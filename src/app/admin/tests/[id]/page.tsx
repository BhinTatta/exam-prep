import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KatexContent } from "@/components/katex-content";
import { TestFormDialog } from "@/components/admin/test-form-dialog";
import { PublishToggle, DeleteTestButton, DeleteQuestionButton } from "@/components/admin/test-actions";
import { QuestionFormDialog } from "@/components/admin/question-form-dialog";
import { parseQuestionOptions } from "@/lib/assessment/types";
import { ListChecks } from "lucide-react";
import type { AssessmentQuestion } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminTestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const test = await prisma.test.findUnique({
    where: { id },
    include: { questions: { orderBy: [{ section: "asc" }, { order: "asc" }] } },
  });
  if (!test) notFound();

  const profileQuestions = test.questions.filter((q) => q.section === "PROFILE");
  const contentQuestions = test.questions.filter((q) => q.section === "CONTENT");
  const nextOrder = (test.questions.at(-1)?.order ?? -1) + 1;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={test.title}
        description={`/tests/${test.slug} — ${test.durationMinutes} min — ${test.questions.length} questions`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PublishToggle testId={test.id} published={test.published} />
            <TestFormDialog mode="edit" test={test} />
            <DeleteTestButton testId={test.id} />
          </div>
        }
      />

      {test.published && contentQuestions.length === 0 && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          This test is published but has no content questions yet — test-takers won&apos;t be able to start it meaningfully.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Profile questions</h2>
          <QuestionFormDialog testId={test.id} mode="create" nextOrder={nextOrder} />
        </div>
        <p className="text-sm text-muted-foreground">
          Shown before the timed section. No correct answer — used to personalize the study plan.
        </p>
        {profileQuestions.length === 0 ? (
          <EmptyState icon={ListChecks} title="No profile questions yet" />
        ) : (
          <QuestionList questions={profileQuestions} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Content questions</h2>
        {contentQuestions.length === 0 ? (
          <EmptyState icon={ListChecks} title="No content questions yet" description="Add scored physics questions below." />
        ) : (
          <QuestionList questions={contentQuestions} />
        )}
      </section>
    </div>
  );
}

function QuestionList({ questions }: { questions: AssessmentQuestion[] }) {
  return (
    <div className="flex flex-col gap-3">
      {questions.map((q) => {
        const options = parseQuestionOptions(q.options);
        return (
          <Card key={q.id} className={!q.isActive ? "opacity-60" : undefined}>
            <CardContent className="flex items-start justify-between gap-4 pt-6">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{q.topic}</Badge>
                  {!q.isActive && <Badge variant="outline">Inactive</Badge>}
                  {q.section === "CONTENT" && (
                    <span className="text-xs text-muted-foreground">
                      +{q.marks} / -{q.negativeMarks}
                    </span>
                  )}
                </div>
                <KatexContent text={q.prompt} className="text-sm" />
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {options.map((o) => (
                    <li key={o.id} className={q.correctOptionIds.includes(o.id) ? "font-medium text-foreground" : undefined}>
                      {q.correctOptionIds.includes(o.id) ? "✓ " : "· "}
                      {o.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <QuestionFormDialog testId={q.testId} mode="edit" question={q} />
                <DeleteQuestionButton questionId={q.id} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
