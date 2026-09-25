import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { drainNotifications } from "@/lib/notifications/dispatch";
import { planMissingNotifications } from "@/lib/notifications/enqueue";
import { expireStaleHolds } from "@/lib/payments/sync";

/**
 * The clock this application does not otherwise have.
 *
 * Serverless has no scheduler, so something outside has to knock: an external
 * pinger every few minutes (cron-job.org), with Vercel's own daily cron as a
 * safety net. Vercel's Hobby plan runs cron jobs once per day at most and fires
 * them anywhere within the scheduled hour, which is why the frequent caller is
 * external — and why nothing here may depend on being called punctually.
 *
 * Everything this endpoint does is therefore window-based and idempotent: it
 * asks "what is due?" rather than "what is due exactly now?", and marks each row
 * as it goes. A tick that arrives four minutes late, twice, or not at all
 * changes nothing except when the mail goes out. That property is what makes a
 * free, best-effort pinger good enough, and it is worth preserving — do not add
 * work here that assumes an exact firing time.
 *
 * Swapping the caller is a configuration change, not a code change: point any
 * scheduler that can send a header at this URL.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Refuse rather than run unauthenticated: an open drain endpoint lets anyone
  // burn the day's email quota.
  if (!secret) return false;

  const offered = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function tick(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Queue anything a confirmed booking is owed but never got — see
  // planMissingNotifications for why the outbox is repaired here rather than
  // trusted to every call site.
  const queued = await planMissingNotifications();

  const drained = await drainNotifications();

  // Free slots whose payment window lapsed. This used to happen only when
  // somebody happened to load a page that reads availability; on a tick it
  // happens whether or not anyone is browsing. The lazy calls stay as a
  // fallback for when this endpoint is not wired up yet.
  const released = await expireStaleHolds();

  return NextResponse.json({ ok: true, queued, released, ...drained });
}

/** Vercel Cron issues GET. */
export async function GET(request: Request) {
  return tick(request);
}

/** External pingers default to POST. */
export async function POST(request: Request) {
  return tick(request);
}
