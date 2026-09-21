/**
 * Mentor rank display.
 *
 * Mentors type their rank free-hand at application time, so the column holds
 * anything from "12" to "air 12" to "CRL 340". A bare number means nothing to
 * a student scanning cards — "AIR 12" is the terminology they actually use —
 * so every surface that renders a rank runs it through here.
 *
 * The one thing this must never do is relabel a rank that is explicitly NOT an
 * All India Rank. A category rank or a state rank printed as "AIR" is a claim
 * we'd be making on the mentor's behalf, and it's the exact claim the proof
 * document is checked against. Those are left exactly as the mentor wrote them.
 */

/** Rank labels that are already qualified — prefixing "AIR" would be a lie. */
const QUALIFIED_RANK = /^(crl|gate air|category|state|obc|sc|st|ews|gen(eral)?|pwd)\b/i;

/** A leading generic "rank"/"AIR" label, with whatever punctuation follows it. */
const GENERIC_LABEL = /^(air|rank)\b[\s.:#-]*/i;

/**
 * "12" → "AIR 12", "air-12" → "AIR 12", "CRL 340" → "CRL 340", "" → null.
 * Idempotent: feeding it its own output changes nothing.
 */
export function formatAir(rank: string | null | undefined): string | null {
  const value = rank?.trim().replace(/\s+/g, " ");
  if (!value) return null;
  if (QUALIFIED_RANK.test(value)) return value;

  const bare = value.replace(GENERIC_LABEL, "");
  // A label with nothing after it ("AIR", "rank") carries no information, and
  // a lone "AIR" on the credential strip reads like a bug. Drop it instead —
  // every caller already handles a null rank.
  return bare ? `AIR ${bare}` : null;
}
