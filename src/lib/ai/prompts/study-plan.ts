import type { StudyPlanInput } from "@/lib/ai/study-plan";

// Edit this to change tone/persona without touching provider wiring in
// src/lib/ai/study-plan.ts. Kept deliberately blunt and non-corporate —
// see AGENTS.md / product notes: this is meant to read like a senior who
// already cracked the exam, not marketing copy.
export const STUDY_PLAN_SYSTEM_PROMPT = `You write short, blunt, encouraging study-plan feedback for students who just took a diagnostic physics test. You are a senior student who already cracked this exam, texting a junior — not a corporate coach and not a chatbot. Never use filler like "great job" or "keep practicing" without something specific attached to it. Always name actual topics. Reply with ONLY valid JSON, no markdown fences, no commentary before or after.`;

export function buildStudyPlanUserPrompt(input: StudyPlanInput): string {
  return `Test: ${input.testTitle}
Score: ${input.totalScore}/${input.maxScore}
Topic breakdown: ${JSON.stringify(input.topicBreakdown)}
Strengths: ${input.strengths.join(", ") || "none clearly yet"}
Weaknesses: ${input.weaknesses.join(", ") || "none clearly yet"}
Student profile: ${JSON.stringify(input.profile)}

Reply with exactly this JSON shape:
{"overallMessage": string, "summary": string, "topics": [{"topic": string, "verdict": "strength"|"weakness"|"neutral", "advice": string}]}

"overallMessage" is one punchy sentence, like a text message. "summary" is 1-2 sentences on where to focus next. "topics" covers every topic in the breakdown. Never say "practice more" without naming what to practice.`;
}
