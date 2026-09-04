import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, IndianRupee } from "lucide-react";
import { DAYS } from "@/lib/days";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "My sessions" };

export default async function BookingsPage() {
  const user = await requireUser();

  const bookings = await prisma.booking.findMany({
    where: { menteeId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      mentor: { include: { user: { select: { name: true } } } },
      slot: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="My sessions" description="Every mentor session you've booked, past and present." />

      {bookings.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No sessions booked yet"
          description="Book a session with a verified mentor to see it here."
          action={
            <Link href="/mentors">
              <Button>Find a mentor</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((b) => (
            <Link key={b.id} href={`/bookings/${b.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">{b.mentor.user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {DAYS[b.slot.dayOfWeek]} {b.slot.startTime} ·{" "}
                      {formatDistanceToNow(b.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center text-sm font-medium">
                      <IndianRupee className="size-3.5" /> {b.amount}
                    </span>
                    <BookingStatusBadge status={b.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
