// The arithmetic behind the on-screen scientific calculator. Pure and
// framework-free so it can be reasoned about (and tested) without a browser.
//
// It works like the calculator in the real exam window, not like a formula
// bar: a function key acts on the number currently in the display (type 30,
// press sin), while + − × ÷ xʸ mod and brackets build up an expression that
// "=" evaluates with the usual precedence.

export type AngleMode = "deg" | "rad";
export type BinaryOp = "+" | "-" | "*" | "/" | "^" | "mod";
type Token = number | BinaryOp | "(" | ")";

export type CalcState = {
  tokens: Token[];
  /** Digits being typed. Empty when the display is showing a result. */
  entry: string;
  /** What the display shows when nothing is being typed. */
  shown: number;
  /** True right after a function key or ")" — the display holds a finished value. */
  hasValue: boolean;
  error: boolean;
  memory: number;
  angle: AngleMode;
};

export const initialCalcState: CalcState = {
  tokens: [],
  entry: "",
  shown: 0,
  hasValue: false,
  error: false,
  memory: 0,
  angle: "deg",
};

const PRECEDENCE: Record<BinaryOp, number> = { "+": 1, "-": 1, "*": 2, "/": 2, mod: 2, "^": 3 };
const isOp = (t: Token | undefined): t is BinaryOp => typeof t === "string" && t in PRECEDENCE;

function applyOp(op: BinaryOp, a: number, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return b === 0 ? NaN : a / b;
    case "^":
      return Math.pow(a, b);
    case "mod":
      return b === 0 ? NaN : a % b;
  }
}

/** Shunting-yard over an already-tokenised expression. Unclosed brackets are closed for you. */
export function evaluateTokens(tokens: Token[]): number {
  const values: number[] = [];
  const ops: (BinaryOp | "(")[] = [];
  const reduce = () => {
    const op = ops.pop() as BinaryOp;
    const b = values.pop();
    const a = values.pop();
    values.push(a === undefined || b === undefined ? NaN : applyOp(op, a, b));
  };

  for (const t of tokens) {
    if (typeof t === "number") values.push(t);
    else if (t === "(") ops.push(t);
    else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") reduce();
      ops.pop();
    } else {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top === "(") break;
        // xʸ is right-associative: 2^3^2 is 2^(3^2).
        if (PRECEDENCE[top] > PRECEDENCE[t] || (PRECEDENCE[top] === PRECEDENCE[t] && t !== "^")) reduce();
        else break;
      }
      ops.push(t);
    }
  }
  while (ops.length) {
    if (ops[ops.length - 1] === "(") ops.pop();
    else reduce();
  }
  return values.length === 1 ? values[0] : NaN;
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// sin(180°) should read 0, not 1.2e-16.
const tidy = (n: number) => (Math.abs(n) < 1e-15 ? 0 : n);

export const UNARY_FUNCTIONS = {
  sin: (x, m) => tidy(Math.sin(toRad(x, m))),
  cos: (x, m) => tidy(Math.cos(toRad(x, m))),
  tan: (x, m) => {
    const r = toRad(x, m);
    return Math.abs(Math.cos(r)) < 1e-15 ? NaN : tidy(Math.tan(r));
  },
  asin: (x, m) => fromRad(Math.asin(x), m),
  acos: (x, m) => fromRad(Math.acos(x), m),
  atan: (x, m) => fromRad(Math.atan(x), m),
  sinh: (x) => Math.sinh(x),
  cosh: (x) => Math.cosh(x),
  tanh: (x) => Math.tanh(x),
  asinh: (x) => Math.asinh(x),
  acosh: (x) => Math.acosh(x),
  atanh: (x) => Math.atanh(x),
  ln: (x) => (x <= 0 ? NaN : Math.log(x)),
  log: (x) => (x <= 0 ? NaN : Math.log10(x)),
  log2: (x) => (x <= 0 ? NaN : Math.log2(x)),
  exp: (x) => Math.exp(x),
  pow10: (x) => Math.pow(10, x),
  sqrt: (x) => (x < 0 ? NaN : Math.sqrt(x)),
  cbrt: (x) => Math.cbrt(x),
  square: (x) => x * x,
  cube: (x) => x * x * x,
  inv: (x) => (x === 0 ? NaN : 1 / x),
  abs: (x) => Math.abs(x),
  fact: (x) => factorial(x),
  neg: (x) => -x,
  percent: (x) => x / 100,
} satisfies Record<string, (x: number, mode: AngleMode) => number>;
export type UnaryFn = keyof typeof UNARY_FUNCTIONS;

function toRad(x: number, mode: AngleMode) {
  return mode === "deg" ? (x * Math.PI) / 180 : x;
}
function fromRad(x: number, mode: AngleMode) {
  return mode === "deg" ? (x * 180) / Math.PI : x;
}

export type CalcAction =
  | { type: "digit"; digit: string } // "0".."9" or "."
  | { type: "op"; op: BinaryOp }
  | { type: "fn"; fn: UnaryFn }
  | { type: "const"; value: number }
  | { type: "paren"; paren: "(" | ")" }
  | { type: "equals" }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "angle"; mode: AngleMode }
  | { type: "memory"; op: "MC" | "MR" | "MS" | "M+" | "M-" };

const current = (s: CalcState) => (s.entry !== "" ? Number(s.entry) : s.shown);
const fail = (s: CalcState): CalcState => ({ ...s, tokens: [], entry: "", shown: 0, hasValue: false, error: true });
/** Is there a number on the display that the next operator should pick up? */
const hasOperand = (s: CalcState) => s.entry !== "" || s.hasValue;

