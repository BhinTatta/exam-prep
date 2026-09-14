import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { PayoutButton } from "@/components/admin/payout-button";
import { Badge } from "@/components/ui/badge";
import { DAYS } from "@/lib/days";
import { Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "Sessions & payouts" };

export default async function AdminSessionsPage() {
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["CONFIRMED", "COMPLETED", "DISPUTED"] } },
    include: {
      mentee: { select: { name: true } },
      mentor: { include: { user: { select: { name: true } } } },
      slot: true,
      payout: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Sessions & payouts"
        description="Mentees pay the platform; you pay mentors by hand. Each row shows where to send it."
      />
      {bookings.length === 0 ? (
        <EmptyState icon={Calendar} title="No sessions yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {b.mentee.name} → {b.mentor.user.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {DAYS[b.slot.dayOfWeek]} {b.slot.startTime} · ₹{b.amount} ·{" "}
                    {formatDistanceToNow(b.createdAt, { addSuffix: true })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pay <span className="font-mono">{b.mentor.upiId}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <BookingStatusBadge status={b.status} />
                  {b.status === "COMPLETED" &&
                    (b.payout?.paidAt ? (
                      <Badge variant="outline">Paid out</Badge>
                    ) : (
                      <PayoutButton bookingId={b.id} amount={b.amount} />
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
