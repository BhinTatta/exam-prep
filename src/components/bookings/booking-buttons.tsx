"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelBooking, confirmHappened } from "@/app/bookings/actions";

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

/**
 * The dispute path.
 *
 * Its counterpart — "yes, it happened" — no longer exists as a button: rating
 * the session is what confirms it, so a student is asked one question instead
 * of two. This one stays a quiet link rather than a peer of the rating,
 * because it opens an admin review and a refund decision, and it asks before
 * it fires.
 */
export function DidNotHappenButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function report() {
    startTransition(async () => {
      try {
        await confirmHappened(bookingId, false);
        setOpen(false);
        toast.success("Reported — an admin will look into it");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="link" size="sm" className="self-start px-0 text-muted-foreground">
          This session didn&apos;t happen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Report that this session didn&apos;t happen?</AlertDialogTitle>
          <AlertDialogDescription>
            An admin reviews it and refunds you in full if the mentor missed the call. Only do this
            if the call genuinely didn&apos;t take place — a session that went badly is feedback, not
            a dispute.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Never mind</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" loading={isPending} loadingText="Reporting…" onClick={report}>
              Yes, report it
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
