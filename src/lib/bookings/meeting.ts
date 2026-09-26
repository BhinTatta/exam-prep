/**
 * When a booking's video call may be joined, and by whom.
 *
 * Not "server-only": the client component that renders the button needs the
 * same rule, and having two copies of it is how they drift apart.
 */

/** Who is looking at the session — the two parties, plus admins for support. */
export type MeetingRole = "MENTEE" | "MENTOR" | "ADMIN";

/**
 * Late enough that the room is never sitting open for an hour, early enough to
 * sort out a camera before the clock starts.
 *
 * The mentor's door opens first, and that gap is load-bearing rather than a
 * courtesy: on public Jitsi the first person into a room becomes its moderator
 * (see src/lib/bookings/jitsi.ts), so the mentor arriving first is what makes
 * the mentor the moderator. JaaS, where moderation is granted by signed token,
 * does not depend on it — the head start is then just a head start.
 *
 * Admins share the mentor's door so support can look in on a call in progress.
 * They are never granted moderator rights.
 */
const OPENS_BEFORE_MS: Record<MeetingRole, number> = {
  MENTEE: 5 * 60 * 1000,
  MENTOR: 10 * 60 * 1000,
  ADMIN: 10 * 60 * 1000,
};

/** Quotable in copy — emails have to tell people the same number the page enforces. */
export const MENTEE_JOIN_OPENS_BEFORE_MINUTES = OPENS_BEFORE_MS.MENTEE / 60_000;
export const MENTOR_JOIN_OPENS_BEFORE_MINUTES = OPENS_BEFORE_MS.MENTOR / 60_000;

export function joinOpensBeforeMs(role: MeetingRole): number {
  return OPENS_BEFORE_MS[role];
}

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
 * This is the one rule, and both sides of the gate consult it: the button in
 * src/components/bookings/join-call-button.tsx decides what to render, and
 * src/app/bookings/[id]/join/route.ts refuses to mint a room URL outside the
 * window. The button is a courtesy; the route is the gate. A hidden button is
 * not access control — somebody who knows the path can type it.
 *
 * Old bookings resolve to UNSCHEDULED and keep working exactly as before: a
 * tightened rule should not strand a session somebody already paid for.
 */
export function meetingWindow(booking: {
  scheduledStartAt: Date | null;
  durationMinutes: number | null;
  role: MeetingRole;
  now?: Date;
}): MeetingWindow {
  const { scheduledStartAt, durationMinutes, role } = booking;
  if (!scheduledStartAt) return { state: "UNSCHEDULED" };

  const now = (booking.now ?? new Date()).getTime();
  const startsAt = scheduledStartAt.getTime();
  const endsAt = startsAt + (durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000;

  const opensAt = startsAt - OPENS_BEFORE_MS[role];
  const closesAt = endsAt + JOIN_CLOSES_AFTER_MS;

  if (now < opensAt) {
    return { state: "TOO_EARLY", opensAt: new Date(opensAt), startsAt: new Date(startsAt) };
  }
  if (now > closesAt) return { state: "CLOSED", endedAt: new Date(endsAt) };
  return { state: "OPEN", closesAt: new Date(closesAt) };
}

/** Whether a room URL may be handed to this person right now. */
export function canJoinNow(window: MeetingWindow): boolean {
  return window.state === "OPEN" || window.state === "UNSCHEDULED";
}
