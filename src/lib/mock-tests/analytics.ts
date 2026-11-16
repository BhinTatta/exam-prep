import "server-only";
import { prisma } from "@/lib/prisma";
import { formatMarks, roundMarks } from "./scoring";

// Everything the analysis board and the progress dashboard show is derived
// here from rows that already exist (attempts and their responses). Nothing is
// precomputed or cached: a paper is 60 rows, and deriving on read means a
// corrected answer key or a new chart never needs a backfill.

export type Outcome = "correct" | "incorrect" | "skipped";

export type QuestionRow = {
  id: string;
  number: number;
  sectionId: string;
  sectionName: string;
  type: "MCQ" | "MSQ" | "NAT";
  topic: string | null;
  marks: number;
  outcome: Outcome;
  awarded: number;
  timeSpent: number;
};

export type GroupStat = {
  label: string;
  total: number;
  correct: number;
  incorrect: number;
  score: number;
  max: number;
  seconds: number;
};

export type AttemptAnalysis = {
  rows: QuestionRow[];
  bySection: GroupStat[];
  byType: GroupStat[];
  /** "1-mark questions", "2-mark questions" — lowest weight first. */
  byMarks: GroupStat[];
  /** Weakest first. Empty when the paper has no topic tags. */
  byTopic: GroupStat[];
  /** Marks deducted for wrong answers (a positive number). */
  negativeLost: number;
  /** Marks on questions that were never answered. */
  marksUnattempted: number;
  /** Sum of per-question time — a little under the wall-clock time taken. */
  trackedSeconds: number;
  avgSecondsCorrect: number | null;
  avgSecondsIncorrect: number | null;
  insights: string[];
};

type QuestionInput = {
  id: string;
  number: number;
  sectionId: string;
  type: "MCQ" | "MSQ" | "NAT";
  topic: string | null;
  marks: number;
};
type ResponseInput = { questionId: string; isCorrect: boolean | null; marksAwarded: number | null; timeSpentSeconds: number };

const TYPE_NAME = { MCQ: "MCQ", MSQ: "MSQ", NAT: "NAT" } as const;

function group(rows: QuestionRow[], key: (r: QuestionRow) => string | null, order?: string[]): GroupStat[] {
  const map = new Map<string, GroupStat>();
  for (const label of order ?? []) map.set(label, { label, total: 0, correct: 0, incorrect: 0, score: 0, max: 0, seconds: 0 });
  for (const r of rows) {
    const label = key(r);
    if (label === null) continue;
    const g = map.get(label) ?? { label, total: 0, correct: 0, incorrect: 0, score: 0, max: 0, seconds: 0 };
    g.total += 1;
    g.max += r.marks;
    g.score += r.awarded;
    g.seconds += r.timeSpent;
    if (r.outcome === "correct") g.correct += 1;
    if (r.outcome === "incorrect") g.incorrect += 1;
    map.set(label, g);
  }
  return [...map.values()].filter((g) => g.total > 0).map((g) => ({ ...g, score: roundMarks(g.score), max: roundMarks(g.max) }));
}

