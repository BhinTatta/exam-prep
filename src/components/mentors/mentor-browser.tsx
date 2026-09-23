"use client";

import { useMemo, useState } from "react";
import { MentorCard } from "@/components/mentors/mentor-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { CalendarX2, Star, Zap } from "lucide-react";
import type { MentorListEntry } from "@/lib/mentors/list";

/**
 * The sort toggle and day filter on /mentors.
 *
 * All of this runs on data the page already sent. The server loads every
 * verified mentor once, with their slots resolved and formatted, so switching
 * the sort or picking a day is a re-render and not a round trip — no database
 * query, no spinner, nothing to wait for. That is the whole reason the sort is
 * state in here rather than a `?sort=` search param: a search param would make
 * every click on a toggle re-run the page and re-query Postgres to reorder a
 * list the browser is already holding.
 *
 * It also means there is no date arithmetic in this file. Every slot arrives
 * pre-rendered ("Tomorrow, 6:00 PM") with the minutes-until already computed
 * server-side, so nothing here depends on the visitor's clock.
 */

type SortKey = "rating" | "soonest";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * How far down the list the "don't show a wall of booked-out mentors" rule
 * applies, and how many of those cards must be bookable.
 *
 * Fully-booked mentors near the top are useful — they read as demand. A whole
 * opening screen of them reads as a broken marketplace, and a student concludes
 * that whoever is left is whoever nobody wanted. So the first screen is
 * guaranteed to contain mentors they can actually book, and the rest of the
 * list stays in strict rating order.
 */
const INTERLEAVE_WINDOW = 6;
const MIN_BOOKABLE_IN_WINDOW = 3;

const isBookable = (entry: MentorListEntry) => entry.soonestInMinutes !== null;

/**
 * Reorder so the first INTERLEAVE_WINDOW cards hold at least
 * MIN_BOOKABLE_IN_WINDOW bookable mentors, disturbing the given order as
 * little as possible: a bookable mentor is pulled forward only on the
 * positions where leaving them out would break the guarantee.
 */
function guaranteeBookableAbove(entries: MentorListEntry[]): MentorListEntry[] {
  const bookable = entries.filter(isBookable);
  const bookedOut = entries.filter((entry) => !isBookable(entry));
  if (bookable.length === 0 || bookedOut.length === 0) return entries;

  const rank = new Map(entries.map((entry, index) => [entry.mentor.id, index]));
  const ordered: MentorListEntry[] = [];
  let nextBookable = 0;
  let nextBookedOut = 0;
  let placedBookable = 0;

  for (let position = 0; position < entries.length; position++) {
    const slotsLeftInWindow = INTERLEAVE_WINDOW - position;
    const stillNeeded = MIN_BOOKABLE_IN_WINDOW - placedBookable;
    const mustTakeBookable =
      position < INTERLEAVE_WINDOW && stillNeeded >= slotsLeftInWindow && nextBookable < bookable.length;

    const takeBookable =
      mustTakeBookable ||
      nextBookedOut >= bookedOut.length ||
      (nextBookable < bookable.length &&
        rank.get(bookable[nextBookable].mentor.id)! < rank.get(bookedOut[nextBookedOut].mentor.id)!);

    if (takeBookable) {
      ordered.push(bookable[nextBookable++]);
      placedBookable++;
    } else {
      ordered.push(bookedOut[nextBookedOut++]);
    }
  }

  return ordered;
}

export function MentorBrowser({ mentors }: { mentors: MentorListEntry[] }) {
  const [sort, setSort] = useState<SortKey>("rating");
  const [day, setDay] = useState<number | null>(null);

  // Only offer days somebody is actually free on — a filter chip that can only
  // ever return nothing is a worse answer than not asking the question.
  const availableDays = useMemo(() => {
    const days = new Set<number>();
    for (const entry of mentors) for (const openDay of entry.openDays) days.add(openDay);
    return [...days].sort((a, b) => a - b);
  }, [mentors]);

  const visible = useMemo(() => {
    const filtered = day === null ? mentors : mentors.filter((entry) => entry.openDays.includes(day));

    if (sort === "soonest") {
      // Booked-out mentors sort last here by construction, and that is the
      // point of this view — no interleaving.
      return [...filtered].sort(
        (a, b) =>
          (a.soonestInMinutes ?? Number.MAX_SAFE_INTEGER) -
          (b.soonestInMinutes ?? Number.MAX_SAFE_INTEGER)
      );
    }

    // `mentors` already arrives in weighted-rating order from the database.
    return guaranteeBookableAbove(filtered);
  }, [mentors, sort, day]);

  return (
    <div className="mt-10 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SortChip active={sort === "rating"} icon={Star} onClick={() => setSort("rating")}>
            Highest rated
          </SortChip>
          <SortChip active={sort === "soonest"} icon={Zap} onClick={() => setSort("soonest")}>
            Soonest available
          </SortChip>
        </div>

        {availableDays.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Free on
            </p>
            {/* Scrolls rather than wraps on a phone: eight chips wrapping to
                three rows pushes the first card below the fold. */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              <DayChip active={day === null} onClick={() => setDay(null)}>
                Any day
              </DayChip>
              {availableDays.map((openDay) => (
                <DayChip key={openDay} active={day === openDay} onClick={() => setDay(openDay)}>
                  {DAY_LABELS[openDay]}
                </DayChip>
              ))}
            </div>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="Nobody's free that day"
          description="Try another day, or clear the filter to see every mentor."
          action={
            <Button variant="outline" onClick={() => setDay(null)}>
              Show every mentor
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((entry, i) => (
            <MentorCard
              key={entry.mentor.id}
              mentor={entry.mentor}
              // With a day picked, show that day's openings and nothing else.
              // Showing the three soonest instead is how a student filters to
              // Wednesday and reads "Today, Friday" on every card.
              slots={
                day === null
                  ? entry.slots
                  : entry.slots.filter((slot) => slot.dayOfWeek === day)
              }
              highlightLabel={highlightFor(entry, i, sort)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The pill on the leading card, and only when it is true of that card: "top
 * rated" over a mentor nobody has rated is the kind of small lie that costs
 * more trust than the pill wins attention.
 */
function highlightFor(entry: MentorListEntry, index: number, sort: SortKey) {
  if (index !== 0) return undefined;
  if (sort === "soonest") return isBookable(entry) ? "Soonest" : undefined;
  return entry.mentor.reviewCount > 0 ? "Top rated" : undefined;
}

function SortChip({
  active,
  icon: Icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: typeof Star;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("size-4", active && "fill-current")} />
      {children}
    </button>
  );
}

function DayChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
