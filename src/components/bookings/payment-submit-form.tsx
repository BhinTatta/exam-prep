"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileInput } from "@/components/ui/file-input";
import { submitPayment } from "@/app/bookings/actions";

export function PaymentSubmitForm({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await submitPayment(bookingId, formData);
        toast.success("Payment submitted — waiting for admin confirmation");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't submit payment");
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="utrReference">UTR / transaction reference</Label>
        <Input id="utrReference" name="utrReference" placeholder="e.g. 402812345678" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="screenshot">Payment screenshot (optional)</Label>
        <FileInput id="screenshot" name="screenshot" accept="image/*" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Submitting..." : "I've paid — submit for review"}
      </Button>
    </form>
  );
}
