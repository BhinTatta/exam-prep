import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, hasRole } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { PaymentSubmitForm } from "@/components/bookings/payment-submit-form";
import { CancelBookingButton, ConfirmHappenedButtons } from "@/components/bookings/booking-buttons";
import { DAYS } from "@/lib/days";
import { Video, IndianRupee } from "lucide-react";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      mentee: { select: { id: true, name: true } },
      mentor: { include: { user: { select: { id: true, name: true } } } },
      slot: true,
    },
  });

  if (!booking) notFound();

  const isMentee = booking.menteeId === user.id;
  const isMentor = booking.mentor.userId === user.id;
  const isAdmin = hasRole(user.role, "ADMIN");
  if (!isMentee && !isMentor && !isAdmin) notFound();

  const upiUri = `upi://pay?pa=${encodeURIComponent(booking.mentor.upiId)}&am=${booking.amount}&cu=INR&tn=${encodeURIComponent(
    "Exam prep mentoring session"
  )}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`;

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

          <Separator />

          {booking.status === "PENDING_PAYMENT" && isMentee && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt="UPI QR code" className="size-40 rounded-md border bg-white p-1" />
                <p className="text-sm">
                  Pay to UPI ID <span className="font-mono font-medium">{booking.mentor.upiId}</span>
                </p>
                <p className="text-lg font-semibold">₹{booking.amount}</p>
              </div>
              <PaymentSubmitForm bookingId={booking.id} />
              <CancelBookingButton bookingId={booking.id} />
            </div>
          )}

          {booking.status === "PAYMENT_SUBMITTED" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {isMentee
                  ? "Payment submitted — an admin will confirm it shortly and generate your video call link."
                  : "Mentee submitted payment. Waiting on admin confirmation."}
              </p>
              {booking.utrReference && (
                <p className="text-xs text-muted-foreground">
                  UTR: <span className="font-mono">{booking.utrReference}</span>
                </p>
              )}
              {isMentee && <CancelBookingButton bookingId={booking.id} />}
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
            </div>
          )}

          {booking.status === "COMPLETED" && (
            <p className="text-sm text-muted-foreground">Session completed. Thanks for using {`the platform`}!</p>
          )}

          {booking.status === "DISPUTED" && (
            <p className="text-sm text-muted-foreground">
              Marked as not happened — an admin will review this booking.
            </p>
          )}

          {booking.status === "CANCELLED" && (
            <p className="text-sm text-muted-foreground">This booking was cancelled.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
