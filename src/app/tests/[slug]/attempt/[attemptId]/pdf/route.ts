import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { siteConfig } from "@/config/site";
import { renderStudyPlanPdf } from "@/lib/assessment/study-plan-pdf";
import type { TopicStat, StudyPlan } from "@/lib/assessment/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; attemptId: string }> }
) {
  const { slug, attemptId } = await params;
  const session = await auth();
  if (!session?.user) return new Response("Sign in required", { status: 401 });

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true, result: true },
  });

  if (!attempt || attempt.test.slug !== slug || !attempt.result || !attempt.result.studyPlan) {
    return new Response("Not found", { status: 404 });
  }
  if (attempt.userId !== session.user.id) return new Response("This result belongs to a different account", { status: 403 });

  const mentors = attempt.result.recommendedMentorIds.length
    ? await prisma.mentorProfile.findMany({
        where: { id: { in: attempt.result.recommendedMentorIds } },
        include: { user: { select: { name: true } } },
      })
    : [];

  const bytes = await renderStudyPlanPdf({
    siteName: siteConfig.name,
    testTitle: attempt.test.title,
    totalScore: attempt.result.totalScore,
    maxScore: attempt.result.maxScore,
    topicBreakdown: attempt.result.topicBreakdown as unknown as TopicStat[],
    studyPlan: attempt.result.studyPlan as unknown as StudyPlan,
    mentors: mentors.map((m) => ({ name: m.user.name ?? "Mentor", institute: m.institute, rate: m.rate })),
  });

  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${attempt.test.slug}-study-plan.pdf"`,
    },
  });
}
