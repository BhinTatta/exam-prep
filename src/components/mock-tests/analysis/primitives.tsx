import { cn } from "@/lib/utils";

/** A titled panel. Every chart on the board and the dashboard sits in one. */
export function Panel({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** One headline number with its label and an optional line of context. */
export function StatTile({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-2xl border bg-card p-4 shadow-xs", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-semibold tracking-tight">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export type MeterRow = {
  label: string;
  /** 0..1 — how much of the track is filled. */
  share: number;
  figure: string;
  detail?: string;
};

/**
 * One ratio per named row, bars aligned so rows compare at a glance. Used
 * wherever each row has its own whole (a section's marks, a topic's questions).
 */
export function MeterList({ rows, tone = "primary" }: { rows: MeterRow[]; tone?: "primary" | "muted" }) {
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5">
          <span className="truncate text-sm font-medium" title={row.label}>
            {row.label}
          </span>
          <span className="text-sm tabular-nums">
            <span className="font-medium">{row.figure}</span>
            {row.detail && <span className="text-muted-foreground"> · {row.detail}</span>}
          </span>
          <div
            role="meter"
            aria-label={row.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(row.share * 100)}
            aria-valuetext={row.figure}
            className={cn("col-span-2 h-2 overflow-hidden rounded-full", tone === "primary" ? "bg-primary/15" : "bg-muted")}
          >
            <div
              className={cn("h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-muted-foreground/60")}
              style={{ width: `${Math.max(0, Math.min(1, row.share)) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const OUTCOME_PARTS = [
  { key: "correct", name: "Correct", block: "bg-success text-white", swatch: "bg-success" },
  { key: "incorrect", name: "Incorrect", block: "bg-destructive text-white", swatch: "bg-destructive" },
  { key: "skipped", name: "Unattempted", block: "bg-muted-foreground/25 text-foreground", swatch: "bg-muted-foreground/25" },
] as const;

/**
 * How the paper split into right, wrong and unattempted — one bar, each part
 * its own block. Green and red are close for colour-blind readers, so every
 * part is also named in the legend in block order and carries its count.
 */
export function OutcomeBar({ correct, incorrect, skipped }: { correct: number; incorrect: number; skipped: number }) {
  const counts = { correct, incorrect, skipped };
  const total = correct + incorrect + skipped;
  if (total === 0) return null;
  const summary = OUTCOME_PARTS.map((p) => `${counts[p.key]} ${p.name.toLowerCase()}`).join(", ");
  return (
    <div className="flex flex-col gap-2.5">
      <div role="img" aria-label={`Of ${total} questions: ${summary}`} className="flex h-7 gap-0.5">
        {OUTCOME_PARTS.filter((p) => counts[p.key] > 0).map((p) => {
          const share = counts[p.key] / total;
          return (
            <div
              key={p.key}
              title={`${p.name}: ${counts[p.key]} of ${total}`}
              style={{ flexGrow: counts[p.key], flexBasis: 0 }}
              className={cn("flex min-w-1 items-center rounded px-2 text-xs font-semibold tabular-nums", p.block)}
            >
              {/* A block too narrow for its number prints none; the legend carries it. */}
              {share >= 0.08 && counts[p.key]}
            </div>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {OUTCOME_PARTS.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", p.swatch)} />
            {p.name}
            {(counts[p.key] === 0 || counts[p.key] / total < 0.08) && (
              <span className="font-medium text-foreground tabular-nums">{counts[p.key]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
