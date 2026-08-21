import type { Host, Question } from "./contract.ts";
import { Rng } from "./game/rng.ts";

/**
 * Local stub Host so `npm run dev` is a real, playable game with no runtime
 * underneath it.
 *
 * Rules it holds itself to, because the real host will too:
 *  - Exact integer arithmetic only. No float appears in an answer or in a
 *    comparison; every answer is the decimal string of a JS safe integer.
 *  - Seeded and deterministic. The same seed yields the same question stream.
 *  - Distractors are *mal-rule outputs*: what a child actually writes when they
 *    run the wrong procedure. `7 x 6 -> 13` is a child who added. `52 - 27 ->
 *    35` is smaller-from-larger. A distractor that is merely "answer + 1" is a
 *    coin flip dressed as a question.
 */

type Gen = (rng: Rng, d: number) => Raw;
type Raw = { prompt: string; answer: number; wrong: number[]; domain: string; signed?: boolean };

const NBSP = " "; // thin space: keeps "3 + 4" from wrapping mid-expression

function ex(a: number, op: string, b: number): string {
  return `${a}${NBSP}${op}${NBSP}${b}`;
}

/* ------------------------------------------------------------------ */
/* Generators. Each returns the true answer plus the mal-rule outputs. */
/* ------------------------------------------------------------------ */

const addSmall: Gen = (rng, d) => {
  const cap = d <= 0 ? 9 : 12 + d * 3;
  const a = rng.int(2, cap);
  const b = rng.int(2, cap);
  return {
    prompt: ex(a, "+", b),
    answer: a + b,
    // count-on-by-one slip; counted the first addend too (fencepost); doubled one side
    wrong: [a + b - 1, a + b + 1, a + a, b + b, Math.abs(a - b)],
    domain: "add.within20",
  };
};

const addCarry: Gen = (rng, d) => {
  // Build the digits directly rather than sampling and repairing.
  //
  // The repair approach — "nudge b until the units carry, then clamp it" — can
  // undo its own fix when the nudge wraps past ten, and it did: **18% of
  // `add.carry` items arrived with no carry in them at all**, like `43 + 20`.
  // That is worse than a wasted question. In exactly those items the headline
  // mal-rule (dropped the carry) equals the correct answer, so the dedupe in
  // `build()` silently swallows it and the gate is left with one plausible
  // option and one absurd three-digit one — effectively two lanes, in a game
  // whose entire premise is that the third lane costs you something.
  //
  // This is the same trap the generator below it already fell into and fixed;
  // see `subBorrow`. Sampling the digits makes the carry a fact of construction
  // rather than something a later line can take away.
  const aU = rng.int(1, 9);
  const bU = rng.int(10 - aU, 9); // guarantees aU + bU >= 10, i.e. a real carry
  const hiT = d >= 5 ? 8 : 4;
  const aT = rng.int(1, hiT);
  const bT = rng.int(1, hiT);
  const a = aT * 10 + aU;
  const b = bT * 10 + bU;
  const sum = a + b;
  const units = aU + bU; // always 10..18
  const tens = aT + bT;
  return {
    prompt: ex(a, "+", b),
    answer: sum,
    wrong: [
      // Dropped the carry: the tens column written as-is, the units column
      // written mod ten. Because the carry is now guaranteed this is always
      // exactly `sum - 10`, and always distinct from the answer.
      tens * 10 + (units - 10),
      sum + 10, // carried twice
      sum - 1, // a slip counting the units column
      tens * 100 + units, // wrote each column whole, side by side
    ],
    domain: "add.carry",
  };
};

const subSmall: Gen = (rng, d) => {
  const cap = d <= 0 ? 10 : 14 + d * 2;
  const a = rng.int(5, cap);
  const b = rng.int(1, a - 1);
  return {
    prompt: ex(a, "−", b),
    answer: a - b,
    wrong: [a - b + 1, a - b - 1, a + b, b],
    domain: "sub.within20",
  };
};

const subBorrow: Gen = (rng, d) => {
  // Build the digits directly rather than sampling and repairing. The repair
  // approach ("nudge b until it borrows, then clamp it below a") can undo its
  // own fix on the clamp and quietly emit 88 - 70, which teaches nothing about
  // borrowing and makes the classic mal-rule distractor meaningless.
  const aT = rng.int(3, d >= 5 ? 9 : 6);
  const bT = rng.int(1, aT - 1);
  const aU = rng.int(0, 7);
  const bU = rng.int(aU + 1, 9);
  const a = aT * 10 + aU;
  const b = bT * 10 + bU;
  return {
    prompt: ex(a, "−", b),
    answer: a - b,
    wrong: [
      (aT - bT) * 10 + Math.abs(aU - bU), // smaller-from-larger, the classic
      (aT - bT + 1) * 10 + (aU + 10 - bU), // borrowed but never decremented the tens
      a - b + 10,
      a - b - 10,
    ],
    domain: "sub.borrow",
  };
};

