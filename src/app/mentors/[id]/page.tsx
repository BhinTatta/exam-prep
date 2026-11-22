import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShareProfile } from "@/components/mentors/share-profile";
import { NotifyMeButton, NotifyMeCallout } from "@/components/mentors/notify-me";
import { openSlotRequestKeys, slotRequestKey } from "@/lib/slot-requests";
import { RatingChip, RatingSummary } from "@/components/reviews/rating-summary";
import { ReviewQuote } from "@/components/reviews/review-quote";
import { formatSlotTime } from "@/lib/days";
import { openSlotsForMentor } from "@/lib/mentors/availability";
import { formatOccurrenceDay } from "@/lib/slots";
import { SlotPicker, type SlotDay } from "@/components/mentors/slot-picker";
import { expireStaleHolds } from "@/lib/payments/sync";
import { getMentorProfile, REVIEWS_ON_PROFILE } from "@/lib/mentors/profile";
import { MIN_SESSIONS_TO_SHOW } from "@/lib/mentors/rank";
import { averageRating, formatRating } from "@/lib/reviews";
import { siteConfig } from "@/config/site";
import {
  BadgeCheck,
  Languages,
  Video,
  NotebookPen,
  ListOrdered,
  Undo2,
  Users,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Same cached read the page itself does — one query serves both.
  const mentor = await getMentorProfile(id);
  if (!mentor || !mentor.verified) return { title: "Mentor" };

  const name = mentor.user.name ?? "This mentor";
  const average = averageRating(mentor);
  const credential = [mentor.rank, mentor.examCleared].filter(Boolean).join(", ");
  const rated = average
    ? ` Rated ${formatRating(average)}/5 by ${mentor.reviewCount} ${mentor.reviewCount === 1 ? "student" : "students"}.`
    : "";
  const description = `${name} cleared ${mentor.examCleared} and takes 1:1 video sessions on ${siteConfig.name}.${rated}`;
  const url = `${siteConfig.url}/mentors/${mentor.id}`;

  return {
    title: `${name} — ${credential}`,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${name} — ${credential}`, description, url, type: "profile" as const },
    twitter: { card: "summary_large_image" as const, title: `${name} — ${credential}`, description },
  };
}

export default async function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  // Put slots from abandoned checkouts back on sale before listing availability.
  await expireStaleHolds();

  const mentor = await getMentorProfile(id);

  if (!mentor || !mentor.verified) notFound();

  const isOwnProfile = session?.user?.id === mentor.userId;
  const firstName = mentor.user.name?.trim().split(/\s+/)[0] ?? "them";
  const credential = [mentor.rank, mentor.examCleared, mentor.examYear || null].filter(Boolean).join(" · ");
  const now = new Date();
  const slots = await openSlotsForMentor(mentor.id, mentor.availability, now);
  const slotDays = groupByDay(slots, now);
  const durations = new Set(slots.map((s) => s.duration));
  const hasMoreReviews = mentor.reviewCount > mentor.reviews.length;

  // "Notify me" for this mentor, any day. Captured so a student who finds
  // nothing to book is a lead on /admin/demand rather than a lost visit.
  const slotRequest = { mentorId: mentor.id, dayOfWeek: null, source: "mentor_profile" as const };
  const onWaitlist = (await openSlotRequestKeys(session?.user?.id)).includes(
    slotRequestKey(mentor.id, null)
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex items-start gap-4">
            <Avatar className="size-16 shrink-0 ring-2 ring-background">
              <AvatarImage src={mentor.user.image ?? undefined} alt="" />
              <AvatarFallback className="bg-accent text-xl font-semibold text-accent-foreground">
                {(mentor.user.name ?? "M").slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-2xl leading-tight font-bold">{mentor.user.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mentor.currentRole || mentor.institute}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <RatingChip rollup={mentor} />
                {/* Sessions taken, next to the rating and before anything else
                    on the page: "forty students have paid to talk to this
                    person" is the single strongest thing we can say about a
                    mentor, and it is stronger than any number of stars from a
                    handful of raters. Hidden below MIN_SESSIONS_TO_SHOW — a
                    profile advertising "1 session booked" is arguing against
                    itself. */}
                {mentor.paidSessions >= MIN_SESSIONS_TO_SHOW && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-3.5" />
                    <span className="font-medium text-foreground tabular-nums">
                      {mentor.paidSessions}
                    </span>{" "}
                    sessions booked
                  </span>
                )}
              </div>
            </div>
            {/* Sharing sits with the identity, not with the booking controls —
                a student forwards "this person", not "this checkout". */}
            <ShareProfile
              path={`/mentors/${mentor.id}`}
              fallbackUrl={`${siteConfig.url}/mentors/${mentor.id}`}
              mentorName={mentor.user.name ?? "this mentor"}
              isOwner={isOwnProfile}
              size="sm"
              className="shrink-0"
            />
          </div>

          {credential && (
            <div className="flex flex-col gap-1 rounded-lg bg-accent px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
                <BadgeCheck className="size-5 shrink-0 text-primary" />
                {credential}
              </span>
              <span className="pl-7 text-xs text-muted-foreground sm:ml-auto sm:shrink-0 sm:pl-0">
                Proof verified
              </span>
            </div>
          )}

          {mentor.story && (
            <blockquote className="border-l-2 border-primary/30 pl-4 text-pretty text-base leading-relaxed italic">
              &ldquo;{mentor.story}&rdquo;
            </blockquote>
          )}

          {mentor.bio && (
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{mentor.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {mentor.languages.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Languages className="size-3.5" /> Speaks {mentor.languages.join(", ")}
              </span>
            )}
            <div className="flex flex-wrap gap-1.5">
              {mentor.subjects.map((s) => (
                <Badge key={s} variant="secondary" className="capitalize">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Removing the "what actually happens on the call?" unknown — the last
          hesitation before paying is almost never about the price. */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">What the session actually looks like</h2>
        <ul className="mt-3 flex flex-col gap-3">
          <Expectation icon={Video}>
            A 1:1 video call — no recording, no group, no script to read out.
          </Expectation>
          <Expectation icon={NotebookPen}>
            Bring your diagnostic result or your last mock. Real numbers make it specific fast.
          </Expectation>
          <Expectation icon={ListOrdered}>
            You leave with an order to work in: what to drop, what to drill, what to ignore entirely.
          </Expectation>
        </ul>
      </section>

      {/* Sits immediately above the price. Everything up to here is what the
          mentor says about themselves; this is the only part of the page they
          don't write. */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2 className="font-heading text-lg font-semibold">
            What students said after their session
          </h2>
          {mentor.reviewCount > 0 && <RatingSummary rollup={mentor} />}
        </div>

        {mentor.reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {mentor.reviewCount > 0
              ? `${mentor.reviewCount} ${mentor.reviewCount === 1 ? "student has" : "students have"} rated ${firstName} without leaving a note.`
              : `Nobody has rated ${firstName} yet — every review here comes from a paid session, so this fills up only as people actually book.`}
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-6">
            {mentor.reviews.map((review) => (
              <ReviewQuote key={review.id} review={review} canReport={!!session?.user} />
            ))}
          </div>
        )}

        {(hasMoreReviews || mentor.reviews.length >= REVIEWS_ON_PROFILE) && (
          <Link
            href={`/mentors/${mentor.id}/reviews`}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Read all {mentor.reviewCount} {mentor.reviewCount === 1 ? "review" : "reviews"}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">Pick a time</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-heading text-xl font-bold text-foreground tabular-nums">
              ₹{mentor.rate}
            </span>{" "}
            per session
          </p>
        </div>

        {slots.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center">
            <p className="text-sm text-pretty text-muted-foreground">
              {isOwnProfile
                ? "You have no open slots. Students who find you here can't book until you add some."
                : `${firstName} has no open slots right now. Ask to be told when they add one.`}
            </p>
            {!isOwnProfile && (
              <NotifyMeButton
                request={slotRequest}
                requested={onWaitlist}
                signedIn={!!session?.user}
                size="lg"
              />
            )}
          </div>
        ) : (
          <div className="mt-4">
            <p className="mb-4 text-sm text-muted-foreground">
              {durations.size === 1 ? `${[...durations][0]}-minute video call` : "1:1 video call"} · times in IST
            </p>
            <SlotPicker
              mentorId={mentor.id}
              days={slotDays}
              price={mentor.rate}
              mode={isOwnProfile ? "preview" : session?.user ? "book" : "sign-in"}
              showDuration={durations.size > 1}
            />
          </div>
        )}

        {/* Open slots, but maybe not ones that fit: a student who can only do
            evenings and sees three mornings is the same lost booking. */}
        {slots.length > 0 && !isOwnProfile && (
          <NotifyMeCallout
            className="mt-4"
            title="None of these times work?"
            description={`Get on ${firstName}'s list for when new slots open.`}
            request={slotRequest}
            requested={onWaitlist}
            signedIn={!!session?.user}
          />
        )}

        <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Undo2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {firstName} doesn&apos;t show up? Full refund, no argument. Your slot is held while you pay.
        </p>
      </section>
    </div>
  );
}

function Expectation({ icon: Icon, children }: { icon: typeof Video; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[0.9375rem] leading-relaxed">
      <Icon className="mt-0.5 size-4.5 shrink-0 text-primary" />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

const DATE_ONLY = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

/** Sessions grouped under their IST day, for the picker. */
function groupByDay(slots: Awaited<ReturnType<typeof openSlotsForMentor>>, now: Date): SlotDay[] {
  const days: SlotDay[] = [];
  for (const slot of slots) {
    const heading = formatOccurrenceDay(slot.startsAt, now);
    let day = days.at(-1);
    if (!day || day.heading !== heading) {
      // Past the coming week the heading is already a date ("Wed, 3 Dec").
      const date = heading.includes(",") ? "" : DATE_ONLY.format(slot.startsAt);
      day = { key: slot.startsAt.toISOString(), heading, date, slots: [] };
      days.push(day);
    }
    day.slots.push({
      ruleId: slot.ruleId,
      startsAtIso: slot.startsAt.toISOString(),
      time: formatSlotTime(slot.startTime),
      duration: slot.duration,
    });
  }
  return days;
}
