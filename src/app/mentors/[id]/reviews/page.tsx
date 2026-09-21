import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { ReviewQuote } from "@/components/reviews/review-quote";
import { ShareProfile } from "@/components/mentors/share-profile";
import { listMentorReviews, REVIEWS_PER_PAGE } from "@/lib/mentors/profile";
import { formatAir } from "@/lib/mentors/rank";
import { siteConfig } from "@/config/site";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mentor = await prisma.mentorProfile.findUnique({
    where: { id },
    select: { reviewCount: true, user: { select: { name: true } } },
  });
  if (!mentor) return { title: "Reviews" };
  return {
    title: `Reviews of ${mentor.user.name}`,
    description: `What ${mentor.reviewCount} students said after a 1:1 session with ${mentor.user.name}.`,
  };
}

/**
 * Every review a mentor has, paginated.
 *
 * Split off the profile page on purpose: a mentor with two hundred sessions
 * would otherwise ship two hundred rows into a page whose actual job is to get
 * a slot booked. Here the rows are the point, and `skip`/`take` ride the
 * `(mentorId, published, createdAt DESC)` index so page 9 costs what page 1
 * does. The total comes off the mentor's rollup column, so there is no
 * `count()` alongside the page query.
 */
export default async function MentorReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ id }, { page: pageParam }, session] = await Promise.all([params, searchParams, auth()]);
  const page = Math.max(1, Number(pageParam) || 1);

  const [mentor, reviews] = await Promise.all([
    prisma.mentorProfile.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        verified: true,
        rank: true,
        examCleared: true,
        currentRole: true,
        institute: true,
        reviewCount: true,
        ratingSum: true,
        user: { select: { name: true, image: true } },
      },
    }),
    listMentorReviews(id, page),
  ]);

  if (!mentor || !mentor.verified) notFound();
  if (page > 1 && reviews.length === 0) notFound();

  const name = mentor.user.name ?? "This mentor";
  const isOwner = session?.user?.id === mentor.userId;
  const lastPage = Math.max(1, Math.ceil(mentor.reviewCount / REVIEWS_PER_PAGE));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/mentors/${mentor.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Back to {name.split(/\s+/)[0]}&apos;s profile
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12 shrink-0 ring-2 ring-background">
            <AvatarImage src={mentor.user.image ?? undefined} alt="" />
            <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
              {name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-heading text-xl leading-tight font-bold">{name}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {[formatAir(mentor.rank), mentor.examCleared].filter(Boolean).join(" · ") ||
                mentor.currentRole ||
                mentor.institute}
            </p>
          </div>
        </div>
        <ShareProfile
          path={`/mentors/${mentor.id}`}
          fallbackUrl={`${siteConfig.url}/mentors/${mentor.id}`}
          mentorName={name}
          isOwner={isOwner}
          size="sm"
        />
      </header>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-heading text-lg font-semibold">
          {mentor.reviewCount === 1 ? "1 rated session" : `${mentor.reviewCount} rated sessions`}
        </h2>
        <RatingSummary rollup={mentor} />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Every rating here comes from a paid, completed session — there is no way to leave one
        without having taken the call.
      </p>

      {reviews.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No ratings yet. The first one will be from whoever books next.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-7">
          {reviews.map((review) => (
            <ReviewQuote key={review.id} review={review} canReport={!!session?.user} />
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <nav className="mt-10 flex items-center justify-between border-t pt-6" aria-label="Reviews pages">
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/mentors/${mentor.id}/reviews${page > 2 ? `?page=${page - 1}` : ""}`}
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
            >
              <ChevronLeft /> Newer
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {lastPage}
          </span>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/mentors/${mentor.id}/reviews?page=${page + 1}`}
              aria-disabled={page >= lastPage}
              className={page >= lastPage ? "pointer-events-none opacity-50" : undefined}
            >
              Older <ChevronRight />
            </Link>
          </Button>
        </nav>
      )}
    </div>
  );
}
