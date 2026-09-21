import { prisma } from "@/lib/prisma";

const MAX_RECOMMENDATIONS = 3;

/**
 * Picks the mentors recorded against an attempt.
 *
 * Deliberately NOT ranked by topic overlap. Surfacing a mentor as the answer
 * to a specific weak topic implies we know they fixed that same gap for
 * someone — we don't, and a confident wrong match costs more trust than it
 * wins bookings. Until there's real outcome data to rank on, every verified
 * mentor is an equally honest suggestion, newest first.
 */
export async function recommendMentors() {
  return prisma.mentorProfile.findMany({
    where: { verified: true },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_RECOMMENDATIONS,
  });
}
