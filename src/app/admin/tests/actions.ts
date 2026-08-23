"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { subjects } from "@/config/site";
import { questionOptionsSchema } from "@/lib/assessment/types";
import type { AssessmentQuestionSection } from "@prisma/client";

const testSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().min(3).max(120),
  subject: z.enum(subjects.map((s) => s.slug) as [string, ...string[]]),
  description: z.string().max(2000).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(180),
});

export async function createTest(formData: FormData) {
  await requireRole("ADMIN");

  const parsed = testSchema.parse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    subject: formData.get("subject"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
  });

  const test = await prisma.test.create({ data: parsed });
  revalidatePath("/admin/tests");
  return test;
}

export async function updateTest(id: string, formData: FormData) {
  await requireRole("ADMIN");

  const parsed = testSchema.parse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    subject: formData.get("subject"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
  });

  await prisma.test.update({ where: { id }, data: parsed });
  revalidatePath("/admin/tests");
  revalidatePath(`/admin/tests/${id}`);
}

export async function togglePublishTest(id: string, published: boolean) {
  await requireRole("ADMIN");
  await prisma.test.update({ where: { id }, data: { published } });
  revalidatePath("/admin/tests");
  revalidatePath(`/admin/tests/${id}`);
}

export async function deleteTest(id: string) {
  await requireRole("ADMIN");
  await prisma.test.delete({ where: { id } });
  revalidatePath("/admin/tests");
}

const questionInputSchema = z.object({
  testId: z.string().min(1),
  section: z.enum(["PROFILE", "CONTENT"]),
  topic: z.string().min(1).max(120),
  prompt: z.string().min(1).max(4000),
  imageUrl: z.string().url().optional().or(z.literal("")),
  options: questionOptionsSchema,
  correctOptionIds: z.array(z.string()),
  marks: z.coerce.number().int().min(0).max(20),
  negativeMarks: z.coerce.number().int().min(0).max(20),
  order: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

function validateQuestionInput(input: QuestionInput) {
  const parsed = questionInputSchema.parse(input);
  const optionIds = new Set(parsed.options.map((o) => o.id));
  if (parsed.correctOptionIds.some((id) => !optionIds.has(id))) {
    throw new Error("correctOptionIds must reference existing option ids");
  }
  if (parsed.section === "CONTENT" && parsed.correctOptionIds.length === 0) {
    throw new Error("Content questions need at least one correct option");
  }
  return parsed;
}

export async function createQuestion(input: QuestionInput) {
  await requireRole("ADMIN");
  const parsed = validateQuestionInput(input);

  await prisma.assessmentQuestion.create({
    data: {
      testId: parsed.testId,
      section: parsed.section as AssessmentQuestionSection,
      topic: parsed.topic,
      prompt: parsed.prompt,
      imageUrl: parsed.imageUrl || null,
      options: parsed.options,
      correctOptionIds: parsed.section === "PROFILE" ? [] : parsed.correctOptionIds,
      marks: parsed.marks,
      negativeMarks: parsed.negativeMarks,
      order: parsed.order,
      isActive: parsed.isActive,
    },
  });

  revalidatePath(`/admin/tests/${parsed.testId}`);
}

export async function updateQuestion(id: string, input: QuestionInput) {
  await requireRole("ADMIN");
  const parsed = validateQuestionInput(input);

  await prisma.assessmentQuestion.update({
    where: { id },
    data: {
      section: parsed.section as AssessmentQuestionSection,
      topic: parsed.topic,
      prompt: parsed.prompt,
      imageUrl: parsed.imageUrl || null,
      options: parsed.options,
      correctOptionIds: parsed.section === "PROFILE" ? [] : parsed.correctOptionIds,
      marks: parsed.marks,
      negativeMarks: parsed.negativeMarks,
      order: parsed.order,
      isActive: parsed.isActive,
    },
  });

  revalidatePath(`/admin/tests/${parsed.testId}`);
}

export async function deleteQuestion(id: string) {
  await requireRole("ADMIN");
  const question = await prisma.assessmentQuestion.findUniqueOrThrow({ where: { id } });
  await prisma.assessmentQuestion.delete({ where: { id } });
  revalidatePath(`/admin/tests/${question.testId}`);
}
