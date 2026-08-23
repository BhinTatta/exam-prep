import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { TopicStat, StudyPlan } from "@/lib/assessment/types";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

export type StudyPlanPdfInput = {
  siteName: string;
  testTitle: string;
  totalScore: number;
  maxScore: number;
  topicBreakdown: TopicStat[];
  studyPlan: StudyPlan;
  mentors: { name: string; institute: string; rate: number }[];
};

// pdf-lib's standard fonts only encode WinAnsi (~Latin-1). Study plan text
// comes from an LLM and can contain smart quotes, dashes, or symbols
// (e.g. "₹") outside that set — normalize the common ones and drop anything
// else so a single unusual character can't crash PDF generation.
const PDF_SAFE_REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  "₹": "Rs. ",
  "•": "-",
};

function sanitizeForPdf(text: string): string {
  const normalized = text.replace(/[‘’“”–—…₹•]/g, (ch) => PDF_SAFE_REPLACEMENTS[ch]);
  return [...normalized].map((ch) => (ch.codePointAt(0)! > 255 ? "?" : ch)).join("");
}

export async function renderStudyPlanPdf(input: StudyPlanPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(lineHeight: number) {
    if (y < MARGIN + lineHeight) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawText(
    text: string,
    opts: { size?: number; useBold?: boolean; color?: ReturnType<typeof rgb>; gapAfter?: number } = {}
  ) {
    const size = opts.size ?? 11;
    const useFont: PDFFont = opts.useBold ? bold : font;
    const color = opts.color ?? rgb(0.13, 0.13, 0.13);
    const maxWidth = PAGE_WIDTH - MARGIN * 2;

    const words = sanitizeForPdf(text).split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (useFont.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);

    for (const l of lines) {
      ensureSpace(size + 4);
      page.drawText(l, { x: MARGIN, y, size, font: useFont, color });
      y -= size + 4;
    }
    y -= opts.gapAfter ?? 4;
  }

  function drawRule() {
    ensureSpace(12);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 14;
  }

  drawText(input.siteName, { size: 10, color: rgb(0.5, 0.5, 0.5), gapAfter: 2 });
  drawText(input.testTitle, { size: 20, useBold: true, gapAfter: 2 });
  drawText(`Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, {
    size: 9,
    color: rgb(0.55, 0.55, 0.55),
    gapAfter: 16,
  });

  const pct = input.maxScore > 0 ? Math.round((input.totalScore / input.maxScore) * 100) : 0;
  drawText(`Score: ${input.totalScore} / ${input.maxScore} (${pct}%)`, { size: 14, useBold: true, gapAfter: 16 });

  drawText("Topic breakdown", { size: 13, useBold: true, gapAfter: 6 });
  for (const t of input.topicBreakdown) {
    drawText(`${t.topic} — ${t.correct}/${t.total} correct`, { size: 11, gapAfter: 3 });
  }
  y -= 10;
  drawRule();

  drawText("Your study plan", { size: 13, useBold: true, gapAfter: 6 });
  drawText(input.studyPlan.overallMessage, { size: 12, useBold: true, gapAfter: 4 });
  drawText(input.studyPlan.summary, { size: 11, gapAfter: 14 });

  for (const t of input.studyPlan.topics) {
    drawText(`${t.topic} (${t.verdict})`, { size: 11, useBold: true, gapAfter: 2 });
    drawText(t.advice, { size: 10, color: rgb(0.3, 0.3, 0.3), gapAfter: 10 });
  }

  if (input.mentors.length > 0) {
    y -= 6;
    drawRule();
    drawText("Recommended mentors", { size: 13, useBold: true, gapAfter: 6 });
    for (const m of input.mentors) {
      // pdf-lib's standard WinAnsi-encoded fonts can't render "₹" — spell it out instead.
      drawText(`${m.name} — ${m.institute} (Rs. ${m.rate}/session)`, { size: 11, gapAfter: 4 });
    }
  }

  return pdfDoc.save();
}