const mulFact: Gen = (rng, d) => {
  const hi = d <= 2 ? 6 : d <= 4 ? 9 : 12;
  const a = rng.int(2, hi);
  const b = rng.int(2, hi);
  const p = a * b;
  return {
    prompt: ex(a, "×", b),
    answer: p,
    wrong: [
      p - a, // skip-counted one step short
      p + a, // one step long
      p - b,
      a + b, // added instead of multiplied
    ],
    domain: "mul.facts",
  };
};

const mulTwoByOne: Gen = (rng, d) => {
  const a = rng.int(d >= 7 ? 21 : 12, d >= 7 ? 89 : 39);
  const b = rng.int(3, d >= 7 ? 9 : 6);
  const aT = Math.floor(a / 10), aU = a % 10;
  const carry = Math.floor((aU * b) / 10);
  return {
    prompt: ex(a, "×", b),
    answer: a * b,
    wrong: [
      aT * b * 10 + (aU * b) % 10, // dropped the carry into the tens
      (aT + carry) * b * 10 + ((aU * b) % 10), // added the carry before multiplying
      a * b - a,
      a * b + a,
    ],
    domain: "mul.multidigit",
  };
};

const divFact: Gen = (rng, d) => {
  const hi = d <= 4 ? 8 : 12;
  const q = rng.int(2, hi);
  const b = rng.int(2, hi);
  const a = q * b;
  return {
    prompt: ex(a, "÷", b),
    answer: q,
    wrong: [
      b, // handed back the divisor
      q + 1,
      q - 1,
      a - b, // subtracted instead
    ],
    domain: "div.facts",
  };
};

const missingAddend: Gen = (rng, d) => {
  const total = rng.int(d >= 4 ? 25 : 11, d >= 4 ? 70 : 19);
  const a = rng.int(3, total - 2);
  return {
    prompt: `${a}${NBSP}+${NBSP}▢${NBSP}=${NBSP}${total}`,
    answer: total - a,
    wrong: [total + a, a, total, total - a - 1],
    domain: "add.missing",
  };
};

const orderOfOps: Gen = (rng, d) => {
  const hi = d >= 8 ? 9 : 6;
  const c = rng.int(2, hi);
  if (rng.chance(0.5)) {
    const a = rng.int(2, 9);
    const b = rng.int(2, hi);
    return {
      prompt: `${a}${NBSP}+${NBSP}${b}${NBSP}×${NBSP}${c}`,
      answer: a + b * c,
      wrong: [(a + b) * c, a + b + c, a * b + c],
      domain: "ops.order",
    };
  }
  // The subtraction branch, with `b` held strictly below `a`.
  //
  // `a` and `b` used to be sampled independently, so `a·c − b×c` went negative
  // whenever b > a — **19% of `ops.order` items**, in a domain that is not
  // marked `signed`. That combination is the worst of both: `build()` strips
  // negative *distractors* from an unsigned domain but never checks the answer,
  // so `12 − 8 × 4 = −20` shipped against `8`, `16` and `0`. The answer was the
  // only negative on offer, and a child could take that lane without doing any
  // arithmetic at all — which is precisely the free elimination this host exists
  // to refuse. Signed work has its own generator and its own ladder band.
  const a = rng.int(3, 9);
  const b = rng.int(2, a - 1);
  return {
    prompt: `${a * c}${NBSP}−${NBSP}${b}${NBSP}×${NBSP}${c}`,
    answer: (a - b) * c,
    wrong: [(a * c - b) * c, a * c - b - c, a * c - b + c],
    domain: "ops.order",
  };
};

const fractionOf: Gen = (rng, d) => {
  const den = rng.pick([2, 3, 4, 5]);
  const num = rng.int(1, den - 1);
  const whole = den * rng.int(2, d >= 8 ? 12 : 7);
  return {
    prompt: `${num}/${den}${NBSP}of${NBSP}${whole}`,
    answer: (whole / den) * num,
    wrong: [
      whole / den, // divided and stopped
      whole * num, // multiplied and stopped
      whole - den,
      (whole / den) * (den - num), // took the complement
    ],
    domain: "frac.of",
  };
};

