import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { canViewMockAttempt, finalizeIfExpired } from "@/lib/mock-tests/attempts";
import { formatMarks } from "@/lib/mock-tests/scoring";
import { analyseAttempt, formatDuration, getCohortStats } from "@/lib/mock-tests/analytics";
import { parseMockOptions } from "@/lib/mock-tests/types";
import { AnalysisBoard } from "@/components/mock-tests/analysis/analysis-board";
import { OptionContent, QuestionPrompt } from "@/components/mock-tests/question-content";
import { KatexContent } from "@/components/katex-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BarChart3, Check, RotateCcw } from "lucide-react";

export const metadata = { title: "Mock test result", robots: { index: false } };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "incorrect", label: "Incorrect" },
  { key: "unattempted", label: "Unattempted" },
  { key: "correct", label: "Correct" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const formatNat = (n: number) => String(Number(n.toPrecision(12)));

export default async function MockResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; attemptId: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { slug, attemptId } = await params;
  const { show } = await searchParams;
  const base = `/mock-tests/${slug}/attempt/${attemptId}`;
  const viewer = await requireUser(`${base}/result`);

  let attempt = await loadAttempt(attemptId);
  if (!attempt || attempt.test.slug !== slug || !canViewMockAttempt(viewer, attempt)) notFound();

  if (await finalizeIfExpired(attempt)) attempt = (await loadAttempt(attemptId))!;
  const isOwner = attempt.userId === viewer.id;

  if (attempt.status !== "SUBMITTED") {
    if (isOwner) redirect(base);
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-bold">Still in progress</h1>
        <p className="mt-2 text-muted-foreground">
          {attempt.user.name ?? "This student"} hasn&apos;t submitted this paper yet. The scorecard appears here once
          they do, or when their time runs out.
        </p>
      </div>
    );
  }

  const filter: Filter = FILTERS.some((f) => f.key === show) ? (show as Filter) : "all";
  const responseByQuestion = new Map(attempt.responses.map((r) => [r.questionId, r]));
  const score = attempt.score ?? 0;
  const maxScore = attempt.maxScore ?? 0;
  const timeTaken = Math.max(
    0,
    Math.round(((attempt.submittedAt ?? attempt.deadlineAt).getTime() - attempt.startedAt.getTime()) / 1000)
  );

  const analysis = analyseAttempt(attempt.test.sections, attempt.test.questions, attempt.responses, score);
  const cohort = await getCohortStats(attempt.testId, attempt.id, score);

  const outcome = (questionId: string) => {
    const r = responseByQuestion.get(questionId);
    return r?.isCorrect === true ? "correct" : r?.isCorrect === false ? "incorrect" : "unattempted";
  };
  const visible = attempt.test.questions.filter((q) => filter === "all" || outcome(q.id) === filter);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {isOwner ? "Your scorecard" : `Scorecard · ${attempt.user.name ?? attempt.user.email ?? "Student"}`}
        </p>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{attempt.test.title}</h1>
        <p className="text-sm text-muted-foreground">
          Submitted{" "}
          {(attempt.submittedAt ?? attempt.deadlineAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          })}
          {attempt.autoSubmitted && " · auto-submitted when time ran out"}
        </p>
      </div>

      <div className="mt-6">
        <AnalysisBoard
          score={score}
          maxScore={maxScore}
          correct={attempt.correctCount ?? 0}
          incorrect={attempt.incorrectCount ?? 0}
          unattempted={attempt.unattemptedCount ?? 0}
          secondsTaken={timeTaken}
          durationMinutes={attempt.test.durationMinutes}
          analysis={analysis}
          cohort={cohort}
          isOwner={isOwner}
        />
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold">Question review</h2>
          <nav aria-label="Filter questions" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? `${base}/result` : `${base}/result?show=${f.key}`}
                scroll={false}
                aria-current={filter === f.key ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>

        {visible.length === 0 && (
          <p className="mt-6 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No questions in this group.
          </p>
        )}

        <ol className="mt-4 flex flex-col gap-4">
          {visible.map((q) => {
            const r = responseByQuestion.get(q.id);
            const state = outcome(q.id);
            const options = parseMockOptions(q.options);
            const correct = new Set(q.correctOptionIds);
            const chosen = new Set(r?.selectedOptionIds ?? []);
            return (
              <li key={q.id} id={`q-${q.number}`} className="scroll-mt-20 rounded-xl border bg-card p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-heading text-sm font-semibold">Question {q.number}</span>
                  <Badge variant="secondary">{q.type}</Badge>
                  {q.topic && <span className="text-muted-foreground">{q.topic}</span>}
                  <span className="ml-auto flex items-center gap-3">
                    {r && r.timeSpentSeconds > 0 && (
                      <span className="text-muted-foreground">{formatDuration(r.timeSpentSeconds)}</span>
                    )}
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                        state === "correct" && "bg-green-600/10 text-green-700 dark:text-green-400",
                        state === "incorrect" && "bg-red-600/10 text-red-700 dark:text-red-400",
                        state === "unattempted" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {state === "correct" ? "Correct" : state === "incorrect" ? "Incorrect" : "Not attempted"} ·{" "}
                      {formatMarks(r?.marksAwarded ?? 0, { sign: true })} / {formatMarks(q.marks)}
                    </span>
                  </span>
                </div>

                <QuestionPrompt number={q.number} prompt={q.prompt} imageUrl={q.imageUrl} />

                {q.type === "NAT" ? (
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{isOwner ? "Your answer" : "Student's answer"}</dt>
                      <dd className="font-mono font-semibold">{r?.numericAnswer ?? "—"}</dd>
                    </div>
                    <div className="rounded-lg border border-green-600/40 bg-green-600/5 px-3 py-2">
                      <dt className="text-xs text-muted-foreground">Accepted answer</dt>
                      <dd className="font-mono font-semibold">
                        {q.natMin === q.natMax
                          ? formatNat(q.natMin ?? 0)
                          : `${formatNat(q.natMin ?? 0)} to ${formatNat(q.natMax ?? 0)}`}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <ul className="mt-4 flex flex-col gap-2">
                    {options.map((opt) => {
                      const isCorrect = correct.has(opt.id);
                      const isChosen = chosen.has(opt.id);
                      return (
                        <li
                          key={opt.id}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm",
                            isCorrect && "border-green-600/50 bg-green-600/5",
                            isChosen && !isCorrect && "border-red-600/50 bg-red-600/5"
                          )}
                        >
                          <span className="w-5 shrink-0 font-semibold">{opt.id}.</span>
                          <OptionContent option={opt} />
                          <span className="ml-auto flex shrink-0 flex-col items-end gap-0.5 text-xs font-medium">
                            {isCorrect && (
                              <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
                                <Check className="size-3.5" /> Correct answer
                              </span>
                            )}
                            {isChosen && (
                              <span className={cn(!isCorrect && "text-red-700 dark:text-red-400")}>
                                {isOwner ? "You chose this" : "Chosen"}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {q.explanation && (
                  <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Solution</p>
                    <KatexContent text={q.explanation} className="leading-relaxed [overflow-wrap:anywhere]" />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {isOwner && (
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild variant="outline" size="lg">
            <Link href={`/mock-tests/${slug}`}>
              <RotateCcw /> Take it again
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/mock-tests">More mock tests</Link>
          </Button>
          <Button asChild size="lg">
            <Link href="/dashboard">
              <BarChart3 /> My progress
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function loadAttempt(attemptId: string) {
  return prisma.mockAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: { select: { name: true, email: true } },
      responses: true,
      test: {
        select: {
          slug: true,
          title: true,
          durationMinutes: true,
          sections: { orderBy: { order: "asc" }, select: { id: true, name: true } },
          questions: { orderBy: { number: "asc" } },
        },
      },
    },
  });
}
