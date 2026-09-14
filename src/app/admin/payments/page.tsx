import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PaymentStatusBadge } from "@/components/admin/payment-status-badge";
import { DismissCancellationButton } from "@/components/admin/dismiss-cancellation-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInr } from "@/lib/razorpay/money";
import { isRazorpayTestMode } from "@/lib/razorpay/config";
import { CreditCard, Search } from "lucide-react";
import type { PaymentStatus, Prisma } from "@prisma/client";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "CAPTURED", label: "Captured" },
  { value: "CREATED", label: "Not paid" },
  { value: "AUTHORIZED", label: "Authorised" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  "CREATED",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as string[]).includes(value);
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "all", q = "" } = await searchParams;
  const query = q.trim();

  const where: Prisma.PaymentWhereInput = {};

  if (status === "REFUNDED") {
    where.status = { in: ["REFUNDED", "PARTIALLY_REFUNDED"] };
  } else if (isPaymentStatus(status)) {
    where.status = status;
  }

  if (query) {
    where.OR = [
      { razorpayPaymentId: { contains: query, mode: "insensitive" } },
      { razorpayOrderId: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { booking: { mentee: { email: { contains: query, mode: "insensitive" } } } },
      { booking: { mentee: { name: { contains: query, mode: "insensitive" } } } },
    ];
  }

  const [payments, cancellationRequests] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        booking: {
          include: {
            mentee: { select: { name: true, email: true } },
            mentor: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.booking.findMany({
      where: { cancellationRequestedAt: { not: null } },
      include: {
        mentee: { select: { name: true, email: true } },
        payments: { where: { status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] } }, take: 1 },
      },
      orderBy: { cancellationRequestedAt: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Every Razorpay order this platform has created. Payments confirm themselves — this is for monitoring and refunds."
      />

      {isRazorpayTestMode() && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Razorpay is in <strong>test mode</strong>. No real money is moving.
        </div>
      )}

      {cancellationRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Cancellation requests
              <Badge className="ml-2 border-0 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {cancellationRequests.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {cancellationRequests.map((b) => (
              <div key={b.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{b.mentee.name ?? b.mentee.email}</span>
                  <span className="text-muted-foreground">₹{b.amount}</span>
                </div>
                <p className="text-muted-foreground">{b.cancellationReason}</p>
                <div className="flex gap-3 text-xs">
                  <Link href={`/bookings/${b.id}`} className="underline underline-offset-2">
                    View booking
                  </Link>
                  {b.payments[0] && (
                    <Link
                      href={`/admin/payments/${b.payments[0].id}`}
                      className="underline underline-offset-2"
                    >
                      Refund this payment
                    </Link>
                  )}
                  <DismissCancellationButton bookingId={b.id} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link key={f.value} href={`/admin/payments?status=${f.value}${query ? `&q=${encodeURIComponent(query)}` : ""}`}>
            <Badge
              variant={status === f.value ? "default" : "outline"}
              className="cursor-pointer px-3 py-1"
            >
              {f.label}
            </Badge>
          </Link>
        ))}
        <form action="/admin/payments" className="ml-auto flex gap-2">
          <input type="hidden" name="status" value={status} />
          <Input
            name="q"
            defaultValue={query}
            placeholder="Mentee, email, pay_… or order_…"
            className="w-56"
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Search payments">
            <Search className="size-4" />
          </Button>
        </form>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments"
          description={query ? "Nothing matched that search." : "Payments will appear here as mentees book sessions."}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Mentee</TableHead>
                <TableHead>Mentor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Razorpay ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {p.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/payments/${p.id}`} className="font-medium underline underline-offset-2">
                      {p.booking.mentee.name ?? p.booking.mentee.email ?? "Unknown"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.booking.mentor.user.name}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatInr(p.amount)}
                    {p.refundedAmount > 0 && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        −{formatInr(p.refundedAmount)} refunded
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.method ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.razorpayPaymentId ?? p.razorpayOrderId}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
