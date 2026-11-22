import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { bookSlot } from "@/app/mentors/actions";

export type SlotChip = {
  ruleId: string;
  /** The session's start, ISO, which bookSlot re-checks server-side. */
  startsAtIso: string;
  /** "6:30 PM" */
  time: string;
  duration: number;
};

export type SlotDay = {
  key: string;
  /** "Today", "Tomorrow", "Wednesday", "Wed, 3 Dec" */
  heading: string;
  /** "22 Nov"; empty when the heading already carries the date. */
  date: string;
  slots: SlotChip[];
};

/** Days shown before "Show more days". */
const DAYS_VISIBLE = 4;

/**
 * A mentor's bookable sessions, grouped by day, one tap to book.
 *
 * Grouped rather than one card per session because a single "6 to 9 PM every
 * day" rule is ~80 sessions over the booking window: as a list that is a wall,
 * as chips under each day it is a calendar. Everything is formatted on the
 * server; this renders strings.
 */
export function SlotPicker({
  mentorId,
  days,
  price,
  mode,
  showDuration,
}: {
  mentorId: string;
  days: SlotDay[];
  price: number;
  /** "book" for a signed-in student, "sign-in" for a visitor, "preview" for the mentor themselves. */
  mode: "book" | "sign-in" | "preview";
  /** Label each chip with its length, when a mentor offers more than one. */
  showDuration: boolean;
}) {
  const visible = days.slice(0, DAYS_VISIBLE);
  const more = days.slice(DAYS_VISIBLE);
  const soonestIso = days[0]?.slots[0]?.startsAtIso;

  const renderDay = (day: SlotDay) => (
    <div key={day.key} className="flex flex-col gap-2">
      <p className="text-sm">
        <span className="font-semibold">{day.heading}</span>
        {day.date && <span className="text-muted-foreground"> · {day.date}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {day.slots.map((slot) => {
          const soonest = slot.startsAtIso === soonestIso;
          const label = showDuration ? `${slot.time} · ${slot.duration} min` : slot.time;
          const title = `${day.heading} ${slot.time}, ${slot.duration} minutes, ₹${price}`;

          if (mode === "preview") {
            return (
              <span
                key={slot.startsAtIso}
                className="rounded-full border px-3.5 py-1.5 text-sm text-muted-foreground"
              >
                {label}
              </span>
            );
          }
          if (mode === "sign-in") {
            return (
              <Button key={slot.startsAtIso} asChild variant={soonest ? "default" : "outline"} className="rounded-full">
                <Link href={`/sign-in?callbackUrl=/mentors/${mentorId}`} title={title}>
                  {label}
                </Link>
              </Button>
            );
          }
          return (
            <form key={slot.startsAtIso} action={bookSlot.bind(null, mentorId, slot.ruleId, slot.startsAtIso)}>
              <SubmitButton
                variant={soonest ? "default" : "outline"}
                className="rounded-full"
                loadingText="Holding…"
                title={`Book ${title}`}
              >
                {label}
              </SubmitButton>
            </form>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {visible.map(renderDay)}
      {more.length > 0 && (
        <details className="group flex flex-col gap-5">
          <summary className="cursor-pointer list-none text-sm font-medium text-primary underline-offset-4 hover:underline group-open:hidden">
            Show {more.length} more {more.length === 1 ? "day" : "days"}
          </summary>
          <div className="flex flex-col gap-5">{more.map(renderDay)}</div>
        </details>
      )}
    </div>
  );
}
