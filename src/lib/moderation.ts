import "server-only";

import { prisma } from "@/lib/prisma";

const QUEUE_SIZE = 30;

/**
 * Everything the moderation queue renders, in one parallel batch.
 *
 * Lives here because /admin/moderation and /moderator show the same queue to
 * different roles — when reviews were added, the two copies of this query were
 * the thing that fell out of step.
 */
export async function loadModerationQueue() {
  const [questions, comments, reviews] = await Promise.all([
    prisma.question.findMany({
      where: { deleted: false },
      orderBy: { createdAt: "desc" },
      take: QUEUE_SIZE,
      include: { user: { select: { name: true } } },
    }),
    prisma.comment.findMany({
      where: { deleted: false },
      orderBy: { createdAt: "desc" },
      take: QUEUE_SIZE,
      include: { user: { select: { name: true } }, question: { select: { title: true } } },
    }),
    // Reviews are public testimonials on a mentor's profile, so they need the
    // same eyes as questions and comments. Hidden ones are listed too — this
    // is also where a hide gets undone.
    prisma.sessionReview.findMany({
      orderBy: { createdAt: "desc" },
      take: QUEUE_SIZE,
      select: {
        id: true,
        rating: true,
        comment: true,
        published: true,
        createdAt: true,
        mentorId: true,
        author: { select: { name: true } },
        mentor: { select: { user: { select: { name: true } } } },
      },
    }),
  ]);

  return { questions, comments, reviews };
}
