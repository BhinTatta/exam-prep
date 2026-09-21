import { prisma } from "@/lib/prisma";
import { daysUntilSlot, pickNextSlot } from "@/lib/days";
import type { MentorCardData, MentorCardSlot } from "@/components/mentors/mentor-card";

export type BookableMentor = { mentor: MentorCardData; nextSlot: MentorCardSlot };

/** Mentors with no open slot sort last. */
function slotDistance(slot: MentorCardSlot) {
  return slot ? daysUntilSlot(slot.dayOfWeek, slot.startTime) : Number.MAX_SAFE_INTEGER;
}

/** Pinned mentors first, in the admin's order; unpinned keep their own order. */
function pinDistance(displayOrder: number | null) {
  return displayOrder ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Verified mentors with their soonest open slot, soonest first.
 *
 * Sorting happens before `limit` so a short list is genuinely the soonest
 * bookable mentors, not the newest few re-ordered among themselves. An open
 * slot tomorrow converts better than a better-looking profile with nothing
 * free for nine days.
 *
 * Above that sits the admin's pin order (`displayOrder`, set in
 * /admin/mentors). A pinned mentor holds their position whatever their
 * availability looks like — that's the whole point of pinning — and everyone
 * else falls in behind them on the soonest-slot rule.
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
      displayOrder: true,
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

  // `displayOrder` rides along on the mentor object purely as a sort key; the
  // card never reads it, and stripping it would cost another pass over the list.
  const ranked = profiles
    .map(({ availability, ...mentor }) => ({ mentor, nextSlot: pickNextSlot(availability) }))
    .sort(
      (a, b) =>
        pinDistance(a.mentor.displayOrder) - pinDistance(b.mentor.displayOrder) ||
        slotDistance(a.nextSlot) - slotDistance(b.nextSlot)
    );

  return limit ? ranked.slice(0, limit) : ranked;
}
