import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KatexContent } from "@/components/katex-content";
import { DeleteMockTestButton, MockPublishToggle } from "@/components/admin/mock-test-actions";
import { OptionContent, QuestionPrompt } from "@/components/mock-tests/question-content";
import { formatMarks, formatNegative } from "@/lib/mock-tests/scoring";
import { parseMockOptions } from "@/lib/mock-tests/types";
import { cn } from "@/lib/utils";
import { ExternalLink, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const ATTEMPTS_SHOWN = 200;

export default async function AdminMockTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = await prisma.mockTest.findUnique({
    where: { id },
    include: {
      sections: { orderBy: { order: "asc" }, include: { questions: { orderBy: { number: "asc" } } } },
      attempts: {
        orderBy: { startedAt: "desc" },
        take: ATTEMPTS_SHOWN,
        include: { user: { select: { name: true, email: true } } },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!test) notFound();

  const questionCount = test.sections.reduce((n, s) => n + s.questions.length, 0);
  const totalMarks = test.sections.reduce((n, s) => n + s.questions.reduce((m, q) => m + q.marks, 0), 0);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={test.title}
        description={`/mock-tests/${test.slug} — ${test.durationMinutes} min — ${questionCount} questions — ${formatMarks(totalMarks)} marks`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MockPublishToggle testId={test.id} published={test.published} />
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/mock-tests/${test.slug}`}>
                <ExternalLink className="size-3.5" /> Open
              </Link>
            </Button>
            <DeleteMockTestButton testId={test.id} attempts={test._count.attempts} />
          </div>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Attempts <span className="font-normal text-muted-foreground">({test._count.attempts})</span>
        </h2>
        {test.attempts.length === 0 ? (
          <EmptyState icon={Users} title="No attempts yet" />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Student</th>
                  <th className="px-3 py-2 text-left font-medium">Started</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Correct / Wrong</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {test.attempts.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{a.user.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{a.user.email}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {a.startedAt.toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kolkata",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      {a.status === "SUBMITTED" ? (
                        <Badge variant="secondary">{a.autoSubmitted ? "Timed out" : "Submitted"}</Badge>
                      ) : (
                        <Badge variant="outline">In progress</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.status === "SUBMITTED" ? `${a.correctCount} / ${a.incorrectCount}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {a.status === "SUBMITTED" ? `${formatMarks(a.score ?? 0)} / ${formatMarks(a.maxScore ?? 0)}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/mock-tests/${test.slug}/attempt/${a.id}/result`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {test._count.attempts > ATTEMPTS_SHOWN && (
          <p className="text-xs text-muted-foreground">Showing the latest {ATTEMPTS_SHOWN}.</p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Paper and answer key</h2>
          <p className="text-sm text-muted-foreground">
            Read-only — check it against the source PDF after every import. To change anything, edit the paper file and
            import it again.
          </p>
        </div>
        {test.sections.map((s) => (
          <div key={s.id} className="flex flex-col gap-3">
            <h3 className="font-semibold">{s.name}</h3>
            {s.instructions && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{s.instructions}</p>}
            {s.questions.map((q) => {
              const correct = new Set(q.correctOptionIds);
              return (
                <div key={q.id} className="rounded-lg border bg-card p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-sm font-semibold">Q{q.number}</span>
                    <Badge variant="secondary">{q.type}</Badge>
                    <span className="text-muted-foreground">
                      +{formatMarks(q.marks)}
                      {q.negativeMarks > 0 && ` / −${formatNegative(q.marks, q.negativeMarks)}`}
                    </span>
                    {q.topic && <span className="text-muted-foreground">· {q.topic}</span>}
                  </div>
                  <QuestionPrompt number={q.number} prompt={q.prompt} imageUrl={q.imageUrl} className="text-sm" />
                  {q.type === "NAT" ? (
                    <p className="mt-3 text-sm">
                      Accepted:{" "}
                      <span className="font-mono font-semibold text-green-700 dark:text-green-400">
                        {q.natMin === q.natMax ? q.natMin : `${q.natMin} to ${q.natMax}`}
                      </span>
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                      {parseMockOptions(q.options).map((opt) => (
                        <li
                          key={opt.id}
                          className={cn(
                            "flex gap-2 rounded-md px-2 py-1",
                            correct.has(opt.id) && "bg-green-600/10 font-medium text-green-800 dark:text-green-300"
                          )}
                        >
                          <span className="shrink-0">({opt.id})</span>
                          <OptionContent option={opt} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.explanation && (
                    <KatexContent text={q.explanation} className="mt-3 border-t pt-3 text-sm text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
}