/** Share of the available marks actually scored, floored at zero for sorting and bars. */
export const scoreShare = (g: { score: number; max: number }) => (g.max > 0 ? Math.max(0, g.score / g.max) : 0);

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 && m < 10 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function analyseAttempt(
  sections: { id: string; name: string }[],
  questions: QuestionInput[],
  responses: ResponseInput[],
  score: number
): AttemptAnalysis {
  const sectionName = new Map(sections.map((s) => [s.id, s.name]));
  const responseBy = new Map(responses.map((r) => [r.questionId, r]));

  const rows: QuestionRow[] = [...questions]
    .sort((a, b) => a.number - b.number)
    .map((q) => {
      const r = responseBy.get(q.id);
      return {
        id: q.id,
        number: q.number,
        sectionId: q.sectionId,
        sectionName: sectionName.get(q.sectionId) ?? "",
        type: q.type,
        topic: q.topic,
        marks: q.marks,
        outcome: r?.isCorrect === true ? "correct" : r?.isCorrect === false ? "incorrect" : "skipped",
        awarded: r?.marksAwarded ?? 0,
        timeSpent: r?.timeSpentSeconds ?? 0,
      };
    });

  const bySection = group(rows, (r) => r.sectionName, sections.map((s) => s.name));
  const byType = group(rows, (r) => TYPE_NAME[r.type], ["MCQ", "MSQ", "NAT"]);
  const weights = [...new Set(rows.map((r) => r.marks))].sort((a, b) => a - b);
  const weightName = (marks: number) => `${formatMarks(marks)}-mark questions`;
  const byMarks = group(rows, (r) => weightName(r.marks), weights.map(weightName));
  const byTopic = group(rows, (r) => r.topic).sort((a, b) => scoreShare(a) - scoreShare(b) || b.max - a.max);

  const wrong = rows.filter((r) => r.outcome === "incorrect");
  const right = rows.filter((r) => r.outcome === "correct");
  const skipped = rows.filter((r) => r.outcome === "skipped");
  const penalised = wrong.filter((r) => r.awarded < 0);
  const negativeLost = roundMarks(-penalised.reduce((n, r) => n + r.awarded, 0));
  const marksUnattempted = roundMarks(skipped.reduce((n, r) => n + r.marks, 0));
  const trackedSeconds = rows.reduce((n, r) => n + r.timeSpent, 0);
  const avg = (list: QuestionRow[]) => (list.length ? list.reduce((n, r) => n + r.timeSpent, 0) / list.length : null);
  const wrongSeconds = wrong.reduce((n, r) => n + r.timeSpent, 0);

  // Plain-language takeaways, most actionable first. Each is only stated when
  // the numbers make it worth saying.
  const insights: string[] = [];
  if (negativeLost > 0) {
    insights.push(
      `Negative marking cost you ${formatMarks(negativeLost)} marks across ${plural(penalised.length, "wrong MCQ")}. ` +
        `Leaving those blank would have made this ${formatMarks(score + negativeLost)}.`
    );
  }
  if (trackedSeconds > 0 && wrong.length > 0 && wrongSeconds / trackedSeconds >= 0.2) {
    insights.push(
      `${formatDuration(wrongSeconds)} — ${Math.round((wrongSeconds / trackedSeconds) * 100)}% of your time — went on questions you got wrong.`
    );
  }
  const slow = [...rows].sort((a, b) => b.timeSpent - a.timeSpent)[0];
  if (slow && slow.outcome !== "correct" && slow.timeSpent >= 180) {
    insights.push(
      `Question ${slow.number} took ${formatDuration(slow.timeSpent)} and still didn't score. In the exam, a question like that is one to mark for review and leave.`
    );
  }
  if (skipped.length > 0 && marksUnattempted >= 5) {
    insights.push(`${plural(skipped.length, "question")} worth ${formatMarks(marksUnattempted)} marks went unanswered.`);
  }
  const rated = byTopic.filter((t) => t.total >= 2);
  // With only a few answers on the board, "strongest" and "weakest" are noise.
  if (rated.length >= 3 && right.length + wrong.length >= 8) {
    const weakest = rated[0];
    const strongest = rated[rated.length - 1];
    if (scoreShare(strongest) - scoreShare(weakest) >= 0.3) {
      insights.push(
        `Strongest: ${strongest.label} (${strongest.correct}/${strongest.total} correct). ` +
          `Weakest: ${weakest.label} (${weakest.correct}/${weakest.total}) — start your revision there.`
      );
    }
  }

  return {
    rows,
    bySection,
    byType,
    byMarks,
    byTopic,
    negativeLost,
    marksUnattempted,
    trackedSeconds,
    avgSecondsCorrect: avg(right),
    avgSecondsIncorrect: avg(wrong),
    insights: insights.slice(0, 4),
  };
}

export type CohortStats = {
  attempts: number;
  students: number;
  average: number;
  top: number;
  /** Percent of the other attempts this one scored higher than, 0–100. */
  aheadOf: number;
  rank: number;
};

/** Below this many other attempts, "ahead of 100%" is noise, so nothing is shown. */
const MIN_COHORT = 5;

/**
 * Where one score sits among every submitted attempt at the same paper. Null
 * until enough other people have sat it for the comparison to mean anything.
 */
export async function getCohortStats(testId: string, attemptId: string, score: number): Promise<CohortStats | null> {
  const others = { testId, status: "SUBMITTED" as const, id: { not: attemptId } };
  const [agg, lower, higher, students] = await Promise.all([
    prisma.mockAttempt.aggregate({ where: others, _count: true, _avg: { score: true }, _max: { score: true } }),
    prisma.mockAttempt.count({ where: { ...others, score: { lt: score } } }),
    prisma.mockAttempt.count({ where: { ...others, score: { gt: score } } }),
    prisma.mockAttempt.findMany({ where: { testId, status: "SUBMITTED" }, distinct: ["userId"], select: { userId: true } }),
  ]);
  if (agg._count < MIN_COHORT) return null;
  return {
    attempts: agg._count + 1,
    students: students.length,
    average: roundMarks(agg._avg.score ?? 0),
    top: roundMarks(Math.max(agg._max.score ?? 0, score)),
    aheadOf: Math.round((lower / agg._count) * 100),
    rank: higher + 1,
  };
}

// ---------------------------------------------------------------------------
// Progress dashboard
// ---------------------------------------------------------------------------

