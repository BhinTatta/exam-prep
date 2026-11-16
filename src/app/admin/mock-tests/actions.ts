"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { importPaper, type ImportSummary } from "@/lib/mock-tests/import";

export type ImportResult = { ok: true; summary: ImportSummary } | { ok: false; error: string };

/**
 * Imports a paper from pasted or uploaded JSON. Problems come back as a value
 * rather than a thrown error: production builds strip thrown messages before
 * they reach the browser, and "Q17: answer E is not one of the options" is
 * exactly what the admin needs to read.
 */
export async function importMockTest(json: string): Promise<ImportResult> {
  await requireRole("ADMIN");

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: `That isn't valid JSON: ${e instanceof Error ? e.message : "parse error"}` };
  }

  try {
    const summary = await importPaper(prisma, raw);
    revalidatePath("/admin/mock-tests");
    revalidatePath(`/admin/mock-tests/${summary.id}`);
    return { ok: true, summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed." };
  }
}

export async function setMockTestPublished(id: string, published: boolean) {
  await requireRole("ADMIN");
  await prisma.mockTest.update({ where: { id }, data: { published } });
  revalidatePath("/admin/mock-tests");
  revalidatePath(`/admin/mock-tests/${id}`);
}

export async function deleteMockTest(id: string) {
  await requireRole("ADMIN");
  await prisma.mockTest.delete({ where: { id } });
  revalidatePath("/admin/mock-tests");
}
