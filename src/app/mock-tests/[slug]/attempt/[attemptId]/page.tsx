import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { finalizeIfExpired, serverClock } from "@/lib/mock-tests/attempts";
import { parseMockOptions } from "@/lib/mock-tests/types";
import { ExamRunner } from "@/components/mock-tests/exam-runner";

export const metadata = { title: "Mock test in progress", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MockAttemptPage({
  params,
}: {
  params: Promise<{ slug: string; attemptId: string }>;
}) {
  const { slug, attemptId } = await params;
  const user = await requireUser(`/mock-tests/${slug}/attempt/${attemptId}`);

  const attempt = await prisma.mockAttempt.findUnique({
    where: { id: attemptId },
    include: {
      responses: true,
      test: {
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: {
              // An explicit select: the answer key (correctOptionIds, natMin,
              // natMax, explanation) must never reach the browser mid-exam.
              questions: {
                orderBy: { number: "asc" },
                select: {
                  id: true,
                  number: true,
                  type: true,
                  prompt: true,
                  imageUrl: true,
                  options: true,
                  marks: true,
                  negativeMarks: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Only the student sitting the paper gets the exam screen — nobody else,
  // admins included, should be able to answer on their behalf.
  if (!attempt || attempt.test.slug !== slug || attempt.userId !== user.id) notFound();

  const resultUrl = `/mock-tests/${slug}/attempt/${attemptId}/result`;
  if (attempt.status !== "IN_PROGRESS" || (await finalizeIfExpired(attempt))) redirect(resultUrl);

  const sections = attempt.test.sections
    .filter((s) => s.questions.length > 0)
    .map((s) => ({
      id: s.id,
      name: s.name,
      instructions: s.instructions,
      questions: s.questions.map((q) => ({ ...q, options: parseMockOptions(q.options) })),
    }));
  if (sections.length === 0) notFound();

  return (
    <ExamRunner
      attemptId={attempt.id}
      slug={slug}
      title={attempt.test.title}
      durationMinutes={attempt.test.durationMinutes}
      calculator={attempt.test.calculator}
      sections={sections}
      initialResponses={attempt.responses.map((r) => ({
        questionId: r.questionId,
        selectedOptionIds: r.selectedOptionIds,
        numericAnswer: r.numericAnswer,
        status: r.status,
        timeSpentSeconds: r.timeSpentSeconds,
      }))}
      deadlineAt={attempt.deadlineAt.getTime()}
      serverNow={serverClock()}
      candidate={{ name: user.name ?? user.email ?? "Candidate", image: user.image ?? null }}
    />
  );
}