export type AttemptSummary = {
  id: string;
  slug: string;
  title: string;
  submittedAt: Date;
  score: number;
  maxScore: number;
  /** Score as a percentage of the paper's marks — what makes different papers comparable. */
  percent: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  /** Null when nothing was attempted. */
  accuracy: number | null;
  seconds: number;
  autoSubmitted: boolean;
};

export type StudentProgress = {
  attempts: AttemptSummary[]; // oldest first
  papers: number;
  bestPercent: number;
  averagePercent: number;
  accuracy: number | null;
  practiceSeconds: number;
  questionsAnswered: number;
  /** Latest attempt's percent minus the one before it. Null with fewer than two. */
  lastChange: number | null;
  byTopic: GroupStat[]; // weakest first
  byType: GroupStat[];
  inProgress: { id: string; slug: string; title: string; deadlineAt: Date }[];
};

/** How far back the dashboard looks. Keeps the query bounded for a heavy user. */
const HISTORY_LIMIT = 60;

export async function getStudentProgress(userId: string): Promise<StudentProgress> {
  const [recent, running] = await Promise.all([
    prisma.mockAttempt.findMany({
      where: { userId, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      take: HISTORY_LIMIT,
      include: {
        test: { select: { slug: true, title: true } },
        responses: {
          select: {
            isCorrect: true,
            marksAwarded: true,
            timeSpentSeconds: true,
            question: { select: { type: true, topic: true, marks: true } },
          },
        },
      },
    }),
    prisma.mockAttempt.findMany({
      where: { userId, status: "IN_PROGRESS", deadlineAt: { gt: new Date() } },
      orderBy: { startedAt: "desc" },
      select: { id: true, deadlineAt: true, test: { select: { slug: true, title: true } } },
    }),
  ]);

  const attempts: AttemptSummary[] = recent.reverse().map((a) => {
    const correct = a.correctCount ?? 0;
    const incorrect = a.incorrectCount ?? 0;
    const maxScore = a.maxScore ?? 0;
    const submittedAt = a.submittedAt ?? a.deadlineAt;
    return {
      id: a.id,
      slug: a.test.slug,
      title: a.test.title,
      submittedAt,
      score: a.score ?? 0,
      maxScore,
      percent: maxScore > 0 ? Math.round(((a.score ?? 0) / maxScore) * 1000) / 10 : 0,
      correct,
      incorrect,
      unattempted: a.unattemptedCount ?? 0,
      accuracy: correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : null,
      seconds: Math.max(0, Math.round((submittedAt.getTime() - a.startedAt.getTime()) / 1000)),
      autoSubmitted: a.autoSubmitted,
    };
  });

  // Topic and type strength pool every answered question across the history.
  // Unanswered questions are left out here: this is "how do you do on what you
  // try", and a paper abandoned halfway shouldn't read as weakness everywhere.
  const pooled: QuestionRow[] = recent.flatMap((a) =>
    a.responses
      .filter((r) => r.isCorrect !== null)
      .map((r) => ({
        id: "",
        number: 0,
        sectionId: "",
        sectionName: "",
        type: r.question.type,
        topic: r.question.topic,
        marks: r.question.marks,
        outcome: r.isCorrect ? ("correct" as const) : ("incorrect" as const),
        awarded: r.marksAwarded ?? 0,
        timeSpent: r.timeSpentSeconds,
      }))
  );
  const accuracyOf = (g: GroupStat) => g.correct / g.total;

  const totalCorrect = attempts.reduce((n, a) => n + a.correct, 0);
  const totalAnswered = attempts.reduce((n, a) => n + a.correct + a.incorrect, 0);
  const last = attempts[attempts.length - 1];
  const previous = attempts[attempts.length - 2];

  return {
    attempts,
    papers: new Set(attempts.map((a) => a.slug)).size,
    bestPercent: attempts.length ? Math.max(...attempts.map((a) => a.percent)) : 0,
    averagePercent: attempts.length ? Math.round((attempts.reduce((n, a) => n + a.percent, 0) / attempts.length) * 10) / 10 : 0,
    accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : null,
    practiceSeconds: attempts.reduce((n, a) => n + a.seconds, 0),
    questionsAnswered: totalAnswered,
    lastChange: last && previous ? Math.round((last.percent - previous.percent) * 10) / 10 : null,
    byTopic: group(pooled, (r) => r.topic)
      .filter((g) => g.total >= 2)
      .sort((a, b) => accuracyOf(a) - accuracyOf(b) || b.total - a.total),
    byType: group(pooled, (r) => TYPE_NAME[r.type], ["MCQ", "MSQ", "NAT"]),
    inProgress: running.map((r) => ({ id: r.id, slug: r.test.slug, title: r.test.title, deadlineAt: r.deadlineAt })),
  };
}
