import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { RazorpayCheckoutButton } from "@/components/bookings/razorpay-checkout-button";
import { HoldCountdown } from "@/components/bookings/hold-countdown";
import { RequestCancellationForm } from "@/components/bookings/request-cancellation";
import { CancelBookingButton, ConfirmHappenedButtons } from "@/components/bookings/booking-buttons";
import { expireStaleHolds, reconcileBookingPayments } from "@/lib/payments/sync";
import { formatInr } from "@/lib/razorpay/money";
import { siteConfig } from "@/config/site";
import { DAYS } from "@/lib/days";
import { Video, IndianRupee, ShieldCheck } from "lucide-react";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  // Release any lapsed holds before reading, so this page never shows a booking
  // as payable when its slot has already gone back into circulation.
  await expireStaleHolds();

  const preliminary = await prisma.booking.findUnique({
    where: { id },
    select: { status: true, menteeId: true },
  });
  if (!preliminary) notFound();

  // Fallback for a webhook that never arrived. No-ops unless there is an open
  // order old enough to be worth asking Razorpay about.
  if (preliminary.status === "PENDING_PAYMENT" || preliminary.status === "PAYMENT_PROCESSING") {
    await reconcileBookingPayments(id);
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      mentee: { select: { id: true, name: true } },
      mentor: { include: { user: { select: { id: true, name: true } } } },
      slot: true,
      payments: {
        orderBy: { createdAt: "desc" },
        include: { refunds: { orderBy: { createdAt: "desc" } } },
      },
    },
  });

  if (!booking) notFound();

  const isMentee = booking.menteeId === user.id;
  const isMentor = booking.mentor.userId === user.id;
  const isAdmin = hasRole(user.role, "ADMIN");
  if (!isMentee && !isMentor && !isAdmin) notFound();

  const settled = booking.payments.find((p) => p.status === "CAPTURED" || p.status === "REFUNDED");
  const lastFailure = booking.payments.find((p) => p.errorDescription);
  const totalRefunded = booking.payments.reduce((sum, p) => sum + p.refundedAmount, 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Booking with {isMentee ? booking.mentor.user.name : booking.mentee.name}</CardTitle>
          <BookingStatusBadge status={booking.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Slot</span>
            <span className="font-medium">
              {DAYS[booking.slot.dayOfWeek]} {booking.slot.startTime} ({booking.slot.duration} min)
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="flex items-center font-medium">
              <IndianRupee className="size-3.5" /> {booking.amount}
            </span>
          </div>
          {settled?.razorpayPaymentId && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Payment ID</span>
              <span className="font-mono text-xs">{settled.razorpayPaymentId}</span>
            </div>
          )}

          <Separator />

          {booking.status === "PENDING_PAYMENT" && isMentee && (
            <div className="flex flex-col gap-3">
              {lastFailure?.errorDescription && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  Last attempt failed: {lastFailure.errorDescription}
                </p>
              )}
              <RazorpayCheckoutButton bookingId={booking.id} amountLabel={`₹${booking.amount}`} />
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Card, UPI, netbanking and wallets — secured by Razorpay
              </p>
              {booking.expiresAt && <HoldCountdown expiresAt={booking.expiresAt.toISOString()} />}
              <CancelBookingButton bookingId={booking.id} />
            </div>
          )}

          {booking.status === "PENDING_PAYMENT" && !isMentee && (
            <p className="text-sm text-muted-foreground">
              Waiting for the mentee to pay. The slot is held until they do or the hold lapses.
            </p>
          )}

          {booking.status === "PAYMENT_PROCESSING" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {isMentee
                  ? "Your bank is still confirming this payment. It usually takes under a minute — this page updates itself once it clears."
                  : "The mentee's payment is being confirmed by their bank."}
              </p>
            </div>
          )}

          {booking.status === "CONFIRMED" && (
            <div className="flex flex-col gap-3">
              <a href={booking.meetLink ?? "#"} target="_blank" rel="noopener noreferrer">
                <Button className="w-full gap-1.5">
                  <Video className="size-4" /> Join video call
                </Button>
              </a>
              {isMentee && (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">After your session — did it happen?</p>
                  <ConfirmHappenedButtons bookingId={booking.id} />
                </div>
              )}
              {isMentee &&
                (booking.cancellationRequestedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Cancellation requested — an admin is reviewing it.
                  </p>
                ) : (
                  <RequestCancellationForm bookingId={booking.id} />
                ))}
            </div>
          )}

          {booking.status === "COMPLETED" && (
            <p className="text-sm text-muted-foreground">
              Session completed. Thanks for using {siteConfig.name}!
            </p>
          )}

          {booking.status === "DISPUTED" && (
            <p className="text-sm text-muted-foreground">
              Marked as not happened — an admin will review this booking.
            </p>
          )}

          {booking.status === "CANCELLED" && (
            <p className="text-sm text-muted-foreground">This booking was cancelled.</p>
          )}

          {booking.status === "EXPIRED" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                This booking expired before it was paid for, so the slot was released.
              </p>
              {isMentee && (
                <Link href={`/mentors/${booking.mentorId}`}>
                  <Button variant="outline" className="w-full">
                    Book another slot
                  </Button>
                </Link>
              )}
            </div>
          )}

          {booking.status === "REFUNDED" && (
            <p className="text-sm text-muted-foreground">
              {totalRefunded > 0
                ? `${formatInr(totalRefunded)} was refunded to your original payment method. Banks usually take 5–7 working days to show it.`
                : "This booking was refunded."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
