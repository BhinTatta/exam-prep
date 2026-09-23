import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { RatingChip } from "@/components/reviews/rating-summary";
import { MIN_SESSIONS_TO_SHOW } from "@/lib/mentors/rank";
import { BadgeCheck, CalendarClock, CalendarX2, Languages, Users, ArrowRight } from "lucide-react";

/** Openings a card advertises before it defers to the profile page. */
const SLOTS_ON_CARD = 3;

export type MentorCardData = {
  id: string;
  rate: number;
  institute: string;
  rank: string | null;
  examCleared: string;
  examYear: number;
  currentRole: string;
  languages: string[];
  story: string;
  // Read straight off the mentor row. Ratings on a listing must never cost a
  // query per card — see the rollup comment in prisma/schema.prisma.
  reviewCount: number;
  ratingSum: number;
  paidSessions: number;
  user: { name: string | null; image: string | null };
};

/**
 * One open slot, already resolved against the clock on the server. `when` is
 * the rendered string ("Tomorrow, 6:00 PM") rather than the raw time, because
 * this card renders inside a client component on /mentors and re-deriving
 * "tomorrow" during hydration is how you get a mismatch at midnight.
 */
export type MentorSlotView = { dayOfWeek: number; duration: number; when: string };

function firstNameOf(name: string | null) {
  return name?.trim().split(/\s+/)[0] ?? "them";
}

/**
 * The unit that does the actual selling.
 *
 * Deliberate ordering: credential → their own words → practical details →
 * price. A student decides "has this person cleared MY exam and will they get
 * me" long before they weigh ₹400, so price is last and always paired with
 * what it buys.
 *
 * ---------------------------------------------------------------------------
 * Why the link is a separate overlay and not the CTA
 * ---------------------------------------------------------------------------
 * The whole card is one link, so it is a single tab stop with a single
 * accessible name. The obvious way to build that is a `::after` stretched off
 * the CTA — and it does not work here, because `::after` is positioned against
 * the nearest *positioned* ancestor, and any transform on an element makes it
 * a containing block for its own absolute descendants.
 *
 * The CTA is a Button, and `buttonVariants` carries `active:translate-y-px`.
 * So the instant the pointer went down, the anchor gained a transform, its
 * `::after` stopped resolving against the card and collapsed onto the button's
 * own 277x44 box. Mouseup then landed on a plain div, the browser dispatched
 * `click` at the common ancestor instead of the link, and the card did nothing
 * — anywhere outside the button itself. The DOM told the story plainly:
 * `mousedown:A, mouseup:DIV, click:DIV`.
 *
 * The same mechanism, via hover rather than active, is what used to make the
 * cursor flicker: an overlay that moves relative to the card uncovers a strip
 * where the cursor falls through, reverts to an arrow and bounces back.
 *
 * So the link is its own element now, a sibling of the card that covers it,
 * and the CTA is painted rather than interactive. Nothing that transforms owns
 * the hit area any more. Two rules keep it that way:
 *
 *   1. The hover target is the static wrapper; only the card inside it moves.
 *      Lifting the element that carries the `:hover` slides it out from under
 *      the pointer at its own bottom edge and oscillates.
 *   2. Nothing inside the card is interactive. One link, one tab stop.
 */
