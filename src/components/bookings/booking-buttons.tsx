"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelBooking, confirmHappened } from "@/app/bookings/actions";
import { ThumbsDown, ThumbsUp } from "lucide-react";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      loading={isPending}
      loadingText="Cancelling…"
      onClick={() =>
        startTransition(async () => {
          try {
            await cancelBooking(bookingId);
            toast.success("Booking cancelled");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't cancel");
          }
        })
      }
    >
      Cancel booking
    </Button>
  );
}

export function ConfirmHappenedButtons({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  // Both buttons share one transition, so track which one was actually clicked
  // — otherwise clicking "No" spins the "Yes" button too.
  const [clicked, setClicked] = useState<"yes" | "no" | null>(null);
  const router = useRouter();

  function run(happened: boolean) {
    setClicked(happened ? "yes" : "no");
    startTransition(async () => {
      try {
        await confirmHappened(bookingId, happened);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update");
      } finally {
        setClicked(null);
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        loading={isPending && clicked === "yes"}
        disabled={isPending}
        onClick={() => run(true)}
        className="gap-1.5"
      >
        <ThumbsUp className="size-4" /> Yes, it happened
      </Button>
      <Button
        size="sm"
        variant="outline"
        loading={isPending && clicked === "no"}
        disabled={isPending}
        onClick={() => run(false)}
        className="gap-1.5"
      >
        <ThumbsDown className="size-4" /> No, it didn&apos;t
      </Button>
    </div>
  );
}
