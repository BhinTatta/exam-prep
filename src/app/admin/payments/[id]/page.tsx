import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { PaymentStatusBadge } from "@/components/admin/payment-status-badge";
import { RefundDialog, SyncPaymentButton } from "@/components/admin/payment-admin-controls";
import { formatInr } from "@/lib/razorpay/money";
import { DAYS } from "@/lib/days";

export const metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      refunds: {
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { name: true, email: true } } },
      },
      booking: {
        include: {
          mentee: { select: { id: true, name: true, email: true } },
          mentor: { include: { user: { select: { name: true } } } },
          slot: true,
        },
      },
    },
  });

  if (!payment) notFound();

  // The webhook trail for this payment, via the ids the handler lifts out of
  // each payload into indexed columns.
  const events = await prisma.webhookEvent.findMany({
    where: {
      OR: [
        { razorpayOrderId: payment.razorpayOrderId },
        ...(payment.razorpayPaymentId ? [{ razorpayPaymentId: payment.razorpayPaymentId }] : []),
      ],
    },
    orderBy: { receivedAt: "desc" },
    take: 25,
  });

  const refundable = payment.amount - payment.refundedAmount;
  const canRefund =
    (payment.status === "CAPTURED" || payment.status === "PARTIALLY_REFUNDED") && refundable > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={formatInr(payment.amount)}
        description={`Payment from ${payment.booking.mentee.name ?? payment.booking.mentee.email ?? "a mentee"}`}
      />

      <div className="flex flex-wrap gap-2">
        <SyncPaymentButton paymentId={payment.id} />
        {canRefund && <RefundDialog paymentId={payment.id} refundablePaise={refundable} />}
        {payment.razorpayPaymentId && (
          <a
            href={`https://dashboard.razorpay.com/app/payments/${payment.razorpayPaymentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-2"
          >
            Open in Razorpay dashboard →
          </a>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Payment</CardTitle>
            <PaymentStatusBadge status={payment.status} />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Row label="Amount">{formatInr(payment.amount)}</Row>
            {payment.refundedAmount > 0 && (
              <Row label="Refunded">{formatInr(payment.refundedAmount)}</Row>
            )}
            <Row label="Method">{payment.method ?? "—"}</Row>
            <Row label="Order ID">
              <span className="font-mono text-xs">{payment.razorpayOrderId}</span>
            </Row>
            <Row label="Payment ID">
              <span className="font-mono text-xs">{payment.razorpayPaymentId ?? "—"}</span>
            </Row>
            <Row label="Contact">{payment.email ?? payment.contact ?? "—"}</Row>
            <Row label="Created">{payment.createdAt.toLocaleString("en-IN")}</Row>
            {payment.capturedAt && <Row label="Captured">{payment.capturedAt.toLocaleString("en-IN")}</Row>}
            {payment.errorDescription && (
              <>
                <Separator />
                <p className="text-sm text-destructive">
                  {payment.errorCode ? `${payment.errorCode}: ` : ""}
                  {payment.errorDescription}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Booking</CardTitle>
            <BookingStatusBadge status={payment.booking.status} />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Row label="Mentee">{payment.booking.mentee.name ?? payment.booking.mentee.email}</Row>
            <Row label="Mentor">{payment.booking.mentor.user.name}</Row>
            <Row label="Mentor payout UPI">
              <span className="font-mono text-xs">{payment.booking.mentor.upiId}</span>
            </Row>
            <Row label="Slot">
              {DAYS[payment.booking.slot.dayOfWeek]} {payment.booking.slot.startTime} (
              {payment.booking.slot.duration} min)
            </Row>
            {payment.booking.cancellationRequestedAt && (
              <>
                <Separator />
                <p className="text-sm">
                  <span className="font-medium">Cancellation requested:</span>{" "}
                  <span className="text-muted-foreground">{payment.booking.cancellationReason}</span>
                </p>
              </>
            )}
            <Separator />
            <Link
              href={`/bookings/${payment.booking.id}`}
              className="text-sm underline underline-offset-2"
            >
              View booking →
            </Link>
          </CardContent>
        </Card>
      </div>

      {payment.refunds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Refunds</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {payment.refunds.map((r) => (
              <div key={r.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatInr(r.amount)}</span>
                  <span
                    className={
                      r.status === "failed" ? "text-destructive" : "text-muted-foreground"
                    }
                  >
                    {r.status}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{r.razorpayRefundId}</span>
                {r.reason && <span className="text-muted-foreground">{r.reason}</span>}
                <span className="text-xs text-muted-foreground">
                  {r.createdAt.toLocaleString("en-IN")}
                  {r.admin ? ` · by ${r.admin.name ?? r.admin.email}` : " · automatic"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhook events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No webhooks recorded for this order yet. If the payment succeeded but nothing arrived,
              check the endpoint in Razorpay → Account &amp; Settings → Webhooks, then use Sync above.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs">{e.event}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.receivedAt.toLocaleString("en-IN")}
                  </span>
                  <span
                    className={
                      e.error
                        ? "text-xs text-destructive"
                        : e.processedAt
                          ? "text-xs text-emerald-600 dark:text-emerald-400"
                          : "text-xs text-muted-foreground"
                    }
                  >
                    {e.error ? "failed" : e.processedAt ? "processed" : "pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
