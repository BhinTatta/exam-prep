/**
 * How mentors are ordered, in one place.
 *
 * ---------------------------------------------------------------------------
 * Why not ratingSum / reviewCount
 * ---------------------------------------------------------------------------
 * A raw average is the wrong number to sort a listing by. A mentor with one
 * 5-star review beats a mentor with forty-seven at 4.8, so the top of every
 * list fills with whoever has the fewest ratings — which in practice means
 * whoever signed up most recently. That is the exact bug that used to put a
 * brand-new profile at the top of the home page.
 *
 * So we sort on a Bayesian-weighted rating instead: every mentor starts with
 * PRIOR_WEIGHT imaginary reviews at PRIOR_MEAN stars, and their real reviews
 * pull them away from it. One 5-star review moves a mentor from 4.50 to 4.55;
 * it takes genuine volume to reach the top. A mentor with no reviews at all
 * sits on exactly PRIOR_MEAN — never first, never last.
 *
 *     score = (ratingSum + PRIOR_MEAN * PRIOR_WEIGHT) / (reviewCount + PRIOR_WEIGHT)
 *
 * PRIOR_MEAN is a fixed constant, not the live site-wide average. If it moved
 * with the data, every mentor's stored score would be wrong the moment anyone
 * anywhere was reviewed, and the whole table would need rewriting to fix it.
 *
 * The result is stored on MentorProfile.ratingScore so the database can
 * ORDER BY it. It is written by applyRatingDelta() in ./rollup.ts, in the same
 * UPDATE as reviewCount and ratingSum — never separately, or it drifts.
 */

/** Stars a mentor is assumed to be worth before anyone has rated them. */
export const RATING_PRIOR_MEAN = 4.5;

/**
 * How many real reviews it takes to outweigh that assumption.
 *
 * Ten, not five. At five, a single 5-star review scored 4.583 and edged past a
 * mentor with eight reviews averaging 4.6 — which is arithmetically correct
 * and exactly the outcome this whole file exists to prevent. Ten makes one
 * glowing review worth what it actually is: weak evidence.
 */
export const RATING_PRIOR_WEIGHT = 10;

/** The numerator's constant term — kept here so the SQL and the TS agree. */
export const RATING_PRIOR_TOTAL = RATING_PRIOR_MEAN * RATING_PRIOR_WEIGHT;

/**
 * The same formula the database column holds. Used for backfills and tests —
 * request-path code reads the stored column instead of recomputing this.
 */
export function ratingScoreOf(ratingSum: number, reviewCount: number): number {
  return (ratingSum + RATING_PRIOR_TOTAL) / (reviewCount + RATING_PRIOR_WEIGHT);
}

/**
 * Below this, a session count is not social proof — it is an admission.
 * "1 session booked" reads worse than saying nothing at all, so cards and
 * profiles show the number only once a mentor clears this bar.
 */
export const MIN_SESSIONS_TO_SHOW = 3;

/**
 * What a mentor has to have done before the home page will put them up on its
 * own.
 *
 * The weighted rating above stops an unrated mentor from *leading* the page,
 * but it cannot stop them appearing on it: with only three cards, third place
 * is close enough to the prior that one good review can reach it. The home
 * page is the shop window, so it asks for evidence as well as a score —
 * sessions actually taken, or enough ratings to mean something.
 *
 * This is a floor for the home page alone. /mentors lists everyone: a new
 * mentor has to be discoverable somewhere or they can never earn their way up.
 */
export const HOME_MIN_PAID_SESSIONS = 3;
export const HOME_MIN_REVIEWS = 3;

/**
 * Has this mentor earned an unpinned slot on the home page?
 *
 * A pinned mentor always has: that is an admin looking at the profile and
 * deciding, which is better evidence than either threshold.
 */
export function isProvenMentor(mentor: {
  paidSessions: number;
  reviewCount: number;
  featuredRank: number | null;
}): boolean {
  return (
    mentor.featuredRank !== null ||
    mentor.paidSessions >= HOME_MIN_PAID_SESSIONS ||
    mentor.reviewCount >= HOME_MIN_REVIEWS
  );
}
