import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { Stars } from "@/components/reviews/stars";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, IndianRupee, Star } from "lucide-react";
import { DAYS, formatIstDateTime } from "@/lib/days";
import { formatDistanceToNow } from "date-fns";

// Per-user data behind an auth guard: never prerender or cache this.
export const dynamic = "force-dynamic";

export const metadata = { title: "My sessions" };

export default async function BookingsPage() {
  const user = await requireUser();

  const bookings = await prisma.booking.findMany({
    where: { menteeId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      mentor: { include: { user: { select: { name: true } } } },
      slot: true,
      // Included rather than looked up per row: this is the page that has to
      // answer "which of my sessions still need rating?", and doing that one
      // booking at a time is the N+1 this list would be most likely to grow.
      review: { select: { rating: true } },
    },
  });

  // The whole reason a student comes back here. Surfaced above the list so it
  // isn't something you have to open each booking to discover.
  const unrated = bookings.filter(
    (b) => (b.status === "CONFIRMED" || b.status === "COMPLETED") && !b.review
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="My sessions" description="Every mentor session you've booked, past and present." />

      {unrated.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-accent/50 p-4 sm:flex-row sm:items-center">
          <Star className="size-5 shrink-0 text-highlight" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {unrated.length === 1
                ? `You haven't rated your session with ${unrated[0].mentor.user.name}`
                : `${unrated.length} sessions are waiting on your rating`}
            </p>
            <p className="text-sm text-muted-foreground">
              A minute of your time is what the next student decides on.
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0 sm:ml-auto">
            <Link href={`/bookings/${unrated[0].id}`}>
              {unrated.length === 1 ? "Rate it" : "Rate the first"}
            </Link>
          </Button>
        </div>
      )}

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
          {bookings.map((b) => {
            const rateable = (b.status === "CONFIRMED" || b.status === "COMPLETED") && !b.review;
            return (
              <Link key={b.id} href={`/bookings/${b.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.mentor.user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {/* The booking's resolved date, not the slot's weekly
                            pattern — the pattern rolls forward to next week the
                            moment a session passes, so an old booking would
                            advertise a date it was never for. */}
                        {b.scheduledStartAt
                          ? formatIstDateTime(b.scheduledStartAt)
                          : `${DAYS[b.slot.dayOfWeek]} ${b.slot.startTime}`}{" "}
                        · {formatDistanceToNow(b.createdAt, { addSuffix: true })}
                      </p>
                      {b.review && (
                        <Stars
                          value={b.review.rating}
                          className="mt-1.5"
                          label={`You rated this ${b.review.rating} out of 5`}
                        />
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {rateable ? (
                        // Replaces the status badge rather than sitting beside
                        // it: on a session you took, what's left to do matters
                        // more than the fact that it's paid for.
                        <span className="flex items-center gap-1.5 rounded-full bg-highlight/20 px-2.5 py-1 text-xs font-semibold text-highlight-foreground">
                          <Star className="size-3.5" /> Rate it
                        </span>
                      ) : (
                        <BookingStatusBadge status={b.status} />
                      )}
                      <span className="flex items-center text-sm font-medium">
                        <IndianRupee className="size-3.5" /> {b.amount}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
