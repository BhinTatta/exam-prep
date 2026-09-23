import "server-only";

import { prisma } from "@/lib/prisma";
import { daysUntilSlot, formatSlotWhen } from "@/lib/days";
import { isProvenMentor } from "@/lib/mentors/rank";
import type { MentorCardData, MentorSlotView } from "@/components/mentors/mentor-card";

/**
 * How many mentors a listing will ever load in one go.
 *
 * There is no pagination here, deliberately. At the size this runs at — under
 * a hundred verified mentors, and that is the ceiling for the next year — one
 * indexed read of every row plus their open slots is a couple of milliseconds
 * and around sixty kilobytes, and it buys a sort toggle and a day filter that
 * are instant because they never touch the network. Paginating would cost both
 * of those and save nothing yet.
 *
 * The cap is here so that stops being true loudly rather than quietly. If this
 * ever truncates a real listing, that is the signal to move to cursor
 * pagination — which means the "soonest available" ordering has to move into
 * SQL too, and that is a schema change (a stored next-slot column), not a
 * tweak to this file.
 */
const LIST_CAP = 120;

/**
 * Open slots carried per mentor.
 *
 * More than a card shows, because the day filter needs them: a student who
 * filters to Wednesday must see that mentor's *Wednesday* openings on the
 * card, not the three soonest ones — which is how you end up filtering for
 * Wednesday and reading "Today, Friday". The card slices this down to what
 * fits; the filter picks which ones it slices.
 *
 * Capped so a mentor who opens forty slots does not bloat the payload for
 * everyone. Two or three a day for a week is well inside it.
 */
const SLOTS_PER_MENTOR = 21;

/** A mentor as every listing renders them. */
export type MentorListEntry = {
  mentor: MentorCardData;
  /** Open slots, soonest first, already formatted. Empty means booked out. */
  slots: MentorSlotView[];
  /** Every weekday this mentor has an open slot on — what the day filter reads. */
  openDays: number[];
  /** Minutes until the soonest open slot; null when there are none. */
  soonestInMinutes: number | null;
  /** Curated home-page position, null when unpinned. Not rendered on the card. */
  featuredRank: number | null;
};

export type MentorOrder =
  /** Curated first, then the weighted rating. The home page. */
  | "featured"
  /** Weighted rating alone. The default on /mentors. */
  | "rating"
  /** Soonest bookable first. For a student who is about to book. */
  | "soonest";

/**
 * Exactly the columns a card renders.
 *
 * An explicit `select`, not an `include`: a mentor row carries their UPI ID and
 * their proof document, and a listing has no business loading either. The
 * rating and the session count come off the row as stored numbers, so twenty
 * cards still cost two statements — a per-card aggregate would be the textbook
 * N+1 here.
 */
const cardColumns = {
  id: true,
  rate: true,
  institute: true,
  rank: true,
  examCleared: true,
  examYear: true,
  currentRole: true,
  languages: true,
  story: true,
  reviewCount: true,
  ratingSum: true,
  paidSessions: true,
  featuredRank: true,
  user: { select: { name: true, image: true } },
} as const;

/** Minutes from now until the next occurrence of a weekly slot. */
function minutesUntil(slot: { dayOfWeek: number; startTime: string }, now: Date) {
  const [hours, minutes] = slot.startTime.split(":").map(Number);
  return daysUntilSlot(slot.dayOfWeek, slot.startTime, now) * 1440 + hours * 60 + minutes;
}

/**
 * Verified mentors, ordered, with their open slots resolved for rendering.
 *
 * Ordering lives in the database for "featured" and "rating" — both are plain
 * stored columns with an index behind them. "soonest" cannot: a slot is a
 * recurring weekday plus "HH:mm", and which one comes next depends on the
 * current time in IST, which is not something Postgres can sort on without a
 * denormalised column. So that one reads the rating order and re-sorts it here,
 * which is correct as long as the whole set fits under LIST_CAP.
 *
 * Every date calculation happens here, on the server, and what reaches a client
 * component is a formatted string and a number of minutes. That is not just
 * tidiness: `formatSlotWhen` resolves "Tomorrow" against the clock, so running
 * it again during hydration is a rendering mismatch waiting for someone to load
 * the page at 23:59.
 */
export async function listRankedMentors({
  limit,
  order = "rating",
}: { limit?: number; order?: MentorOrder } = {}): Promise<MentorListEntry[]> {
  const profiles = await prisma.mentorProfile.findMany({
    where: { verified: true },
    select: {
      ...cardColumns,
      availability: {
        where: { isBooked: false },
        select: { dayOfWeek: true, startTime: true, duration: true },
      },
    },
    orderBy:
      order === "featured"
        ? [
            // Postgres sorts NULLs last on ASC anyway, but saying so means the
            // ordering does not quietly invert if this ever moves engines:
            // featured mentors first, in the rank the admin chose, then
            // everyone else on merit.
            { featuredRank: { sort: "asc", nulls: "last" } },
            { ratingScore: "desc" },
            { paidSessions: "desc" },
          ]
        : [{ ratingScore: "desc" }, { paidSessions: "desc" }],
    // Always the whole set, never `limit`. Two of the three orderings finish
    // their ranking in this file — "soonest" re-sorts, "featured" filters for
    // proven mentors — so a LIMIT pushed into SQL would hand them the wrong
    // candidates to choose from. Under LIST_CAP rows that pushdown saves
    // nothing anyway; `limit` slices at the end instead.
    take: LIST_CAP,
  });

  const now = new Date();

  const entries = profiles.map(({ availability, featuredRank, ...mentor }): MentorListEntry => {
    const sorted = [...availability].sort((a, b) => minutesUntil(a, now) - minutesUntil(b, now));

    return {
      mentor,
      slots: sorted.slice(0, SLOTS_PER_MENTOR).map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        duration: slot.duration,
        when: formatSlotWhen(slot.dayOfWeek, slot.startTime, now),
      })),
      // Read off every slot, including any past the cap above, so filtering by
      // a day cannot hide a mentor whose only Sunday opening sits at the tail.
      openDays: [...new Set(sorted.map((slot) => slot.dayOfWeek))].sort((a, b) => a - b),
      soonestInMinutes: sorted.length > 0 ? minutesUntil(sorted[0], now) : null,
      featuredRank,
    };
  });

  const ranked =
    order === "soonest"
      ? [...entries].sort(bySoonest)
      : order === "featured"
        ? provenFirst(entries)
        : entries;

  return limit ? ranked.slice(0, limit) : ranked;
}

/**
 * Mentors who have something to show for themselves, then everyone else.
 *
 * The home page fills from the top of this, so in practice the tail is never
 * reached — it exists so that a site with four verified mentors and no reviews
 * yet shows four mentors rather than an empty section. A shop window with
 * nothing in it is worse than one showing someone unproven.
 *
 * Both halves keep the order they arrived in, which is the database's:
 * pinned first, then weighted rating.
 */
function provenFirst(entries: MentorListEntry[]): MentorListEntry[] {
  const isProven = (entry: MentorListEntry) =>
    isProvenMentor({ ...entry.mentor, featuredRank: entry.featuredRank });

  const proven = entries.filter(isProven);
  if (proven.length === 0) return entries;
  return [...proven, ...entries.filter((entry) => !isProven(entry))];
}

/** Bookable first, soonest opening leading; mentors with nothing open sort last. */
export function bySoonest(a: MentorListEntry, b: MentorListEntry) {
  return (a.soonestInMinutes ?? Number.MAX_SAFE_INTEGER) - (b.soonestInMinutes ?? Number.MAX_SAFE_INTEGER);
}
