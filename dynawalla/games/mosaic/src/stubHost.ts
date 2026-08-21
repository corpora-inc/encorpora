/**
 * The stub host.
 *
 * Stands in for `dynawalla/curriculum` + `dynawalla/engine` until the pack
 * runtime lands. Exact integer arithmetic, seeded, deterministic, and the
 * distractors are real mal-rule outputs rather than answer ± random:
 *
 *   52 − 27 → 35   subtract the smaller digit from the larger, per column
 *   27 + 35 → 52   drop the carry
 *   7 × 8  → 63    slide one step along the table
 *   7 × 8  → 15    add instead of multiply
 *
 * Distractors like these are the ones worth putting on a rune, because picking
 * one is diagnostic: it says which step broke, not merely that something did.
 */
import type { Host, Question } from "./contract.ts";
import { Rng } from "./rng.ts";

const digits = (n: number): number[] => String(n).split("").map(Number);

/** Column-wise |a−b| — the classic smaller-from-larger bug. */
function smallerFromLarger(a: number, b: number): number {
  const A = digits(a);
  const B = digits(b);
  while (B.length < A.length) B.unshift(0);
  let out = "";
  for (let i = 0; i < A.length; i++) out += String(Math.abs(A[i]! - B[i]!));
  return Number(out);
}

/** Column-wise addition with every carry dropped. */
function noCarry(a: number, b: number): number {
  const A = digits(a);
  const B = digits(b);
  while (B.length < A.length) B.unshift(0);
  while (A.length < B.length) A.unshift(0);
  let out = "";
  for (let i = 0; i < A.length; i++) out += String((A[i]! + B[i]!) % 10);
  return Number(out);
}

function uniq(answer: number, candidates: number[], rng: Rng): string[] {
  const seen = new Set<number>([answer]);
  const out: string[] = [];
  for (const c of candidates) {
    if (c < 0 || !Number.isInteger(c) || seen.has(c)) continue;
    seen.add(c);
    out.push(String(c));
    if (out.length === 3) return out;
  }
  let step = 1;
  while (out.length < 3) {
    for (const c of [answer + step, answer - step, answer + step * 10]) {
      if (c >= 0 && !seen.has(c)) {
        seen.add(c);
        out.push(String(c));
        if (out.length === 3) break;
      }
    }
    step++;
    if (step > 40) break;
  }
  return rng.shuffle(out);
}

export type StubOptions = {
  seed?: number;
  /** 0..1 — the game raises this as the run escalates. */
  difficulty?: () => number;
};

export function createStubHost(opts: StubOptions = {}): Host & { questions: number } {
  const rng = new Rng(opts.seed ?? 0x4d05a1c);
  const getDifficulty = opts.difficulty ?? (() => 0.35);
  let n = 0;

  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const reduced =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  const host: Host & { questions: number } = {
    questions: 0,

    next(): Question {
      const d = Math.max(0, Math.min(1, getDifficulty()));
      const id = `stub-${n++}`;
      host.questions = n;
      const family = rng.int(0, 9);

      // Multiplication and division carry the run; add/sub gives it a floor.
      if (family <= 4) {
        const hi = d < 0.3 ? 7 : d < 0.6 ? 9 : 12;
        const a = rng.int(2, hi);
        const b = rng.int(2, hi);
        const p = a * b;
        if (family <= 3) {
          return {
            id,
            prompt: `${a} × ${b}`,
            answer: String(p),
            distractors: uniq(p, [a * (b + 1), a * (b - 1), a + b, p + a, (a + 1) * b], rng),
            domain: "mul-div",
            difficulty: Math.min(1, (a * b) / 144),
          };
        }
        return {
          id,
          prompt: `${p} ÷ ${a}`,
          answer: String(b),
          distractors: uniq(b, [a, b + 1, b - 1, p - a, a * b], rng),
          domain: "mul-div",
          difficulty: Math.min(1, (a * b) / 144),
        };
      }

      if (family <= 7) {
        const lo = d < 0.35 ? 10 : 20;
        const hi = d < 0.35 ? 49 : d < 0.7 ? 89 : 480;
        const a = rng.int(lo, hi);
        const b = rng.int(lo, Math.min(hi, a));
        const s = a + b;
        return {
          id,
          prompt: `${a} + ${b}`,
          answer: String(s),
          distractors: uniq(s, [noCarry(a, b), s + 10, s - 10, s - 1, s + 1], rng),
          domain: "add-sub",
          difficulty: Math.min(1, s / 900),
        };
      }

      const hi = d < 0.35 ? 60 : d < 0.7 ? 99 : 520;
      const a = rng.int(22, hi);
      const b = rng.int(9, Math.max(10, a - 1));
      const diff = a - b;
      return {
        id,
        prompt: `${a} − ${b}`,
        answer: String(diff),
        distractors: uniq(diff, [smallerFromLarger(a, b), diff + 10, diff - 10, diff + 1, b - a + 20], rng),
        domain: "add-sub",
        difficulty: Math.min(1, a / 600),
      };
    },

    report() {
      // The real host feeds FSRS. The stub deliberately records nothing so
      // nothing in the game can come to depend on a reply.
    },

    haptic(kind) {
      if (!canVibrate) return;
      const ms =
        kind === "light" ? 8 : kind === "medium" ? 16 : kind === "heavy" ? 32 : kind === "success" ? 24 : 40;
      try {
        navigator.vibrate(kind === "success" ? [14, 26, 20] : kind === "failure" ? [30, 40, 30] : ms);
      } catch {
        /* a browser that refuses to buzz is not an error */
      }
    },

    prefersReducedMotion() {
      return reduced?.matches ?? false;
    },
  };

  return host;
}
