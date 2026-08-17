"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth-helpers";
import { subjects } from "@/config/site";
import { uploadFile } from "@/lib/supabase";

const questionSchema = z.object({
  title: z.string().min(5).max(200),
  body: z.string().min(5).max(10000),
  subject: z.enum(subjects.map((s) => s.slug) as [string, ...string[]]),
});

export async function createQuestion(formData: FormData) {
  const user = await requireUser();

  const parsed = questionSchema.parse({
    title: formData.get("title"),
    body: formData.get("body"),
    subject: formData.get("subject"),
  });

  let imageUrl: string | undefined;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    imageUrl = await uploadFile(`qa/${user.id}-${Date.now()}-${image.name}`, image);
  }

  const question = await prisma.question.create({
    data: { ...parsed, userId: user.id, imageUrl },
  });

  revalidatePath("/qa");
  return question.id;
}

export async function createComment(questionId: string, body: string) {
  const user = await requireUser();
  if (!body.trim()) throw new Error("Comment can't be empty");

  const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
  if (question.locked) throw new Error("This thread is locked");

  await prisma.comment.create({
    data: { questionId, userId: user.id, body: body.trim() },
  });

  revalidatePath(`/qa/${questionId}`);
}

export async function toggleUpvote(commentId: string, questionId: string) {
  const user = await requireUser();

  const existing = await prisma.commentUpvote.findUnique({
    where: { commentId_userId: { commentId, userId: user.id } },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.commentUpvote.delete({ where: { id: existing.id } }),
      prisma.comment.update({ where: { id: commentId }, data: { upvotes: { decrement: 1 } } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.commentUpvote.create({ data: { commentId, userId: user.id } }),
      prisma.comment.update({ where: { id: commentId }, data: { upvotes: { increment: 1 } } }),
    ]);
  }

  revalidatePath(`/qa/${questionId}`);
}

export async function pinQuestion(id: string, pinned: boolean) {
  await requireRole("MODERATOR");
  await prisma.question.update({ where: { id }, data: { pinned } });
  revalidatePath("/qa");
  revalidatePath(`/qa/${id}`);
}

export async function lockQuestion(id: string, locked: boolean) {
  await requireRole("MODERATOR");
  await prisma.question.update({ where: { id }, data: { locked } });
  revalidatePath(`/qa/${id}`);
}

export async function deleteQuestion(id: string) {
  await requireRole("MODERATOR");
  await prisma.question.update({ where: { id }, data: { deleted: true } });
  revalidatePath("/qa");
}

export async function deleteComment(id: string, questionId: string) {
  await requireRole("MODERATOR");
  await prisma.comment.update({ where: { id }, data: { deleted: true } });
  revalidatePath(`/qa/${questionId}`);
}
