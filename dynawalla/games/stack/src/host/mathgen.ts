/**
 * Exact-arithmetic question generation for MONUMENT.
 *
 * Hard rules, enforced by tests in `mathgen.test.ts`:
 *   - No floating point ever appears in an answer or in a comparison. Decimal
 *     questions are computed as integer-numerator rationals and *formatted* to
 *     a decimal string; `0.1 + 0.2` never happens.
 *   - Every distractor is the output of a real mal-rule — a mistake a child
 *     actually makes — not a random number. A wrong drop must feel like the
 *     answer the player believed in.
 *   - Fully deterministic from a seed.
 */

import type { Question } from "../contract.ts";

/* ── seeded RNG ───────────────────────────────────────────────────────────── */

/** mulberry32 — small, fast, good enough, and identical on every platform. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [lo, hi] inclusive. */
function ri(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pick<T>(rng: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)]!;
}

/* ── exact rationals (integers only, never a float) ───────────────────────── */

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a === 0 ? 1 : a;
}

/** `n/d` reduced, rendered as "n/d" (or "n" when d reduces to 1). */
export function frac(n: number, d: number): string {
  if (d === 0) return "—";
  let sign = 1;
  if (d < 0) {
    d = -d;
    sign = -sign;
  }
  if (n < 0) {
    n = -n;
    sign = -sign;
  }
  const g = gcd(n, d);
  const rn = (n / g) * sign;
  const rd = d / g;
  return rd === 1 ? String(rn) : `${rn}/${rd}`;
}

/** Unreduced "n/d" — some mal-rules produce a fraction the child would not reduce. */
function rawFrac(n: number, d: number): string {
  return d === 1 ? String(n) : `${n}/${d}`;
}

/**
 * `n` tenths as a decimal string, by integer arithmetic only.
 * tenths(7) === "0.7", tenths(10) === "1", tenths(13) === "1.3", tenths(-3) === "-0.3".
 */
export function tenths(n: number): string {
  const sign = n < 0 ? "-" : "";
  const m = Math.abs(n);
  const whole = Math.floor(m / 10);
  const rem = m % 10;
  return rem === 0 ? `${sign}${whole}` : `${sign}${whole}.${rem}`;
}

/* ── question families ────────────────────────────────────────────────────── */

export type Family = {
  id: string;
  /** Lowest `difficulty` at which this family may be drawn. */
  from: number;
  build(rng: () => number): { prompt: string; answer: string; wrong: string[] };
};

/**
 * Each `wrong` list is ordered strongest-mal-rule-first; the caller takes as
 * many as it needs. Duplicates and accidental correct answers are filtered by
 * `generate` below, so a family may safely emit an overlapping candidate.
 */
