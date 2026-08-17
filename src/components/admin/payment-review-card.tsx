"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Image as ImageIcon } from "lucide-react";
import { DAYS } from "@/lib/days";
import { confirmPayment } from "@/app/admin/actions";

export function PaymentReviewCard({
  booking,
}: {
  booking: {
    id: string;
    amount: number;
    utrReference: string | null;
    paymentProofUrl: string | null;
    mentee: { name: string | null };
    mentor: { user: { name: string | null } };
    slot: { dayOfWeek: number; startTime: string };
  };
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {booking.mentee.name} → {booking.mentor.user.name}
        </CardTitle>
        <CardDescription>
          {DAYS[booking.slot.dayOfWeek]} {booking.slot.startTime} · ₹{booking.amount}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Badge variant="outline" className="w-fit font-mono">
          UTR: {booking.utrReference}
        </Badge>
        {booking.paymentProofUrl && (
          <a href={booking.paymentProofUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ImageIcon className="size-4" /> View screenshot
            </Button>
          </a>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={isPending}
            className="gap-1.5"
            onClick={() =>
              startTransition(async () => {
                await confirmPayment(booking.id, true);
                toast.success("Payment confirmed — Jitsi link generated");
              })
            }
          >
            <Check className="size-4" /> Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            className="gap-1.5"
            onClick={() =>
              startTransition(async () => {
                await confirmPayment(booking.id, false);
                toast.success("Booking rejected");
              })
            }
          >
            <X className="size-4" /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
