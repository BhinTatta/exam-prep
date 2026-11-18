"use client";

import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Panel } from "@/components/mock-tests/analysis/primitives";
import { RANK_EXAM } from "@/lib/rank-predictor/data";
import { COLLEGES, COLLEGE_YEARS } from "@/lib/rank-predictor/colleges";
import { predictRank } from "@/lib/rank-predictor/predict";
import { CollegeList } from "./college-list";
import { RankByYear, RankDisclaimer, RankHeadline } from "./rank-breakdown";

/**
 * The stand-alone "what rank is this score?" tool: type a score or drag the
 * slider and everything below updates as it moves.
 */
export function RankCalculator({ initialMarks }: { initialMarks: number }) {
  const [marks, setMarks] = useState(initialMarks);
  // The text box keeps its own string so "4", "45." and "" can all be typed on
  // the way to "45.5" without the field fighting back.
  const [text, setText] = useState(String(initialMarks));

  const prediction = useMemo(() => predictRank(marks), [marks]);

  function onType(value: string) {
    if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) return;
    setText(value);
    const n = Number(value);
    if (value !== "" && Number.isFinite(n)) setMarks(Math.min(RANK_EXAM.maxMarks, n));
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border bg-linear-to-br from-primary/10 via-card to-card p-6 shadow-xs">
        <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center">
          <div className="flex flex-col gap-4">
            <label htmlFor="rank-marks" className="text-sm font-medium text-muted-foreground">
              Your marks, out of {RANK_EXAM.maxMarks}
            </label>
            <input
              id="rank-marks"
              value={text}
              onChange={(e) => onType(e.target.value.trim())}
              onBlur={() => setText(String(marks))}
              inputMode="decimal"
              autoComplete="off"
              className="h-16 w-36 rounded-xl border border-input bg-background px-4 font-heading text-4xl font-bold tracking-tight outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
            <Slider
              aria-label="Marks"
              min={0}
              max={RANK_EXAM.maxMarks}
              step={0.5}
              value={[marks]}
              onValueChange={([v]) => {
                setMarks(v);
                setText(String(v));
              }}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>
          <RankHeadline prediction={prediction} />
        </div>
      </section>

      <Panel
        title="Year by year"
        subtitle="What this score was worth in each of the last five exams, with the rank range for its 5-mark bracket"
      >
        <RankByYear prediction={prediction} />
      </Panel>

      <Panel
        title="Which IITs does that reach?"
        subtitle={`M.Sc. Physics at all ${COLLEGES.length} IITs, from the last ${COLLEGE_YEARS.length} years' final admission rounds`}
      >
        <CollegeList prediction={prediction} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          A rough guide, not a guarantee. Closing ranks move every year and every round, and your real rank will not be
          an exact match for this estimate. Check the official JAM opening and closing ranks before you decide.
        </p>
      </Panel>

      <RankDisclaimer />
    </div>
  );
}
