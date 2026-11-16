"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { X, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  calcDisplay,
  calcReducer,
  formatCalcExpression,
  initialCalcState,
  type CalcAction,
} from "@/lib/mock-tests/calculator";

type Key = { label: React.ReactNode; action: CalcAction; tone?: "num" | "op" | "fn" | "danger" | "equals"; aria?: string };

const fn = (label: React.ReactNode, name: Extract<CalcAction, { type: "fn" }>["fn"], aria?: string): Key => ({
  label,
  action: { type: "fn", fn: name },
  tone: "fn",
  aria,
});
const num = (d: string): Key => ({ label: d, action: { type: "digit", digit: d }, tone: "num" });
const op = (label: string, o: Extract<CalcAction, { type: "op" }>["op"], aria: string): Key => ({
  label,
  action: { type: "op", op: o },
  tone: "op",
  aria,
});
const inv = (name: string) => (
  <>
    {name}
    <sup>−1</sup>
  </>
);

// Eight columns: four of functions on the left, the number pad on the right.
const KEYS: Key[] = [
  fn("sin", "sin"), fn("cos", "cos"), fn("tan", "tan"),
  { label: "π", action: { type: "const", value: Math.PI }, tone: "fn", aria: "pi" },
  { label: "(", action: { type: "paren", paren: "(" }, tone: "op" },
  { label: ")", action: { type: "paren", paren: ")" }, tone: "op" },
  { label: "←", action: { type: "backspace" }, tone: "danger", aria: "backspace" },
  { label: "C", action: { type: "clear" }, tone: "danger", aria: "clear" },

  fn(inv("sin"), "asin", "inverse sine"), fn(inv("cos"), "acos", "inverse cosine"), fn(inv("tan"), "atan", "inverse tangent"),
  { label: "e", action: { type: "const", value: Math.E }, tone: "fn", aria: "Euler's number" },
  num("7"), num("8"), num("9"), op("÷", "/", "divide"),

  fn("sinh", "sinh"), fn("cosh", "cosh"), fn("tanh", "tanh"), fn("n!", "fact", "factorial"),
  num("4"), num("5"), num("6"), op("×", "*", "multiply"),

  fn(inv("sinh"), "asinh", "inverse hyperbolic sine"), fn(inv("cosh"), "acosh", "inverse hyperbolic cosine"),
  fn(inv("tanh"), "atanh", "inverse hyperbolic tangent"), fn("|x|", "abs", "absolute value"),
  num("1"), num("2"), num("3"), op("−", "-", "subtract"),

  fn("ln", "ln", "natural log"), fn(<>log<sub>10</sub></>, "log", "log base 10"),
  fn(<>e<sup>x</sup></>, "exp", "e to the x"), fn(<>10<sup>x</sup></>, "pow10", "ten to the x"),
  num("0"), num("."), fn("±", "neg", "change sign"), op("+", "+", "add"),

  fn(<>x<sup>2</sup></>, "square", "square"), fn(<>x<sup>3</sup></>, "cube", "cube"),
  { label: <>x<sup>y</sup></>, action: { type: "op", op: "^" }, tone: "op", aria: "x to the power y" }, fn("√", "sqrt", "square root"),
  fn("∛", "cbrt", "cube root"), fn("1/x", "inv", "reciprocal"), op("mod", "mod", "modulo"),
  { label: "=", action: { type: "equals" }, tone: "equals", aria: "equals" },
];

const TONE: Record<NonNullable<Key["tone"]>, string> = {
  num: "bg-card font-semibold hover:bg-muted",
  op: "bg-secondary hover:bg-secondary/70",
  fn: "bg-muted text-foreground/90 hover:bg-muted/60",
  danger: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  equals: "bg-primary text-primary-foreground hover:bg-primary/90",
};

const KEYBOARD: Record<string, CalcAction> = {
  "+": { type: "op", op: "+" },
  "-": { type: "op", op: "-" },
  "*": { type: "op", op: "*" },
  "/": { type: "op", op: "/" },
  "^": { type: "op", op: "^" },
  "(": { type: "paren", paren: "(" },
  ")": { type: "paren", paren: ")" },
  "=": { type: "equals" },
  Enter: { type: "equals" },
  Backspace: { type: "backspace" },
  Delete: { type: "clear" },
};

/**
 * The on-screen scientific calculator, floating over the paper like the one in
 * the real exam window. Drag it by its title bar; it keeps its memory and
 * display while hidden, so closing it to read the question loses nothing.
 */
export function ScientificCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, dispatch] = useReducer(calcReducer, initialCalcState);
  // Offset from the default position (centred near the top), in px.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  if (!open) return null;

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    // Keep at least the title bar on screen so it can always be dragged back.
    const maxX = window.innerWidth / 2 + panel.offsetWidth / 2 - 60;
    const x = Math.max(-maxX, Math.min(maxX, d.baseX + e.clientX - d.startX));
    const y = Math.max(-56, Math.min(window.innerHeight - 110, d.baseY + e.clientY - d.startY));
    setOffset({ x, y });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") return onClose();
    const action: CalcAction | undefined = /^[0-9.]$/.test(e.key) ? { type: "digit", digit: e.key } : KEYBOARD[e.key];
    if (!action) return;
    e.preventDefault();
    dispatch(action);
  }

  const expression = formatCalcExpression(state.tokens);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Scientific calculator"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
      className="fixed top-16 left-1/2 z-[60] w-[min(26rem,calc(100vw-1rem))] rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className="flex cursor-move touch-none items-center justify-between rounded-t-xl bg-primary px-3 py-2 text-primary-foreground select-none"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <GripHorizontal className="size-4 opacity-70" /> Scientific Calculator
        </span>
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Close calculator"
          className="rounded p-1 hover:bg-white/20"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-2">
        <div className="rounded-lg border bg-background px-3 py-2 text-right">
          <div className="h-4 truncate text-xs text-muted-foreground" dir="rtl">
            <bdi>{expression}</bdi>
          </div>
          <div aria-live="polite" className="truncate font-mono text-2xl font-semibold tabular-nums">
            {calcDisplay(state)}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex overflow-hidden rounded-md border" role="radiogroup" aria-label="Angle unit">
            {(["deg", "rad"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={state.angle === mode}
                onClick={() => dispatch({ type: "angle", mode })}
                className={cn(
                  "px-2.5 py-1 font-medium",
                  state.angle === mode ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {mode === "deg" ? "Deg" : "Rad"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {state.memory !== 0 && <span className="mr-1 font-semibold text-primary">M</span>}
            {(["MC", "MR", "MS", "M+", "M-"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => dispatch({ type: "memory", op: m })}
                className="rounded-md border px-2 py-1 font-medium hover:bg-muted"
              >
                {m === "M-" ? "M−" : m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-8 gap-1">
          {KEYS.map((key, i) => (
            <button
              key={i}
              type="button"
              aria-label={key.aria}
              onClick={() => dispatch(key.action)}
              className={cn(
                "flex h-9 items-center justify-center rounded-md border text-[0.8125rem] transition-colors active:translate-y-px",
                TONE[key.tone ?? "fn"]
              )}
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
