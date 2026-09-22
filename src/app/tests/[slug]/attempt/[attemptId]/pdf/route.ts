import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-helpers";
import { siteConfig } from "@/config/site";
import { renderStudyPlanPdf } from "@/lib/assessment/study-plan-pdf";
import { listRankedMentors } from "@/lib/mentors/list";
import type { TopicStat, StudyPlan } from "@/lib/assessment/types";

const MENTORS_IN_PDF = 3;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; attemptId: string }> }
) {
  const { slug, attemptId } = await params;
  const session = await getSession();
  if (!session?.user) return new Response("Sign in required", { status: 401 });

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true, result: true },
  });

  if (!attempt || attempt.test.slug !== slug || !attempt.result || !attempt.result.studyPlan) {
    return new Response("Not found", { status: 404 });
  }
  if (attempt.userId !== session.user.id) return new Response("This result belongs to a different account", { status: 403 });

  // The same mentors the results page would show right now, rather than the
  // set frozen against this attempt when it was submitted. A study plan
  // downloaded weeks later should point at mentors who are still verified and
  // still taking sessions.
  const mentors = await listRankedMentors({ limit: MENTORS_IN_PDF, order: "soonest" });

  const bytes = await renderStudyPlanPdf({
    siteName: siteConfig.name,
    testTitle: attempt.test.title,
    totalScore: attempt.result.totalScore,
    maxScore: attempt.result.maxScore,
    topicBreakdown: attempt.result.topicBreakdown as unknown as TopicStat[],
    studyPlan: attempt.result.studyPlan as unknown as StudyPlan,
    mentors: mentors.map(({ mentor }) => ({
      name: mentor.user.name ?? "Mentor",
      institute: mentor.institute,
      rate: mentor.rate,
    })),
  });

  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${attempt.test.slug}-study-plan.pdf"`,
    },
  });
}
