import { z } from "zod";

// ---------------------------------------------------------------------------
// Stored shapes
// ---------------------------------------------------------------------------

/** One entry of MockQuestion.options (Prisma Json). */
export type MockOption = { id: string; label: string; imageUrl?: string };

const storedOptionsSchema = z.array(
  z.object({ id: z.string(), label: z.string(), imageUrl: z.string().optional() })
);

export function parseMockOptions(value: unknown): MockOption[] {
  if (value == null) return [];
  return storedOptionsSchema.parse(value);
}

/** One entry of MockAttempt.sectionBreakdown (Prisma Json). */
export type MockSectionStat = {
  sectionId: string;
  name: string;
  questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  score: number;
  maxScore: number;
};

export const RESPONSE_STATUSES = [
  "NOT_VISITED",
  "NOT_ANSWERED",
  "ANSWERED",
  "MARKED",
  "ANSWERED_MARKED",
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

/** A response as the exam screen holds it and as it travels to the server. */
export const responseEntrySchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().max(8)).max(10),
  numericAnswer: z
    .string()
    .max(24)
    .regex(/^-?\d*\.?\d*$/)
    .nullable(),
  status: z.enum(RESPONSE_STATUSES),
  timeSpentSeconds: z.number().int().min(0).max(86_400),
});
export type ResponseEntry = z.infer<typeof responseEntrySchema>;

/** Only these two palette states carry an answer that gets evaluated. */
export function isAnsweredStatus(status: ResponseStatus) {
  return status === "ANSWERED" || status === "ANSWERED_MARKED";
}

// ---------------------------------------------------------------------------
// Authoring format — one JSON file per paper in content/mock-tests.
// Documented for humans in docs/mock-tests.md; this schema is the authority.
// ---------------------------------------------------------------------------

// "1/3" is easier to get right in a file than 0.3333333.
const marksValue = z.union([
  z.number().min(0).max(100),
  z
    .string()
    .regex(/^\d+(\.\d+)?(\/\d+(\.\d+)?)?$/, 'Use a number or a fraction like "1/3"')
    .transform((s) => {
      const [n, d] = s.split("/").map(Number);
      return d ? n / d : n;
    }),
]);

const optionInput = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1).max(8).optional(),
    label: z.string().default(""),
    image: z.string().min(1).optional(),
  }),
]);

const questionInput = z.object({
  number: z.number().int().min(1),
  type: z.enum(["MCQ", "MSQ", "NAT"]),
  topic: z.string().max(120).optional(),
  prompt: z.string().min(1),
  image: z.string().min(1).optional(),
  options: z.array(optionInput).min(2).max(8).optional(),
  // MCQ: "B" · MSQ: ["A", "C"] · NAT: 2.5, or { min, max } from the answer key.
  // Left out only for a "marks to all" question.
  answer: z
    .union([
      z.string().min(1),
      z.array(z.string().min(1)).min(1),
      z.number(),
      z.object({ min: z.number(), max: z.number() }),
    ])
    .optional(),
  // The official key says "marks to all" (MTA): the question was flawed, so
  // everyone gets its marks, attempted or not. Such a question has no answer.
  marksToAll: z.boolean().optional(),
  marks: marksValue,
  // Omit for the JAM default: one third of the marks on MCQs, zero elsewhere.
  negativeMarks: marksValue.optional(),
  explanation: z.string().optional(),
});

const sectionInput = z.object({
  name: z.string().min(1).max(60),
  instructions: z.string().optional(),
  questions: z.array(questionInput).min(1),
});

export const paperSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().min(3).max(160),
  exam: z.string().min(1).max(40).default("IIT JAM"),
  subject: z.string().min(1).max(40).default("physics"),
  year: z.number().int().min(1990).max(2100).optional(),
  description: z.string().max(4000).optional(),
  durationMinutes: z.number().int().min(1).max(600).default(180),
  calculator: z.boolean().default(true),
  // Leave out to keep whatever the database already says (draft for a new paper).
  published: z.boolean().optional(),
  sections: z.array(sectionInput).min(1),
});
export type PaperInput = z.input<typeof paperSchema>;

export type NormalizedQuestion = {
  number: number;
  type: "MCQ" | "MSQ" | "NAT";
  topic: string | null;
  prompt: string;
  imageUrl: string | null;
  options: MockOption[] | null;
  correctOptionIds: string[];
  natMin: number | null;
  natMax: number | null;
  marks: number;
  negativeMarks: number;
  marksToAll: boolean;
  explanation: string | null;
};

export type NormalizedPaper = Omit<z.output<typeof paperSchema>, "sections"> & {
  sections: { name: string; instructions: string | null; questions: NormalizedQuestion[] }[];
};

