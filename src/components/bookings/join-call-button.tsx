"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatIstDateTime } from "@/lib/days";
import { meetingWindow, type MeetingWindow } from "@/lib/bookings/meeting";

/**
 * The join button, and the wait before it.
 *
 * Client-side because the interesting moment is one that arrives while somebody
 * is already looking at the page: a mentee who opens their session at 5:40 for a
 * 6:00 call should watch the button unlock at 5:45, not have to guess that a
 * refresh might help.
 */
export function JoinCallButton({
  meetLink,
  scheduledStartAt,
  durationMinutes,
}: {
  meetLink: string | null;
  /** ISO string — a Date cannot cross the server/client boundary as one. */
  scheduledStartAt: string | null;
  durationMinutes: number | null;
}) {
  // Everything clock-derived is computed in the interval below and held here,
  // never read during render: a component that calls Date.now() while rendering
  // produces a different answer on every re-render. Starting null also keeps the
  // server render and the first client render identical, which is what avoids a
  // hydration mismatch.
  const [view, setView] = useState<{ window: MeetingWindow; msUntilOpen: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const startsAt = scheduledStartAt ? new Date(scheduledStartAt) : null;

    function tick() {
      const now = new Date();
      const next = meetingWindow({ scheduledStartAt: startsAt, durationMinutes, now });
      const msUntilOpen =
        next.state === "TOO_EARLY" ? next.opensAt.getTime() - now.getTime() : 0;

      setView((previous) => {
        // Crossing into OPEN is worth a server round trip: the page's own
        // status and review sections are rendered from data that has just
        // become stale.
        if (previous?.window.state === "TOO_EARLY" && next.state === "OPEN") {
          router.refresh();
        }
        return { window: next, msUntilOpen };
      });
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledStartAt, durationMinutes, router]);

  // Reserve the button's height on the first paint so nothing jumps.
  if (!view) {
    return <Button className="w-full" disabled aria-hidden />;
  }

  const { window, msUntilOpen } = view;

  if (window.state === "CLOSED") {
    return (
      <p className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
        This session has ended. The video call is closed.
      </p>
    );
  }

  if (window.state === "TOO_EARLY") {
    // Within the hour, a ticking countdown beats a date they have to read.
    const soon = msUntilOpen < 60 * 60 * 1000;

    return (
      <div className="flex flex-col gap-2">
        <Button className="w-full gap-1.5" disabled>
          <Video className="size-4" /> Join video call
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {soon ? (
            <>
              Opens in{" "}
              <span className="font-mono font-medium tabular-nums text-foreground">
                {formatCountdown(msUntilOpen)}
              </span>
            </>
          ) : (
            <>
              Opens 30 minutes before your session — {formatIstDateTime(window.startsAt)}
            </>
          )}
        </p>
      </div>
    );
  }

  // OPEN, or UNSCHEDULED (a booking that predates scheduled times — it keeps
  // the old always-available behaviour rather than becoming unjoinable).
  return (
    <a href={meetLink ?? "#"} target="_blank" rel="noopener noreferrer">
      <Button className="w-full gap-1.5">
        <Video className="size-4" /> Join video call
      </Button>
    </a>
  );
}

/** "14:02", or "1:09:53" once it is over an hour out. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
