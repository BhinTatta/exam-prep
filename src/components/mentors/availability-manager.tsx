"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Repeat, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { minutesOfDay } from "@/lib/days";
import { BOOKING_HORIZON_DAYS, SESSION_LENGTHS, describeRule, sessionStartsOf } from "@/lib/slots";
import { addAvailability, removeAvailability } from "@/app/mentors/actions";

type Rule = { id: string; days: number[]; startTime: string; endTime: string | null; duration: number };

/** Monday first: how people read a week. Values are still 0 = Sunday. */
const WEEK = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 0, label: "Sun" },
];

const PRESETS = [
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
];

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d));

/**
 * Recurring availability: pick the days, then either one session time or a
 * range that is split into back-to-back sessions. A rule repeats every week
 * on its own; nothing here is ever "used up" by a booking.
 */
export function AvailabilityManager({ rules }: { rules: Rule[] }) {
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [mode, setMode] = useState<"single" | "range">("single");
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");
  const [duration, setDuration] = useState<number>(SESSION_LENGTHS[0]);

  const draft = { days, startTime, endTime: mode === "range" ? endTime : null, duration };
  const problem =
    days.length === 0
      ? "Pick at least one day."
      : !startTime || (mode === "range" && !endTime)
        ? "Pick a time."
        : mode === "range" && minutesOfDay(endTime) - minutesOfDay(startTime) < duration
          ? "The range needs room for at least one session."
          : mode === "range" && sessionStartsOf(draft).length > 16
            ? "That's more than 16 sessions a day. Try a shorter range."
            : null;

  function toggleDay(day: number) {
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  }

  function onAdd(formData: FormData) {
    if (problem) return;
    startTransition(async () => {
      try {
        await addAvailability(formData);
        toast.success("Added. It repeats every week.");
      } catch {
        toast.error("Couldn't add that. Check the times and try again.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6">
        <form action={onAdd} className="flex flex-col gap-5">
          {days.map((d) => (
            <input key={d} type="hidden" name="days" value={d} />
          ))}
          <input type="hidden" name="duration" value={duration} />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Repeats on</legend>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Chip key={preset.label} active={sameDays(days, preset.days)} onClick={() => setDays(preset.days)}>
                  {preset.label}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WEEK.map(({ day, label }) => (
                <Chip key={day} small active={days.includes(day)} onClick={() => toggleDay(day)}>
                  {label}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium">When</legend>
            <div className="flex flex-wrap gap-2">
              <Chip active={mode === "single"} onClick={() => setMode("single")}>
                One session
              </Chip>
              <Chip active={mode === "range"} onClick={() => setMode("range")}>
                A time range
              </Chip>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="startTime">{mode === "range" ? "From" : "At"}</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-32"
                  required
                />
              </div>
              {mode === "range" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="endTime">Until</Label>
                  <Input
                    id="endTime"
                    name="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-32"
                    required
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Indian Standard Time.</p>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Session length</legend>
            <div className="flex flex-wrap gap-2">
              {SESSION_LENGTHS.map((len) => (
                <Chip key={len} active={duration === len} onClick={() => setDuration(len)}>
                  {len} min
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={cn("text-sm", problem ? "text-destructive" : "text-foreground")}>
              {problem ?? describeRule(draft)}
            </p>
            <Button type="submit" disabled={isPending || !!problem} loading={isPending} loadingText="Adding…">
              Add availability
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-1 border-t pt-4">
          <p className="mb-1 text-sm font-medium">Your weekly availability</p>
          {rules.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nothing yet. Students can&apos;t book you until you add some.</p>
          ) : (
            <>
              <div className="flex flex-col divide-y">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-2 text-sm">
                      <Repeat className="size-3.5 shrink-0 text-primary" />
                      {describeRule(rule)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={isPending}
                      onClick={() => startTransition(() => removeAvailability(rule.id))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Students can book up to {BOOKING_HORIZON_DAYS} days ahead. Removing a rule doesn&apos;t
                cancel sessions already booked from it.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Chip({
  active,
  small,
  onClick,
  children,
}: {
  active: boolean;
  small?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cursor-pointer rounded-full border font-medium transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        small ? "min-w-11 px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
