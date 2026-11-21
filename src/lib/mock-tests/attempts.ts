import "server-only";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/roles";
import { scoreMockAttempt } from "./scoring";
import type { ResponseEntry } from "./types";

/**
 * How long after the deadline the server still accepts a submission. The
 * browser submits at 0:00 on its own clock; this absorbs the request's travel
 * time and a little clock drift so an on-time paper is never rejected.
 */
export const SUBMIT_GRACE_MS = 60_000;

/** The server's clock, for seeding the browser countdown. */
export const serverClock = () => Date.now();

/**
 * Who may look at a submitted attempt. The owner and admins today.
 *
 * This is the one place to widen when mentors get access — e.g. "a mentor with
 * a booking with this student". It is deliberately not "any MENTOR": a
 * student's paper is theirs until they share it.
 */
export function canViewMockAttempt(
  viewer: { id: string; role?: string } | null | undefined,
  attempt: { userId: string }
) {
  if (!viewer) return false;
  return viewer.id === attempt.userId || hasRole(viewer.role, "ADMIN");
}

/**
 * Scores an attempt and closes it. Safe to call twice — the second call finds
 * it already submitted and does nothing.
 *
 * `entries` is the exam screen's full picture when the student submits. When
 * it's omitted (the clock ran out with the tab closed), the answers last saved
 * to the server are what gets scored.
 */
export async function finalizeMockAttempt(
  attemptId: string,
  { entries, autoSubmitted }: { entries?: ResponseEntry[]; autoSubmitted: boolean }
) {
  const attempt = await prisma.mockAttempt.findUnique({
    where: { id: attemptId },
    include: {
      responses: true,
      test: {
        select: {
          sections: { select: { id: true, name: true }, orderBy: { order: "asc" } },
          questions: {
            select: {
              id: true,
              sectionId: true,
              type: true,
              correctOptionIds: true,
              altCorrectOptionIds: true,
              natMin: true,
              natMax: true,
              marks: true,
              negativeMarks: true,
              marksToAll: true,
            },
          },
        },
      },
    },
  });
  if (!attempt || attempt.status !== "IN_PROGRESS") return;

  const questionIds = new Set(attempt.test.questions.map((q) => q.id));
  const source: ResponseEntry[] =
    entries?.filter((e) => questionIds.has(e.questionId)) ??
    attempt.responses.map((r) => ({
      questionId: r.questionId,
      selectedOptionIds: r.selectedOptionIds,
      numericAnswer: r.numericAnswer,
      status: r.status,
      timeSpentSeconds: r.timeSpentSeconds,
    }));

  const result = scoreMockAttempt(attempt.test.sections, attempt.test.questions, source);
  // Never record a finish after the deadline: an abandoned attempt finalized
  // days later by a page view took three hours, not three days.
  const now = new Date();
  const submittedAt = now > attempt.deadlineAt ? attempt.deadlineAt : now;

  await prisma.$transaction(async (tx) => {
    // The status guard makes two racing submits (double click, or the timer
    // and the button together) resolve to exactly one scoring.
    const claimed = await tx.mockAttempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: {
        status: "SUBMITTED",
        submittedAt,
        autoSubmitted,
        score: result.score,
        maxScore: result.maxScore,
        correctCount: result.correctCount,
        incorrectCount: result.incorrectCount,
        unattemptedCount: result.unattemptedCount,
        sectionBreakdown: result.sectionBreakdown,
      },
    });
    if (claimed.count === 0) return;
    await tx.mockResponse.deleteMany({ where: { attemptId } });
    await tx.mockResponse.createMany({ data: result.responses.map((r) => ({ attemptId, ...r })) });
  });
}

/**
 * Closes an attempt whose clock has run out. Called wherever an attempt is
 * read, so "left the tab open and went to bed" still ends in a scorecard
 * without needing a cron job.
 */
export async function finalizeIfExpired(attempt: { id: string; status: string; deadlineAt: Date }) {
  if (attempt.status !== "IN_PROGRESS") return false;
  if (Date.now() <= attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS) return false;
  await finalizeMockAttempt(attempt.id, { autoSubmitted: true });
  return true;
}
