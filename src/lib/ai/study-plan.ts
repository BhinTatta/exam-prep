import { z } from "zod";
import type { StudyPlan, TopicStat } from "@/lib/assessment/types";
import { STUDY_PLAN_SYSTEM_PROMPT, buildStudyPlanUserPrompt } from "@/lib/ai/prompts/study-plan";

export type StudyPlanInput = {
  testTitle: string;
  totalScore: number;
  maxScore: number;
  topicBreakdown: TopicStat[];
  strengths: string[];
  weaknesses: string[];
  /** Free-text answers to PROFILE questions, e.g. { prep_level: "Just starting" }. */
  profile: Record<string, string>;
};

const studyPlanSchema: z.ZodType<StudyPlan> = z.object({
  overallMessage: z.string().min(1),
  summary: z.string().min(1),
  topics: z.array(
    z.object({
      topic: z.string().min(1),
      verdict: z.enum(["strength", "weakness", "neutral"]),
      advice: z.string().min(1),
    })
  ),
});

/**
 * Single entry point for turning a deterministic score breakdown into a
 * human-readable study plan. The LLM never sees raw answers or touches the
 * score — only this already-computed breakdown — so grading stays
 * reproducible regardless of which model (or none) generates the plan.
 *
 * Provider selection: AI_PROVIDER env var ("gemini" | "anthropic"), default
 * "gemini". Swap providers by editing `callProvider` below; everything
 * upstream (scoring, results page, mentor matching) is unaffected. Tone/
 * persona lives in src/lib/ai/prompts/study-plan.ts, separate from this
 * wiring, so it can be edited without touching provider logic.
 */
export async function generateStudyPlan(input: StudyPlanInput): Promise<StudyPlan> {
  const provider = process.env.AI_PROVIDER ?? "gemini";
  const hasKey = provider === "gemini" ? !!process.env.GEMINI_API_KEY : !!process.env.ANTHROPIC_API_KEY;

  if (hasKey) {
    try {
      const raw = await callProvider(provider, input);
      return studyPlanSchema.parse(raw);
    } catch (err) {
      console.error("generateStudyPlan: provider call failed, using fallback", err);
    }
  }
  return fallbackStudyPlan(input);
}

async function callProvider(provider: string, input: StudyPlanInput): Promise<unknown> {
  const system = STUDY_PLAN_SYSTEM_PROMPT;
  const user = buildStudyPlanUserPrompt(input);

  if (provider === "gemini") return callGemini(system, user);
  if (provider === "anthropic") return callAnthropic(system, user);
  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}

async function callGemini(system: string, user: string): Promise<unknown> {
  const model = process.env.AI_MODEL ?? "gemini-3.6-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini returned ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text content");
  return JSON.parse(text);
}

async function callAnthropic(system: string, user: string): Promise<unknown> {
  const model = process.env.AI_MODEL ?? "claude-sonnet-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic returned ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no text content");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Anthropic response did not contain JSON");
  return JSON.parse(jsonMatch[0]);
}

function fallbackStudyPlan(input: StudyPlanInput): StudyPlan {
  const pct = input.maxScore > 0 ? Math.round((input.totalScore / input.maxScore) * 100) : 0;

  const overallMessage =
    input.weaknesses.length === 0
      ? `Solid first attempt — ${pct}% and nothing glaringly weak. Keep the pace up.`
      : `You're at ${pct}% right now. ${input.weaknesses[0]} is the one dragging you down the most — fix that first and the score moves fast.`;

  const summary =
    input.strengths.length > 0
      ? `Strong on ${input.strengths.join(", ")}. Focus the next two weeks on ${input.weaknesses.slice(0, 2).join(" and ") || "consolidating what you already know"}.`
      : `Nothing's locked in as a strength yet — that's normal for a first diagnostic. Start with ${input.weaknesses.slice(0, 2).join(" and ") || "the basics"} since those had the most room to grow.`;

  const topics = input.topicBreakdown.map((t) => {
    const verdict: StudyPlan["topics"][number]["verdict"] =
      t.accuracy >= 0.75 ? "strength" : t.accuracy < 0.5 ? "weakness" : "neutral";
    const advice =
      verdict === "strength"
        ? `You got ${t.correct}/${t.total} here — keep it sharp with occasional revision, don't over-invest more time.`
        : verdict === "weakness"
          ? `Only ${t.correct}/${t.total} correct. Go back to fundamentals on ${t.topic} before attempting more problems — this is costing you the most marks.`
          : `${t.correct}/${t.total} — decent but not locked in. A focused revision pass would move this to a strength.`;
    return { topic: t.topic, verdict, advice };
  });

  return { overallMessage, summary, topics };
}
