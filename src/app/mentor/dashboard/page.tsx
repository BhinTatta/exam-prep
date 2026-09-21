import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { AvailabilityManager } from "@/components/mentors/availability-manager";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { ShareProfile } from "@/components/mentors/share-profile";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { ReviewQuote } from "@/components/reviews/review-quote";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, IndianRupee, ArrowRight } from "lucide-react";
import { DAYS } from "@/lib/days";
import { siteConfig } from "@/config/site";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "Mentor dashboard" };

const REVIEWS_ON_DASHBOARD = 3;

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
      // The mentor's own feedback, newest first. Same one-statement include as
      // the public profile; the rollup below it comes off the row itself.
      reviews: {
        where: { published: true },
        orderBy: { createdAt: "desc" },
        take: REVIEWS_ON_DASHBOARD,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          author: { select: { name: true, image: true } },
        },
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
          <div className="flex items-center gap-2">
            <Badge variant={profile.verified ? "default" : "secondary"}>
              {profile.verified ? "Verified" : "Pending review"}
            </Badge>
            {profile.verified && (
              <ShareProfile
                path={`/mentors/${profile.id}`}
                fallbackUrl={`${siteConfig.url}/mentors/${profile.id}`}
                mentorName={user.name ?? "your profile"}
                isOwner
                size="sm"
              />
            )}
          </div>
        }
      />

      {/* Ratings first: it's the number a mentor actually wants on opening
          this page, and the one that decides whether anyone books them next. */}
      {profile.verified && (
        <section className="mb-10 border-b pb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-heading font-semibold">How your sessions are going</h2>
              <p className="text-sm text-muted-foreground">
                Only students who paid for and took a session can rate you.
              </p>
            </div>
            <RatingSummary rollup={profile} />
          </div>

          {profile.reviews.length > 0 && (
            <div className="mt-6 flex flex-col gap-6">
              {profile.reviews.map((review) => (
                <ReviewQuote key={review.id} review={review} />
              ))}
            </div>
          )}

          {profile.reviewCount > profile.reviews.length && (
            <Link
              href={`/mentors/${profile.id}/reviews`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Read all {profile.reviewCount} reviews <ArrowRight className="size-3.5" />
            </Link>
          )}
        </section>
      )}

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