export function calcReducer(state: CalcState, action: CalcAction): CalcState {
  // After an error only Clear, memory and the angle switch do anything
  // useful; any other key starts again from zero.
  const s: CalcState = state.error && action.type !== "clear" ? { ...state, error: false } : state;

  switch (action.type) {
    case "clear":
      return { ...initialCalcState, memory: s.memory, angle: s.angle };

    case "angle":
      return { ...s, angle: action.mode };

    case "digit": {
      // Typing over a finished value replaces it. If that value was a closed
      // bracket group, the group goes with it.
      const tokens = s.hasValue && s.tokens[s.tokens.length - 1] === ")" ? dropLastGroup(s.tokens) : s.tokens;
      let entry = s.hasValue ? "" : s.entry;
      if (action.digit === ".") {
        if (entry.includes(".")) return { ...s, tokens };
        entry = entry === "" ? "0." : `${entry}.`;
      } else {
        if (entry.replace(/[-.]/g, "").length >= 16) return s;
        entry = entry === "0" ? action.digit : entry + action.digit;
      }
      return { ...s, tokens, entry, hasValue: false };
    }

    case "backspace": {
      if (s.entry === "") return s;
      const entry = s.entry.slice(0, -1);
      return { ...s, entry: entry === "-" ? "" : entry, shown: 0 };
    }

    case "const":
      return setValue(s, action.value);

    case "fn": {
      const result = UNARY_FUNCTIONS[action.fn](current(s), s.angle);
      return Number.isFinite(result) ? setValue(s, result) : fail(s);
    }

    case "op": {
      const last = s.tokens[s.tokens.length - 1];
      if (!hasOperand(s) && isOp(last)) {
        // Pressed × then changed your mind to ÷.
        return { ...s, tokens: [...s.tokens.slice(0, -1), action.op] };
      }
      const tokens = last === ")" && s.hasValue ? s.tokens : [...s.tokens, current(s)];
      return { ...s, tokens: [...tokens, action.op], entry: "", shown: current(s), hasValue: false };
    }

    case "paren": {
      if (action.paren === "(") {
        const last = s.tokens[s.tokens.length - 1];
        // "2 (" means "2 × (" — otherwise the 2 would silently vanish.
        if (hasOperand(s) && last !== ")") {
          return { ...s, tokens: [...s.tokens, current(s), "*", "("], entry: "", hasValue: false };
        }
        const tokens = last === ")" ? [...s.tokens, "*" as const] : s.tokens;
        return { ...s, tokens: [...tokens, "("], entry: "", hasValue: false };
      }
      const open = s.tokens.filter((t) => t === "(").length - s.tokens.filter((t) => t === ")").length;
      if (open <= 0) return s;
      const last = s.tokens[s.tokens.length - 1];
      const tokens: Token[] = last === ")" && s.hasValue ? [...s.tokens, ")"] : [...s.tokens, current(s), ")"];
      const value = evaluateTokens(groupAtEnd(tokens));
      if (!Number.isFinite(value)) return fail(s);
      return { ...s, tokens, entry: "", shown: value, hasValue: true };
    }

    case "equals": {
      const last = s.tokens[s.tokens.length - 1];
      const tokens = last === ")" && s.hasValue ? s.tokens : [...s.tokens, current(s)];
      const value = evaluateTokens(tokens);
      if (!Number.isFinite(value)) return fail(s);
      return { ...s, tokens: [], entry: "", shown: value, hasValue: true };
    }

    case "memory": {
      const v = current(s);
      // Storing ends the number being typed, so "7 MS 2" is a 2, not 72.
      const stored: CalcState = { ...s, entry: "", shown: v, hasValue: true };
      switch (action.op) {
        case "MC":
          return { ...s, memory: 0 };
        case "MR":
          return setValue(s, s.memory);
        case "MS":
          return { ...stored, memory: v };
        case "M+":
          return { ...stored, memory: s.memory + v };
        case "M-":
          return { ...stored, memory: s.memory - v };
      }
    }
  }
}

/** Puts a finished value on the display, replacing a closed bracket group if that's what was there. */
function setValue(s: CalcState, value: number): CalcState {
  const tokens = s.hasValue && s.tokens[s.tokens.length - 1] === ")" ? dropLastGroup(s.tokens) : s.tokens;
  return { ...s, tokens, entry: "", shown: value, hasValue: true };
}

/** Index of the "(" matching the ")" that ends `tokens`. */
function lastGroupStart(tokens: Token[]) {
  let depth = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i] === ")") depth++;
    else if (tokens[i] === "(" && --depth === 0) return i;
  }
  return 0;
}
const groupAtEnd = (tokens: Token[]) => tokens.slice(lastGroupStart(tokens));
const dropLastGroup = (tokens: Token[]) => tokens.slice(0, lastGroupStart(tokens));

const OP_LABEL: Record<BinaryOp, string> = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^", mod: "mod" };

export function formatCalcNumber(n: number): string {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e16 || abs < 1e-9) return n.toExponential(9).replace(/\.?0+e/, "e");
  return String(Number(n.toPrecision(14)));
}

/** The small line above the display: the expression so far. */
export function formatCalcExpression(tokens: Token[]): string {
  return tokens.map((t) => (typeof t === "number" ? formatCalcNumber(t) : isOp(t) ? OP_LABEL[t] : t)).join(" ");
}

export function calcDisplay(s: CalcState): string {
  if (s.error) return "Error";
  return s.entry !== "" ? s.entry : formatCalcNumber(s.shown);
}
