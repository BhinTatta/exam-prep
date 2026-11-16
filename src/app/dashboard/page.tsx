import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { formatDuration, getStudentProgress, type GroupStat } from "@/lib/mock-tests/analytics";
import { formatMarks } from "@/lib/mock-tests/scoring";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { MeterList, Panel, StatTile } from "@/components/mock-tests/analysis/primitives";
import { ScoreTrendChart } from "@/components/mock-tests/analysis/score-trend-chart";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Clock, Minus } from "lucide-react";

export const metadata = { title: "My progress", robots: { index: false } };
export const dynamic = "force-dynamic";

const IST = "Asia/Kolkata";
const fullDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST });
const shortDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });

const accuracyRow = (g: GroupStat) => ({
  label: g.label,
  share: g.correct / g.total,
  figure: `${Math.round((g.correct / g.total) * 100)}%`,
  detail: `${g.correct}/${g.total} correct`,
});

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const progress = await getStudentProgress(user.id);
  const { attempts } = progress;
  const firstName = user.name?.trim().split(/\s+/)[0];

  if (attempts.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <PageHeader title="My progress" />
        <ResumeBanner running={progress.inProgress} />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <BarChart3 className="size-6 text-primary" />
          </div>
          <div>
            <p className="font-heading text-lg font-semibold">Your scores will chart themselves here</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Sit a mock test and this page fills in: your score trend, your accuracy, and which topics are costing
              you marks.
            </p>
          </div>
          <Button asChild size="xl" emphasis="lift">
            <Link href="/mock-tests">
              Take a mock test <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const latest = attempts[attempts.length - 1];
  const change = progress.lastChange;
  const history = [...attempts].reverse();
  // Topics: the three weakest and the three strongest, when there are enough to split.
  const topics = progress.byTopic;
  const split = topics.length >= 6;
  const weak = split ? topics.slice(0, 3) : topics;
  const strong = split ? topics.slice(-3).reverse() : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10">
      <PageHeader
        title={firstName ? `${firstName}'s progress` : "My progress"}
        description={`${attempts.length} mock test${attempts.length === 1 ? "" : "s"} taken across ${progress.papers} paper${progress.papers === 1 ? "" : "s"}.`}
        action={
          <Button asChild emphasis="lift">
            <Link href="/mock-tests">
              Take a mock test <ArrowRight />
            </Link>
          </Button>
        }
      />
      <ResumeBanner running={progress.inProgress} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Latest score"
          value={latest.percent}
          unit="%"
          hint={
            change === null ? (
              `${formatMarks(latest.score)} / ${formatMarks(latest.maxScore)}`
            ) : (
              <span className="flex items-center gap-1">
                {change > 0 ? (
                  <ArrowUpRight className="size-3.5 text-success" />
                ) : change < 0 ? (
                  <ArrowDownRight className="size-3.5 text-destructive" />
                ) : (
                  <Minus className="size-3.5" />
                )}
                {change === 0
                  ? "Same as the attempt before"
                  : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} points on the attempt before`}
              </span>
            )
          }
        />
        <StatTile label="Best score" value={progress.bestPercent} unit="%" hint={`Average ${progress.averagePercent}%`} />
        <StatTile
          label="Accuracy"
          value={progress.accuracy ?? "—"}
          unit={progress.accuracy === null ? undefined : "%"}
          hint={`${progress.questionsAnswered} question${progress.questionsAnswered === 1 ? "" : "s"} answered`}
        />
        <StatTile
          label="Time practised"
          value={formatDuration(progress.practiceSeconds)}
          hint={`Across ${attempts.length} attempt${attempts.length === 1 ? "" : "s"}`}
        />
      </div>

      <Panel
        title="Score trend"
        subtitle={
          attempts.length === 1
            ? "One attempt so far. Take another and the line starts here."
            : "Score as a share of each paper's marks, oldest attempt first. Select a point to open its analysis."
        }
      >
        <ScoreTrendChart
          points={attempts.map((a) => ({
            id: a.id,
            href: `/mock-tests/${a.slug}/attempt/${a.id}/result`,
            title: a.title,
            date: fullDate(a.submittedAt),
            shortDate: shortDate(a.submittedAt),
            percent: a.percent,
            scoreText: `${formatMarks(a.score)} / ${formatMarks(a.maxScore)}`,
          }))}
        />
      </Panel>

      {(topics.length > 0 || progress.byType.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {topics.length > 0 && (
            <Panel
              title={split ? "Needs work" : "Accuracy by topic"}
              subtitle={split ? "Your three weakest topics, on questions you attempted" : "On questions you attempted, weakest first"}
            >
              <MeterList rows={weak.map(accuracyRow)} />
            </Panel>
          )}
          {strong.length > 0 && (
            <Panel title="Strongest" subtitle="Where your marks are safest">
              <MeterList rows={strong.map(accuracyRow)} />
            </Panel>
          )}
          {progress.byType.length > 0 && (
            <Panel
              title="Accuracy by question type"
              subtitle="On questions you attempted, across every paper"
              className={split || topics.length === 0 ? "lg:col-span-2" : undefined}
            >
              <MeterList rows={progress.byType.map(accuracyRow)} />
            </Panel>
          )}
        </div>
      )}

      <Panel title="Every attempt" subtitle="Newest first">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 pl-5 text-left font-medium">Paper</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Accuracy</th>
                <th className="px-3 py-2 text-right font-medium">Time</th>
                <th className="py-2 pr-5 pl-3" />
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="max-w-56 truncate py-3 pr-3 pl-5 font-medium">{a.title}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{fullDate(a.submittedAt)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                    <span className="font-medium">{formatMarks(a.score)}</span>
                    <span className="text-muted-foreground"> / {formatMarks(a.maxScore)}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{a.accuracy === null ? "—" : `${a.accuracy}%`}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatDuration(a.seconds)}
                  </td>
                  <td className="py-3 pr-5 pl-3 text-right">
                    <Link
                      href={`/mock-tests/${a.slug}/attempt/${a.id}/result`}
                      className="font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline"
                    >
                      Analysis
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ResumeBanner({ running }: { running: { id: string; slug: string; title: string; deadlineAt: Date }[] }) {
  if (running.length === 0) return null;
  return (
    <ul className="mb-4 flex flex-col gap-2">
      {running.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-highlight/50 bg-highlight/10 px-4 py-3"
        >
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <Clock className="size-4 shrink-0" />
            <span className="truncate">
              <strong>{r.title}</strong> is in progress and its clock is running.
            </span>
          </p>
          <Button asChild size="sm">
            <Link href={`/mock-tests/${r.slug}/attempt/${r.id}`}>Resume</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
