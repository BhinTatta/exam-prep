import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SLOT_HOLDING_STATUSES } from "@/lib/payments/sync";
import {
  BOOKING_HORIZON_DAYS,
  openOccurrences,
  type BusyInterval,
  type Occurrence,
  type SlotRule,
} from "@/lib/slots";

/** The rule columns src/lib/slots.ts needs. */
export const slotRuleColumns = {
  id: true,
  days: true,
  startTime: true,
  endTime: true,
  duration: true,
} as const satisfies Prisma.AvailabilitySelect;

/** Longest session we allow; how far back a booking can start and still overlap now. */
const LONGEST_SESSION_MS = 3 * 60 * 60_000;

/**
 * Live bookings per mentor that fall inside the booking horizon: the time
 * their rules cannot offer again.
 *
 * Bookings from before scheduledStartAt existed have no fixed time; they are
 * all long past, so ignoring them is safe.
 */
export async function busyIntervalsByMentor(
  mentorIds: string[],
  now = new Date(),
  db: Prisma.TransactionClient = prisma
): Promise<Map<string, BusyInterval[]>> {
  const bookings = await db.booking.findMany({
    where: {
      mentorId: { in: mentorIds },
      status: { in: SLOT_HOLDING_STATUSES },
      scheduledStartAt: {
        gte: new Date(now.getTime() - LONGEST_SESSION_MS),
        lte: new Date(now.getTime() + (BOOKING_HORIZON_DAYS + 1) * 86_400_000),
      },
    },
    select: { mentorId: true, scheduledStartAt: true, durationMinutes: true, slot: { select: { duration: true } } },
  });

  const byMentor = new Map<string, BusyInterval[]>();
  for (const b of bookings) {
    if (!b.scheduledStartAt) continue;
    const list = byMentor.get(b.mentorId) ?? [];
    list.push({ startsAt: b.scheduledStartAt, durationMinutes: b.durationMinutes ?? b.slot.duration });
    byMentor.set(b.mentorId, list);
  }
  return byMentor;
}

/** One mentor's bookable sessions, soonest first. */
export async function openSlotsForMentor(
  mentorId: string,
  rules: SlotRule[],
  now = new Date()
): Promise<Occurrence[]> {
  if (rules.length === 0) return [];
  const busy = await busyIntervalsByMentor([mentorId], now);
  return openOccurrences(rules, busy.get(mentorId) ?? [], now);
}
