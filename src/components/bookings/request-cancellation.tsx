"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestCancellation } from "@/app/bookings/actions";

/**
 * Refunds are admin-only, so a mentee who has already paid asks rather than
 * cancels. This just flags the booking for the admin queue.
 */
export function RequestCancellationForm({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        Need to cancel this session?
      </Button>
    );
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await requestCancellation(bookingId, formData);
        toast.success("Cancellation requested — we'll review it and be in touch");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't send that request");
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-2 rounded-lg border p-3">
      <label htmlFor="reason" className="text-sm font-medium">
        Why do you need to cancel?
      </label>
      <Textarea
        id="reason"
        name="reason"
        required
        minLength={5}
        maxLength={1000}
        rows={3}
        placeholder="Let us know what happened so we can sort out a refund."
      />
      <p className="text-xs text-muted-foreground">
        An admin reviews every request — refunds are not automatic.
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Sending…" : "Send request"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Never mind
        </Button>
      </div>
    </form>
  );
}
