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

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function nowInIst(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: IST_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    dayIndex: SHORT_DAYS.indexOf(get("weekday") as (typeof SHORT_DAYS)[number]),
    // Some engines render midnight as "24" under hour12:false.
    minutesOfDay: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

function minutesOfDay(startTime: string) {
  const [h, m] = startTime.split(":").map(Number);
  return h * 60 + m;
}

/** Whole days from now until the next occurrence of this weekly slot. */
export function daysUntilSlot(dayOfWeek: number, startTime: string, now = new Date()) {
  const current = nowInIst(now);
  if (current.dayIndex < 0) return (dayOfWeek + 7) % 7;

  const delta = (dayOfWeek - current.dayIndex + 7) % 7;
  // A slot earlier today has already gone — it's next week's.
  return delta === 0 && minutesOfDay(startTime) <= current.minutesOfDay ? 7 : delta;
}

/** "6:00 PM" — students read clock time, not "18:00". */
export function formatSlotTime(startTime: string) {
  const [h, m] = startTime.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
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
