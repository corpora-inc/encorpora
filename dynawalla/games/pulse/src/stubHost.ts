/**
 * Local stub host — exact, seeded, deterministic.
 *
 * Replaced by the real curriculum host later; the game never imports anything from
 * here except through `Host`.
 *
 * Every answer is a fraction strictly inside `(0, 1]` because in PULSE a value IS a
 * position inside one bar. Distractors are kept at least 1/12 of a bar apart so the
 * set handed over is not degenerate — but a twelfth is NOT a legibility guarantee and
 * this file must not pretend to make one: at 390 px it is 33 px between candidates
 * that are 74 px across. What the child actually sees is spaced by `gateFitFor`,
 * which knows the viewport. This is a producer's hint; `buildGate` is the enforcer.
 */

import type { Host, Question } from "./contract.ts";
import { makeRng, hashSeed, type Rng } from "./rng.ts";
import {
  type Rat,
  rat,
  add,
  sub,
  mul,
  cmp,
  eq,
  fmt,
  inBar,
  ONE,
  toFloat,
} from "./math/rational.ts";
import { malForAdd, malForComplement, malForMul, malForSub, type MalOut } from "./math/malrules.ts";

const MIN_GAP = rat(1n, 12n);

type Built = { prompt: string; answer: Rat; mal: MalOut[]; domain: string };

function denomPool(diff: number): number[] {
  if (diff < 0.2) return [2, 4];
  if (diff < 0.4) return [2, 3, 4];
  if (diff < 0.6) return [2, 3, 4, 6, 8];
  if (diff < 0.8) return [2, 3, 4, 5, 6, 8];
  return [2, 3, 4, 5, 6, 8, 10, 12];
}

function buildAdd(rng: Rng, diff: number): Built | null {
  const pool = denomPool(diff);
  const unlike = diff >= 0.35 && rng.bool(Math.min(0.85, (diff - 0.35) * 2 + 0.3));
  const d1 = rng.pick(pool);
  const d2 = unlike ? rng.pick(pool.filter((x) => x !== d1)) ?? d1 : d1;
  const n1 = 1 + rng.i(d1 - 1);
  const n2 = 1 + rng.i(d2 - 1);
  const a = rat(n1, d1);
  const b = rat(n2, d2);
  const s = add(a, b);
  if (!inBar(s)) return null;
  return { prompt: `${fmt(a)} + ${fmt(b)}`, answer: s, mal: malForAdd(a, b), domain: "fractions-add" };
}

function buildSub(rng: Rng, diff: number): Built | null {
  const pool = denomPool(diff);
  const unlike = diff >= 0.45 && rng.bool(Math.min(0.8, (diff - 0.45) * 2 + 0.25));
  const d1 = rng.pick(pool);
  const d2 = unlike ? rng.pick(pool.filter((x) => x !== d1)) ?? d1 : d1;
  const n1 = 1 + rng.i(d1);
  const n2 = 1 + rng.i(d2);
  const a = rat(n1, d1);
  const b = rat(n2, d2);
  if (cmp(a, ONE) > 0) return null;
  const s = sub(a, b);
  if (!inBar(s)) return null;
  return { prompt: `${fmt(a)} − ${fmt(b)}`, answer: s, mal: malForSub(a, b), domain: "fractions-sub" };
}

function buildMul(rng: Rng, diff: number): Built | null {
  const pool = denomPool(diff);
  const d = rng.pick(pool.filter((x) => x >= 3)) ?? 4;
  const k = 2 + rng.i(Math.min(5, d - 1));
  const unitOnly = diff < 0.5;
  const f = rat(unitOnly ? 1 : 1 + rng.i(2), d);
  const s = mul(rat(k), f);
  if (!inBar(s)) return null;
  return {
    prompt: `${k} × ${fmt(f)}`,
    answer: s,
    mal: malForMul(BigInt(k), f),
    domain: "fractions-mul",
  };
}

function buildComplement(rng: Rng, diff: number): Built | null {
  const pool = denomPool(diff);
  const d = rng.pick(pool);
  const n = 1 + rng.i(d - 1);
  const f = rat(n, d);
  const s = sub(ONE, f);
  if (!inBar(s)) return null;
  return { prompt: `1 − ${fmt(f)}`, answer: s, mal: malForComplement(f), domain: "fractions-sub" };
}

type Builder = (rng: Rng, diff: number) => Built | null;

function buildersFor(diff: number): Builder[] {
  if (diff < 0.28) return [buildAdd, buildAdd, buildMul];
  if (diff < 0.5) return [buildAdd, buildComplement, buildMul, buildSub];
  return [buildAdd, buildSub, buildMul, buildComplement, buildAdd, buildSub];
}

