"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWidth } from "./use-width";

export type TrendPoint = {
  id: string;
  href: string;
  title: string;
  date: string; // already formatted
  shortDate: string;
  percent: number;
  scoreText: string;
};

const HEIGHT = 240;
const M = { top: 28, right: 20, bottom: 28, left: 40 };

/**
 * Score across attempts, as a percentage of each paper's marks so different
 * papers share one axis. Attempts are spaced evenly, not by date: three papers
 * in one weekend and then one a month later should still read as four steps.
 */
export function ScoreTrendChart({ points }: { points: TrendPoint[] }) {
  const router = useRouter();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = HEIGHT - M.top - M.bottom;
  // Negative marking can push a score below zero; the axis follows it down.
  const min = Math.min(0, Math.floor(Math.min(...points.map((p) => p.percent)) / 10) * 10);
  const x = (i: number) => M.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => M.top + (1 - (v - min) / (100 - min)) * innerH;

  const ticks = [0, 25, 50, 75, 100];
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.percent).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(min)} L${x(0).toFixed(1)},${y(min)} Z`;
  // As many date labels as fit without touching.
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 64))));
  const last = points.length - 1;

  function nearest(clientX: number, target: Element) {
    const left = target.getBoundingClientRect().left;
    const ratio = points.length === 1 ? 0 : (clientX - left - M.left) / innerW;
    return Math.max(0, Math.min(last, Math.round(ratio * last)));
  }

  const hovered = active === null ? null : points[active];
  // Keep the tooltip inside the chart: flip it to the left of the point near the right edge.
  const tipLeft = active === null ? 0 : x(active);
  const flip = tipLeft > width * 0.6;

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Score trend over ${points.length} attempts, from ${points[0].percent}% to ${points[last].percent}%. The table below lists every attempt.`}
          className="cursor-pointer touch-pan-y"
          onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget))}
          onPointerLeave={() => setActive(null)}
          onClick={(e) => router.push(points[nearest(e.clientX, e.currentTarget)].href)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {t}%
              </text>
            </g>
          ))}
          {points.map(
            (p, i) =>
              (i % every === 0 || i === last) &&
              // Drop a regular label that would collide with the always-shown last one.
              (i === last || last - i >= every * 0.6) && (
                <text
                  key={p.id}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor={i === 0 && points.length > 1 ? "start" : i === last && points.length > 1 ? "end" : "middle"}
                  className="fill-muted-foreground text-[11px]"
                >
                  {p.shortDate}
                </text>
              )
          )}

          {points.length > 1 && (
            <>
              <path d={area} fill="var(--chart-1)" opacity={0.1} />
              <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={y(min)} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} />
          )}
          {points.map((p, i) => (
            <circle
              key={p.id}
              cx={x(i)}
              cy={y(p.percent)}
              r={i === active ? 6 : 4}
              fill="var(--chart-1)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
          {/* Only the latest point is labelled; the rest are on hover and in the table. */}
          {active === null && (
            <text
              x={x(last)}
              y={y(points[last].percent) - 12}
              textAnchor={points.length > 1 ? "end" : "middle"}
              className="fill-foreground text-xs font-semibold tabular-nums"
            >
              {points[last].percent}%
            </text>
          )}
        </svg>
      )}

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-56 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
          style={{
            top: Math.max(0, y(hovered.percent) - 78),
            left: flip ? undefined : tipLeft + 12,
            right: flip ? width - tipLeft + 12 : undefined,
          }}
        >
          <p className="truncate font-medium">{hovered.title}</p>
          <p className="text-muted-foreground">{hovered.date}</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {hovered.percent}% <span className="font-normal text-muted-foreground">· {hovered.scoreText}</span>
          </p>
        </div>
      )}
    </div>
  );
}
