/**
 * Rating vocabulary, shared by the form, the public testimonials and the OG
 * image so a "4" means the same thing everywhere it is written down.
 */

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_COMMENT_LENGTH = 600;

/** What each star actually claims — shown live while the student picks. */
export const RATING_LABELS: Record<number, string> = {
  1: "Not worth it",
  2: "Below what I expected",
  3: "Useful in parts",
  4: "Genuinely helpful",
  5: "Changed how I'm preparing",
};

/** Placeholder that asks for the one detail a future student needs. */
export const COMMENT_PROMPTS: Record<number, string> = {
  1: "What went wrong? This goes to the mentor and to our moderators.",
  2: "What was missing? Be specific — it's how mentors improve.",
  3: "What helped, and what didn't?",
  4: "What did they help you figure out?",
  5: "What did they tell you that nobody else had?",
};

export type RatingRollup = { reviewCount: number; ratingSum: number };

/** Mean rating to one decimal, or null when nobody has reviewed yet. */
export function averageRating({ reviewCount, ratingSum }: RatingRollup): number | null {
  if (reviewCount <= 0) return null;
  return Math.round((ratingSum / reviewCount) * 10) / 10;
}

/** "4.8" — always one decimal, so a row of ratings stays column-aligned. */
export function formatRating(value: number): string {
  return value.toFixed(1);
}

/**
 * "Ananya S." — testimonials carry a real person's first name and an initial.
 * Full names on a public page are more than a student signed up for; initials
 * alone ("A. S.") read as fabricated.
 */
export function reviewerName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A student";
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}
