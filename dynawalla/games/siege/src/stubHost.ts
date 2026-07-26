/**
 * Local stub Host so SIEGE is playable standalone.
 *
 * Everything here is exact integer arithmetic — no float ever reaches an answer
 * or a comparison. Distractors are real mal-rule outputs (the wrong answer a
 * child actually produces when a specific procedure breaks), not random noise.
 *
 * Difficulty is *adaptive*: it rises when answers are correct and fast, falls
 * when they are wrong. That is what the real host will do, so the swap changes
 * nothing about how the game feels.
 */
import type { Host, Question } from "./contract.ts";
import { makeRng, type Rng } from "./core/rng.ts";
import { clamp01 } from "./core/easing.ts";

// ---------------------------------------------------------------------------
// mal-rules
// ---------------------------------------------------------------------------

/** Column subtraction with the "always take the smaller digit from the larger" bug. */
export function malSmallerFromLarger(a: number, b: number): number {
  const as = String(a);
  const bs = String(b).padStart(as.length, "0");
  let out = "";
  for (let i = 0; i < as.length; i++) {
    const da = Number(as[i]);
    const db = Number(bs[i]);
    out += String(Math.abs(da - db));
  }
  const n = Number(out);
  return Number.isFinite(n) ? n : a - b;
}

/** Column subtraction that borrows but forgets to decrement the next column. */
export function malForgotDecrement(a: number, b: number): number {
  const as = String(a).split("").map(Number);
  const bs = String(b).padStart(as.length, "0").split("").map(Number);
  const out: number[] = [];
  for (let i = as.length - 1; i >= 0; i--) {
    const da = as[i] as number;
    const db = bs[i] as number;
    out.unshift(da >= db ? da - db : da + 10 - db); // borrows, never pays it back
  }
  return Number(out.join(""));
}

/** Column addition that writes the full column sum's units but drops the carry. */
export function malDroppedCarry(a: number, b: number): number {
  const as = String(a).split("").map(Number);
  const bs = String(b).split("").map(Number);
  const len = Math.max(as.length, bs.length);
  while (as.length < len) as.unshift(0);
  while (bs.length < len) bs.unshift(0);
  const out: number[] = [];
  for (let i = len - 1; i >= 0; i--) {
    out.unshift(((as[i] as number) + (bs[i] as number)) % 10);
  }
  return Number(out.join(""));
}

/** Short multiplication that multiplies each digit but never carries. */
export function malNoCarryMul(a: number, m: number): number {
  const as = String(a).split("").map(Number);
  const out: number[] = [];
  for (let i = as.length - 1; i >= 0; i--) out.unshift(((as[i] as number) * m) % 10);
  return Number(out.join(""));
}

// ---------------------------------------------------------------------------
// question families
// ---------------------------------------------------------------------------

type Built = { prompt: string; answer: number; wrong: number[]; domain: string };

const MINUS = "−"; // U+2212 MINUS SIGN — reads as arithmetic, not a hyphen
const TIMES = "×";
const DIVIDE = "÷";

function addSmall(rng: Rng): Built {
  const a = rng.i(2, 9);
  const b = rng.i(2, 9);
  return {
    prompt: `${a} + ${b}`,
    answer: a + b,
    wrong: [a + b + 1, a + b - 1, a + b + 10],
    domain: "add-sub",
  };
}

function subSmall(rng: Rng): Built {
  const a = rng.i(6, 18);
  const b = rng.i(2, Math.min(9, a - 1));
  return {
    prompt: `${a} ${MINUS} ${b}`,
    answer: a - b,
    wrong: [a - b + 1, a - b - 1, a + b],
    domain: "add-sub",
  };
}

function addTwoDigit(rng: Rng): Built {
  const a = rng.i(14, 89);
  const b = rng.i(14, 89);
  return {
    prompt: `${a} + ${b}`,
    answer: a + b,
    wrong: [malDroppedCarry(a, b), a + b - 10, a + b + 10],
    domain: "add-sub",
  };
}

