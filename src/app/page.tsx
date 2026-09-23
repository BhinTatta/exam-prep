import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MentorCard } from "@/components/mentors/mentor-card";
import { listRankedMentors } from "@/lib/mentors/list";
import { siteConfig, exams } from "@/config/site";
import {
  BookOpen,
  MessagesSquare,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  MessageSquareOff,
  CalendarX,
  Target,
  ClipboardCheck,
  Undo2,
  Wallet,
} from "lucide-react";

// ISR. The page is prerendered and served from the CDN as static HTML, then
// regenerated in the background at most once an hour — nobody waits on a
// database round-trip to see the landing page.
//
// Nothing on this page is perishable any more. The mentor cards deliberately
// carry no availability: this is a showcase, not a booking surface, and a page
// cached for an hour has no business printing a clock time that a booking can
// falsify ten minutes later. What is left — who the best-rated mentors are,
// their price, their session count — moves slowly enough that an hour old is
// indistinguishable from live.
//
// So the hourly timer carries this page on its own, and each regeneration
// picks up the current ranking without anyone having to remember to bust a
// cache. The one exception is curation: setFeaturedRank() in
// app/admin/actions.ts calls revalidateMentorPages(), because an admin who
// pins a mentor for a campaign should not be told to wait up to an hour to see
// it. src/lib/cache.ts documents what that does to the stored copy.
export const revalidate = 3600;

const MENTORS_ON_HOME = 3;

export default async function Home() {
  const [test, mentors] = await Promise.all([
    prisma.test.findFirst({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      select: { slug: true, durationMinutes: true },
    }),
    // Featured first (an admin's call), then the weighted rating. Explicitly
    // NOT the soonest available: an empty calendar is what a mentor who signed
    // up yesterday has, so ranking on it put the newest profile on the front
    // page every time — the opposite of a showcase.
    listRankedMentors({ limit: MENTORS_ON_HOME, order: "featured" }),
  ]);

  // Straight to the test when there's one to take — the listing page is a hop
  // that costs a click and a full server round-trip before anyone sees a
  // question.
  const testHref = test ? `/tests/${test.slug}` : "/tests";
  const duration = test ? `${test.durationMinutes} min` : "25 min";
  const durationWords = `${test?.durationMinutes ?? 25}-minute`;

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,theme(colors.primary/10%),transparent_60%)]" />
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-24">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            <Sparkles className="size-3.5" /> Free forever. No ads. No spam.
          </Badge>

          <h1 className="max-w-3xl text-balance font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Find out what&apos;s actually costing you marks.
          </h1>

          <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
            A free {durationWords} diagnostic that shows you, topic by topic, where your marks are
            leaking — then a study plan built from it. No sign-up to take it.
          </p>

          {/* One CTA. Two buttons of equal weight is a decision the student
              doesn't want to make, so the second option is a plain link. */}
          <div className="flex w-full flex-col items-center gap-4">
            <Button asChild size="hero" emphasis="glow" className="w-full sm:w-auto">
              <Link href={testHref}>
                Take the free test — {duration} <ArrowRight />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              No sign-up. No card. Your result the moment you finish.
            </p>
            <Link
              href="/mentors"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              or meet the mentors who&apos;ve cleared it →
            </Link>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {exams.map((exam) => (
              <Badge key={exam.slug} variant="outline" className="px-3 py-1 text-sm font-normal">
                {exam.label}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* The mentor pitch sits second, directly under the hero — it's the
          product, not a footnote below a feature grid. */}
      <section className="border-b bg-accent/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:py-20">
          <div className="mx-auto flex max-w-2xl flex-col gap-4 text-center">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              The part that changes your rank
            </p>
            <h2 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              You&apos;ve messaged seniors. Most never replied.
            </h2>
            <p className="text-pretty text-muted-foreground">
              The one who did sent two sentences. A 45-minute call with someone who cleared the exact
              exam you&apos;re preparing for is a different thing — they look at where you&apos;re
              losing marks and tell you what to drop, what to drill, and in what order.
            </p>
            <p className="font-heading text-lg font-semibold text-balance">
              One call. Months of unguided prep you don&apos;t have to repeat.
            </p>
          </div>

          {mentors.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* No `slots` and no pill. Three cards that are all "our best"
                  do not need one of them singled out, and any label we could
                  put there — "soonest", "top rated" — would be a claim this
                  cached page cannot keep true. */}
              {mentors.map(({ mentor }) => (
                <MentorCard key={mentor.id} mentor={mentor} />
              ))}
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            {/* Big, but not glowing: the diagnostic in the hero is the one
                CTA on this page allowed to glow, and two competing halos make
                the choice harder rather than more obvious. */}
            <Button asChild size="hero" emphasis="lift">
              <Link href="/mentors">
                {mentors.length > 0 ? "Find more mentors" : "Meet the mentors"} <ArrowRight />
              </Link>
            </Button>
            <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
              Rank proof checked by a human. Mentor doesn&apos;t show up? Full refund, no argument.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:py-20">
        <h2 className="text-center font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-8 flex flex-col gap-5">
          <Step n={1} icon={ClipboardCheck} title={`Take the diagnostic — free, ${duration}`}>
            No account needed. Conceptual questions across the whole syllabus, not a full mock.
          </Step>
          <Step n={2} icon={Target} title="See exactly where the marks leak">
            A topic-by-topic breakdown and a study plan built from your actual answers.
          </Step>
          <Step n={3} icon={MessagesSquare} title="Take it to someone who's been there">
            Optional, and the only thing that costs money. Pick a mentor, pick a slot, talk.
          </Step>
        </ol>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <Assurance icon={MessageSquareOff} title="Not another group class">
            1:1 video, no recording, no script.
          </Assurance>
          <Assurance icon={Wallet} title="Pay per session">
            No subscription, no package, no upsell call.
          </Assurance>
          <Assurance icon={Undo2} title="They don't show, you don't pay">
            Full refund if a mentor misses the call.
          </Assurance>
        </div>
      </section>

      {/* Resources and Q&A are real, and they are not why anyone is here —
          one compact row rather than equal billing with the funnel. */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-4xl gap-4 px-4 py-14 sm:grid-cols-2">
          <SideLink
            icon={BookOpen}
            href="/resources"
            title="Curated resources"
            description="Institute material, books, test series and PYQs — kept current by moderators."
          />
          <SideLink
            icon={MessagesSquare}
            href="/qa"
            title="Community Q&A"
            description="Ask with full LaTeX support and get answers from people taking the same exam."
          />
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-14 text-center">
          <CalendarX className="size-7 text-primary" />
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Cleared the exam yourself?
          </h2>
          <p className="text-sm text-muted-foreground">
            You remember what nobody told you in time. Set your own rate and hours — we verify your
            rank proof by hand before your profile goes live.
          </p>
          <Button asChild variant="outline" size="lg">
            <Link href="/mentors/apply">Become a mentor</Link>
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {siteConfig.name} is run by moderators, not algorithms.
          </p>
        </div>
      </section>
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  children,
}: {
  n: number;
  icon: typeof Target;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary tabular-nums">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold">
          <Icon className="size-4 shrink-0 text-primary" />
          {title}
        </p>
        <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}

function Assurance({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <Icon className="size-4.5 text-primary" />
      <p className="mt-1 text-sm font-semibold">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function SideLink({
  icon: Icon,
  href,
  title,
  description,
}: {
  icon: typeof BookOpen;
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Card className="relative transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-5">
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="font-semibold">
            <Link href={href} className="after:absolute after:inset-0">
              {title}
            </Link>
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
