import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MentorCard, type MentorCardData, type MentorCardSlot } from "@/components/mentors/mentor-card";
import { StudyPlanSection } from "@/components/assessment/study-plan-section";
import { cn } from "@/lib/utils";
import type { TopicStat, StudyPlan } from "@/lib/assessment/types";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquareOff,
  CalendarX,
  Target,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export type ResultsMentor = {
  mentor: MentorCardData;
  nextSlot: MentorCardSlot;
};

/** Honest, non-shaming read of the score — every band has a reason to act. */
function verdictFor(pct: number) {
  if (pct >= 70) return "Strong fundamentals. From here, rank is decided by what you drop, not what you add.";
  if (pct >= 40) return "Middle of the pack — which is exactly where the right guidance moves you the most.";
  return "Rough, but you found out now instead of in the exam hall. That's the whole point of this.";
}

export function ResultsReport({
  slug,
  testTitle,
  totalScore,
  maxScore,
  topicBreakdown,
  studyPlan,
  mentors,
  canViewFullPlan,
  attemptId,
}: {
  slug: string;
  testTitle: string;
  totalScore: number;
  maxScore: number;
  topicBreakdown: TopicStat[];
  studyPlan: StudyPlan | null;
  mentors: ResultsMentor[];
  canViewFullPlan: boolean;
  attemptId: string;
}) {
  const pct = maxScore > 0 ? Math.max(0, Math.round((totalScore / maxScore) * 100)) : 0;
  const callbackUrl = `/tests/${slug}/attempt/${attemptId}/results`;
  const topWeakness = topicBreakdown
    .filter((t) => t.accuracy < 0.5)
    .sort((a, b) => a.accuracy - b.accuracy)[0]?.topic;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{testTitle}</p>
        <ScoreRing percent={pct} />
        <p className="text-sm text-muted-foreground tabular-nums">
          {totalScore} / {maxScore} marks
        </p>
        <p className="max-w-md text-balance font-heading text-lg font-semibold">{verdictFor(pct)}</p>
        {topWeakness && (
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm font-normal">
            <TrendingDown className="size-3.5 text-destructive" />
            Biggest leak: <span className="font-semibold">{topWeakness}</span>
          </Badge>
        )}
      </header>

      {/* The conversion block sits here — directly under the score, while the
          gap is still fresh — and not four sections down past the study plan.
          This is the moment the student is most motivated to fix something. */}
      <ConversionBlock mentors={mentors} topWeakness={topWeakness} />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">Topic breakdown</h2>
        <div className="flex flex-col gap-3">
          {topicBreakdown.map((t) => (
            <TopicBar key={t.topic} stat={t} />
          ))}
        </div>
      </section>

      <StudyPlanSection
        studyPlan={studyPlan}
        canViewFull={canViewFullPlan}
        callbackUrl={callbackUrl}
        pdfUrl={`/tests/${slug}/attempt/${attemptId}/pdf`}
      />

      {/* Retaking is an escape hatch, not an outcome — it gets a link, not a
          button competing with the CTA above. */}
      <div className="flex justify-center pb-4">
        <Link
          href={`/tests/${slug}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Retake the test
        </Link>
      </div>
    </div>
  );
}

function ConversionBlock({
  mentors,
  topWeakness,
}: {
  mentors: ResultsMentor[];
  topWeakness?: string;
}) {
  const cheapest = mentors.length ? Math.min(...mentors.map((m) => m.mentor.rate)) : null;

  return (
    <section className="-mx-4 flex flex-col gap-6 border-y bg-accent/40 px-4 py-8 sm:mx-0 sm:rounded-2xl sm:border">
      <div className="flex flex-col gap-3">
        <h2 className="text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Knowing the gap is the easy part.
        </h2>
        <p className="text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
          {topWeakness ? (
            <>
              You now know <span className="font-medium text-foreground">{topWeakness}</span> is costing
              you marks. The expensive part is the next three months — figuring out what to actually do
              about it, alone, from a hundred conflicting playlists.
            </>
          ) : (
            <>
              Your fundamentals are fine. The expensive part is the next three months — knowing what to
              cut, what to drill, and what simply won&apos;t move your rank.
            </>
          )}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        <Point icon={MessageSquareOff}>
          You&apos;ve already messaged a few seniors. One replied — two sentences, then nothing.
        </Point>
        <Point icon={CalendarX}>
          Months of unguided work, spent on topics that were never going to change your rank.
        </Point>
        <Point icon={Target}>
          Or 45 minutes with someone who sat this exact exam and cleared it — what to drop, what to
          drill, in what order.
        </Point>
      </ul>

      <p className="text-pretty font-heading text-lg leading-snug font-semibold">
        Talk to someone who was exactly where you are.
      </p>

      {mentors.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {mentors.map(({ mentor, nextSlot }, i) => (
              <MentorCard
                key={mentor.id}
                mentor={mentor}
                nextSlot={nextSlot}
                highlight={i === 0 && !!nextSlot}
              />
            ))}
          </div>
          <div className="flex flex-col items-center gap-3">
            <Button asChild variant="outline" size="lg">
              <Link href="/mentors">
                See all verified mentors <ArrowRight />
              </Link>
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
              Rank proof checked by a human. Mentor doesn&apos;t show up? Full refund, no argument.
            </p>
          </div>
        </>
      ) : (
        <Button asChild size="hero" emphasis="glow" className="w-full sm:w-auto sm:self-start">
          <Link href="/mentors">
            {cheapest ? `Talk to someone who cleared it — from ₹${cheapest}` : "Talk to someone who cleared it"}
            <ArrowRight />
          </Link>
        </Button>
      )}
    </section>
  );
}

function Point({ icon: Icon, children }: { icon: typeof Target; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[0.9375rem] leading-relaxed">
      <Icon className="mt-0.5 size-4.5 shrink-0 text-primary" />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

function ScoreRing({ percent }: { percent: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className="relative flex size-36 items-center justify-center">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-heading text-3xl font-bold tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}

function TopicBar({ stat }: { stat: TopicStat }) {
  const verdict = stat.accuracy >= 0.75 ? "strength" : stat.accuracy < 0.5 ? "weakness" : "neutral";
  const barColor =
    verdict === "strength" ? "bg-success" : verdict === "weakness" ? "bg-destructive" : "bg-highlight";
  const Icon = verdict === "strength" ? TrendingUp : verdict === "weakness" ? TrendingDown : Minus;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                "size-4",
                verdict === "strength"
                  ? "text-success"
                  : verdict === "weakness"
                    ? "text-destructive"
                    : "text-highlight"
              )}
            />
            <span className="font-medium">{stat.topic}</span>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {stat.correct}/{stat.total}
          </Badge>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${Math.round(stat.accuracy * 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
