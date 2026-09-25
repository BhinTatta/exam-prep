import "server-only";

import type { BookingStatus, NotificationEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";
import { emailTransport } from "./channels/email";
import { renderEmail, type RenderContext } from "./render";

/** Give up after this many tries and leave the row FAILED for inspection. */
const MAX_ATTEMPTS = 5;

/**
 * Rows per tick. Small on purpose: a cron tick should finish well inside a
 * serverless function's budget, and whatever is left over is simply picked up
 * by the next one a few minutes later.
 */
const DEFAULT_BATCH = 25;

/** Which booking states each event still makes sense in. */
const RELEVANT_STATUSES: Record<NotificationEvent, BookingStatus[]> = {
  BOOKING_CONFIRMED: ["CONFIRMED"],
  SESSION_REMINDER_24H: ["CONFIRMED"],
  SESSION_REMINDER_30M: ["CONFIRMED"],
  // By feedback time the mentee may already have confirmed it happened, which
  // moves the booking to COMPLETED.
  SESSION_FEEDBACK: ["CONFIRMED", "COMPLETED"],
};

const REMINDER_EVENTS: NotificationEvent[] = ["SESSION_REMINDER_24H", "SESSION_REMINDER_30M"];

export type DrainResult = {
  due: number;
  sent: number;
  skipped: number;
  retrying: number;
  failed: number;
};

/** 2, 4, 8, 16 minutes. */
function backoffMs(attempts: number): number {
  return 2 ** attempts * 60_000;
}

/**
 * Send whatever is due.
 *
 * Nothing in here is allowed to throw: one malformed row, one missing address,
 * one provider outage must not stop the rest of the batch, and the endpoint
 * above this has nothing useful to do with an exception anyway.
 */
export async function drainNotifications(limit = DEFAULT_BATCH): Promise<DrainResult> {
  const now = new Date();
  const result: DrainResult = { due: 0, sent: 0, skipped: 0, retrying: 0, failed: 0 };

  const due = await prisma.notification.findMany({
    where: { status: "PENDING", sendAfter: { lte: now } },
    orderBy: { sendAfter: "asc" },
    take: limit,
    select: { id: true, attempts: true },
  });
  result.due = due.length;

  const transport = emailTransport();

  for (const candidate of due) {
    // Claim the row by bumping `attempts` conditionally. Two overlapping ticks
    // both read this row; only one of them wins the update, and the loser
    // moves on rather than sending a second copy.
    const claimed = await prisma.notification.updateMany({
      where: { id: candidate.id, status: "PENDING", attempts: candidate.attempts },
      data: { attempts: candidate.attempts + 1 },
    });
    if (claimed.count === 0) continue;

    const attempts = candidate.attempts + 1;

    try {
      const outcome = await deliver(candidate.id, transport, now);
      if (outcome.kind === "sent") result.sent += 1;
      else result.skipped += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const giveUp = attempts >= MAX_ATTEMPTS;

      await prisma.notification.update({
        where: { id: candidate.id },
        data: giveUp
          ? { status: "FAILED", lastError: message }
          : { status: "PENDING", lastError: message, sendAfter: new Date(Date.now() + backoffMs(attempts)) },
      });

      if (giveUp) {
        result.failed += 1;
        console.error("notifications: giving up", { id: candidate.id, attempts, message });
      } else {
        result.retrying += 1;
        console.warn("notifications: will retry", { id: candidate.id, attempts, message });
      }
    }
  }

  return result;
}

type DeliveryOutcome = { kind: "sent" } | { kind: "skipped"; reason: string };

/**
 * Render and send one claimed row.
 *
 * Throws on anything worth retrying (a provider error), and returns `skipped`
 * for anything that will never become sendable — a cancelled booking, a
 * recipient with no email address, a reminder whose session has already begun.
 * Retrying those forever would just be noise in the table.
 */
async function deliver(
  id: string,
  transport: ReturnType<typeof emailTransport>,
  now: Date
): Promise<DeliveryOutcome> {
  const row = await prisma.notification.findUnique({
    where: { id },
    select: {
      id: true,
      event: true,
      userId: true,
      user: { select: { name: true, email: true } },
      booking: {
        select: {
          id: true,
          status: true,
          amount: true,
          meetLink: true,
          scheduledStartAt: true,
          durationMinutes: true,
          menteeId: true,
          mentee: { select: { name: true } },
          mentor: { select: { userId: true, user: { select: { name: true } } } },
        },
      },
    },
  });

  const skip = async (reason: string): Promise<DeliveryOutcome> => {
    await prisma.notification.update({
      where: { id },
      data: { status: "SKIPPED", lastError: reason },
    });
    return { kind: "skipped", reason };
  };

  if (!row) return { kind: "skipped", reason: "row vanished" };
  const { booking } = row;

  if (!booking) return skip("booking no longer exists");
  if (!booking.scheduledStartAt) return skip("booking has no scheduled start time");

  if (!RELEVANT_STATUSES[row.event].includes(booking.status)) {
    // The commonest path here is a booking cancelled or refunded after its
    // reminders were queued. Telling someone their cancelled session starts in
    // 30 minutes would be worse than telling them nothing.
    return skip(`booking is ${booking.status}`);
  }

  // A tick that was down for hours must not deliver "starts in 30 minutes"
  // about a session that started this morning.
  if (REMINDER_EVENTS.includes(row.event) && booking.scheduledStartAt <= now) {
    return skip("session already started");
  }

  const to = row.user.email;
  if (!to) {
    // Expected, not exceptional: Telegram sign-in gives us no email address.
    // This is the row that will make the case for the Telegram channel.
    return skip("recipient has no email address");
  }

  const audience = row.userId === booking.menteeId ? "MENTEE" : "MENTOR";
  const context: RenderContext = {
    event: row.event,
    audience,
    recipientName: row.user.name,
    counterpartName:
      (audience === "MENTEE" ? booking.mentor.user.name : booking.mentee.name) ?? "your session partner",
    startsAt: booking.scheduledStartAt,
    durationMinutes: booking.durationMinutes ?? 30,
    meetLink: booking.meetLink,
    bookingUrl: `${siteConfig.url}/bookings/${booking.id}`,
    amount: booking.amount,
  };

  const message = renderEmail(context);
  await transport.send({ to, ...message }, { idempotencyKey: row.id });

  await prisma.notification.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), lastError: null },
  });
  return { kind: "sent" };
}