function subTwoDigit(rng: Rng): Built {
  // force a regroup so the mal-rule is live
  const bOnes = rng.i(4, 9);
  const aOnes = rng.i(0, bOnes - 1);
  const aTens = rng.i(3, 9);
  const bTens = rng.i(1, aTens - 1);
  const a = aTens * 10 + aOnes;
  const b = bTens * 10 + bOnes;
  return {
    prompt: `${a} ${MINUS} ${b}`,
    answer: a - b,
    wrong: [malSmallerFromLarger(a, b), malForgotDecrement(a, b), a - b + 10],
    domain: "add-sub",
  };
}

function subThreeDigit(rng: Rng): Built {
  const a = rng.i(302, 950);
  const b = rng.i(108, a - 60);
  return {
    prompt: `${a} ${MINUS} ${b}`,
    answer: a - b,
    wrong: [malSmallerFromLarger(a, b), malForgotDecrement(a, b), a - b + 100],
    domain: "add-sub",
  };
}

function table(rng: Rng, lo: number, hi: number): Built {
  const a = rng.i(lo, hi);
  const b = rng.i(2, 9);
  const p = a * b;
  return {
    prompt: `${a} ${TIMES} ${b}`,
    answer: p,
    wrong: [p - a, p + a, a + b],
    domain: "mul-div",
  };
}

function bigTable(rng: Rng): Built {
  const a = rng.i(6, 12);
  const b = rng.i(6, 12);
  const p = a * b;
  return {
    prompt: `${a} ${TIMES} ${b}`,
    answer: p,
    wrong: [p - a, p + b, p - b],
    domain: "mul-div",
  };
}

function shortMul(rng: Rng): Built {
  const a = rng.i(13, 49);
  const m = rng.i(3, 9);
  const p = a * m;
  return {
    prompt: `${a} ${TIMES} ${m}`,
    answer: p,
    wrong: [malNoCarryMul(a, m), p - m, p + 10],
    domain: "mul-div",
  };
}

function divFact(rng: Rng): Built {
  const b = rng.i(3, 12);
  const q = rng.i(3, 12);
  const a = b * q;
  return {
    prompt: `${a} ${DIVIDE} ${b}`,
    answer: q,
    wrong: [q + 1, q - 1, b],
    domain: "mul-div",
  };
}

/** Rate maths, which is what a tower defence player is actually doing. */
function rateStep(rng: Rng): Built {
  const dmg = rng.i(4, 12);
  const shots = rng.i(3, 9);
  const bonus = rng.i(2, 20);
  const plus = rng.chance(0.6);
  const total = plus ? dmg * shots + bonus : dmg * shots - bonus;
  return {
    prompt: plus
      ? `${dmg} ${TIMES} ${shots} + ${bonus}`
      : `${dmg} ${TIMES} ${shots} ${MINUS} ${bonus}`,
    answer: total,
    // order-of-operations mal-rule: left-to-right regardless of precedence
    wrong: [
      plus ? dmg * (shots + bonus) : dmg * (shots - bonus),
      total + dmg,
      total - shots,
    ],
    domain: "rate",
  };
}

function doubleDigitMul(rng: Rng): Built {
  const a = rng.i(11, 29);
  const b = rng.i(11, 25);
  const p = a * b;
  const at = Math.floor(a / 10) * 10;
  const ao = a % 10;
  const bt = Math.floor(b / 10) * 10;
  const bo = b % 10;
  return {
    prompt: `${a} ${TIMES} ${b}`,
    answer: p,
    // the classic "multiply the tens, multiply the ones, add" cross-term omission
    wrong: [at * bt + ao * bo, p - a, p + b],
    domain: "mul-div",
  };
}

type Family = { build: (r: Rng) => Built; lo: number; hi: number };

/** Each family is live over a difficulty band; bands overlap so the mix breathes. */
const FAMILIES: readonly Family[] = [
  { build: addSmall, lo: 0.0, hi: 0.26 },
  { build: subSmall, lo: 0.0, hi: 0.34 },
  { build: (r) => table(r, 2, 5), lo: 0.14, hi: 0.46 },
  { build: addTwoDigit, lo: 0.2, hi: 0.6 },
  { build: subTwoDigit, lo: 0.26, hi: 0.72 },
  { build: (r) => table(r, 3, 9), lo: 0.3, hi: 0.66 },
  { build: divFact, lo: 0.4, hi: 0.82 },
  { build: bigTable, lo: 0.46, hi: 0.86 },
  { build: shortMul, lo: 0.58, hi: 1.01 },
  { build: subThreeDigit, lo: 0.64, hi: 1.01 },
  { build: rateStep, lo: 0.7, hi: 1.01 },
  { build: doubleDigitMul, lo: 0.84, hi: 1.01 },
];

