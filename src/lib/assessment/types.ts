import { z } from "zod";

// Shape stored in AssessmentQuestion.options (Prisma Json).
export const questionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

export const questionOptionsSchema = z.array(questionOptionSchema).min(2).max(8);

export function parseQuestionOptions(value: unknown): QuestionOption[] {
  return questionOptionsSchema.parse(value);
}

// Shape stored in AttemptResult.topicBreakdown (Prisma Json).
export type TopicStat = {
  topic: string;
  correct: number;
  total: number;
  attempted: number;
  score: number;
  maxScore: number;
  accuracy: number; // 0..1, correct / total
};

// Shape stored in AttemptResult.studyPlan (Prisma Json).
export type StudyPlan = {
  overallMessage: string;
  summary: string;
  topics: {
    topic: string;
    verdict: "strength" | "weakness" | "neutral";
    advice: string;
  }[];
};
