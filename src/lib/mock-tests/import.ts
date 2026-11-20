import type { PrismaClient } from "@prisma/client";
import { normalizePaper } from "./types";

export type ImportSummary = {
  id: string;
  slug: string;
  title: string;
  created: boolean;
  published: boolean;
  sections: number;
  questions: number;
  totalMarks: number;
  /** Questions that were in the database but not in this file, and were deleted. */
  removedQuestions: number[];
};

/**
 * Loads one paper file into the database — creating the test, or updating it
 * in place if the slug already exists.
 *
 * Re-importing is the editing workflow (fix a typo in the file, import again),
 * so it must be safe on a paper students have already taken: questions are
 * matched by their printed number and updated, never dropped and recreated,
 * which keeps every recorded response attached to its question. Scores already
 * awarded are not recomputed.
 *
 * Takes the client as an argument so the CLI script and the admin action share
 * this without the script importing the Next.js-side singleton.
 */
export async function importPaper(prisma: PrismaClient, raw: unknown): Promise<ImportSummary> {
  const paper = normalizePaper(raw);

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.mockTest.findUnique({ where: { slug: paper.slug }, select: { id: true } });
      const meta = {
        title: paper.title,
        exam: paper.exam,
        subject: paper.subject,
        year: paper.year ?? null,
        description: paper.description ?? null,
        durationMinutes: paper.durationMinutes,
        calculator: paper.calculator,
        ...(paper.published === undefined ? {} : { published: paper.published }),
      };
      const test = existing
        ? await tx.mockTest.update({ where: { id: existing.id }, data: meta })
        : await tx.mockTest.create({ data: { slug: paper.slug, ...meta } });

      // Sections are matched by position. Park the existing ones on negative
      // orders first so the (testId, order) unique index never sees a clash
      // while rows are being rewritten.
      const oldSections = await tx.mockSection.findMany({ where: { testId: test.id }, orderBy: { order: "asc" } });
      for (const [i, s] of oldSections.entries()) {
        await tx.mockSection.update({ where: { id: s.id }, data: { order: -1 - i } });
      }

      const keptNumbers: number[] = [];
      let totalMarks = 0;
      for (const [i, section] of paper.sections.entries()) {
        const data = { name: section.name, instructions: section.instructions, order: i };
        const row = oldSections[i]
          ? await tx.mockSection.update({ where: { id: oldSections[i].id }, data })
          : await tx.mockSection.create({ data: { testId: test.id, ...data } });

        for (const q of section.questions) {
          keptNumbers.push(q.number);
          totalMarks += q.marks;
          const fields = {
            sectionId: row.id,
            type: q.type,
            topic: q.topic,
            prompt: q.prompt,
            imageUrl: q.imageUrl,
            options: q.options ?? undefined,
            correctOptionIds: q.correctOptionIds,
            natMin: q.natMin,
            natMax: q.natMax,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            marksToAll: q.marksToAll,
            explanation: q.explanation,
          };
          await tx.mockQuestion.upsert({
            where: { testId_number: { testId: test.id, number: q.number } },
            update: fields,
            create: { testId: test.id, number: q.number, ...fields },
          });
        }
      }

      const stale = await tx.mockQuestion.findMany({
        where: { testId: test.id, number: { notIn: keptNumbers } },
        select: { number: true },
      });
      await tx.mockQuestion.deleteMany({ where: { testId: test.id, number: { notIn: keptNumbers } } });
      // Every question has been moved to its new section by now, so sections
      // beyond the new count are empty.
      await tx.mockSection.deleteMany({ where: { testId: test.id, order: { lt: 0 } } });

      return {
        id: test.id,
        slug: test.slug,
        title: test.title,
        created: !existing,
        published: test.published,
        sections: paper.sections.length,
        questions: keptNumbers.length,
        totalMarks: Math.round(totalMarks * 100) / 100,
        removedQuestions: stale.map((q) => q.number).sort((a, b) => a - b),
      };
    },
    // A 60-question paper is ~70 sequential statements; over a pooled Neon
    // connection that can outrun Prisma's 5s default.
    { timeout: 60_000, maxWait: 15_000 }
  );
}
