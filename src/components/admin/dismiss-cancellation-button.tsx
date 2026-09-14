"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { dismissCancellationRequest } from "@/app/admin/actions";

/** Clears a cancellation request the admin has decided not to refund. */
export function DismissCancellationButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
      onClick={() =>
        startTransition(async () => {
          try {
            await dismissCancellationRequest(bookingId);
            toast.success("Request dismissed");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't dismiss");
          }
        })
      }
    >
      Dismiss
    </button>
  );
}
