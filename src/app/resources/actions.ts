"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { resourceCategories, subjects } from "@/config/site";

const resourceSchema = z.object({
  title: z.string().min(3).max(160),
  url: z.string().url(),
  category: z.enum(resourceCategories.map((c) => c.slug) as [string, ...string[]]),
  subject: z.enum(subjects.map((s) => s.slug) as [string, ...string[]]),
  tags: z.string().optional(),
});

export async function createResource(formData: FormData) {
  const user = await requireRole("MODERATOR");

  const parsed = resourceSchema.parse({
    title: formData.get("title"),
    url: formData.get("url"),
    category: formData.get("category"),
    subject: formData.get("subject"),
    tags: formData.get("tags") ?? undefined,
  });

  const tags = (parsed.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await prisma.resource.create({
    data: {
      title: parsed.title,
      url: parsed.url,
      category: parsed.category,
      subject: parsed.subject,
      tags,
      uploadedBy: user.id,
    },
  });

  revalidatePath("/resources");
}

export async function deleteResource(id: string) {
  await requireRole("MODERATOR");
  await prisma.resource.delete({ where: { id } });
  revalidatePath("/resources");
}

export async function togglePinResource(id: string, pinned: boolean) {
  await requireRole("MODERATOR");
  await prisma.resource.update({ where: { id }, data: { pinned } });
  revalidatePath("/resources");
}

export async function toggleFeatureResource(id: string, featured: boolean) {
  await requireRole("ADMIN");
  await prisma.resource.update({ where: { id }, data: { featured } });
  revalidatePath("/resources");
}
