import { isAnsweredStatus, type MockSectionStat, type ResponseEntry } from "./types";

export type ScorableQuestion = {
  id: string;
  sectionId: string;
  type: "MCQ" | "MSQ" | "NAT";
  correctOptionIds: string[];
  natMin: number | null;
  natMax: number | null;
  marks: number;
  negativeMarks: number;
};

export type ScoredResponse = ResponseEntry & { isCorrect: boolean | null; marksAwarded: number | null };

export type MockScore = {
  score: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  sectionBreakdown: MockSectionStat[];
  responses: ScoredResponse[];
};

/** Marks are thirds of a mark in JAM; two decimals is how the scorecard prints them. */
export const roundMarks = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Answer-key ranges are given to a few decimals; without a tolerance, a
// correct "0.3" can miss a range that ends at 0.3 by one float ulp.
const NAT_TOLERANCE = 1e-9;

/** Null when the response carries no evaluable answer. */
function judge(q: ScorableQuestion, r: ResponseEntry): boolean | null {
  if (q.type === "NAT") {
    const text = r.numericAnswer?.trim();
    if (!text || !/\d/.test(text)) return null;
    const value = Number(text);
    if (!Number.isFinite(value) || q.natMin == null || q.natMax == null) return null;
    return value >= q.natMin - NAT_TOLERANCE && value <= q.natMax + NAT_TOLERANCE;
  }
  if (r.selectedOptionIds.length === 0) return null;
  const selected = new Set(r.selectedOptionIds);
  // MSQ follows the JAM rule: the exact set, or nothing. No partial credit.
  return selected.size === q.correctOptionIds.length && q.correctOptionIds.every((id) => selected.has(id));
}

/**
 * Deterministic scorer — the only place a mock score is computed.
 *
 * An answer counts only if its palette state says it was saved (Answered, or
 * Answered & Marked for Review). That mirrors the real interface, where
 * choosing an option and then jumping away without "Save & Next" records
 * nothing.
 */
export function scoreMockAttempt(
  sections: { id: string; name: string }[],
  questions: ScorableQuestion[],
  entries: ResponseEntry[]
): MockScore {
  const entryByQuestion = new Map(entries.map((e) => [e.questionId, e]));
  const stats = new Map<string, MockSectionStat>(
    sections.map((s) => [
      s.id,
      { sectionId: s.id, name: s.name, questions: 0, attempted: 0, correct: 0, incorrect: 0, score: 0, maxScore: 0 },
    ])
  );

  const responses: ScoredResponse[] = [];
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  for (const q of questions) {
    const stat = stats.get(q.sectionId);
    maxScore += q.marks;
    if (stat) {
      stat.questions += 1;
      stat.maxScore += q.marks;
    }

    const entry = entryByQuestion.get(q.id);
    if (!entry) continue;

    const verdict = isAnsweredStatus(entry.status) ? judge(q, entry) : null;
    if (verdict === null) {
      // Nothing evaluable: store the palette state without a stray answer.
      const status =
        entry.status === "ANSWERED" ? "NOT_ANSWERED" : entry.status === "ANSWERED_MARKED" ? "MARKED" : entry.status;
      responses.push({ ...entry, status, selectedOptionIds: [], numericAnswer: null, isCorrect: null, marksAwarded: null });
      continue;
    }

    const marksAwarded = verdict ? q.marks : q.negativeMarks > 0 ? -q.negativeMarks : 0;
    score += marksAwarded;
    if (verdict) correctCount += 1;
    else incorrectCount += 1;
    if (stat) {
      stat.attempted += 1;
      stat.score += marksAwarded;
      if (verdict) stat.correct += 1;
      else stat.incorrect += 1;
    }
    responses.push({ ...entry, isCorrect: verdict, marksAwarded: roundMarks(marksAwarded) });
  }

  return {
    score: roundMarks(score),
    maxScore: roundMarks(maxScore),
    correctCount,
    incorrectCount,
    unattemptedCount: questions.length - correctCount - incorrectCount,
    sectionBreakdown: [...stats.values()].map((s) => ({
      ...s,
      score: roundMarks(s.score),
      maxScore: roundMarks(s.maxScore),
    })),
    responses,
  };
}

/** "+2", "−0.67", "0" — for scorecards and the question header. */
export function formatMarks(n: number, { sign = false }: { sign?: boolean } = {}) {
  const rounded = roundMarks(n);
  const text = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(2);
  if (rounded < 0) return `−${text}`;
  return sign && rounded > 0 ? `+${text}` : text;
}

/** Negative marks the way the paper prints them: "1/3", "2/3", or a decimal. */
export function formatNegative(marks: number, negativeMarks: number) {
  if (negativeMarks <= 0) return "0";
  const thirds = (negativeMarks * 3) / marks;
  if (Math.abs(thirds - 1) < 1e-6 && Number.isInteger(marks)) return `${marks}/3`;
  return formatMarks(negativeMarks);
}
