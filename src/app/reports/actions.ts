"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/auth-helpers";

const reportSchema = z.object({
  targetType: z.enum(["QUESTION", "COMMENT", "RESOURCE"]),
  targetId: z.string().min(1),
  reason: z.string().min(1).max(100),
  details: z.string().max(2000).optional(),
  contextUrl: z.string().max(500).optional(),
});

export async function reportContent(input: z.infer<typeof reportSchema>) {
  const user = await requireUser();
  const parsed = reportSchema.parse(input);

  try {
    await prisma.report.create({
      data: { ...parsed, reporterId: user.id },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("You've already reported this");
    }
    throw err;
  }
}

export async function resolveReport(id: string, status: "RESOLVED" | "DISMISSED") {
  const admin = await requireRole("MODERATOR");
  await prisma.report.update({
    where: { id },
    data: { status, resolvedAt: new Date(), resolvedBy: admin.id },
  });
}

export async function resolveContactMessage(id: string, resolved: boolean) {
  await requireRole("MODERATOR");
  await prisma.contactMessage.update({ where: { id }, data: { resolved } });
}