// ---------------------------------------------------------------------------
// the host
// ---------------------------------------------------------------------------

export type StubHostOptions = {
  seed?: number;
  /** starting difficulty, 0..1 */
  difficulty?: number;
  /** called on every report — the game uses it for telemetry/HUD */
  onReport?: (r: {
    questionId: string;
    correct: boolean;
    ms: number;
    answered: string;
    difficulty: number;
  }) => void;
};

export type StubHost = Host & {
  /** current adaptive difficulty, 0..1 — read-only view for the HUD */
  difficulty(): number;
  /** the game nudges the floor up as waves escalate; never lowers the child's level */
  raiseFloor(v: number): void;
};

export function createStubHost(opts: StubHostOptions = {}): StubHost {
  const rng = makeRng(opts.seed ?? 0x5e1e6e);
  let difficulty = clamp01(opts.difficulty ?? 0.1);
  let floor = 0;
  let n = 0;
  const recent: string[] = [];

  const buildOne = (): Built => {
    const eligible = FAMILIES.filter((f) => difficulty >= f.lo && difficulty < f.hi);
    const pool = eligible.length > 0 ? eligible : [FAMILIES[0] as Family];
    // 24 attempts to avoid repeating a prompt we just showed
    for (let attempt = 0; attempt < 24; attempt++) {
      const built = rng.pick(pool).build(rng);
      if (!recent.includes(built.prompt)) return built;
    }
    return rng.pick(pool).build(rng);
  };

  const next = (): Question => {
    const built = buildOne();
    recent.push(built.prompt);
    if (recent.length > 9) recent.shift();

    const seen = new Set<number>([built.answer]);
    const distractors: string[] = [];
    for (const w of built.wrong) {
      if (w < 0 || !Number.isInteger(w) || seen.has(w)) continue;
      seen.add(w);
      distractors.push(String(w));
    }
    // top up deterministically if a mal-rule collided with the answer
    let bump = 1;
    while (distractors.length < 3) {
      for (const cand of [built.answer + bump, built.answer - bump, built.answer + bump * 10]) {
        if (distractors.length >= 3) break;
        if (cand < 0 || seen.has(cand)) continue;
        seen.add(cand);
        distractors.push(String(cand));
      }
      bump++;
      if (bump > 40) break;
    }

    n++;
    return {
      id: `s${n}`,
      prompt: built.prompt,
      answer: String(built.answer),
      distractors,
      domain: built.domain,
      difficulty,
    };
  };

  const canVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  const PATTERNS: Record<string, number | number[]> = {
    light: 8,
    medium: 18,
    heavy: 40,
    success: [10, 30, 22],
    failure: [26, 40, 26],
  };

  return {
    next,
    report(r) {
      // fast + right pushes up, slowly; wrong pulls down harder than right pushes up
      // ~70 clean answers to cross the whole range: a child should feel the
      // ground move under them over a session, not inside two minutes
      if (r.correct) {
        const fast = r.ms < 2600 ? 1 : r.ms < 5200 ? 0.55 : 0.2;
        difficulty = clamp01(difficulty + 0.014 * fast);
      } else {
        difficulty = clamp01(difficulty - 0.045);
      }
      if (difficulty < floor) difficulty = floor;
      opts.onReport?.({ ...r, difficulty });
    },
    haptic(kind) {
      if (!canVibrate) return;
      try {
        navigator.vibrate(PATTERNS[kind] ?? 10);
      } catch {
        /* a browser that rejects vibrate is not an error worth surfacing */
      }
    },
    prefersReducedMotion() {
      if (typeof matchMedia !== "function") return false;
      return matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    difficulty: () => difficulty,
    raiseFloor(v) {
      floor = clamp01(Math.max(floor, v));
      if (difficulty < floor) difficulty = floor;
    },
  };
}
