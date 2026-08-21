import { Rng } from "../core/rng.ts";
import type { Question } from "../contract.ts";

/**
 * Exact, seeded question generation for FUSE.
 *
 * FUSE needs questions with a *chosen answer*: a tile is worth 7, so its face
 * must be an expression that equals 7. Everything is integer arithmetic; no
 * float is ever produced, compared or displayed.
 *
 * Prompts are purely symbolic — no words at all. That keeps a tile face legible
 * at 40px, keeps the game free of translation, and matches the bar: a child
 * should read "15 − 8" and act, with nothing explained.
 */

export const MINUS = "−"; // U+2212 MINUS SIGN, not a hyphen
export const TIMES = "×";
export const DIVIDE = "÷";

export type Form = "add" | "sub" | "mul" | "add3" | "sub2" | "muladd" | "div";

/** Forms unlocked at a difficulty in 0..1. */
export function formsFor(difficulty: number): Form[] {
  const f: Form[] = ["add"];
  if (difficulty >= 0.15) f.push("sub");
  if (difficulty >= 0.35) f.push("mul");
  if (difficulty >= 0.45) f.push("add3");
  if (difficulty >= 0.6) f.push("sub2", "div");
  if (difficulty >= 0.75) f.push("muladd");
  return f;
}

function factorPairs(v: number): [number, number][] {
  const out: [number, number][] = [];
  for (let p = 2; p * p <= v; p++) {
    if (v % p === 0) out.push([p, v / p]);
  }
  return out;
}

function uniquePositive(answer: number, xs: number[]): string[] {
  const seen = new Set<number>([answer]);
  const out: string[] = [];
  for (const x of xs) {
    if (!Number.isInteger(x) || x <= 0 || seen.has(x)) continue;
    seen.add(x);
    out.push(String(x));
    if (out.length === 3) break;
  }
  return out;
}

/** Digit-wise subtraction taking the smaller digit from the larger — the classic bug. */
export function smallerFromLarger(m: number, s: number): number {
  const ms = String(m).split("").reverse();
  const ss = String(s).split("").reverse();
  let out = "";
  for (let i = 0; i < ms.length; i++) {
    const a = Number(ms[i] ?? "0");
    const b = Number(ss[i] ?? "0");
    out = String(Math.abs(a - b)) + out;
  }
  return Number(out);
}

/** Column addition that drops every carry. */
export function noCarryAdd(a: number, b: number): number {
  const as = String(a).split("").reverse();
  const bs = String(b).split("").reverse();
  const n = Math.max(as.length, bs.length);
  let out = "";
  for (let i = 0; i < n; i++) {
    const x = Number(as[i] ?? "0") + Number(bs[i] ?? "0");
    out = String(x % 10) + out;
  }
  return Number(out);
}

type Built = { prompt: string; distractors: string[]; domain: string };

function build(form: Form, value: number, rng: Rng): Built | null {
  switch (form) {
    case "add": {
      if (value < 2) return null;
      const a = rng.range(1, value - 1);
      const b = value - a;
      return {
        prompt: `${a} + ${b}`,
        distractors: uniquePositive(value, [
          noCarryAdd(a, b),
          value + 1,
          value - 1,
          Math.abs(a - b),
          value + 10,
        ]),
        domain: "add-sub",
      };
    }
    case "sub": {
      const s = rng.range(1, Math.max(2, Math.min(19, value + 8)));
      const m = value + s;
      return {
        prompt: `${m} ${MINUS} ${s}`,
        distractors: uniquePositive(value, [
          smallerFromLarger(m, s),
          value + 1,
          value - 1,
          m + s,
          value + 10,
        ]),
        domain: "add-sub",
      };
    }
    case "mul": {
      const pairs = factorPairs(value);
      if (pairs.length === 0) return null;
      const [p, q] = rng.pick(pairs);
      return {
        prompt: `${p} ${TIMES} ${q}`,
        distractors: uniquePositive(value, [p + q, value + p, value - p, value + q]),
        domain: "mul-div",
      };
    }
    case "div": {
      if (value < 2) return null;
      const d = rng.range(2, 9);
      const m = value * d;
      return {
        prompt: `${m} ${DIVIDE} ${d}`,
        distractors: uniquePositive(value, [m - d, value + d, value * 2, value + 1]),
        domain: "mul-div",
      };
    }
    case "add3": {
      if (value < 3) return null;
      const a = rng.range(1, value - 2);
      const b = rng.range(1, value - a - 1);
      const c = value - a - b;
      return {
        prompt: `${a} + ${b} + ${c}`,
        distractors: uniquePositive(value, [a + b, value + 1, value - 1, a + b + c + c]),
        domain: "add-sub",
      };
    }
    case "sub2": {
      const s = rng.range(1, 9);
      const t = rng.range(1, 9);
      const m = value + s + t;
      return {
        prompt: `${m} ${MINUS} ${s} ${MINUS} ${t}`,
        distractors: uniquePositive(value, [m - s + t, value + s, value + t, value + 1]),
        domain: "add-sub",
      };
    }
    case "muladd": {
      const pairs = factorPairs(value - 1).concat(factorPairs(value - 2));
      const r = pairs.length > 0 && rng.chance(1, 2) ? 1 : 2;
      const base = value - r;
      const fp = factorPairs(base);
      if (fp.length === 0) return null;
      const [p, q] = rng.pick(fp);
      return {
        prompt: `${p} ${TIMES} ${q} + ${r}`,
        distractors: uniquePositive(value, [p * (q + r), base, value + p, p + q + r]),
        domain: "mul-div",
      };
    }
  }
}

/**
 * A question whose exact answer is `value`.
 *
 * Deterministic for a given rng state. Falls back down the form list until one
 * fits, so it never returns null for value >= 1.
 */
export function questionFor(value: number, difficulty: number, rng: Rng, seq: number): Question {
  const allowed = formsFor(difficulty);
  const order = rng.shuffle(allowed.slice());
  for (const form of order) {
    const built = build(form, value, rng);
    if (!built) continue;
    if (built.distractors.length < 2) continue;
    return {
      id: `fuse-${seq}-${value}`,
      prompt: built.prompt,
      answer: String(value),
      distractors: built.distractors,
      domain: built.domain,
      difficulty,
    };
  }
  // value 1 with only "add" available: 1 has no split. Emit an exact identity.
  return {
    id: `fuse-${seq}-${value}`,
    prompt: `${value + 4} ${MINUS} 4`,
    answer: String(value),
    distractors: uniquePositive(value, [value + 4, value + 1, value + 8, value + 2]),
    domain: "add-sub",
    difficulty,
  };
}

/** Evaluate a generated prompt exactly, for tests. Integer arithmetic only. */
export function evaluatePrompt(prompt: string): number {
  const tokens = prompt.split(" ");
  // handle × and ÷ first, left to right
  const mul: (string | number)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as string;
    if (t === TIMES || t === DIVIDE) {
      const left = mul.pop() as number;
      const right = Number(tokens[++i]);
      mul.push(t === TIMES ? left * right : Math.trunc(left / right));
    } else if (t === "+" || t === MINUS) {
      mul.push(t);
    } else {
      mul.push(Number(t));
    }
  }
  let acc = mul[0] as number;
  for (let i = 1; i < mul.length; i += 2) {
    const op = mul[i] as string;
    const v = mul[i + 1] as number;
    acc = op === "+" ? acc + v : acc - v;
  }
  return acc;
}
