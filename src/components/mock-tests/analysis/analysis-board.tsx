import { formatMarks } from "@/lib/mock-tests/scoring";
import { formatDuration, scoreShare, type AttemptAnalysis, type CohortStats, type GroupStat } from "@/lib/mock-tests/analytics";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RankByYear, RankDisclaimer, RankHeadline } from "@/components/rank-predictor/rank-breakdown";
import type { RankPrediction } from "@/lib/rank-predictor/predict";
import { MeterList, OutcomeBar, Panel, StatTile } from "./primitives";
import { QuestionTimeChart } from "./question-time-chart";

/** An honest one-line read of the score. Never shaming: every band points somewhere. */
function verdict(percent: number, attempted: number) {
  if (attempted === 0) return "Nothing was answered this time — the paper is still here whenever you want a proper go.";
  if (percent >= 75) return "Excellent. At this level, rank comes from the marks you don't throw away.";
  if (percent >= 55) return "A solid paper. The gap to the top is a handful of questions — the breakdown below shows which.";
  if (percent >= 35) return "A fair base to build on. Fix the two weakest areas below and this moves fast.";
  return "A tough one — and far better to find that out here than in the exam hall.";
}

const marksRow = (g: GroupStat) => ({
  label: g.label,
  share: scoreShare(g),
  figure: `${formatMarks(g.score)} / ${formatMarks(g.max)}`,
  detail: `${g.correct}/${g.total} correct`,
});

/**
 * The analysis shown above the question review once a paper is submitted:
 * what the score was, where it came from, where the time went, and what to do
 * about it.
 */