/**
 * A bare filename in a paper means "the file next to this paper's other
 * diagrams": public/mock-tests/<slug>/<file>. Anything that already looks like
 * a path or URL is left alone, so diagrams can also live on external storage.
 */
function resolveImage(slug: string, image: string | undefined): string | undefined {
  if (!image) return undefined;
  if (/^(https?:)?\/\//.test(image) || image.startsWith("/") || image.startsWith("data:")) return image;
  return `/mock-tests/${slug}/${image}`;
}

/**
 * Validates a paper file and resolves every shorthand into the stored shape.
 * Throws an Error whose message lists every problem with its question number —
 * a 60-question paper typed up from a PDF will have a few, and fixing them one
 * failed import at a time is miserable.
 */
export function normalizePaper(raw: unknown): NormalizedPaper {
  const parsed = paperSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Paper file is not valid:\n${lines.join("\n")}`);
  }
  const paper = parsed.data;
  const problems: string[] = [];
  const seenNumbers = new Set<number>();

  const sections = paper.sections.map((section) => ({
    name: section.name,
    instructions: section.instructions ?? null,
    questions: section.questions.map((q): NormalizedQuestion => {
      const where = `Q${q.number}`;
      if (seenNumbers.has(q.number)) problems.push(`${where}: question number used twice`);
      seenNumbers.add(q.number);

      const base = {
        number: q.number,
        type: q.type,
        topic: q.topic ?? null,
        prompt: q.prompt,
        imageUrl: resolveImage(paper.slug, q.image) ?? null,
        marks: q.marks,
        marksToAll: q.marksToAll ?? false,
        explanation: q.explanation ?? null,
      };

      if (q.marksToAll && q.answer !== undefined) {
        problems.push(`${where}: a "marks to all" question has no answer — leave "answer" out`);
      }
      if (!q.marksToAll && q.answer === undefined) problems.push(`${where}: answer is missing`);

      if (q.type === "NAT") {
        if (q.options) problems.push(`${where}: a NAT question cannot have options`);
        if (q.marksToAll) {
          return { ...base, options: null, correctOptionIds: [], natMin: null, natMax: null, negativeMarks: 0 };
        }
        let min = NaN;
        let max = NaN;
        if (typeof q.answer === "number") min = max = q.answer;
        else if (typeof q.answer === "string" && q.answer.trim() !== "" && Number.isFinite(Number(q.answer)))
          min = max = Number(q.answer);
        else if (typeof q.answer === "object" && !Array.isArray(q.answer)) ({ min, max } = q.answer);
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
          problems.push(`${where}: NAT answer must be a number or { "min": …, "max": … }`);
        } else if (min > max) {
          problems.push(`${where}: NAT answer range has min greater than max`);
        }
        return {
          ...base,
          options: null,
          correctOptionIds: [],
          natMin: min,
          natMax: max,
          negativeMarks: q.negativeMarks ?? 0,
        };
      }

      const options: MockOption[] = (q.options ?? []).map((o, i) => {
        const fallbackId = String.fromCharCode(65 + i);
        if (typeof o === "string") return { id: fallbackId, label: o };
        const imageUrl = resolveImage(paper.slug, o.image);
        if (!o.label && !imageUrl) problems.push(`${where}: option ${o.id ?? fallbackId} has no label or image`);
        return { id: o.id ?? fallbackId, label: o.label, ...(imageUrl ? { imageUrl } : {}) };
      });
      if (options.length < 2) problems.push(`${where}: ${q.type} needs at least two options`);
      if (new Set(options.map((o) => o.id)).size !== options.length) problems.push(`${where}: duplicate option ids`);

      if (q.marksToAll) {
        return { ...base, options, correctOptionIds: [], natMin: null, natMax: null, negativeMarks: 0 };
      }

      const answer =
        typeof q.answer === "string" ? [q.answer] : Array.isArray(q.answer) ? q.answer : null;
      if (!answer) {
        problems.push(`${where}: ${q.type} answer must be an option id${q.type === "MSQ" ? " list" : ""}`);
      } else {
        const ids = new Set(options.map((o) => o.id));
        for (const a of answer) if (!ids.has(a)) problems.push(`${where}: answer "${a}" is not one of the options`);
        if (new Set(answer).size !== answer.length) problems.push(`${where}: answer lists an option twice`);
        if (q.type === "MCQ" && answer.length !== 1) problems.push(`${where}: an MCQ has exactly one answer`);
      }

      return {
        ...base,
        options,
        correctOptionIds: answer ?? [],
        natMin: null,
        natMax: null,
        negativeMarks: q.negativeMarks ?? (q.type === "MCQ" ? q.marks / 3 : 0),
      };
    }),
  }));

  if (problems.length > 0) throw new Error(`Paper file has problems:\n  ${problems.join("\n  ")}`);
  return { ...paper, sections };
}
