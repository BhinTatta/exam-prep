"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-helpers";
import { hasRole } from "@/lib/roles";
import { finalizeIfExpired, finalizeMockAttempt, SUBMIT_GRACE_MS } from "@/lib/mock-tests/attempts";
import { responseEntrySchema, type ResponseEntry } from "@/lib/mock-tests/types";

const entriesSchema = z.array(responseEntrySchema).max(500);

async function requireUserId() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Sign in to take a mock test.");
  return session.user.id;
}

/**
 * Starts an attempt, or hands back the one already running. A student who
 * closes the tab and comes back must land in the same paper with the same
 * clock, not get a fresh three hours.
 */
export async function startMockAttempt(testId: string): Promise<{ slug: string; attemptId: string }> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sign in to take a mock test.");

  const test = await prisma.mockTest.findUnique({
    where: { id: testId },
    select: { id: true, slug: true, published: true, durationMinutes: true, _count: { select: { questions: true } } },
  });
  // Admins may sit a draft: proof-reading a freshly imported paper on the real
  // exam screen is the point of having drafts.
  const available = test && (test.published || hasRole(session.user.role, "ADMIN")) && test._count.questions > 0;
  if (!available) throw new Error("This mock test isn't available.");

  const running = await prisma.mockAttempt.findFirst({
    where: { testId, userId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });
  if (running && !(await finalizeIfExpired(running))) return { slug: test.slug, attemptId: running.id };

  const startedAt = new Date();
  const attempt = await prisma.mockAttempt.create({
    data: {
      testId,
      userId,
      startedAt,
      deadlineAt: new Date(startedAt.getTime() + test.durationMinutes * 60_000),
    },
  });
  return { slug: test.slug, attemptId: attempt.id };
}

async function loadOwnAttempt(attemptId: string, userId: string) {
  const attempt = await prisma.mockAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, testId: true, status: true, deadlineAt: true },
  });
  if (!attempt || attempt.userId !== userId) throw new Error("Attempt not found.");
  return attempt;
}

/**
 * Saves the responses that changed since the last call. Fired by the exam
 * screen after every "Save & Next" so a crash, a dead battery or a refresh
 * costs the student nothing.
 *
 * Returns `closed: true` once the attempt can no longer be written to, which
 * tells the screen to stop and show the scorecard.
 */
export async function saveMockProgress(attemptId: string, rawEntries: ResponseEntry[]): Promise<{ closed: boolean }> {
  const userId = await requireUserId();
  const entries = entriesSchema.parse(rawEntries);
  const attempt = await loadOwnAttempt(attemptId, userId);

  if (attempt.status !== "IN_PROGRESS") return { closed: true };
  if (await finalizeIfExpired(attempt)) return { closed: true };
  if (entries.length === 0) return { closed: false };

  const valid = await prisma.mockQuestion.findMany({
    where: { testId: attempt.testId, id: { in: entries.map((e) => e.questionId) } },
    select: { id: true },
  });
  const validIds = new Set(valid.map((q) => q.id));

  await prisma.$transaction(
    entries
      .filter((e) => validIds.has(e.questionId))
      .map(({ questionId, ...data }) =>
        prisma.mockResponse.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          update: data,
          create: { attemptId, questionId, ...data },
        })
      )
  );
  return { closed: false };
}

/**
 * Final submission. Carries the screen's complete state so the last few
 * answers count even if their background save never made it.
 */
export async function submitMockAttempt(
  attemptId: string,
  rawEntries: ResponseEntry[],
  { timedOut = false }: { timedOut?: boolean } = {}
): Promise<void> {
  const userId = await requireUserId();
  const entries = entriesSchema.parse(rawEntries);
  const attempt = await loadOwnAttempt(attemptId, userId);
  if (attempt.status !== "IN_PROGRESS") return;

  // Past the grace window the screen's state is no longer trusted — otherwise
  // pausing the page's timer would buy unlimited time. Fall back to what was
  // saved while the clock was still running.
  const late = Date.now() > attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS;
  await finalizeMockAttempt(attemptId, {
    entries: late ? undefined : entries,
    autoSubmitted: late || timedOut,
  });
}
