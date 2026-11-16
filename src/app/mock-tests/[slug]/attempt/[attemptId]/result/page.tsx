import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { canViewMockAttempt, finalizeIfExpired } from "@/lib/mock-tests/attempts";
import { formatMarks, roundMarks } from "@/lib/mock-tests/scoring";
import { parseMockOptions, type MockSectionStat } from "@/lib/mock-tests/types";
import { OptionContent, QuestionPrompt } from "@/components/mock-tests/question-content";
import { KatexContent } from "@/components/katex-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Clock, Minus, RotateCcw, X } from "lucide-react";

export const metadata = { title: "Mock test result", robots: { index: false } };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "incorrect", label: "Incorrect" },
  { key: "unattempted", label: "Unattempted" },
  { key: "correct", label: "Correct" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

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
  const sectionStats = (attempt.sectionBreakdown as MockSectionStat[] | null) ?? [];
  const score = attempt.score ?? 0;
  const maxScore = attempt.maxScore ?? 0;
  const attempted = (attempt.correctCount ?? 0) + (attempt.incorrectCount ?? 0);
  const accuracy = attempted > 0 ? Math.round(((attempt.correctCount ?? 0) / attempted) * 100) : null;
  const timeTaken = Math.max(
    0,
    Math.round(((attempt.submittedAt ?? attempt.deadlineAt).getTime() - attempt.startedAt.getTime()) / 1000)
  );

  // Topic view only when the paper was tagged — untagged papers skip it
  // rather than showing one row called "Other".
  const topics = new Map<string, { total: number; correct: number; incorrect: number; score: number; max: number }>();
  for (const q of attempt.test.questions) {
    if (!q.topic) continue;
    const t = topics.get(q.topic) ?? { total: 0, correct: 0, incorrect: 0, score: 0, max: 0 };
    const r = responseByQuestion.get(q.id);
    t.total += 1;
    t.max += q.marks;
    t.score += r?.marksAwarded ?? 0;
    if (r?.isCorrect === true) t.correct += 1;
    if (r?.isCorrect === false) t.incorrect += 1;
    topics.set(q.topic, t);
  }
  const topicRows = [...topics.entries()].sort((a, b) => a[1].score / a[1].max - b[1].score / b[1].max);

  const outcome = (questionId: string) => {
    const r = responseByQuestion.get(questionId);
    return r?.isCorrect === true ? "correct" : r?.isCorrect === false ? "incorrect" : "unattempted";
  };
  const visible = attempt.test.questions.filter((q) => filter === "all" || outcome(q.id) === filter);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
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

      <div className="mt-6 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Score</p>
          <p className="mt-1 font-heading text-4xl font-bold tabular-nums">
            {formatMarks(score)}
            <span className="text-lg font-medium text-muted-foreground"> / {formatMarks(maxScore)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {accuracy === null ? "No questions attempted" : `${accuracy}% accuracy on attempted questions`}
          </p>
        </div>
        <Stat icon={Check} tone="text-green-700 dark:text-green-400" label="Correct" value={attempt.correctCount ?? 0} />
        <Stat icon={X} tone="text-red-700 dark:text-red-400" label="Incorrect" value={attempt.incorrectCount ?? 0} />
        <Stat icon={Minus} tone="text-muted-foreground" label="Unattempted" value={attempt.unattemptedCount ?? 0} />
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="size-4" /> Time taken: {formatDuration(timeTaken)} of {attempt.test.durationMinutes} min
      </p>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Section-wise</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Section</th>
                <th className="px-3 py-2 text-right font-medium">Attempted</th>
                <th className="px-3 py-2 text-right font-medium">Correct</th>
                <th className="px-3 py-2 text-right font-medium">Incorrect</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sectionStats.map((s) => (
                <tr key={s.sectionId} className="border-t">
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-right">
                    {s.attempted} / {s.questions}
                  </td>
                  <td className="px-3 py-2 text-right">{s.correct}</td>
                  <td className="px-3 py-2 text-right">{s.incorrect}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatMarks(s.score)} / {formatMarks(s.maxScore)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {topicRows.length > 1 && (
        <section className="mt-8">
          <h2 className="font-heading text-lg font-semibold">Topic-wise</h2>
          <p className="text-sm text-muted-foreground">Weakest first.</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {topicRows.map(([topic, t]) => {
              const pct = Math.max(0, Math.min(100, (t.score / t.max) * 100));
              return (
                <li key={topic} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
                  <span className="truncate font-medium">{topic}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {t.correct}/{t.total} correct · {formatMarks(roundMarks(t.score))}/{formatMarks(t.max)}
                  </span>
                  <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
              <li key={q.id} className="rounded-xl border bg-card p-4 sm:p-5">
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
          <Button asChild size="lg">
            <Link href="/mock-tests">More mock tests</Link>
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
          questions: { orderBy: { number: "asc" } },
        },
      },
    },
  });
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof Check;
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={cn("size-3.5", tone)} /> {label}
      </p>
      <p className="mt-1 font-heading text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
