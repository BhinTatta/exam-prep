import { prisma } from "@/lib/prisma";
import { daysUntilSlot, pickNextSlot } from "@/lib/days";
import type { MentorCardData, MentorCardSlot } from "@/components/mentors/mentor-card";

export type BookableMentor = { mentor: MentorCardData; nextSlot: MentorCardSlot };

/** Mentors with no open slot sort last. */
function slotDistance(slot: MentorCardSlot) {
  return slot ? daysUntilSlot(slot.dayOfWeek, slot.startTime) : Number.MAX_SAFE_INTEGER;
}

/**
 * Verified mentors with their soonest open slot, soonest first.
 *
 * Sorting happens before `limit` so a short list is genuinely the soonest
 * bookable mentors, not the newest few re-ordered among themselves. An open
 * slot tomorrow converts better than a better-looking profile with nothing
 * free for nine days.
 *
 * Two things about the query. It is an explicit `select`, not an `include`:
 * a mentor row carries their UPI ID and proof document, and a listing has no
 * business loading either. And the rating comes from the rollup columns on the
 * row itself, so rendering N cards with N ratings is still two statements — a
 * per-card `aggregate` would be the textbook N+1 here.
 */
export async function listBookableMentors({
  limit,
  ids,
}: { limit?: number; ids?: string[] } = {}): Promise<BookableMentor[]> {
  const profiles = await prisma.mentorProfile.findMany({
    where: { verified: true, ...(ids?.length ? { id: { in: ids } } : {}) },
    select: {
      id: true,
      rate: true,
      institute: true,
      rank: true,
      examCleared: true,
      examYear: true,
      currentRole: true,
      languages: true,
      story: true,
      reviewCount: true,
      ratingSum: true,
      user: { select: { name: true, image: true } },
      availability: {
        where: { isBooked: false },
        select: { dayOfWeek: true, startTime: true, duration: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const ranked = profiles
    .map(({ availability, ...mentor }) => ({ mentor, nextSlot: pickNextSlot(availability) }))
    .sort((a, b) => slotDistance(a.nextSlot) - slotDistance(b.nextSlot));

  return limit ? ranked.slice(0, limit) : ranked;
}
