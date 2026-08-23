import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StudyPlanSection } from "@/components/assessment/study-plan-section";
import { cn } from "@/lib/utils";
import type { TopicStat, StudyPlan } from "@/lib/assessment/types";
import type { MentorProfile, User } from "@prisma/client";
import { TrendingUp, TrendingDown, Minus, IndianRupee } from "lucide-react";

type Mentor = MentorProfile & { user: Pick<User, "name" | "image"> };

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
  mentors: Mentor[];
  canViewFullPlan: boolean;
  attemptId: string;
}) {
  const pct = maxScore > 0 ? Math.max(0, Math.round((totalScore / maxScore) * 100)) : 0;
  const callbackUrl = `/tests/${slug}/attempt/${attemptId}/results`;
  const topWeakness = topicBreakdown
    .filter((t) => t.accuracy < 0.5)
    .sort((a, b) => a.accuracy - b.accuracy)[0]?.topic;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{testTitle}</p>
        <ScoreRing percent={pct} />
        <p className="text-sm text-muted-foreground">
          {totalScore} / {maxScore} marks
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Topic breakdown</h2>
        <div className="flex flex-col gap-3">
          {topicBreakdown.map((t) => (
            <TopicBar key={t.topic} stat={t} />
          ))}
        </div>
      </div>

      <StudyPlanSection
        studyPlan={studyPlan}
        canViewFull={canViewFullPlan}
        callbackUrl={callbackUrl}
        pdfUrl={`/tests/${slug}/attempt/${attemptId}/pdf`}
      />

      {mentors.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Worth talking to someone?</h2>
            <p className="text-sm text-muted-foreground">
              {topWeakness
                ? `You're weakest in ${topWeakness} — these mentors have been exactly where you are and closed that
                   same gap. One real conversation usually beats another week of solo grinding.`
                : `Solid all-round score — a mentor session now is about sharpening an edge, not fixing a gap.`}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {mentors.map((m) => (
              <Link key={m.id} href={`/mentors/${m.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-3 pt-6">
                    <Avatar className="size-10">
                      <AvatarImage src={m.user.image ?? undefined} />
                      <AvatarFallback>{(m.user.name ?? "M").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.institute}</p>
                    </div>
                    <p className="flex shrink-0 items-center gap-0.5 text-sm font-medium">
                      <IndianRupee className="size-3.5" />
                      {m.rate}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <Link href="/mentors" className="self-center">
            <Button variant="outline" size="sm">
              Book a call
            </Button>
          </Link>
        </div>
      )}

      <div className="flex justify-center">
        <Link href={`/tests/${slug}`}>
          <Button variant="outline">Retake the test</Button>
        </Link>
      </div>
    </div>
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
        <span className="text-3xl font-bold tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}

function TopicBar({ stat }: { stat: TopicStat }) {
  const verdict = stat.accuracy >= 0.75 ? "strength" : stat.accuracy < 0.5 ? "weakness" : "neutral";
  const barColor =
    verdict === "strength" ? "bg-emerald-500" : verdict === "weakness" ? "bg-red-500" : "bg-amber-500";
  const Icon = verdict === "strength" ? TrendingUp : verdict === "weakness" ? TrendingDown : Minus;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                "size-4",
                verdict === "strength" ? "text-emerald-500" : verdict === "weakness" ? "text-red-500" : "text-amber-500"
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
