"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import { CATEGORIES, COLLEGES, COLLEGE_YEARS, type Category } from "@/lib/rank-predictor/colleges";
import { collegeOutlook, formatRank, type CollegeChance, type CollegeOutlook, type RankPrediction } from "@/lib/rank-predictor/predict";
import { cn } from "@/lib/utils";

const CHANCE: Record<CollegeChance, { label: string; icon: typeof Check; pill: string }> = {
  likely: { label: "Good chance", icon: Check, pill: "bg-success/12 text-success" },
  borderline: { label: "Borderline", icon: Minus, pill: "bg-highlight/25 text-highlight-foreground dark:text-highlight" },
  unlikely: { label: "Unlikely", icon: X, pill: "bg-muted text-muted-foreground" },
  none: { label: "No seat", icon: Minus, pill: "bg-muted text-muted-foreground" },
};

type Filter = "all" | Exclude<CollegeChance, "none">;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "likely", label: "Good chance" },
  { key: "borderline", label: "Borderline" },
  { key: "unlikely", label: "Unlikely" },
];

const rangeText = (r: { opening: number; closing: number }) =>
  r.opening === r.closing ? formatRank(r.closing) : `${formatRank(r.opening)}–${formatRank(r.closing)}`;

// The year boxes sit three abreast even on a 320px phone, where "1,985–2,259"
// doesn't fit. Ranks never reach five digits, so the boxes drop the separator.
const compactRange = (r: { opening: number; closing: number }) =>
  r.opening === r.closing ? String(r.closing) : `${r.opening}–${r.closing}`;

/**
 * Every IIT that takes JAM Physics, with how this score would have fared at
 * each one in each of the last three years, for the chosen category.
 */
export function CollegeList({ prediction }: { prediction: RankPrediction }) {
  const [category, setCategory] = useState<Category>("General");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => collegeOutlook(prediction, category), [prediction, category]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, likely: 0, borderline: 0, unlikely: 0 };
    for (const r of rows) {
      if (r.chance === "none") continue;
      c.all += 1;
      c[r.chance] += 1;
    }
    return c;
  }, [rows]);
  const visible = filter === "all" ? rows : rows.filter((r) => r.chance === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Your category</p>
        <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                "h-8 rounded-full border px-3.5 text-sm font-medium transition-colors",
                category === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Show</p>
        <div role="radiogroup" aria-label="Filter institutes" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                filter === f.key ? "border-foreground/60 bg-foreground/5 font-medium" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
              <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-foreground tabular-nums">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Each box is that year&apos;s <strong className="font-medium text-foreground">opening – closing rank</strong>.{" "}
        <Check className="inline size-3.5 align-[-2px] text-success" aria-hidden /> means this score&apos;s estimated rank
        in that year&apos;s exam was inside the closing rank;{" "}
        <X className="inline size-3.5 align-[-2px]" aria-hidden /> means it wasn&apos;t.
      </p>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No institutes in this group for this score.
        </p>
      ) : (
        <ul className="-mx-1 flex flex-col divide-y">
          {visible.map((row) => (
            <CollegeRow key={row.code} row={row} category={category} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CollegeRow({ row, category }: { row: CollegeOutlook; category: Category }) {
  const [open, setOpen] = useState(false);
  const { label, icon: Icon, pill } = CHANCE[row.chance];
  const college = COLLEGES.find((c) => c.code === row.code)!;

  return (
    <li className="px-1 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.jointPhd ? "Joint M.Sc.–Ph.D." : "M.Sc. Physics"}
            {row.offeredYears > 0 && (
              <>
                {" · "}
                got in {row.madeYears} of {row.offeredYears} year{row.offeredYears === 1 ? "" : "s"}
              </>
            )}
          </p>
        </div>
        <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", pill)}>
          <Icon className="size-3.5" aria-hidden /> {label}
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-3 gap-1.5 sm:gap-2">
        {row.years.map((y) => (
          <div
            key={y.year}
            className={cn(
              "flex min-w-0 flex-col gap-0.5 rounded-lg border px-1.5 py-1.5 min-[360px]:px-2 sm:px-2.5",
              y.range === null && "border-dashed",
              y.made && "border-success/40 bg-success/5"
            )}
          >
            <dt className="flex items-center justify-between text-[0.6875rem] text-muted-foreground">
              <span className="tabular-nums">{y.year}</span>
              {y.made === true && <Check className="size-3.5 text-success" aria-label="would have got in" />}
              {y.made === false && <X className="size-3.5" aria-label="would not have got in" />}
            </dt>
            <dd className="text-xs font-medium tracking-tight whitespace-nowrap tabular-nums sm:text-sm sm:tracking-normal">
              {y.range ? compactRange(y.range) : <span className="font-normal text-muted-foreground">No seat</span>}
            </dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mt-2 flex items-center gap-1 text-xs font-medium text-primary"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Hide" : "All categories"}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[30rem] text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-medium">Year</th>
                {CATEGORIES.map((c) => (
                  <th key={c} className={cn("px-2.5 py-1.5 text-right font-medium", c === category && "text-foreground")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {COLLEGE_YEARS.map((year) => {
                const ranks = college.years[year];
                return (
                  <tr key={year} className="border-t">
                    <td className="px-2.5 py-1.5 font-medium">{year}</td>
                    {CATEGORIES.map((c) => (
                      <td
                        key={c}
                        className={cn("px-2.5 py-1.5 text-right whitespace-nowrap", c === category && "bg-primary/5 font-medium")}
                      >
                        {ranks?.[c] ? rangeText(ranks[c]) : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}
