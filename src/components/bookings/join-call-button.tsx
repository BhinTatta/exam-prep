"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatIstDateTime } from "@/lib/days";
import {
  joinOpensBeforeMs,
  meetingWindow,
  type MeetingRole,
  type MeetingWindow,
} from "@/lib/bookings/meeting";

/**
 * The join button, and the wait before it.
 *
 * Client-side because the interesting moment is one that arrives while somebody
 * is already looking at the page: a mentee who opens their session at 2:50 for a
 * 3:00 call should watch the button appear at 2:55, not have to guess that a
 * refresh might help.
 *
 * Before then there is no button — not a disabled one, no button. A greyed-out
 * "Join video call" an hour ahead of time reads as something being broken, and
 * the honest thing to show is the one fact they want: when it opens. The
 * address is not here either; it lives behind /bookings/[id]/join, which
 * re-checks the clock server-side and is what actually enforces any of this.
 */
export function JoinCallButton({
  bookingId,
  role,
  scheduledStartAt,
  durationMinutes,
}: {
  bookingId: string;
  role: MeetingRole;
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
      const next = meetingWindow({ scheduledStartAt: startsAt, durationMinutes, role, now });
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
  }, [scheduledStartAt, durationMinutes, role, router]);

  // Nothing on the first paint: the alternative is a button that exists for one
  // frame and then vanishes, which is worse than a line of text arriving.
  if (!view) return null;

  const { window, msUntilOpen } = view;

  if (window.state === "CLOSED") {
    return (
      <p className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
        This session has ended. The video call is closed.
      </p>
    );
  }

  if (window.state === "TOO_EARLY") {
    const opensMinutes = Math.round(joinOpensBeforeMs(role) / 60_000);
    // Within the hour, a ticking countdown beats a date they have to read.
    const soon = msUntilOpen < 60 * 60 * 1000;

    return (
      <div className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
        {soon ? (
          <>
            The video call opens in{" "}
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatCountdown(msUntilOpen)}
            </span>
          </>
        ) : (
          <>
            The video call opens {opensMinutes} minutes before your session —{" "}
            <span className="font-medium text-foreground">
              {formatIstDateTime(window.startsAt)}
            </span>
          </>
        )}
        {role === "MENTOR" && (
          <span className="mt-1 block text-xs">
            You get in first, and that is deliberate — whoever opens the room runs it.
          </span>
        )}
      </div>
    );
  }

  // OPEN, or UNSCHEDULED (a booking that predates scheduled times — it keeps
  // the old always-available behaviour rather than becoming unjoinable).
  //
  // A plain link, not a fetch: the route answers with a redirect to the room,
  // and letting the browser follow it means the room opens in the new tab the
  // click already created.
  return (
    <a href={`/bookings/${bookingId}/join`} target="_blank" rel="noopener noreferrer">
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