const FAMILIES: readonly Family[] = [
  {
    // Number bonds to ten. The first thing a six-year-old owns.
    id: "bond-10",
    from: 1,
    build(rng) {
      const a = ri(rng, 1, 9);
      const b = 10 - a;
      return {
        prompt: `${a} + ? = 10`,
        answer: String(b),
        // count-on slip (±1), read the total as the part, doubled the part.
        wrong: [String(b + 1), String(b - 1), String(10 + a), String(a)],
      };
    },
  },
  {
    // Bonds to a stated total up to twenty — the same idea, no longer memorised.
    id: "bond-n",
    from: 2,
    build(rng) {
      const n = ri(rng, 11, 20);
      const a = ri(rng, 2, n - 2);
      const b = n - a;
      return {
        prompt: `${a} + ? = ${n}`,
        answer: String(b),
        wrong: [String(b + 1), String(b - 1), String(n + a), String(n)],
      };
    },
  },
  {
    // Missing subtrahend. The classic error is inverting the operation.
    id: "sub-missing",
    from: 3,
    build(rng) {
      const a = ri(rng, 8, 19);
      const r = ri(rng, 1, a - 2);
      const b = a - r;
      return {
        prompt: `${a} − ? = ${r}`,
        answer: String(b),
        // added instead of subtracted, copied the result, borrow slip.
        wrong: [String(a + r), String(r), String(b + 1), String(b - 1)],
      };
    },
  },
  {
    // Missing factor. Mal-rules: neighbouring row of the table, additive slip.
    id: "mult-missing",
    from: 4,
    build(rng) {
      const a = ri(rng, 2, 9);
      const b = ri(rng, 2, 9);
      const p = a * b;
      return {
        prompt: `${a} × ? = ${p}`,
        answer: String(b),
        // off-by-one down the table, treated × as −, treated × as +.
        wrong: [String(b + 1), String(b - 1), String(p - a), String(p + a)],
      };
    },
  },
  {
    // Division as the inverse. Same mal-rules, seen from the other side.
    id: "div-exact",
    from: 5,
    build(rng) {
      const a = ri(rng, 2, 9);
      const b = ri(rng, 2, 12);
      const p = a * b;
      return {
        prompt: `${p} ÷ ${a} = ?`,
        answer: String(b),
        wrong: [String(b + 1), String(b - 1), String(p - a), String(a)],
      };
    },
  },
  {
    // Complete the whole. The signature fraction error is adding denominators.
    id: "frac-whole",
    from: 6,
    build(rng) {
      const d = pick(rng, [3, 4, 5, 6, 8, 10] as const);
      const n = ri(rng, 1, d - 1);
      const m = d - n;
      return {
        prompt: `${n}/${d} + ? = 1`,
        answer: frac(m, d),
        // added the denominators, inverted, copied, numerator only.
        // added the denominators, inverted, copied, numerator only, off-by-one.
        wrong: [rawFrac(m, d + d), rawFrac(d, m), rawFrac(n, d), String(m), rawFrac(m + 1, d)],
      };
    },
  },
  {
    // Equivalent fractions. The great mal-rule: add the same number to both.
    id: "frac-equiv",
    from: 7,
    build(rng) {
      const d = pick(rng, [2, 3, 4, 5, 6] as const);
      const n = ri(rng, 1, d - 1);
      const k = ri(rng, 2, 4);
      const bigD = d * k;
      const bigN = n * k;
      return {
        prompt: `${n}/${d} = ?/${bigD}`,
        answer: String(bigN),
        // additive instead of multiplicative, scaled by the wrong k, copied.
        wrong: [String(n + (bigD - d)), String(n * (k + 1)), String(n), String(bigD - n)],
      };
    },
  },
  {
    // Decimal tenths to a whole. Integers throughout; formatted at the edge.
    id: "dec-tenths",
    from: 8,
    build(rng) {
      const a = ri(rng, 1, 9); // tenths
      const b = 10 - a;
      return {
        prompt: `${tenths(a)} + ? = 1`,
        answer: tenths(b),
        // treated tenths as whole numbers, place-value slip, off-by-one tenth.
        wrong: [String(b), tenths(b + 10), tenths(b + 1), tenths(a)],
      };
    },
  },
  {
    // Additive inverse. Sign is the whole lesson, so sign is the whole mal-rule.
    id: "signed-zero",
    from: 9,
    build(rng) {
      const a = ri(rng, 2, 12);
      const neg = rng() < 0.5;
      const from = neg ? -a : a;
      const ans = neg ? a : -a;
      return {
        prompt: `${from} + ? = 0`,
        answer: String(ans),
        // kept the sign, answered the identity, doubled.
        wrong: [String(from), "0", String(-2 * from), String(2 * from)],
      };
    },
  },
  {
    // Two-step: a product must be reached from a partial. Late-tower work.
    id: "two-step",
    from: 10,
    build(rng) {
      const a = ri(rng, 3, 9);
      const b = ri(rng, 3, 9);
      const c = ri(rng, 2, 9);
      const total = a * b + c;
      return {
        prompt: `${a} × ${b} + ? = ${total}`,
        answer: String(c),
        // ignored precedence (a × (b + ?)), dropped the product, off-by-one.
        wrong: [String(total - a - b), String(total), String(c + 1), String(c - 1)],
      };
    },
  },
] as const;