export function MentorCard({
  mentor,
  slots,
  highlightLabel,
  className,
}: {
  mentor: MentorCardData;
  /**
   * Open slots to advertise, soonest first — the caller has already narrowed
   * these to whatever the student is filtering by, so the card just shows the
   * first few. Omit entirely (the home page does) to leave availability off
   * the card: a page cached for an hour should not print a clock time that a
   * booking can falsify ten minutes later. An empty array means "we looked,
   * there is nothing open" and renders as booked out.
   */
  slots?: MentorSlotView[];
  /** Lifts this card and labels why — use for the top pick, never for all of them. */
  highlightLabel?: string;
  className?: string;
}) {
  const firstName = firstNameOf(mentor.user.name);
  const credential = [mentor.rank, mentor.examCleared, mentor.examYear || null]
    .filter(Boolean)
    .join(" · ");
  const bookedOut = slots?.length === 0;

  return (
    // Static: it catches the hover and anchors nothing that moves.
    // `cursor-pointer` because every pixel of it opens the profile, and
    // `min-w-0` because this is a grid item whose automatic minimum size is
    // its content — and the name and role below are `truncate`, which is
    // `white-space: nowrap`. Without it a mentor called "MSc Mathematical
    // Statistics, Indian Institute of Technology Kharagpur" stretches the
    // grid track to fit their title on one line and pushes the whole page
    // sideways on a phone. Measured: 159px of horizontal overflow at 412px.
    <div className={cn("group relative h-full min-w-0 cursor-pointer", className)}>
      <Card
        className={cn(
          "relative flex h-full flex-col transition-all duration-200",
          "group-hover:-translate-y-0.5 group-hover:shadow-lg",
          "group-focus-within:-translate-y-0.5 group-focus-within:shadow-lg",
          highlightLabel && "shadow-md ring-primary/40 ring-1"
        )}
      >
        {/* Floating pill rather than a full-width banner: a banner adds height
            to this card only, knocking its header out of line with its
            neighbours. Transparent to the pointer so it cannot punch a hole in
            the link covering the card underneath it. */}
        {highlightLabel && (
          <span className="pointer-events-none absolute top-3 right-3 z-10 rounded-full bg-primary px-2.5 py-1 text-[0.625rem] font-semibold tracking-wide text-primary-foreground uppercase shadow-sm">
            {highlightLabel}
          </span>
        )}

        <CardContent className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <Avatar className="size-14 shrink-0 ring-2 ring-background">
              <AvatarImage src={mentor.user.image ?? undefined} alt="" />
              <AvatarFallback className="bg-accent text-base font-semibold text-accent-foreground">
                {(mentor.user.name ?? "M").slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate font-heading text-lg leading-tight font-semibold",
                  highlightLabel && "pr-16"
                )}
              >
                {mentor.user.name}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {mentor.currentRole || mentor.institute}
              </p>
            </div>
          </div>

          {/* The credential strip — the single most load-bearing element on the
              card. Tinted, not muted, because this is the reason to trust them. */}
          {credential && (
            <div className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2">
              <BadgeCheck className="size-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-semibold text-accent-foreground">
                {credential}
              </span>
            </div>
          )}

          {mentor.story && (
            <blockquote className="border-l-2 border-primary/30 pl-3 text-[0.9375rem] leading-relaxed text-pretty italic">
              &ldquo;{mentor.story}&rdquo;
            </blockquote>
          )}

          <div className="mt-auto flex flex-col gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <RatingChip rollup={mentor} />
              {mentor.paidSessions >= MIN_SESSIONS_TO_SHOW && (
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  <span className="tabular-nums">{mentor.paidSessions}</span> sessions booked
                </span>
              )}
              {mentor.languages.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <Languages className="size-3.5" /> {mentor.languages.join(", ")}
                </span>
              )}
            </div>

            {slots && slots.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {slots.slice(0, SLOTS_ON_CARD).map((slot) => (
                  <span
                    key={`${slot.dayOfWeek}-${slot.when}`}
                    className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-foreground"
                  >
                    <CalendarClock className="size-3.5 text-primary" />
                    {slot.when}
                  </span>
                ))}
              </div>
            )}

            {/* Booked out is social proof, not a dead end — it says other
                students got there first, and the card still opens a profile
                where next week's slots are listed. */}
            {bookedOut && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarX2 className="size-3.5" />
                Booked out this week
              </span>
            )}

            <div className="flex items-end justify-between gap-3 border-t pt-3">
              <div>
                <p className="font-heading text-2xl leading-none font-bold tabular-nums">
                  ₹{mentor.rate}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  for a {slots?.[0]?.duration ?? 45}-min 1:1 call
                </p>
              </div>
            </div>

            {/* Painted, not interactive — the real link is the overlay below
                the card. It still reacts to the pointer, through the wrapper,
                so it behaves like the button it looks like. */}
            <span
              aria-hidden="true"
              className={cn(
                buttonVariants({ size: "xl", emphasis: "none" }),
                "w-full justify-between group-active:translate-y-px"
              )}
            >
              {bookedOut ? `See ${firstName}'s slots` : `Talk to ${firstName}`}
              <ArrowRight />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* The card's one link, covering the card rather than hanging off
          something inside it. Last in the DOM so it sits above the content,
          and the only focusable thing here — so the focus ring belongs to it
          and is drawn around the whole card. */}
      <Link
        href={`/mentors/${mentor.id}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="sr-only">
          {bookedOut ? `See ${firstName}'s slots` : `Talk to ${firstName}`}
        </span>
      </Link>
    </div>
  );
}
