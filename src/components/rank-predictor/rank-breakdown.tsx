import { RANK_YEARS } from "@/lib/rank-predictor/data";
import { formatRank, type RankPrediction } from "@/lib/rank-predictor/predict";
import { cn } from "@/lib/utils";

// The worst rank anywhere in the reference data — the far end of every bar.
const LAST_RANK = Math.max(...RANK_YEARS.flatMap((y) => y.anchors.map((a) => a.rank)));

/**
 * How full a year's bar is. Ranks are spread over three orders of magnitude,
 * so the bar is on a log scale: rank 1 fills it, the last qualifying rank
 * leaves it empty, and rank 70 — not rank 2,250 — sits near the middle.
 */
const fill = (rank: number) => Math.max(0.02, 1 - Math.log(rank) / Math.log(LAST_RANK));

/** The headline: one average rank and the spread behind it. */
export function RankHeadline({ prediction, className }: { prediction: RankPrediction; className?: string }) {
  const { average, range, qualifiedYears, years } = prediction;
  if (average === null || range === null) {
    const lowest = Math.min(...years.map((y) => y.cutoff));
    return (
      <div className={className}>
        <p className="text-sm font-medium text-muted-foreground">Estimated rank</p>
        <p className="mt-1 font-heading text-3xl font-bold tracking-tight">Below the cutoff</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This score would not have qualified in any of the last {years.length} years. The lowest qualifying score in
          that time was about {lowest} marks.
        </p>
      </div>
    );
  }
  return (
    <div className={className}>
      <p className="text-sm font-medium text-muted-foreground">Estimated All India Rank</p>
      <p className="mt-1 font-heading text-6xl font-bold tracking-tight">
        <span className="text-3xl font-medium text-muted-foreground">≈ </span>
        {formatRank(average)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {qualifiedYears === years.length
          ? `Average across ${years.length} years`
          : `Average of the ${qualifiedYears} year${qualifiedYears === 1 ? "" : "s"} this score would have qualified in`}
        {range[0] !== range[1] && ` · anywhere from ${formatRank(range[0])} to ${formatRank(range[1])} depending on the paper`}
      </p>
    </div>
  );
}

/** One row per past year: what this score was worth in that year's exam. */
export function RankByYear({ prediction, highlightYear }: { prediction: RankPrediction; highlightYear?: number | null }) {
  return (
    <ul className="flex flex-col gap-4">
      {prediction.years.map((y) => {
        const highlighted = y.year === highlightYear;
        return (
          <li key={y.year} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5">
            <span className="min-w-0 text-sm">
              <span className="font-semibold tabular-nums">{y.year}</span>
              <span className="text-muted-foreground"> · {y.difficulty}</span>
              {highlighted && (
                <span className="ml-2 rounded-full bg-highlight/25 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                  This paper
                </span>
              )}
            </span>
            {y.rank === null ? (
              <span className="text-sm text-muted-foreground">Below cutoff ({y.cutoff} marks)</span>
            ) : (
              <span className="text-sm tabular-nums">
                <span className="font-semibold">≈ {formatRank(y.rank)}</span>
                {y.band && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatRank(y.band[0])}–{formatRank(y.band[1])}
                  </span>
                )}
              </span>
            )}
            <div
              className="col-span-2 h-2 overflow-hidden rounded-full bg-primary/15"
              role="img"
              aria-label={y.rank === null ? `${y.year}: below cutoff` : `${y.year}: about rank ${y.rank}`}
            >
              {y.rank !== null && (
                <div
                  className={cn("h-full rounded-full bg-primary transition-[width] duration-200")}
                  style={{ width: `${(fill(y.rank) * 100).toFixed(2)}%` }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function RankDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      Estimates only. IITs publish score distributions, not marks-to-rank tables, so these figures are reconstructed
      from statistical reports and candidates&apos; self-reported results. Read them as &ldquo;roughly here&rdquo;, not
      as a promise — and remember that a mock taken at home is not the exam hall.
    </p>
  );
}
