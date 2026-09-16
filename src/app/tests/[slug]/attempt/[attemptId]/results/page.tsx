import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { claimAttempt } from "@/app/tests/[slug]/attempt/[attemptId]/actions";
import { ResultsReport, type ResultsMentor } from "@/components/assessment/results-report";
import { daysUntilSlot, pickNextSlot } from "@/lib/days";
import type { TopicStat, StudyPlan } from "@/lib/assessment/types";

export const dynamic = "force-dynamic";

const MENTORS_ON_RESULTS = 2;

/** Mentors with no open slot sort last. */
function slotDistance(slot: { dayOfWeek: number; startTime: string } | null) {
  return slot ? daysUntilSlot(slot.dayOfWeek, slot.startTime) : Number.MAX_SAFE_INTEGER;
}

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

  // Mentors shown here are NOT ranked by topic overlap. Telling a student
  // "this mentor closed your exact gap" is a claim we can't stand behind yet,
  // and a wrong match is worse than no match. We show a couple of verified
  // mentors and let the soonest-available one lead.
  const recommendedIds = attempt.result.recommendedMentorIds;
  const mentorProfiles = await prisma.mentorProfile.findMany({
    where: { verified: true, ...(recommendedIds.length > 0 ? { id: { in: recommendedIds } } : {}) },
    include: {
      user: { select: { name: true, image: true } },
      availability: { where: { isBooked: false } },
    },
    orderBy: { createdAt: "desc" },
    take: MENTORS_ON_RESULTS,
  });

  const mentors: ResultsMentor[] = mentorProfiles
    .map((m) => ({ mentor: m, nextSlot: pickNextSlot(m.availability) }))
    // Soonest bookable first — an open slot tomorrow converts better than a
    // better-looking profile with nothing free for nine days.
    .sort((a, b) => slotDistance(a.nextSlot) - slotDistance(b.nextSlot));

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
