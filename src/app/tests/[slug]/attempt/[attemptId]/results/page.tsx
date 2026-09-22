import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-helpers";
import { claimAttempt } from "@/app/tests/[slug]/attempt/[attemptId]/actions";
import { ResultsReport } from "@/components/assessment/results-report";
import { listRankedMentors } from "@/lib/mentors/list";
import type { TopicStat, StudyPlan } from "@/lib/assessment/types";

export const dynamic = "force-dynamic";

const MENTORS_ON_RESULTS = 2;

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
  const session = await getSession();

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

  // Picked now, as the page is viewed — not frozen into the result row at
  // submit time the way this used to be. A result opened three weeks later was
  // still advertising whoever happened to be newest on test day, and quietly
  // showed fewer mentors (sometimes none) once one of them was unverified.
  //
  // Ordered by soonest available, which is the one page where that is the
  // right call: a student reading their own score is as close to booking as
  // they will ever be, and "Thursday, 6:00 PM" converts. Still NOT ranked by
  // topic overlap — telling a student "this mentor closed your exact gap" is a
  // claim we can't stand behind yet, and a confident wrong match costs more
  // trust than it wins bookings.
  const mentors = await listRankedMentors({ limit: MENTORS_ON_RESULTS, order: "soonest" });

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
      mentors={mentors}
      canViewFullPlan={canViewFullPlan}
      attemptId={attemptId}
    />
  );
}
