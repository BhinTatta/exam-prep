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
import { JoinCallButton } from "@/components/bookings/join-call-button";
import type { MeetingRole } from "@/lib/bookings/meeting";
import { RequestCancellationForm } from "@/components/bookings/request-cancellation";
import { CancelBookingButton, DidNotHappenButton } from "@/components/bookings/booking-buttons";
import { ReviewForm } from "@/components/reviews/review-form";
import { expireStaleHolds, reconcileBookingPayments } from "@/lib/payments/sync";
import { formatInr } from "@/lib/razorpay/money";
import { siteConfig } from "@/config/site";
import { DAYS, formatIstDateTime } from "@/lib/days";
import { IndianRupee, ShieldCheck } from "lucide-react";

// Per-user data behind an auth guard: never prerender or cache this.
export const dynamic = "force-dynamic";

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
      // Fetched here rather than in the review block below, so the page costs
      // the same query count whether or not this session has been rated.
      review: { select: { rating: true, comment: true, published: true } },
    },
  });

  if (!booking) notFound();

  const isMentee = booking.menteeId === user.id;
  const isMentor = booking.mentor.userId === user.id;
  const isAdmin = hasRole(user.role, "ADMIN");
  if (!isMentee && !isMentor && !isAdmin) notFound();

  // Which door this viewer gets. The mentor's opens first so that they are the
  // one who opens the room — on public Jitsi that is what makes them its
  // moderator. Checked again, on the same rule, inside /bookings/[id]/join.
  const meetingRole: MeetingRole = isMentee ? "MENTEE" : isMentor ? "MENTOR" : "ADMIN";

  const mentorFirstName = booking.mentor.user.name?.trim().split(/\s+/)[0] ?? "your mentor";
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
            <span className="text-muted-foreground">Session</span>
            <span className="font-medium">
              {/* The booking's own resolved date where we have one. The slot is
                  a recurring weekly pattern, so rendering it directly answers
                  "when does that slot next fall?" rather than "when is this
                  session?" — the same thing on the day it was booked, wrong
                  every day after. */}
              {booking.scheduledStartAt
                ? `${formatIstDateTime(booking.scheduledStartAt)} (${booking.durationMinutes ?? booking.slot.duration} min)`
                : `${DAYS[booking.slot.dayOfWeek]} ${booking.slot.startTime} (${booking.slot.duration} min)`}
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
              <JoinCallButton
                bookingId={booking.id}
                role={meetingRole}
                scheduledStartAt={booking.scheduledStartAt?.toISOString() ?? null}
                durationMinutes={booking.durationMinutes ?? booking.slot.duration}
              />
              {isMentee && (
                <>
                  <Separator />
                  {/* Rating the call is also how it gets marked as happened —
                      a student who has just given five stars should not then
                      be asked whether it took place. The dispute path stays
                      separate below, deliberately quieter. */}
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="font-heading font-semibold">How was it with {mentorFirstName}?</p>
                      <p className="text-sm text-muted-foreground">
                        Once you rate it, this shows on their profile for the next student deciding.
                      </p>
                    </div>
                    <ReviewForm
                      bookingId={booking.id}
                      mentorName={mentorFirstName}
                      existing={booking.review}
                    />
                    <DidNotHappenButton bookingId={booking.id} />
                  </div>
                </>
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

          {booking.status === "COMPLETED" &&
            (isMentee ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="font-heading font-semibold">
                    {booking.review ? "Your review" : `How was it with ${mentorFirstName}?`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.review
                      ? "Change it any time — the profile updates with it."
                      : "You took this session a while back. A rating still helps the next student decide."}
                  </p>
                </div>
                <ReviewForm
                  bookingId={booking.id}
                  mentorName={mentorFirstName}
                  existing={booking.review}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Session completed. Thanks for using {siteConfig.name}!
              </p>
            ))}

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
