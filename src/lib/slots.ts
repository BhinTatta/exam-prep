import { DAYS, IST_OFFSET_MS, formatSlotTime, istParts, minutesOfDay } from "@/lib/days";

/**
 * Recurring availability, expanded into bookable sessions.
 *
 * A mentor sets *rules*: "every day at 7 PM", "weekends, 6 to 9 PM". A rule
 * is an `Availability` row and is never consumed. Booking claims one dated
 * occurrence of it ("Sat 29 Nov, 6:30 PM"), and that occurrence is busy
 * because a live Booking sits on that time, not because a flag on the rule
 * flipped. So a rule keeps producing sessions every week without the mentor
 * touching it again, and a cancelled or expired booking frees its time just
 * by changing status.
 *
 * Occurrences are computed, never stored: the rules plus the mentor's live
 * bookings decide everything. Pure functions, so the same code runs for the
 * listing, the profile and the booking action's server-side check.
 */

/** How far ahead students can book. */
export const BOOKING_HORIZON_DAYS = 14;

/** Minimum notice: a session starting sooner than this is not offered. */
export const MIN_NOTICE_MINUTES = 60;

/** Session lengths a mentor can offer. */
export const SESSION_LENGTHS = [30, 45, 60] as const;

export type SlotRule = {
  id: string;
  /** Weekdays it repeats on, 0 = Sunday. */
  days: number[];
  /** "HH:mm" IST: the session start, or the start of the range. */
  startTime: string;
  /** "HH:mm" IST. null means one session at startTime; set means sessions back to back until here. */
  endTime: string | null;
  /** Minutes per session. */
  duration: number;
};

export type Occurrence = {
  ruleId: string;
  startsAt: Date;
  dayOfWeek: number;
  /** "HH:mm" IST of this particular session. */
  startTime: string;
  duration: number;
};

/** A time already taken by a live booking. */
export type BusyInterval = { startsAt: Date; durationMinutes: number };

const DAY_MS = 86_400_000;

function toHHmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Session start times, in minutes of the IST day, that one rule produces on a day it runs. */
export function sessionStartsOf(rule: Pick<SlotRule, "startTime" | "endTime" | "duration">): number[] {
  const start = minutesOfDay(rule.startTime);
  if (!rule.endTime) return [start];
  const end = minutesOfDay(rule.endTime);
  const starts: number[] = [];
  for (let t = start; t + rule.duration <= end; t += rule.duration) starts.push(t);
  return starts;
}

/** Every session a rule produces from now to the booking horizon, minimum notice applied. */
export function expandRule(rule: SlotRule, now = new Date()): Occurrence[] {
  const today = istParts(now);
  const istMidnight = Date.UTC(today.year, today.month - 1, today.day);
  const earliest = now.getTime() + MIN_NOTICE_MINUTES * 60_000;
  const starts = sessionStartsOf(rule);
  const out: Occurrence[] = [];

  for (let d = 0; d < BOOKING_HORIZON_DAYS; d++) {
    const dayOfWeek = (today.dayIndex + d) % 7;
    if (!rule.days.includes(dayOfWeek)) continue;
    for (const minutes of starts) {
      // The wall-clock reading is IST, so the real instant is 5:30 earlier.
      const startsAt = new Date(istMidnight + d * DAY_MS + minutes * 60_000 - IST_OFFSET_MS);
      if (startsAt.getTime() < earliest) continue;
      out.push({ ruleId: rule.id, startsAt, dayOfWeek, startTime: toHHmm(minutes), duration: rule.duration });
    }
  }
  return out;
}

function overlaps(a: { startsAt: Date; minutes: number }, b: { startsAt: Date; minutes: number }) {
  const aStart = a.startsAt.getTime();
  const bStart = b.startsAt.getTime();
  return aStart < bStart + b.minutes * 60_000 && bStart < aStart + a.minutes * 60_000;
}

/** True when `occurrence` collides with any live booking. */
export function isBusy(occurrence: Occurrence, busy: BusyInterval[]) {
  return busy.some((b) =>
    overlaps(
      { startsAt: occurrence.startsAt, minutes: occurrence.duration },
      { startsAt: b.startsAt, minutes: b.durationMinutes }
    )
  );
}

/**
 * Every bookable session across a mentor's rules, soonest first.
 *
 * Two rules can produce the same start ("every day at 7 PM" alongside
 * "6 to 9 PM"); that time is offered once. Sessions that only partly overlap
 * are both offered, and booking either one takes the other off the list,
 * because the booking is busy time for both.
 */
export function openOccurrences(rules: SlotRule[], busy: BusyInterval[], now = new Date()): Occurrence[] {
  const seen = new Set<number>();
  return rules
    .flatMap((rule) => expandRule(rule, now))
    .filter((o) => !isBusy(o, busy))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .filter((o) => {
      const key = o.startsAt.getTime();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Whole IST calendar days from `now` to `at`: 0 = today, 1 = tomorrow. */
function istDaysBetween(now: Date, at: Date) {
  const a = istParts(now);
  const b = istParts(at);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

const SHORT_DATE = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "Today", "Tomorrow", "Wednesday", then "Wed, 3 Dec" past the coming week. */
export function formatOccurrenceDay(at: Date, now = new Date()) {
  const days = istDaysBetween(now, at);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return DAYS[istParts(at).dayIndex];
  return SHORT_DATE.format(at);
}

/** "Tomorrow, 6:00 PM". */
export function formatOccurrence(occurrence: Occurrence, now = new Date()) {
  return `${formatOccurrenceDay(occurrence.startsAt, now)}, ${formatSlotTime(occurrence.startTime)}`;
}

/** "Every day", "Weekdays", "Weekends", or "Mon, Wed, Fri". */
export function describeDays(days: number[]) {
  const set = [...new Set(days)].sort((a, b) => a - b);
  if (set.length === 7) return "Every day";
  if (set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.join() === "0,6") return "Weekends";
  // Monday-first reads naturally; Sunday goes last.
  return [...set.filter((d) => d !== 0), ...set.filter((d) => d === 0)]
    .map((d) => DAYS[d].slice(0, 3))
    .join(", ");
}

/** "Every day · 7:00 PM · 30 min" or "Weekends · 6:00–9:00 PM · 6 × 30 min". */
export function describeRule(rule: Pick<SlotRule, "days" | "startTime" | "endTime" | "duration">) {
  const days = describeDays(rule.days);
  if (!rule.endTime) return `${days} · ${formatSlotTime(rule.startTime)} · ${rule.duration} min`;
  const count = sessionStartsOf(rule).length;
  return `${days} · ${formatSlotTime(rule.startTime)}–${formatSlotTime(rule.endTime)} · ${count} × ${rule.duration} min`;
}
