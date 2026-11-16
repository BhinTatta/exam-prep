"use client";

import { useState } from "react";
import { useWidth } from "./use-width";

export type TimeBar = {
  number: number;
  section: string;
  type: string;
  outcome: "correct" | "incorrect" | "skipped";
  seconds: number;
  marksText: string; // "+2 / 2"
  timeText: string; // "4m 12s"
};

const PLOT_H = 170;
const M = { top: 26, bottom: 44, left: 40, right: 8 };
const HEIGHT = M.top + PLOT_H + M.bottom;

const FILL = { correct: "var(--success)", incorrect: "var(--destructive)", skipped: "var(--muted-foreground)" } as const;
const NAME = { correct: "Correct", incorrect: "Incorrect", skipped: "Unattempted" } as const;

/** A y-axis top that lands on a round number of minutes. */
function niceMax(seconds: number) {
  const minutes = Math.max(1, seconds / 60);
  const step = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 45, 60].find((s) => s >= minutes) ?? Math.ceil(minutes / 30) * 30;
  return step * 60;
}

/**
 * The mark under each column that says how the question went. It exists
 * because the columns' green and red are near-identical to a colour-blind
 * reader: a filled dot, a cross and a dash are not.
 */
function Glyph({ outcome, cx, cy }: { outcome: TimeBar["outcome"]; cx: number; cy: number }) {
  if (outcome === "correct") return <circle cx={cx} cy={cy} r={3.5} fill={FILL.correct} />;
  if (outcome === "incorrect") {
    return (
      <path
        d={`M${cx - 3.5},${cy - 3.5} L${cx + 3.5},${cy + 3.5} M${cx + 3.5},${cy - 3.5} L${cx - 3.5},${cy + 3.5}`}
        stroke={FILL.incorrect}
        strokeWidth={2}
        strokeLinecap="round"
      />
    );
  }
  return <path d={`M${cx - 3},${cy} L${cx + 3},${cy}`} stroke={FILL.skipped} strokeWidth={2} strokeLinecap="round" opacity={0.6} />;
}

/**
 * Time spent on every question, in paper order, with how each one turned out.
 * The shape of the whole test at a glance: where the time went, and whether it
 * paid off. Click a column to jump to that question's review.
 */
export function QuestionTimeChart({ bars }: { bars: TimeBar[] }) {
  const [ref, containerWidth] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  // Columns share the width when there's room and hold a readable minimum when
  // there isn't — a 60-question paper scrolls sideways on a phone.
  const slot = Math.max(14, Math.min(34, (containerWidth - M.left - M.right) / bars.length));
  const width = Math.max(containerWidth, Math.ceil(M.left + M.right + slot * bars.length));
  const barW = Math.min(24, slot - 2);
  const max = niceMax(Math.max(...bars.map((b) => b.seconds)));
  const y = (s: number) => M.top + PLOT_H * (1 - s / max);
  const cx = (i: number) => M.left + slot * (i + 0.5);
  const ticks = [0, max / 2, max];

  // Where one section ends and the next begins.
  const sections: { name: string; from: number; to: number }[] = [];
  bars.forEach((b, i) => {
    const current = sections[sections.length - 1];
    if (current && current.name === b.section) current.to = i;
    else sections.push({ name: b.section, from: i, to: i });
  });
  const labelEvery = slot >= 22 ? 1 : slot >= 16 ? 2 : 5;

  const hovered = active === null ? null : bars[active];
  const tipX = active === null ? 0 : cx(active);

  return (
    <div className="flex flex-col gap-3">
      <div ref={ref} className="relative overflow-x-auto">
        {containerWidth > 0 && (
          <div className="relative" style={{ width, height: HEIGHT }}>
            <svg width={width} height={HEIGHT} role="img" aria-label="Time spent on each question, in paper order. The question review below gives every figure.">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                  <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                    {t === 0 ? "0" : `${Math.round((t / 60) * 10) / 10}m`}
                  </text>
                </g>
              ))}
              {sections.map((s, i) => (
                <g key={s.name}>
                  {i > 0 && (
                    <line
                      x1={M.left + slot * s.from}
                      x2={M.left + slot * s.from}
                      y1={M.top - 18}
                      y2={HEIGHT - 4}
                      stroke="var(--border)"
                      strokeWidth={1}
                    />
                  )}
                  {/* A one-or-two-question section has no room for its name. */}
                  {(s.to - s.from + 1) * slot >= 64 && (
                    <text x={M.left + slot * s.from + 6} y={M.top - 10} className="fill-muted-foreground text-[11px] font-medium">
                      {s.name}
                    </text>
                  )}
                </g>
              ))}

              {bars.map((b, i) => {
                const top = y(b.seconds);
                const h = M.top + PLOT_H - top;
                const r = Math.min(4, h, barW / 2);
                const left = cx(i) - barW / 2;
                return (
                  <g key={b.number} opacity={active === null || active === i ? 1 : 0.45}>
                    {h > 0.5 && (
                      // Rounded at the data end, square on the baseline.
                      <path
                        d={`M${left},${top + h} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${top + h} Z`}
                        fill={FILL[b.outcome]}
                        opacity={b.outcome === "skipped" ? 0.4 : 1}
                      />
                    )}
                    <Glyph outcome={b.outcome} cx={cx(i)} cy={M.top + PLOT_H + 12} />
                    {(b.number % labelEvery === 0 || b.number === 1) && (
                      <text x={cx(i)} y={M.top + PLOT_H + 34} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                        {b.number}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Full-height hit targets: a 3-second column is otherwise impossible to hover. */}
            {bars.map((b, i) => (
              <a
                key={b.number}
                href={`#q-${b.number}`}
                aria-label={`Question ${b.number}: ${NAME[b.outcome]}, ${b.timeText}, ${b.marksText} marks`}
                className="absolute top-0 rounded-sm outline-offset-0 focus-visible:outline-2"
                style={{ left: M.left + slot * i, width: slot, height: HEIGHT }}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            ))}

            {hovered && (
              <div
                className="pointer-events-none absolute top-0 z-10 w-max rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
                style={tipX > width - 170 ? { right: width - tipX + slot / 2 + 4 } : { left: tipX + slot / 2 + 4 }}
              >
                <p className="font-medium">
                  Question {hovered.number} <span className="font-normal text-muted-foreground">· {hovered.type}</span>
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{hovered.timeText}</p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <svg width={10} height={10} aria-hidden>
                    <Glyph outcome={hovered.outcome} cx={5} cy={5} />
                  </svg>
                  {NAME[hovered.outcome]} · {hovered.marksText}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(["correct", "incorrect", "skipped"] as const).map((o) => (
          <li key={o} className="flex items-center gap-1.5">
            <svg width={22} height={12} aria-hidden>
              <rect x={0} y={1} width={10} height={10} rx={2} fill={FILL[o]} opacity={o === "skipped" ? 0.4 : 1} />
              <Glyph outcome={o} cx={17} cy={6} />
            </svg>
            {NAME[o]}
          </li>
        ))}
      </ul>
    </div>
  );
}
