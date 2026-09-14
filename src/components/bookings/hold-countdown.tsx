"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Counts down the payment hold so the mentee knows how long the slot is theirs.
 * When it reaches zero it refreshes the page, which runs the server-side sweep
 * and moves the booking to EXPIRED.
 */
export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const deadline = new Date(expiresAt).getTime();
  // Starts null so the server and the first client render agree — seeding this
  // from the clock would differ between the two and trip a hydration mismatch.
  const [remaining, setRemaining] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    function tick() {
      const next = deadline - Date.now();
      setRemaining(next);
      return next;
    }
    tick();
    const id = setInterval(() => {
      if (tick() <= 0) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, router]);

  // Reserve the line's height on the first paint so nothing jumps.
  if (remaining === null) {
    return <p className="text-center text-sm text-muted-foreground">&nbsp;</p>;
  }

  if (remaining <= 0) {
    return <p className="text-center text-sm text-muted-foreground">This hold has expired.</p>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <p className="text-center text-sm text-muted-foreground">
      Slot held for{" "}
      <span className="font-mono font-medium tabular-nums text-foreground">
        {minutes}:{String(seconds).padStart(2, "0")}
      </span>
    </p>
  );
}
