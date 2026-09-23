"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth-helpers";
import { applyRatingDelta } from "@/lib/mentors/rollup";
import { MAX_COMMENT_LENGTH, MAX_RATING, MIN_RATING } from "@/lib/reviews";

/**
 * Session feedback.
 *
 * Every write in here moves two things at once: the review row and the
 * mentor's rating rollup (reviewCount / ratingSum / ratingScore). The rollup
 * always moves through applyRatingDelta() in lib/mentors/rollup.ts, in the
 * same transaction as the review itself — one atomic UPDATE, so two students
 * rating the same mentor in the same second cannot lose each other's stars the
 * way a read-then-write average would, and the weighted score can never drift
 * from the counts it is derived from. This file is the only place those three
 * columns are ever touched.
 */

const reviewSchema = z.object({
  bookingId: z.string().min(1).max(64),
  rating: z.coerce.number().int().min(MIN_RATING).max(MAX_RATING),
  comment: z.string().trim().max(MAX_COMMENT_LENGTH).optional(),
});

export type ReviewInput = z.input<typeof reviewSchema>;

/**
 * Create or update the mentee's review of one session.
 *
 * Rating a session is also how a mentee confirms it happened: a student who
 * has just told us their mentor was worth five stars should not then be asked
 * "did this happen?". A CONFIRMED booking therefore moves to COMPLETED here.
 * The "it didn't happen" path stays separate (confirmHappened in
 * app/bookings/actions.ts) because that one is a dispute, not feedback.
 */
export async function submitReview(input: ReviewInput) {
  const user = await requireUser();
  const { bookingId, rating, comment } = reviewSchema.parse(input);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      menteeId: true,
      mentorId: true,
      status: true,
      review: { select: { id: true, rating: true, published: true } },
    },
  });

  if (!booking) throw new Error("We couldn't find that session");
  if (booking.menteeId !== user.id) throw new Error("Only the student who took this session can review it");
  if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
    throw new Error("You can only review a session that has been paid for and taken");
  }

  const body = comment && comment.length > 0 ? comment : null;
  const existing = booking.review;

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.sessionReview.update({
        where: { id: existing.id },
        data: { rating, comment: body },
      });
      // A hidden review is out of the rollup, so editing it must not add the
      // delta back in — it re-enters only if a moderator restores it.
      if (existing.published && rating !== existing.rating) {
        await applyRatingDelta(tx, booking.mentorId, {
          countDelta: 0,
          sumDelta: rating - existing.rating,
        });
      }
    } else {
      await tx.sessionReview.create({
        data: {
          bookingId: booking.id,
          mentorId: booking.mentorId,
          authorId: user.id,
          rating,
          comment: body,
        },
      });
      await applyRatingDelta(tx, booking.mentorId, { countDelta: 1, sumDelta: rating });
    }

    if (booking.status === "CONFIRMED") {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "COMPLETED", menteeConfirmedHappened: true },
      });
    }
  });

  revalidatePath(`/bookings/${booking.id}`);
  revalidatePath("/bookings");
  revalidatePath(`/mentors/${booking.mentorId}`);
  revalidatePath(`/mentors/${booking.mentorId}/reviews`);
  revalidatePath("/mentors");
  revalidatePath("/mentor/dashboard");
}

/**
 * Moderator switch for a published review. Hiding pulls it out of the rollup
 * and every public surface; the row stays so the author still sees their own
 * words and a restore is lossless.
 */
export async function setReviewVisibility(reviewId: string, published: boolean) {
  const moderator = await requireRole("MODERATOR");

  const review = await prisma.sessionReview.findUnique({
    where: { id: reviewId },
    select: { id: true, mentorId: true, rating: true, published: true },
  });
  if (!review) throw new Error("We couldn't find that review");
  if (review.published === published) return;

  const sign = published ? 1 : -1;
  await prisma.$transaction([
    prisma.sessionReview.update({
      where: { id: review.id },
      data: {
        published,
        hiddenAt: published ? null : new Date(),
        hiddenBy: published ? null : moderator.id,
      },
    }),
    applyRatingDelta(prisma, review.mentorId, {
      countDelta: sign,
      sumDelta: sign * review.rating,
    }),
  ]);

  revalidatePath("/admin/moderation");
  revalidatePath(`/mentors/${review.mentorId}`);
  revalidatePath(`/mentors/${review.mentorId}/reviews`);
  revalidatePath("/mentors");
  revalidatePath("/mentor/dashboard");
}
