"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { emailTransport } from "@/lib/notifications/channels/email";
import { renderTestEmail } from "@/lib/notifications/render";
import { drainNotifications } from "@/lib/notifications/dispatch";
import { planMissingNotifications } from "@/lib/notifications/enqueue";

/**
 * These report back rather than throwing.
 *
 * Everything here is a diagnostic, and the answer an admin needs from a failed
 * test send is the provider's actual complaint — "domain not verified", "you can
 * only send to your own address" — not the generic "an error occurred" that a
 * thrown server action shows in production.
 */
export type AdminActionResult = { ok: boolean; message: string };

const testEmailSchema = z.object({
  to: z.string().trim().email("That does not look like an email address"),
});

/**
 * Send one message through the real transport, bypassing the outbox.
 *
 * Bypassing it is the point: this answers "can we send email at all?" — key,
 * domain verification, DNS — and routing it through the queue would only add
 * places for the answer to get stuck.
 */
export async function sendTestEmail(formData: FormData): Promise<AdminActionResult> {
  await requireRole("ADMIN");

  const parsed = testEmailSchema.safeParse({ to: formData.get("to") });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid address" };
  }

  const transport = emailTransport();
  const sentAt = new Date();
  const message = renderTestEmail({
    transport: transport.name,
    from: process.env.EMAIL_FROM ?? "(EMAIL_FROM not set)",
    sentAt,
  });

  try {
    await transport.send(
      { to: parsed.data.to, ...message },
      // Timestamped so pressing the button twice actually sends twice — an
      // idempotency key fixed per address would make the second test a silent
      // no-op, which is the opposite of useful in a diagnostic.
      { idempotencyKey: `test-${parsed.data.to}-${sentAt.getTime()}` }
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Sending failed for an unknown reason",
    };
  }

  return {
    ok: true,
    message:
      transport.name === "console"
        ? "Rendered to the server console — no API key is set, so nothing was actually sent."
        : `Sent to ${parsed.data.to}. If it does not arrive, check spam and Resend's own log.`,
  };
}

/**
 * Run a cron tick by hand.
 *
 * Same code path the scheduler drives, so it is also how you check whether the
 * pinger being down is the problem.
 */
export async function runDrainNow(): Promise<AdminActionResult> {
  await requireRole("ADMIN");

  const queued = await planMissingNotifications();
  const result = await drainNotifications();

  revalidatePath("/admin/notifications");

  const parts = [
    `${result.due} due`,
    `${result.sent} sent`,
    result.skipped > 0 ? `${result.skipped} skipped` : null,
    result.retrying > 0 ? `${result.retrying} will retry` : null,
    result.failed > 0 ? `${result.failed} failed` : null,
    queued > 0 ? `${queued} newly queued` : null,
  ].filter(Boolean);

  return { ok: true, message: parts.join(", ") };
}

/**
 * Hand failed rows back to the drain.
 *
 * FAILED means "nothing will retry this on its own", not "this can never
 * work" — the usual cause is environmental, like a missing API key burning
 * through all five attempts in half an hour. Once the cause is fixed, the mail
 * is still worth sending.
 */
export async function requeueFailedNotifications(): Promise<AdminActionResult> {
  await requireRole("ADMIN");

  const { count } = await prisma.notification.updateMany({
    where: { status: "FAILED" },
    data: { status: "PENDING", attempts: 0, sendAfter: new Date(), lastError: null },
  });

  revalidatePath("/admin/notifications");

  return {
    ok: true,
    message: count === 0 ? "Nothing was failed" : `${count} queued to try again`,
  };
}
