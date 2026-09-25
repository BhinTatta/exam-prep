/**
 * When a booking's video call may be joined.
 *
 * Not "server-only": the client component that renders the button needs the
 * same rule, and having two copies of it is how they drift apart.
 */

/**
 * Early enough to settle in, not early enough to sit in an empty room.
 *
 * Deliberately equal to the lead time on SESSION_REMINDER_30M (see
 * LEAD_TIMES in src/lib/notifications/enqueue.ts): that email carries a "join
 * the call" button, so if the door opened any later the email would be handing
 * people a link the page says is not ready. Change one and change the other.
 */
export const JOIN_OPENS_BEFORE_MS = 30 * 60 * 1000;

/** Generous: sessions run over, and a stale link is worse than a late one. */
export const JOIN_CLOSES_AFTER_MS = 60 * 60 * 1000;

const DEFAULT_DURATION_MINUTES = 30;

export type MeetingWindow =
  /** No known session time — a booking made before scheduledStartAt existed. */
  | { state: "UNSCHEDULED" }
  | { state: "TOO_EARLY"; opensAt: Date; startsAt: Date }
  | { state: "OPEN"; closesAt: Date }
  | { state: "CLOSED"; endedAt: Date };

/**
 * A Jitsi room is only as private as its URL, and these URLs are derived from
 * the booking id, so they never change. Handing one over at confirmation time
 * means anybody who saw it once can walk back into that room weeks later —
 * which is why the link is gated on time rather than only on booking status.
 *
 * Old bookings resolve to UNSCHEDULED and keep working exactly as before: a
 * tightened rule should not strand a session somebody already paid for.
 */
export function meetingWindow(booking: {
  scheduledStartAt: Date | null;
  durationMinutes: number | null;
  now?: Date;
}): MeetingWindow {
  const { scheduledStartAt, durationMinutes } = booking;
  if (!scheduledStartAt) return { state: "UNSCHEDULED" };

  const now = (booking.now ?? new Date()).getTime();
  const startsAt = scheduledStartAt.getTime();
  const endsAt = startsAt + (durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000;

  const opensAt = startsAt - JOIN_OPENS_BEFORE_MS;
  const closesAt = endsAt + JOIN_CLOSES_AFTER_MS;

  if (now < opensAt) {
    return { state: "TOO_EARLY", opensAt: new Date(opensAt), startsAt: new Date(startsAt) };
  }
  if (now > closesAt) return { state: "CLOSED", endedAt: new Date(endsAt) };
  return { state: "OPEN", closesAt: new Date(closesAt) };
}
