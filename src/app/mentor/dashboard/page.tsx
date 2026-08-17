import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { AvailabilityManager } from "@/components/mentors/availability-manager";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, IndianRupee } from "lucide-react";
import { DAYS } from "@/lib/days";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "Mentor dashboard" };

export default async function MentorDashboardPage() {
  const user = await requireUser();

  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: user.id },
    include: {
      availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      bookings: {
        orderBy: { createdAt: "desc" },
        include: { mentee: { select: { name: true } }, slot: true },
      },
    },
  });

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={Calendar}
          title="You haven't applied as a mentor yet"
          description="Apply once and set your rate, subjects, and availability."
          action={
            <Link href="/mentors/apply">
              <Button>Apply now</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Mentor dashboard"
        description={profile.verified ? "You're live — mentees can book you." : "Awaiting admin verification."}
        action={
          <Badge variant={profile.verified ? "default" : "secondary"}>
            {profile.verified ? "Verified" : "Pending review"}
          </Badge>
        }
      />

      <section className="mb-10">
        <h2 className="mb-3 font-medium">Availability</h2>
        <AvailabilityManager slots={profile.availability} />
      </section>

      <section>
        <h2 className="mb-3 font-medium">Bookings</h2>
        {profile.bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.bookings.map((b) => (
              <Link key={b.id} href={`/bookings/${b.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{b.mentee.name}</p>
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
      </section>
    </div>
  );
}