function farEnough(v: Rat, chosen: Rat[]): boolean {
  for (const c of chosen) {
    const diff = cmp(v, c) >= 0 ? sub(v, c) : sub(c, v);
    if (cmp(diff, MIN_GAP) < 0) return false;
  }
  return true;
}

/** Near-miss fillers when the mal-rules do not yield three legible distractors. */
function fillers(answer: Rat, rng: Rng, diff: number): Rat[] {
  const out: Rat[] = [];
  const pool = denomPool(diff);
  const steps = [rat(1n, 4n), rat(1n, 3n), rat(1n, 2n), rat(1n, 6n), rat(2n, 3n), rat(3n, 4n)];
  for (const s of rng.shuffle([...steps])) {
    out.push(add(answer, s), sub(answer, s));
  }
  for (const d of pool) for (let n = 1; n <= d; n++) out.push(rat(n, d));
  return out.filter(inBar);
}

function toQuestion(b: Built, rng: Rng, diff: number, id: string): Question {
  const chosen: Rat[] = [b.answer];
  const distractors: Rat[] = [];
  const push = (v: Rat): boolean => {
    if (!inBar(v)) return false;
    if (chosen.some((c) => eq(c, v))) return false;
    if (!farEnough(v, chosen)) return false;
    chosen.push(v);
    distractors.push(v);
    return true;
  };
  for (const m of rng.shuffle([...b.mal])) {
    if (distractors.length >= 3) break;
    push(m.value);
  }
  for (const f of fillers(b.answer, rng, diff)) {
    if (distractors.length >= 3) break;
    push(f);
  }
  return {
    id,
    prompt: b.prompt,
    answer: fmt(b.answer),
    distractors: distractors.map(fmt),
    domain: b.domain,
    difficulty: Math.max(0, Math.min(1, diff)),
  };
}

export type StubHostOptions = {
  seed?: string;
  /** Where the ramp starts. The game also raises it as stages escalate. */
  startDifficulty?: number;
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void;
  haptic?: (kind: "light" | "medium" | "heavy" | "success" | "failure") => void;
};

export type StubHost = Host & {
  /** The game nudges this as stages escalate; the host still adapts on top. */
  setFloor(d: number): void;
  difficulty(): number;
  history(): ReadonlyArray<{ id: string; correct: boolean; ms: number }>;
};

export function createStubHost(opts: StubHostOptions = {}): StubHost {
  const seedStr = opts.seed ?? "pulse";
  const rng = makeRng(hashSeed(seedStr));
  let diff = opts.startDifficulty ?? 0.12;
  let floor = 0;
  let counter = 0;
  const log: { id: string; correct: boolean; ms: number }[] = [];

  const reduced = (): boolean =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    next(): Question {
      counter++;
      const d = Math.max(floor, diff);
      for (let attempt = 0; attempt < 40; attempt++) {
        const b = rng.pick(buildersFor(d))(rng, d);
        if (!b) continue;
        const q = toQuestion(b, rng, d, `pulse-${seedStr}-${counter}`);
        if (q.distractors.length === 3) return q;
      }
      // Deterministic backstop: 1/4 + 1/4.
      const a = rat(1n, 4n);
      const s = add(a, a);
      return {
        id: `pulse-${seedStr}-${counter}`,
        prompt: `${fmt(a)} + ${fmt(a)}`,
        answer: fmt(s),
        distractors: [fmt(rat(2n, 8n)), fmt(rat(3n, 4n)), fmt(rat(1n, 4n))].filter(
          (x, i, arr) => arr.indexOf(x) === i && x !== fmt(s),
        ),
        domain: "fractions-add",
        difficulty: d,
      };
    },
    report(r) {
      log.push({ id: r.questionId, correct: r.correct, ms: r.ms });
      // Adapt: right and quick pushes up, wrong pulls down. Bounded, gentle, no cliff.
      if (r.correct) diff = Math.min(1, diff + (r.ms < 2200 ? 0.05 : 0.025));
      else diff = Math.max(0.05, diff - 0.07);
      opts.onReport?.(r);
    },
    haptic(kind) {
      opts.haptic?.(kind);
    },
    prefersReducedMotion: reduced,
    setFloor(d) {
      floor = Math.max(0, Math.min(1, d));
    },
    difficulty: () => Math.max(floor, diff),
    history: () => log,
  };
}

/** Exposed for the test suite. */
export const _internal = { toFloat, MIN_GAP };
