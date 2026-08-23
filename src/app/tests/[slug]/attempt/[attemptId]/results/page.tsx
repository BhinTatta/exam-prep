import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { claimAttempt } from "@/app/tests/[slug]/attempt/[attemptId]/actions";
import { ResultsReport } from "@/components/assessment/results-report";
import type { TopicStat, StudyPlan } from "@/lib/assessment/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; attemptId: string }> }) {
  const { attemptId } = await params;
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    select: { test: { select: { title: true } } },
  });
  return { title: attempt ? `Your result — ${attempt.test.title}` : "Result" };
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string; attemptId: string }>;
}) {
  const { slug, attemptId } = await params;
  const session = await auth();

  if (session?.user) {
    await claimAttempt(attemptId);
  }

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true, result: true },
  });

  if (!attempt || attempt.test.slug !== slug) notFound();
  if (!attempt.result) {
    if (attempt.status === "IN_PROGRESS") redirect(`/tests/${slug}/attempt/${attemptId}`);
    notFound();
  }

  const mentors = attempt.result.recommendedMentorIds.length
    ? await prisma.mentorProfile.findMany({
        where: { id: { in: attempt.result.recommendedMentorIds } },
        include: { user: { select: { name: true, image: true } } },
      })
    : [];
  const mentorsById = new Map(mentors.map((m) => [m.id, m]));
  const orderedMentors = attempt.result.recommendedMentorIds
    .map((id) => mentorsById.get(id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined);

  const canViewFullPlan = !!session?.user && session.user.id === attempt.userId;
  const fullStudyPlan = attempt.result.studyPlan as unknown as StudyPlan | null;
  // The blurred "unlock" teaser is a visual nudge, not a real access boundary —
  // the per-topic advice text must never reach the client for a viewer who
  // hasn't unlocked it, or it's trivially readable via view-source.
  const studyPlan: StudyPlan | null =
    canViewFullPlan || !fullStudyPlan
      ? fullStudyPlan
      : {
          ...fullStudyPlan,
          topics: fullStudyPlan.topics.map((t) => ({
            ...t,
            advice: "Sign in to see the specific advice for this topic.",
          })),
        };

  return (
    <ResultsReport
      slug={slug}
      testTitle={attempt.test.title}
      totalScore={attempt.result.totalScore}
      maxScore={attempt.result.maxScore}
      topicBreakdown={attempt.result.topicBreakdown as unknown as TopicStat[]}
      studyPlan={studyPlan}
      mentors={orderedMentors}
      canViewFullPlan={canViewFullPlan}
      attemptId={attemptId}
    />
  );
}
