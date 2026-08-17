"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markPayoutPaid } from "@/app/admin/actions";
import { CircleDollarSign } from "lucide-react";

export function PayoutButton({ bookingId, amount }: { bookingId: string; amount: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      className="gap-1.5"
      onClick={() =>
        startTransition(async () => {
          await markPayoutPaid(bookingId, amount);
          toast.success("Marked as paid out");
        })
      }
    >
      <CircleDollarSign className="size-4" /> Mark paid out
    </Button>
  );
}
