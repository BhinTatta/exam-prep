import type { AssessmentQuestion } from "@prisma/client";
import type { TopicStat } from "./types";

export type ScoredAnswer = {
  questionId: string;
  selectedOptionIds: string[];
};

export type ScoringResult = {
  totalScore: number;
  maxScore: number;
  topicBreakdown: TopicStat[];
  strengths: string[];
  weaknesses: string[];
  responses: {
    questionId: string;
    selectedOptionIds: string[];
    isCorrect: boolean | null;
    marksAwarded: number | null;
  }[];
};

const STRENGTH_THRESHOLD = 0.75;
const WEAKNESS_THRESHOLD = 0.5;

/**
 * Deterministic scorer — the source of truth for the score. Only CONTENT
 * questions are graded; PROFILE questions carry no correct answer.
 */
export function scoreAttempt(
  questions: Pick<AssessmentQuestion, "id" | "section" | "topic" | "correctOptionIds" | "marks" | "negativeMarks">[],
  answers: ScoredAnswer[]
): ScoringResult {
  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a]));
  const contentQuestions = questions.filter((q) => q.section === "CONTENT");

  const responses: ScoringResult["responses"] = [];
  const byTopic = new Map<string, TopicStat>();

  let totalScore = 0;
  let maxScore = 0;

  for (const q of contentQuestions) {
    maxScore += q.marks;

    const stat = byTopic.get(q.topic) ?? {
      topic: q.topic,
      correct: 0,
      total: 0,
      attempted: 0,
      score: 0,
      maxScore: 0,
      accuracy: 0,
    };
    stat.total += 1;
    stat.maxScore += q.marks;

    const answer = answerByQuestionId.get(q.id);
    if (!answer || answer.selectedOptionIds.length === 0) {
      byTopic.set(q.topic, stat);
      continue;
    }

    stat.attempted += 1;
    const correctSet = new Set(q.correctOptionIds);
    const selectedSet = new Set(answer.selectedOptionIds);
    const isCorrect =
      correctSet.size === selectedSet.size && [...correctSet].every((id) => selectedSet.has(id));
    const marksAwarded = isCorrect ? q.marks : -q.negativeMarks;

    totalScore += marksAwarded;
    stat.score += marksAwarded;
    if (isCorrect) stat.correct += 1;

    byTopic.set(q.topic, stat);
    responses.push({ questionId: q.id, selectedOptionIds: answer.selectedOptionIds, isCorrect, marksAwarded });
  }

  const topicBreakdown = [...byTopic.values()].map((stat) => ({
    ...stat,
    accuracy: stat.total > 0 ? stat.correct / stat.total : 0,
  }));

  const strengths = topicBreakdown.filter((t) => t.accuracy >= STRENGTH_THRESHOLD).map((t) => t.topic);
  const weaknesses = topicBreakdown
    .filter((t) => t.accuracy < WEAKNESS_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((t) => t.topic);

  return { totalScore, maxScore, topicBreakdown, strengths, weaknesses, responses };
}