const signedAdd: Gen = (rng, d) => {
  const a = rng.int(2, 9 + d);
  const b = rng.int(2, 9 + d);
  if (rng.chance(0.5)) {
    return {
      prompt: `−${a}${NBSP}+${NBSP}${b}`,
      answer: b - a,
      wrong: [a + b, -(a + b), a - b],
      domain: "int.signed",
      signed: true,
    };
  }
  return {
    prompt: `${a}${NBSP}−${NBSP}${a + b}`,
    answer: -b,
    wrong: [b, a + b, -(a + b)],
    domain: "int.signed",
    signed: true,
  };
};

/** Difficulty band -> the generators that can fire in it. */
const LADDER: { until: number; gens: Gen[] }[] = [
  { until: 1, gens: [addSmall, subSmall] },
  { until: 2, gens: [addSmall, subSmall, mulFact] },
  { until: 3, gens: [addSmall, subSmall, mulFact, addCarry] },
  { until: 4, gens: [mulFact, addCarry, subBorrow, divFact] },
  { until: 5, gens: [mulFact, addCarry, subBorrow, divFact, missingAddend] },
  { until: 6, gens: [mulFact, divFact, subBorrow, missingAddend, mulTwoByOne] },
  { until: 7, gens: [mulFact, divFact, mulTwoByOne, orderOfOps, fractionOf] },
  { until: 99, gens: [mulTwoByOne, orderOfOps, fractionOf, divFact, signedAdd] },
];

export type StubOptions = {
  seed?: number;
  /** Called on every report(); the dev page uses it to draw a live accuracy strip. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void;
};

export function createStubHost(opts: StubOptions = {}): Host & { seed: number } {
  const seed = opts.seed ?? 0xc0ffee;
  const rng = new Rng(seed);
  let n = 0;
  let lastPrompt = "";

  function build(difficulty: number): Question {
    const band = LADDER.find((b) => difficulty < b.until) ?? LADDER[LADDER.length - 1];
    let raw: Raw = rng.pick(band.gens)(rng, difficulty);
    // Never ask the identical prompt twice in a row; it reads as a bug.
    for (let guard = 0; guard < 6 && raw.prompt === lastPrompt; guard++) {
      raw = rng.pick(band.gens)(rng, difficulty);
    }
    lastPrompt = raw.prompt;

    const answer = raw.answer;
    const seen = new Set<number>([answer]);
    const picks: number[] = [];
    for (const w of rng.shuffle(raw.wrong.slice())) {
      if (!Number.isSafeInteger(w)) continue;
      if (seen.has(w)) continue;
      if (!raw.signed && w < 0) continue; // a negative option in a whole-number question is free to reject
      if (Math.abs(w) > 99999) continue;
      seen.add(w);
      picks.push(w);
      if (picks.length >= 3) break;
    }
    // Backfill, still deterministically, if the mal-rules collided.
    for (let k = 1; picks.length < 3 && k < 40; k++) {
      for (const cand of [answer + k, answer - k]) {
        if (seen.has(cand)) continue;
        if (!raw.signed && cand < 0) continue;
        seen.add(cand);
        picks.push(cand);
        if (picks.length >= 3) break;
      }
    }

    return {
      id: `stub-${seed.toString(16)}-${n++}`,
      prompt: raw.prompt,
      answer: String(answer),
      distractors: picks.map(String),
      domain: raw.domain,
      difficulty,
    };
  }

  return {
    seed,
    next(o) {
      // A NaN or Infinity from the host must not propagate into the ladder:
      // `Math.round(NaN)` clamps to NaN, `LADDER.find` then misses every band
      // and the question's own difficulty field becomes NaN on the way back.
      const raw = Number(o?.difficulty ?? 2);
      const d = Number.isFinite(raw) ? Math.max(0, Math.min(12, Math.round(raw))) : 2;
      return build(d);
    },
    report(r) {
      opts.onReport?.(r);
    },
    haptic(k) {
      // Web fallback: the real host owns the native path. Silent no-op when absent.
      const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
      if (typeof nav.vibrate !== "function") return;
      const ms =
        k === "light" ? 8 : k === "medium" ? 16 : k === "heavy" ? 30 : k === "success" ? 12 : 40;
      try {
        nav.vibrate(k === "failure" ? [30, 40, 30] : ms);
      } catch {
        /* Some browsers throw on vibrate without a user gesture. Nothing to do. */
      }
    },
    prefersReducedMotion() {
      return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    },
  };
}
