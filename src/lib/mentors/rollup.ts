import "server-only";

import { Prisma } from "@prisma/client";
import { RATING_PRIOR_TOTAL, RATING_PRIOR_WEIGHT } from "@/lib/mentors/rank";

/**
 * The counters on MentorProfile that no page is allowed to compute for itself.
 *
 * Everything here is raw SQL for one reason: these columns must move
 * atomically, in a single statement, without a read-modify-write. Two students
 * rating the same mentor in the same second would otherwise lose each other's
 * stars. Prisma's `increment` gives us that for a plain counter, but
 * `ratingScore` is a function of the other two columns, and Prisma has no way
 * to express "set this column from the new values of those columns". In SQL it
 * is free: inside one UPDATE, a column reference on the right-hand side is
 * always the OLD value, so the deltas can be applied to all three at once and
 * the three can never disagree.
 */

type RatingDelta = {
  /** +1 when a review enters the rollup, -1 when one is hidden, 0 on an edit. */
  countDelta: number;
  /** Stars entering or leaving the rollup (for an edit: new - old). */
  sumDelta: number;
};

/** Anything that can run a statement: the client, or a transaction handle. */
type Executor = Pick<Prisma.TransactionClient, "$executeRaw">;

/**
 * Move a mentor's review rollup and their weighted rating together.
 *
 * Returns a promise, so it composes with both transaction styles: `await` it
 * inside an interactive `$transaction(async (tx) => ...)`, or drop the
 * un-awaited call into a `$transaction([...])` array.
 */
export function applyRatingDelta(
  db: Executor,
  mentorId: string,
  { countDelta, sumDelta }: RatingDelta
) {
  return db.$executeRaw`
    UPDATE "MentorProfile"
    SET "reviewCount" = "reviewCount" + ${countDelta},
        "ratingSum"   = "ratingSum"   + ${sumDelta},
        "ratingScore" =
          ("ratingSum" + ${sumDelta} + ${RATING_PRIOR_TOTAL}::double precision)
          / ("reviewCount" + ${countDelta} + ${RATING_PRIOR_WEIGHT}::double precision)
    WHERE "id" = ${mentorId}
  `;
}

/**
 * Count one more paid session against a mentor.
 *
 * Called once, where a booking is confirmed by a captured payment. That
 * transition is guarded by a status filter, so a webhook Razorpay delivers
 * three times still moves the booking once and so increments this once.
 */
export function incrementPaidSessions(db: Executor, mentorId: string) {
  return db.$executeRaw`
    UPDATE "MentorProfile"
    SET "paidSessions" = "paidSessions" + 1
    WHERE "id" = ${mentorId}
  `;
}

/**
 * Take a fully-refunded session back off the count.
 *
 * Floored at zero: a counter that a bookkeeping edge case can drive negative
 * would render as "-1 sessions" on a public profile, and no refund sequence is
 * worth that.
 */
export function decrementPaidSessions(db: Executor, mentorId: string) {
  return db.$executeRaw`
    UPDATE "MentorProfile"
    SET "paidSessions" = GREATEST(0, "paidSessions" - 1)
    WHERE "id" = ${mentorId}
  `;
}
