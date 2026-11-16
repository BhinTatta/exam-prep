"use client";

import { useMemo, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Panel } from "@/components/mock-tests/analysis/primitives";
import { CATEGORIES, RANK_EXAM, type Category } from "@/lib/rank-predictor/data";
import { collegeChances, formatRank, predictRank, type CollegeChance } from "@/lib/rank-predictor/predict";
import { cn } from "@/lib/utils";
import { RankByYear, RankDisclaimer, RankHeadline } from "./rank-breakdown";

const CHANCE: Record<CollegeChance, { label: string; icon: typeof Check; tone: string }> = {
  likely: { label: "Within reach", icon: Check, tone: "text-success" },
  borderline: { label: "Borderline", icon: Minus, tone: "text-highlight-foreground dark:text-highlight" },
  unlikely: { label: "Usually closes earlier", icon: X, tone: "text-muted-foreground" },
};

/**
 * The stand-alone "what rank is this score?" tool: type a score or drag the
 * slider and everything below updates as it moves.
 */
export function RankCalculator({ initialMarks }: { initialMarks: number }) {
  const [marks, setMarks] = useState(initialMarks);
  // The text box keeps its own string so "4", "45." and "" can all be typed on
  // the way to "45.5" without the field fighting back.
  const [text, setText] = useState(String(initialMarks));
  const [category, setCategory] = useState<Category>("General");

  const prediction = useMemo(() => predictRank(marks), [marks]);
  const colleges = prediction.average === null ? [] : collegeChances(prediction.average, category);

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
        subtitle="M.Sc. Physics, comparing your average estimated rank with each institute's usual closing rank"
        action={
          <div role="radiogroup" aria-label="Category" className="flex flex-wrap justify-end gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        }
      >
        {colleges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Enter a qualifying score to see this.</p>
        ) : (
          <ul className="divide-y">
            {colleges.map((c) => {
              const { label, icon: Icon, tone } = CHANCE[c.chance];
              return (
                <li key={c.institute} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="font-medium">{c.institute}</span>
                  <span className="flex items-center gap-4">
                    <span className="text-muted-foreground tabular-nums">
                      closes around {formatRank(c.low)}–{formatRank(c.high)}
                    </span>
                    <span className={cn("flex w-44 items-center gap-1.5 font-medium", tone)}>
                      <Icon className="size-4 shrink-0" /> {label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Closing ranks move every year and with every counselling round, and reserved-category seats are allotted on
          category rank. Treat this as a first look, then check the official JOAPS opening and closing ranks.
        </p>
      </Panel>

      <RankDisclaimer />
    </div>
  );
}