/* ── decoy safety ─────────────────────────────────────────────────────────── */

/** Exact value of an emitted string: integer, fraction, or a short decimal. */
function value(s: string): { n: number; d: number } | null {
  if (/^-?\d+$/.test(s)) return { n: Number(s), d: 1 };
  const f = /^(-?\d+)\/(\d+)$/.exec(s);
  if (f) return { n: Number(f[1]), d: Number(f[2]) };
  const dec = /^(-?)(\d+)\.(\d+)$/.exec(s);
  if (dec) {
    const sign = dec[1] === "-" ? -1 : 1;
    const scale = Math.pow(10, dec[3]!.length);
    return { n: sign * (Number(dec[2]) * scale + Number(dec[3])), d: scale };
  }
  return null;
}

/**
 * Two emitted strings denoting the same number.
 *
 * String inequality is not enough: `2/4 + ? = 1` once offered `2/4` as a decoy,
 * because the "copied the fraction" mal-rule happens to BE the answer whenever
 * the numerator is half the denominator. A decoy that is secretly correct
 * punishes a child for being right, which is the worst bug this game could ship.
 */
export function sameValue(a: string, b: string): boolean {
  if (a === b) return true;
  const x = value(a);
  const y = value(b);
  if (!x || !y) return false;
  return x.n * y.d === y.n * x.d;
}

/* ── generation ───────────────────────────────────────────────────────────── */

/** Families legal at `difficulty`, always including a couple of easier ones. */
export function familiesFor(difficulty: number): Family[] {
  const d = Math.max(1, Math.min(10, Math.round(difficulty)));
  const eligible = FAMILIES.filter((f) => f.from <= d);
  // Keep a shallow tail of easier work in the mix so the tower never becomes a
  // wall of the single hardest thing — variety is what holds a long run.
  const floor = Math.max(1, d - 3);
  return eligible.filter((f) => f.from >= floor || eligible.length <= 2);
}

let counter = 0;

/**
 * Build one question. `slots` is how many faces the sliding block will cycle
 * through, so we need `slots - 1` usable distractors.
 */
export function generate(
  rng: () => number,
  difficulty: number,
  slots: number,
  domain?: string,
): Question {
  const pool = familiesFor(difficulty);
  const fam = domain ? (FAMILIES.find((f) => f.id === domain) ?? pick(rng, pool)) : pick(rng, pool);
  // Always produce at least three, so the revive panel has four buttons even
  // when the sweep is only cycling two values.
  const want = Math.max(3, slots - 1);

  let built = fam.build(rng);
  // Retry a couple of times if a family produced a degenerate spread (e.g. a
  // mal-rule that collided with the answer). Bounded, so it always terminates.
  for (let attempt = 0; attempt < 6; attempt++) {
    const out: string[] = [];
    for (const w of built.wrong) {
      if (w === "" || sameValue(w, built.answer)) continue;
      if (out.some((o) => sameValue(o, w))) continue;
      out.push(w);
      if (out.length === want) break;
    }
    if (out.length >= want) {
      return {
        id: `q${(counter = (counter + 1) % 1e9)}-${fam.id}`,
        prompt: built.prompt,
        answer: built.answer,
        distractors: out,
        domain: fam.id,
        difficulty,
      };
    }
    built = fam.build(rng);
  }

  // Unreachable in practice; kept so the function is total.
  return {
    id: `q${(counter = (counter + 1) % 1e9)}-${fam.id}`,
    prompt: built.prompt,
    answer: built.answer,
    distractors: built.wrong.filter((w) => !sameValue(w, built.answer)).slice(0, want),
    domain: fam.id,
    difficulty,
  };
}

/** Exposed for tests only. */
export const ALL_FAMILIES = FAMILIES;
