import "server-only";

import type { MeetingAttendance, MeetingParticipantRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { MeetingRole } from "@/lib/bookings/meeting";

/**
 * Recording who turned up.
 *
 * The write happens on the one path that can hand out a room URL, so there is
 * no separate "tell us you joined" call for a client to forget to make or to
 * fake. See prisma/schema.prisma (MeetingAttendance) for what the row means.
 */

/** The window's roles and the column's enum are the same set; keep them in step. */
export function participantRole(role: MeetingRole): MeetingParticipantRole {
  return role;
}

/**
 * Note that this person has just been let into the call.
 *
 * Never throws: a failed insert must not stop somebody joining a session they
 * have paid for. Analytics has no veto over the product working.
 */
export async function recordJoin(params: {
  bookingId: string;
  userId: string;
  role: MeetingRole;
  moderator: boolean;
  scheduledStartAt: Date | null;
  now?: Date;
}): Promise<void> {
  const { bookingId, userId, role, moderator, scheduledStartAt } = params;
  const now = params.now ?? new Date();

  // Negative before the start, positive after it. Null when the booking has no
  // known start time, rather than a zero that would read as "dead on time".
  const joinedOffsetSeconds = scheduledStartAt
    ? Math.round((now.getTime() - scheduledStartAt.getTime()) / 1000)
    : null;

  try {
    await prisma.meetingAttendance.upsert({
      where: { bookingId_userId: { bookingId, userId } },
      create: {
        bookingId,
        userId,
        role: participantRole(role),
        moderator,
        firstJoinedAt: now,
        lastJoinedAt: now,
        joinedOffsetSeconds,
      },
      // A rejoin is the same person arriving again, so the first arrival, its
      // offset and the role they arrived as are all left exactly as they were.
      update: {
        lastJoinedAt: now,
        joins: { increment: 1 },
        // Except this: a mentor who arrives second on public Jitsi is not the
        // moderator, and a later rejoin into an empty room makes them one.
        moderator: moderator ? true : undefined,
      },
    });
  } catch (error) {
    console.error("attendance: could not record a join", { bookingId, userId, role, error });
  }
}

export type AttendanceSummary = {
  mentee: MeetingAttendance | null;
  mentor: MeetingAttendance | null;
  /** The only version of "this session happened" that nobody had to tell us. */
  bothSidesJoined: boolean;
};

/** Read a booking's rows as the two sides that matter. Admin visits are noise here. */
export function summarizeAttendance(rows: MeetingAttendance[]): AttendanceSummary {
  const mentee = rows.find((r) => r.role === "MENTEE") ?? null;
  const mentor = rows.find((r) => r.role === "MENTOR") ?? null;
  return { mentee, mentor, bothSidesJoined: Boolean(mentee && mentor) };
}