export function AnalysisBoard({
  score,
  maxScore,
  correct,
  incorrect,
  unattempted,
  secondsTaken,
  durationMinutes,
  analysis,
  cohort,
  isOwner,
  rank,
}: {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  secondsTaken: number;
  durationMinutes: number;
  analysis: AttemptAnalysis;
  cohort: CohortStats | null;
  isOwner: boolean;
  /** Present only for papers on the scale the rank data covers (JAM Physics, 100 marks). */
  rank: { prediction: RankPrediction; paperYear: number | null } | null;
}) {
  const total = correct + incorrect + unattempted;
  const attempted = correct + incorrect;
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null;
  const you = isOwner ? "You" : "This attempt";
  // On a standard JAM paper each section is one question type, so a "by type"
  // panel would repeat "by section" bar for bar. Show the split by marks instead.
  const typesMirrorSections =
    analysis.byType.length === analysis.bySection.length &&
    analysis.byType.every((t, i) => t.total === analysis.bySection[i].total && t.max === analysis.bySection[i].max);

  return (
    <div className="flex flex-col gap-4">
      {/* The one hero number on the page. */}
      <section className="grid gap-6 rounded-2xl border bg-linear-to-br from-primary/10 via-card to-card p-6 shadow-xs sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Score</p>
          <p className="mt-1 font-heading text-6xl font-bold tracking-tight">
            {formatMarks(score)}
            <span className="text-2xl font-medium text-muted-foreground"> / {formatMarks(maxScore)}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{percent}% of the marks</p>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-pretty text-[0.9375rem] leading-relaxed">{verdict(percent, attempted)}</p>
          <OutcomeBar correct={correct} incorrect={incorrect} skipped={unattempted} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Accuracy"
          value={accuracy === null ? "—" : accuracy}
          unit={accuracy === null ? undefined : "%"}
          hint={`${correct} right of ${attempted} attempted`}
        />
        <StatTile label="Attempted" value={attempted} unit={`/ ${total}`} hint={`${unattempted} left blank`} />
        <StatTile
          label="Time taken"
          value={formatDuration(secondsTaken)}
          hint={`of ${durationMinutes} min allowed`}
        />
        {cohort ? (
          <StatTile
            label="Standing"
            value={`#${cohort.rank}`}
            unit={`of ${cohort.attempts}`}
            hint={`Ahead of ${cohort.aheadOf}% of other attempts`}
          />
        ) : (
          <StatTile
            label="Lost to negative marking"
            value={analysis.negativeLost > 0 ? `−${formatMarks(analysis.negativeLost)}` : "0"}
            unit="marks"
            hint={analysis.negativeLost > 0 ? "From wrong MCQ answers" : "No penalties this time"}
          />
        )}
      </div>

      {rank && (
        <Panel
          title="What rank is this score?"
          subtitle={`${formatMarks(Math.max(0, score))} marks, set against the real exam's results in each of the last five years`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={`/rank-predictor?marks=${Math.max(0, score)}`}>
                Try other scores <ArrowRight />
              </Link>
            </Button>
          }
        >
          <div className="grid gap-6 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] md:items-center">
            <RankHeadline prediction={rank.prediction} className="[&_.text-6xl]:text-5xl" />
            <RankByYear prediction={rank.prediction} highlightYear={rank.paperYear} />
          </div>
          <RankDisclaimer />
        </Panel>
      )}

      {analysis.insights.length > 0 && (
        <Panel title="What this paper is telling you">
          <ul className="flex flex-col gap-3">
            {analysis.insights.map((text) => (
              <li key={text} className="flex gap-3 text-sm leading-relaxed">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
                <span className="text-pretty">{text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By section" subtitle="Marks scored out of the marks available">
          <MeterList rows={analysis.bySection.map(marksRow)} />
        </Panel>
        {typesMirrorSections ? (
          analysis.byMarks.length > 1 && (
            <Panel title="By question weight" subtitle="Whether the marks are going on the easy ones or the heavy ones">
              <MeterList rows={analysis.byMarks.map(marksRow)} />
            </Panel>
          )
        ) : (
          <Panel title="By question type" subtitle="MCQs carry negative marking; MSQ and NAT do not">
            <MeterList rows={analysis.byType.map(marksRow)} />
          </Panel>
        )}
      </div>

      {analysis.trackedSeconds > 0 && (
        <Panel
          title="Where the time went"
          subtitle="Time on each question, in paper order. Select a column to jump to its review."
        >
          <QuestionTimeChart
            bars={analysis.rows.map((r) => ({
              number: r.number,
              section: r.sectionName,
              type: r.type,
              outcome: r.outcome,
              seconds: r.timeSpent,
              marksText: `${formatMarks(r.awarded, { sign: true })} / ${formatMarks(r.marks)}`,
              timeText: formatDuration(r.timeSpent),
            }))}
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <TimeFact label="Average on correct" seconds={analysis.avgSecondsCorrect} />
            <TimeFact label="Average on incorrect" seconds={analysis.avgSecondsIncorrect} />
            {analysis.bySection.map((s) => (
              <TimeFact key={s.label} label={`Total in ${s.label}`} seconds={s.seconds} />
            ))}
          </dl>
        </Panel>
      )}

      <div className={cn("grid gap-4", cohort && analysis.byTopic.length > 1 && "lg:grid-cols-2")}>
        {analysis.byTopic.length > 1 && (
          <Panel title="By topic" subtitle="Weakest first — this is your revision order">
            <MeterList rows={analysis.byTopic.map(marksRow)} />
          </Panel>
        )}
        {cohort && (
          <Panel
            title="How this compares"
            subtitle={`Against ${cohort.attempts - 1} other attempts by ${cohort.students} students`}
          >
            <ul className="flex flex-col gap-3.5">
              {[
                { label: you, value: score, emphasis: true },
                { label: "Average", value: cohort.average, emphasis: false },
                { label: "Top score", value: cohort.top, emphasis: false },
              ].map((row) => (
                <li key={row.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                  <span className={cn(row.emphasis ? "font-semibold" : "text-muted-foreground")}>{row.label}</span>
                  <div className="h-3">
                    <div
                      className={cn("h-full min-w-0.5 rounded-r", row.emphasis ? "bg-primary" : "bg-muted-foreground/35")}
                      style={{ width: `${maxScore > 0 ? Math.max(0, Math.min(1, row.value / maxScore)) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="font-medium tabular-nums">{formatMarks(row.value)}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {you === "You" ? "You are" : "This attempt is"} ahead of{" "}
              <strong className="text-foreground">{cohort.aheadOf}%</strong> of the other attempts at this paper.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function TimeFact({ label, seconds }: { label: string; seconds: number | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{seconds === null ? "—" : formatDuration(seconds)}</dd>
    </div>
  );
}
