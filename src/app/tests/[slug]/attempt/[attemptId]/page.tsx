import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TestRunner } from "@/components/assessment/test-runner";
import { parseQuestionOptions } from "@/lib/assessment/types";

export const dynamic = "force-dynamic";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ slug: string; attemptId: string }>;
}) {
  const { slug, attemptId } = await params;

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          questions: { where: { isActive: true }, orderBy: [{ section: "asc" }, { order: "asc" }] },
        },
      },
    },
  });

  if (!attempt || attempt.test.slug !== slug) notFound();
  if (attempt.status !== "IN_PROGRESS") redirect(`/tests/${slug}/attempt/${attemptId}/results`);

  const questions = attempt.test.questions.map((q) => ({
    id: q.id,
    section: q.section,
    topic: q.topic,
    prompt: q.prompt,
    imageUrl: q.imageUrl,
    options: parseQuestionOptions(q.options),
  }));

  return (
    <TestRunner
      attemptId={attempt.id}
      slug={slug}
      testTitle={attempt.test.title}
      durationMinutes={attempt.test.durationMinutes}
      questions={questions}
    />
  );
}
