// Loads paper files into the database.
//
//   npm run mock:import -- content/mock-tests/jam-physics-2025.json
//   npm run mock:import -- content/mock-tests/*.json --publish
//   npm run mock:import -- content/mock-tests/jam-physics-2025.json --check
//
// --check     validate only; touches nothing (no database needed)
// --publish   publish after importing, whatever the file says
//
// Importing a slug that already exists updates it in place and keeps every
// recorded attempt. The paper format is described in docs/mock-tests.md.
//
// Reads DATABASE_URL from .env like every other Prisma script here. Point it
// at production by exporting DATABASE_URL / DIRECT_URL for that one command.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importPaper } from "../src/lib/mock-tests/import";
import { normalizePaper, type NormalizedPaper } from "../src/lib/mock-tests/types";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const files = args.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.error("Usage: npm run mock:import -- <paper.json> [more.json …] [--check] [--publish]");
  process.exit(1);
}

/** Diagrams the paper points at inside /public that are not there. */
function missingImages(paper: NormalizedPaper) {
  const urls = paper.sections.flatMap((s) =>
    s.questions.flatMap((q) => [q.imageUrl, ...(q.options ?? []).map((o) => o.imageUrl)])
  );
  return urls.filter(
    (u): u is string => typeof u === "string" && u.startsWith("/") && !u.startsWith("//") && !existsSync(path.join("public", u))
  );
}

async function main() {
  const checkOnly = flags.has("--check");
  const prisma = checkOnly ? null : new PrismaClient();
  let failed = false;

  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8"));
      const paper = normalizePaper(raw);

      const missing = missingImages(paper);
      if (missing.length > 0) {
        throw new Error(`Diagrams not found under public/:\n  ${missing.join("\n  ")}`);
      }

      const questions = paper.sections.flatMap((s) => s.questions);
      const marks = Math.round(questions.reduce((n, q) => n + q.marks, 0) * 100) / 100;
      const byType = (t: string) => questions.filter((q) => q.type === t).length;
      const shape = `${questions.length} questions (${byType("MCQ")} MCQ, ${byType("MSQ")} MSQ, ${byType("NAT")} NAT), ${marks} marks`;

      if (!prisma) {
        console.log(`✓ ${file}: valid — ${shape}`);
        continue;
      }

      const summary = await importPaper(prisma, flags.has("--publish") ? { ...raw, published: true } : raw);
      console.log(
        `✓ ${file}: ${summary.created ? "created" : "updated"} "${summary.title}" — ${shape} — ` +
          `${summary.published ? "PUBLISHED" : "draft"} — /mock-tests/${summary.slug}`
      );
      if (summary.removedQuestions.length > 0) {
        console.log(`  removed questions no longer in the file: ${summary.removedQuestions.join(", ")}`);
      }
    } catch (error) {
      failed = true;
      console.error(`✗ ${file}: ${error instanceof Error ? error.message : error}`);
    }
  }

  await prisma?.$disconnect();
  if (failed) process.exitCode = 1;
}

main();
