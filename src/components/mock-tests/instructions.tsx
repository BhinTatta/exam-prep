import { formatMarks, formatNegative } from "@/lib/mock-tests/scoring";
import { StatusMark, STATUS_LABEL } from "./palette";

export type PatternRow = {
  section: string;
  type: "MCQ" | "MSQ" | "NAT";
  marks: number;
  negativeMarks: number;
  count: number;
  from: number;
  to: number;
};

const TYPE_NAME = {
  MCQ: "Multiple Choice (MCQ)",
  MSQ: "Multiple Select (MSQ)",
  NAT: "Numerical Answer (NAT)",
} as const;

/**
 * Collapses a paper into its marking pattern: one row per run of questions in
 * a section that share a type and marks ("Section A · Q1–10 · MCQ · 1 mark").
 */
export function buildPattern(
  sections: { name: string; questions: { number: number; type: "MCQ" | "MSQ" | "NAT"; marks: number; negativeMarks: number }[] }[]
): PatternRow[] {
  const rows: PatternRow[] = [];
  for (const section of sections) {
    for (const q of [...section.questions].sort((a, b) => a.number - b.number)) {
      const last = rows[rows.length - 1];
      if (
        last &&
        last.section === section.name &&
        last.type === q.type &&
        last.marks === q.marks &&
        Math.abs(last.negativeMarks - q.negativeMarks) < 1e-9 &&
        last.to === q.number - 1
      ) {
        last.to = q.number;
        last.count += 1;
      } else {
        rows.push({
          section: section.name,
          type: q.type,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          count: 1,
          from: q.number,
          to: q.number,
        });
      }
    }
  }
  return rows;
}

export function PatternTable({ rows }: { rows: PatternRow[] }) {
  const totalQuestions = rows.reduce((n, r) => n + r.count, 0);
  const totalMarks = rows.reduce((n, r) => n + r.count * r.marks, 0);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[30rem] text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Section</th>
            <th className="px-3 py-2 font-medium">Questions</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 text-right font-medium">Marks each</th>
            <th className="px-3 py-2 text-right font-medium">Wrong answer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.section}-${r.from}`} className="border-t">
              <td className="px-3 py-2 font-medium">{r.section}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.from === r.to ? `Q${r.from}` : `Q${r.from}–${r.to}`}{" "}
                <span className="text-muted-foreground">({r.count})</span>
              </td>
              <td className="px-3 py-2">{TYPE_NAME[r.type]}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMarks(r.marks)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.negativeMarks > 0 ? `−${formatNegative(r.marks, r.negativeMarks)}` : "No penalty"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/40 font-medium">
          <tr>
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 tabular-nums">{totalQuestions} questions</td>
            <td />
            <td className="px-3 py-2 text-right tabular-nums">{formatMarks(totalMarks)} marks</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * How the exam screen works. Shown before starting and from the Instructions
 * button during the test — same component, so the two can't drift apart.
 */
export function ExamInstructions({
  durationMinutes,
  calculator,
  pattern,
}: {
  durationMinutes: number;
  calculator: boolean;
  pattern: PatternRow[];
}) {
  const hasType = (t: PatternRow["type"]) => pattern.some((r) => r.type === t);
  return (
    <div className="flex flex-col gap-6 text-sm leading-relaxed">
      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-base font-semibold">Marking scheme</h3>
        <PatternTable rows={pattern} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-base font-semibold">The clock</h3>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            You have <strong>{durationMinutes} minutes</strong>. The countdown at the top right starts when you press
            Start and does not pause — not for a refresh, a closed tab or a lost connection.
          </li>
          <li>When it reaches zero the paper is submitted for you with whatever you have saved.</li>
          <li>If your browser closes, open this test again to carry on where you were, with the time that is left.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-base font-semibold">Question palette</h3>
        <p>The palette on the right shows every question in one of these states:</p>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {(["NOT_VISITED", "NOT_ANSWERED", "ANSWERED", "MARKED", "ANSWERED_MARKED"] as const).map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <StatusMark status={s}>{i + 1}</StatusMark>
              <span>
                {STATUS_LABEL[s]}
                {s === "ANSWERED_MARKED" && <span className="text-muted-foreground"> — still counted for marks</span>}
              </span>
            </li>
          ))}
        </ul>
        <p>Click a number to jump straight to that question. Section tabs above the question jump between sections.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-heading text-base font-semibold">Answering</h3>
        <ul className="ml-5 list-disc space-y-1.5">
          {hasType("MCQ") && (
            <li>
              <strong>MCQ</strong> — one option is correct. Pick it; pick another to change your mind.
            </li>
          )}
          {hasType("MSQ") && (
            <li>
              <strong>MSQ</strong> — one or more options are correct. You get the marks only for selecting every
              correct option and no wrong one; there is no partial credit.
            </li>
          )}
          {hasType("NAT") && (
            <li>
              <strong>NAT</strong> — type a number using the on-screen keypad or your keyboard. Decimals and a leading
              minus sign are allowed; anything inside the accepted range is marked correct.
            </li>
          )}
          <li>
            <strong>Save &amp; Next</strong> records your answer. An answer you chose but did not save is{" "}
            <strong>not recorded</strong> if you move away using the palette or a section tab.
          </li>
          <li>
            <strong>Mark for Review &amp; Next</strong> flags the question to come back to. If you had chosen an answer,
            it is saved and will be evaluated even if you never return.
          </li>
          <li>
            <strong>Clear Response</strong> removes your answer to the current question.
          </li>
          {calculator && (
            <li>
              A scientific <strong>calculator</strong> is available from the top bar. No other calculator is allowed in
              the real exam, so practise with this one.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
