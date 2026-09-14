"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { refundPayment, syncPaymentFromRazorpay } from "@/app/admin/actions";
import { RefreshCw, Undo2 } from "lucide-react";

export function SyncPaymentButton({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      className="gap-1.5"
      onClick={() =>
        startTransition(async () => {
          try {
            await syncPaymentFromRazorpay(paymentId);
            toast.success("Synced from Razorpay");
            router.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't sync");
          }
        })
      }
    >
      <RefreshCw className={isPending ? "size-4 animate-spin" : "size-4"} />
      Sync from Razorpay
    </Button>
  );
}

/**
 * `refundablePaise` is what is left after any earlier refunds. The amount field
 * is in rupees for the admin's sake and converted on submit; the server
 * re-checks the ceiling regardless.
 */
export function RefundDialog({
  paymentId,
  refundablePaise,
}: {
  paymentId: string;
  refundablePaise: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((refundablePaise / 100).toString());
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      toast.error("Enter a refund amount");
      return;
    }
    startTransition(async () => {
      try {
        await refundPayment(paymentId, Math.round(rupees * 100), reason.trim() || undefined);
        toast.success("Refund initiated");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't refund");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-1.5">
          <Undo2 className="size-4" /> Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund this payment</DialogTitle>
          <DialogDescription>
            Up to ₹{(refundablePaise / 100).toLocaleString("en-IN")} can be refunded. This cannot be
            undone, and the mentee&apos;s bank typically takes 5–7 working days to show it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="refund-amount">Amount (₹)</Label>
            <Input
              id="refund-amount"
              type="number"
              min={1}
              max={refundablePaise / 100}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="refund-reason">Reason (internal note, optional)</Label>
            <Input
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. mentor unavailable"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={isPending}>
            {isPending ? "Refunding…" : "Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
