import { prisma } from "@/lib/prisma";

const MAX_RECOMMENDATIONS = 3;

/**
 * Ranks verified mentors by overlap with the mentee's weak topics. Falls
 * back to any verified mentor (most recently verified first) when no mentor
 * has been tagged with matching topics yet — keeps recommendations non-empty
 * even before admins start tagging mentor topics.
 */
export async function recommendMentors(weaknesses: string[]) {
  const mentors = await prisma.mentorProfile.findMany({
    where: { verified: true },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });

  const weakSet = new Set(weaknesses.map((w) => w.toLowerCase()));
  const ranked = mentors
    .map((m) => ({
      mentor: m,
      overlap: m.topics.filter((t) => weakSet.has(t.toLowerCase())).length,
    }))
    .sort((a, b) => b.overlap - a.overlap);

  return ranked.slice(0, MAX_RECOMMENDATIONS).map((r) => r.mentor);
}
