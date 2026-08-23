"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { scoreAttempt, type ScoredAnswer } from "@/lib/assessment/scoring";
import { generateStudyPlan } from "@/lib/ai/study-plan";
import { recommendMentors } from "@/lib/assessment/mentor-match";
import { parseQuestionOptions } from "@/lib/assessment/types";

export async function submitAttempt(attemptId: string, answers: ScoredAnswer[]) {
  const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { test: { include: { questions: true } } },
  });

  // Idempotent: a double-click or back-navigation resubmit is a no-op, not a rescore.
  if (attempt.status !== "IN_PROGRESS") return;

  const scoring = scoreAttempt(attempt.test.questions, answers);

  const profileQuestions = attempt.test.questions.filter((q) => q.section === "PROFILE");
  const profile: Record<string, string> = {};
  const profileResponses = profileQuestions.flatMap((q) => {
    const answer = answers.find((a) => a.questionId === q.id);
    if (!answer || answer.selectedOptionIds.length === 0) return [];
    const label = parseQuestionOptions(q.options).find((o) => o.id === answer.selectedOptionIds[0])?.label;
    if (label) profile[q.topic] = label;
    return [{ questionId: q.id, selectedOptionIds: answer.selectedOptionIds, isCorrect: null, marksAwarded: null }];
  });

  // Mentors are shown to everyone regardless of sign-in — see ResultsReport.
  // The study plan is generated for everyone too (its headline is the free
  // hook; the full topic-by-topic breakdown and PDF export are what's
  // gated behind sign-in — see the results page).
  const [recommendedMentors, studyPlan] = await Promise.all([
    recommendMentors(scoring.weaknesses),
    generateStudyPlan({
      testTitle: attempt.test.title,
      totalScore: scoring.totalScore,
      maxScore: scoring.maxScore,
      topicBreakdown: scoring.topicBreakdown,
      strengths: scoring.strengths,
      weaknesses: scoring.weaknesses,
      profile,
    }),
  ]);

  await prisma.$transaction([
    prisma.attemptResponse.createMany({
      data: [...scoring.responses, ...profileResponses].map((r) => ({ attemptId, ...r })),
    }),
    prisma.assessmentAttempt.update({
      where: { id: attemptId },
      data: { status: "EVALUATED", submittedAt: new Date() },
    }),
    prisma.attemptResult.create({
      data: {
        attemptId,
        totalScore: scoring.totalScore,
        maxScore: scoring.maxScore,
        topicBreakdown: scoring.topicBreakdown,
        strengths: scoring.strengths,
        weaknesses: scoring.weaknesses,
        profileAnswers: profile,
        studyPlan,
        recommendedMentorIds: recommendedMentors.map((m) => m.id),
      },
    }),
  ]);
}

/**
 * Attaches an anonymous attempt to the signed-in user. Safe to call
 * repeatedly (idempotent) — only claims attempts that are still unclaimed.
 */
export async function claimAttempt(attemptId: string) {
  const session = await auth();
  if (!session?.user) return;

  await prisma.assessmentAttempt.updateMany({
    where: { id: attemptId, userId: null },
    data: { userId: session.user.id },
  });
}
