export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Availability is stored as a recurring weekday + "HH:mm" with no timezone —
 * mentors enter local Indian time, so "next Thursday" has to be resolved
 * against IST and not whatever timezone the server happens to run in.
 */
const IST_TIME_ZONE = "Asia/Kolkata";

/** IST is a fixed UTC+05:30 and has never observed DST. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Where `now` falls on the Indian calendar and clock. */
function istParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    dayIndex: SHORT_DAYS.indexOf(get("weekday") as (typeof SHORT_DAYS)[number]),
    // Some engines render midnight as "24" even under hourCycle h23.
    minutesOfDay: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

function minutesOfDay(startTime: string) {
  const [h, m] = startTime.split(":").map(Number);
  return h * 60 + m;
}

/** Whole days from now until the next occurrence of this weekly slot. */
export function daysUntilSlot(dayOfWeek: number, startTime: string, now = new Date()) {
  const current = istParts(now);
  if (current.dayIndex < 0) return (dayOfWeek + 7) % 7;

  const delta = (dayOfWeek - current.dayIndex + 7) % 7;
  // A slot earlier today has already gone — it's next week's.
  return delta === 0 && minutesOfDay(startTime) <= current.minutesOfDay ? 7 : delta;
}

/**
 * Pin a recurring weekly slot to the one absolute instant it next falls on.
 *
 * This is the bridge between how mentors think about availability ("Thursdays
 * at 6") and what everything downstream needs (a UTC timestamp it can compare
 * against `now()`): reminders, the meeting-link window, and the completion
 * sweep all key off the result. Resolve it ONCE, when the booking is created,
 * and store it — re-resolving later would silently roll the booking forward to
 * next week the moment its session passed.
 */
export function resolveSlotOccurrence(
  dayOfWeek: number,
  startTime: string,
  now = new Date()
): Date {
  const current = istParts(now);
  const [hours, minutes] = startTime.split(":").map(Number);

  // Date.UTC as a pure calendar calculator: adding the day delta here rolls
  // month and year boundaries correctly without dragging a timezone in.
  const istMidnight = Date.UTC(current.year, current.month - 1, current.day);
  const target = new Date(istMidnight + daysUntilSlot(dayOfWeek, startTime, now) * 86_400_000);

  const istWallClock = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
    hours,
    minutes
  );
  // That wall-clock reading is Indian local time, so the real instant is 5:30 earlier.
  return new Date(istWallClock - IST_OFFSET_MS);
}

/** "6:00 PM" — students read clock time, not "18:00". */
export function formatSlotTime(startTime: string) {
  const [h, m] = startTime.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * "Thu, 1 Oct, 2026, 6:00 pm IST" — for email and anywhere else the reader is
 * not looking at the site and cannot infer the week from context.
 */
export function formatIstDateTime(at: Date) {
  return `${new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(at)} IST`;
}

/** "Tomorrow, 6:00 PM" — concrete beats "Monday 18:00" for urgency. */
export function formatSlotWhen(dayOfWeek: number, startTime: string, now = new Date()) {
  const days = daysUntilSlot(dayOfWeek, startTime, now);
  const day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : DAYS[dayOfWeek];
  return `${day}, ${formatSlotTime(startTime)}`;
}

/** The soonest of a mentor's open slots, or null if they have none. */
export function pickNextSlot<T extends { dayOfWeek: number; startTime: string }>(
  slots: T[],
  now = new Date()
): T | null {
  return (
    slots
      .map((slot) => ({
        slot,
        distance: daysUntilSlot(slot.dayOfWeek, slot.startTime, now) * 1440 + minutesOfDay(slot.startTime),
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.slot ?? null
  );
}
