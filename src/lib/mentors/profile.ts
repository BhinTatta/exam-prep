import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** Testimonials shown inline on a profile before it links out to the rest. */
export const REVIEWS_ON_PROFILE = 4;

/** One page of the full reviews list. */
export const REVIEWS_PER_PAGE = 20;

const reviewCard = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  author: { select: { name: true, image: true } },
} as const;

/**
 * Everything the mentor page renders, in one round trip.
 *
 * Wrapped in React's `cache` because this page reads the mentor twice per
 * request — once in `generateMetadata` and once in the component — and without
 * it that is two identical queries on every view.
 *
 * The testimonial slice is part of the same query rather than a follow-up:
 * Prisma resolves an `include` of a to-many relation as a single extra
 * statement for the whole page, and the `(mentorId, published, createdAt DESC)`
 * index means `take` reads exactly four rows, not the mentor's whole history.
 * Only reviews carrying words are pulled in — a bare star has nothing to show
 * and is already counted in the rollup below it.
 */
export const getMentorProfile = cache(async (id: string) => {
  return prisma.mentorProfile.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, image: true } },
      availability: { where: { isBooked: false } },
      reviews: {
        where: { published: true, NOT: { comment: null } },
        orderBy: { createdAt: "desc" },
        take: REVIEWS_ON_PROFILE,
        select: reviewCard,
      },
    },
  });
});

export type MentorProfileWithReviews = NonNullable<Awaited<ReturnType<typeof getMentorProfile>>>;
export type ReviewCard = MentorProfileWithReviews["reviews"][number];

/** One page of a mentor's published reviews, newest first. */
export async function listMentorReviews(mentorId: string, page: number) {
  return prisma.sessionReview.findMany({
    where: { mentorId, published: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * REVIEWS_PER_PAGE,
    take: REVIEWS_PER_PAGE,
    select: reviewCard,
  });
}
