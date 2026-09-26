import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** The Prisma client, or a transaction — callers may want either. */
type Db = PrismaClient | Prisma.TransactionClient;

const LEAD_TIMES = [
  { event: "SESSION_REMINDER_24H", leadMs: 24 * 60 * 60 * 1000 },
  // Deliberately earlier than the call opens (5 minutes before the start for a
  // mentee, 10 for a mentor — see src/lib/bookings/meeting.ts). This email is a
  // "go and open the page" nudge, not a way in: it carries no room link, so the
  // two numbers no longer have to agree, and the reminder can arrive early
  // enough to be useful to somebody who has lost track of the time.
  { event: "SESSION_REMINDER_30M", leadMs: 30 * 60 * 1000 },
] as const;

/** How long after a session ends before asking the mentee how it went. */
const FEEDBACK_DELAY_MS = 30 * 60 * 1000;

/** Fallback length for a booking made before durationMinutes was snapshotted. */
const DEFAULT_DURATION_MINUTES = 30;

export type PlannableBooking = {
  id: string;
  menteeId: string;
  scheduledStartAt: Date | null;
  durationMinutes: number | null;
  mentor: { userId: string };
};

type PlannedRow = Prisma.NotificationCreateManyInput;

/**
 * What a confirmed booking is owed, as rows.
 *
 * Pure and total: same booking in, same rows out, no I/O and nothing that can
 * throw. Everything about *when* a message goes is expressed as `sendAfter`,
 * which is why scheduling needs no scheduler of its own — a T-30m reminder is
 * simply a row nobody may send yet.
 */
export function planBookingEmails(booking: PlannableBooking, now = new Date()): PlannedRow[] {
  // A booking from before scheduledStartAt existed has no knowable session
  // time, so there is nothing to schedule against.
  if (!booking.scheduledStartAt) return [];

  const startsAt = booking.scheduledStartAt.getTime();
  const bothSides = [booking.menteeId, booking.mentor.userId];
  const rows: Omit<PlannedRow, "channel" | "bookingId">[] = [];

  for (const userId of bothSides) {
    rows.push({ event: "BOOKING_CONFIRMED", userId, sendAfter: now });
  }

  for (const { event, leadMs } of LEAD_TIMES) {
    const sendAfter = new Date(startsAt - leadMs);
    // Skip a reminder whose moment has already gone. Confirming a booking an
    // hour before it starts must not fire a "tomorrow" reminder immediately —
    // the confirmation email already says when it is.
    if (sendAfter <= now) continue;
    for (const userId of bothSides) rows.push({ event, userId, sendAfter });
  }

  // Feedback goes to the mentee alone: they are the one who can review, and
  // asking a mentor to rate their own session makes no sense.
  const endsAt = startsAt + (booking.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000;
  rows.push({
    event: "SESSION_FEEDBACK",
    userId: booking.menteeId,
    sendAfter: new Date(endsAt + FEEDBACK_DELAY_MS),
  });

  // Deduplicate defensively. The unique index would absorb a repeat anyway,
  // but a caller should not depend on that to avoid sending twice.
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const key = `${row.event}:${row.userId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((row) => ({ ...row, channel: "EMAIL" as const, bookingId: booking.id }));
}

/**
 * Queue everything a confirmed booking is owed. Safe to call repeatedly.
 *
 * Idempotent by way of the unique index plus `skipDuplicates`, so the three
 * deliveries of one Razorpay webhook queue one set of emails rather than three.
 * That also means this is convergent rather than event-driven: it can be called
 * from any code path that confirms a booking, in any order, as many times as
 * you like, and the outbox ends up in the same state.
 *
 * Returns the number of rows actually created.
 */
export async function planBookingNotifications(
  bookingId: string,
  db: Db = prisma
): Promise<number> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      menteeId: true,
      scheduledStartAt: true,
      durationMinutes: true,
      mentor: { select: { userId: true } },
    },
  });

  // Only a confirmed booking is worth telling anyone about.
  if (!booking || booking.status !== "CONFIRMED") return 0;

  const rows = planBookingEmails(booking);
  if (rows.length === 0) return 0;

  const created = await db.notification.createMany({ data: rows, skipDuplicates: true });
  return created.count;
}

/**
 * Catch confirmed sessions that never got queued.
 *
 * The outbox is meant to be authoritative — every confirmed booking with a
 * session still ahead of it has its notifications — and this is what enforces
 * that, rather than trusting each call site to remember. It covers a confirm
 * that raced a database blip, an admin confirming a booking through some future
 * path, and the bookings that were already confirmed when this shipped.
 *
 * Deliberately limited to sessions that have not started yet, so turning this
 * on does not mail everybody about sessions they sat through weeks ago.
 */
export async function planMissingNotifications(limit = 50): Promise<number> {
  const stranded = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      scheduledStartAt: { gt: new Date() },
      notifications: { none: {} },
    },
    select: { id: true },
    orderBy: { scheduledStartAt: "asc" },
    take: limit,
  });

  let queued = 0;
  for (const booking of stranded) {
    queued += await planBookingNotifications(booking.id);
  }
  return queued;
}
