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
 */
export async function listBookableMentors({
  limit,
  ids,
}: { limit?: number; ids?: string[] } = {}): Promise<BookableMentor[]> {
  const profiles = await prisma.mentorProfile.findMany({
    where: { verified: true, ...(ids?.length ? { id: { in: ids } } : {}) },
    include: {
      user: { select: { name: true, image: true } },
      availability: { where: { isBooked: false } },
    },
    orderBy: { createdAt: "desc" },
  });

  const ranked = profiles
    .map((mentor) => ({ mentor, nextSlot: pickNextSlot(mentor.availability) }))
    .sort((a, b) => slotDistance(a.nextSlot) - slotDistance(b.nextSlot));

  return limit ? ranked.slice(0, limit) : ranked;
}
