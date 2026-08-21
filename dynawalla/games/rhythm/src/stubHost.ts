/**
 * Local stub Host so Splitbeat is playable standalone with `npm run dev`.
 *
 * Rules it obeys, because the real host obeys them:
 *  - Exact arithmetic only. Every quantity is a pair of integers (n, d). No
 *    float ever reaches an `answer` string or a comparison. `0.1 + 0.2 !== 0.3`
 *    would mark correct work wrong deterministically, so floats are banned here
 *    the same way they are banned in `curriculum/` and `engine/`.
 *  - Seeded and deterministic. Same seed, same stream of questions, forever.
 *  - Distractors are real mal-rule outputs — the answer a child actually
 *    produces when they apply a plausible-but-wrong procedure — never noise.
 */

import type { Host, Question } from "./contract.ts";


/* ------------------------------------------------------------------ */
/* exact rationals                                                     */
/* ------------------------------------------------------------------ */

export type Rat = { n: number; d: number };

function gcd(a: number, b: number): number {
  a = a < 0 ? -a : a;
  b = b < 0 ? -b : b;
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a === 0 ? 1 : a;
}

/** Normalised rational. `d` is always positive; the pair is always reduced. */
export function rat(n: number, d: number): Rat {
  if (d === 0) throw new Error("rat: zero denominator");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

const add = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const mul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
const div = (a: Rat, b: Rat): Rat => rat(a.n * b.d, a.d * b.n);

/** "3", "1/4", "3/8" — the only shapes the game has to render or compare. */
export function fmt(r: Rat): string {
  return r.d === 1 ? String(r.n) : `${r.n}/${r.d}`;
}

/** Parse "3", "1/4", "-2/3". Returns null for anything else. */
export function parseRat(s: string): Rat | null {
  const t = s.trim();
  let m = /^(-?\d+)$/.exec(t);
  if (m) return { n: Number(m[1]), d: 1 };
  m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) {
    const d = Number(m[2]);
    if (d === 0) return null;
    return rat(Number(m[1]), d);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* seeded rng — mulberry32, deterministic and dependency-free           */
/* ------------------------------------------------------------------ */

export function makeRng(seed: number) {
  let a = seed >>> 0;
  return {
    /** uniform in [0,1) — used only for *selection*, never for an answer */
    f(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** integer in [lo, hi] inclusive */
    int(lo: number, hi: number): number {
      return lo + Math.floor(this.f() * (hi - lo + 1));
    },
    pick<T>(xs: readonly T[]): T {
      return xs[Math.floor(this.f() * xs.length)]!;
    },
  };
}
export type Rng = ReturnType<typeof makeRng>;

/* ------------------------------------------------------------------ */
/* question templates                                                  */
/* ------------------------------------------------------------------ */

type Built = { prompt: string; answer: string; wrong: string[]; domain: string };

/** Denominators that are also playable beat subdivisions of a 4/4 bar. */
const MUSICAL_D = [2, 3, 4, 6, 8] as const;

/**
 * `1/4 + 1/4 = ?`
 * Mal-rules: add across (n+n)/(d+d); keep numerator, add denominators;
 * add numerators, multiply denominators.
 */
function tAddLike(rng: Rng, hard: boolean): Built {
  const d = hard ? rng.pick([3, 4, 6, 8] as const) : rng.pick([2, 4, 8] as const);
  const a = rat(1, d);
  const k = hard ? rng.int(1, Math.max(1, d - 1)) : 1;
  const b = rat(k, d);
  const ans = add(a, b);
  const wrong = [
    fmt(rat(a.n + b.n, a.d + b.d)), // added across
    fmt(rat(a.n + b.n, a.d * b.d)), // added tops, multiplied bottoms
    fmt(rat(a.n, a.d + b.d)), // added only the bottoms
  ];
  return { prompt: `${fmt(a)} + ${fmt(b)} = ?`, answer: fmt(ans), wrong, domain: "fractions.add" };
}

/**
 * `1/2 + 1/4 = ?` — unlike denominators, the classic common-denominator trap.
 */
function tAddUnlike(rng: Rng): Built {
  const pairs = [
    [rat(1, 2), rat(1, 4)],
    [rat(1, 2), rat(1, 8)],
    [rat(1, 4), rat(1, 8)],
    [rat(1, 2), rat(1, 6)],
    [rat(1, 3), rat(1, 6)],
    [rat(3, 8), rat(1, 8)],
  ] as const;
  const [a, b] = rng.pick(pairs);
  const ans = add(a, b);
  const wrong = [
    fmt(rat(a.n + b.n, a.d + b.d)), // added across
    fmt(rat(a.n + b.n, Math.max(a.d, b.d))), // kept the bigger bottom
    fmt(mul(a, b)), // multiplied instead
  ];
  return { prompt: `${fmt(a)} + ${fmt(b)} = ?`, answer: fmt(ans), wrong, domain: "fractions.add" };
}

/**
 * `How many 1/8 fit in 1/2?` — the question a drummer answers with their hands.
 */
function tHowMany(rng: Rng, hard: boolean): Built {
  const whole = hard ? rng.pick([rat(1, 2), rat(1, 4), rat(3, 4), rat(1, 1)]) : rng.pick([rat(1, 1), rat(1, 2)]);
  // `whole / (1/small)` is a whole number of pieces only when the bar's own
  // denominator divides `small`; require at least 2 pieces so the question is
  // never the degenerate "how many 1/4 fit in 1/4".
  const usable = MUSICAL_D.filter((d) => d % whole.d === 0 && d * whole.n >= 2 * whole.d);
  const small = usable.length > 0 ? rng.pick(usable) : 8;
  const piece = rat(1, small);
  const ans = div(whole, piece);
  const wrong = [
    String(small), // read the bottom number off and stopped
    String(Math.max(1, small - whole.d)), // subtracted the bottoms
    fmt(mul(whole, piece)), // multiplied instead of divided
  ];
  return {
    prompt: `How many ${fmt(piece)} fit in ${fmt(whole)}?`,
    answer: fmt(ans),
    wrong,
    domain: "fractions.divide",
  };
}

/** `1/2 of 1/2 = ?` and `3 x 1/8 = ?` */
function tScale(rng: Rng, hard: boolean): Built {
  if (rng.f() < 0.5) {
    const d1 = rng.pick([2, 3, 4] as const);
    const d2 = rng.pick(hard ? ([2, 3, 4] as const) : ([2, 4] as const));
    const a = rat(1, d1);
    const b = rat(1, d2);
    const ans = mul(a, b);
    const wrong = [
      fmt(add(a, b)), // added instead
      fmt(rat(1, d1 + d2)), // added the bottoms
      fmt(rat(2, d1 * d2)), // doubled the top for no reason
    ];
    return { prompt: `${fmt(a)} of ${fmt(b)} = ?`, answer: fmt(ans), wrong, domain: "fractions.multiply" };
  }
  const k = rng.int(2, hard ? 5 : 3);
  const d = rng.pick([2, 3, 4, 8] as const);
  const a = rat(1, d);
  const ans = mul(rat(k, 1), a);
  const wrong = [
    fmt(rat(k, d * k)), // multiplied the bottom too
    fmt(rat(1, d * k)), // multiplied only the bottom
    fmt(rat(k + 1, d)), // off by one
  ];
  return { prompt: `${k} x ${fmt(a)} = ?`, answer: fmt(ans), wrong, domain: "fractions.multiply" };
}

/** `2/8 = ?/4` — equivalence, stated so the answer is a single number. */
function tEquivalent(rng: Rng): Built {
  const base = rng.pick([rat(1, 2), rat(1, 4), rat(3, 4), rat(1, 3), rat(2, 3)]);
  const k = rng.int(2, 4);
  const shownN = base.n * k;
  const shownD = base.d * k;
  const ans = base.n;
  const wrong = [
    String(shownN), // copied the top across
    String(base.d), // answered with the bottom
    String(shownN - k), // subtracted the scale factor
  ];
  return {
    prompt: `${shownN}/${shownD} = ?/${base.d}`,
    answer: String(ans),
    wrong,
    domain: "fractions.equivalence",
  };
}

/** Skip-counting, which is a groove: `4, 8, 12, ?` */
function tSkipCount(rng: Rng, hard: boolean): Built {
  const step = hard ? rng.int(3, 9) : rng.pick([2, 3, 4, 5, 10] as const);
  const start = step * rng.int(1, 3);
  const shown = [start, start + step, start + step * 2];
  const ans = start + step * 3;
  const wrong = [
    String(ans + step), // one term too far
    String(ans - 1), // counted by one at the end
    String(shown[2]! + shown[0]!), // added the first term instead of the step
  ];
  return { prompt: `${shown.join(", ")}, ?`, answer: String(ans), wrong, domain: "counting.skip" };
}

/** Tempo as ratio: `90 x 2 = ?` beats per minute. */
function tTempo(rng: Rng, hard: boolean): Built {
  const base = rng.int(3, 12) * 10;
  if (hard && rng.f() < 0.5) {
    // `base` is a multiple of 10; halving is exact only when it is a multiple
    // of 20, so force that rather than emit a fraction of a beat-per-minute.
    const even = base % 20 === 0 ? base : base + 10;
    return {
      prompt: `half of ${even} = ?`,
      answer: String(even / 2),
      wrong: [String(even - 2), String(even / 2 + 10), String(even * 2)],
      domain: "number.scale",
    };
  }
  return {
    prompt: `${base} x 2 = ?`,
    answer: String(base * 2),
    wrong: [String(base + 2), String(base * 2 - 10), String(base + base / 2)],
    domain: "number.scale",
  };
}

/** Plain arithmetic, so the game is exercised on questions it cannot "play". */
function tArith(rng: Rng, hard: boolean): Built {
  const a = rng.int(hard ? 12 : 3, hard ? 40 : 12);
  const b = rng.int(hard ? 12 : 2, hard ? 30 : 9);
  if (rng.f() < 0.5) {
    return {
      prompt: `${a} + ${b} = ?`,
      answer: String(a + b),
      wrong: [String(a + b + 10), String(a + b - 1), String(a - b)],
      domain: "number.add",
    };
  }
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return {
    prompt: `${hi} - ${lo} = ?`,
    answer: String(hi - lo),
    wrong: [String(hi - lo - 1), String(hi + lo), String(lo - hi)],
    domain: "number.subtract",
  };
}

/* ------------------------------------------------------------------ */
/* the host                                                            */
/* ------------------------------------------------------------------ */

export type StubHostOptions = {
  seed?: number;
  /** set false to prove the game degrades correctly on unplayable answers */
  musical?: boolean;
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void;
};

export function createStubHost(opts: StubHostOptions = {}): Host & { log: readonly unknown[] } {
  const rng = makeRng(opts.seed ?? 0x5b17bea7);
  const musical = opts.musical !== false;
  let counter = 0;
  const log: unknown[] = [];

  const reduced =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  function build(difficulty: number): Built {
    const hard = difficulty >= 5;
    const roll = rng.f();
    if (!musical) return tArith(rng, hard);
    // Weighted toward the fraction/subdivision core, because that is what this
    // game can turn into a rhythm. The tail keeps other domains in the mix.
    if (roll < 0.24) return tAddLike(rng, hard);
    if (roll < 0.42) return tHowMany(rng, hard);
    if (roll < 0.56) return tScale(rng, hard);
    if (roll < 0.68) return difficulty >= 3 ? tAddUnlike(rng) : tAddLike(rng, false);
    if (roll < 0.78) return tEquivalent(rng);
    if (roll < 0.9) return tSkipCount(rng, hard);
    if (roll < 0.96) return tTempo(rng, hard);
    return tArith(rng, hard);
  }

  return {
    log,
    next(o): Question {
      // `next({ difficulty })` speaks SPLITBEAT's 1..10 ladder — the scale
      // `packs/shared/game-host` documents this game as sending — but the
      // `Question.difficulty` handed BACK is a 0..1 position on the ladder,
      // which is what the real host emits (`difficulty: Math.max(0,
      // Math.min(1, ladder))`). This stub used to hand back the ladder index,
      // so every question it served looked maximally hard to anything that read
      // the field, and `answerPlan` — which sizes a child's reading time from
      // exactly that field — could only ever be exercised at its ceiling here.
      const rung = Math.max(1, Math.min(10, Math.round(o?.difficulty ?? 1)));
      const difficulty = (rung - 1) / 9;
      let b = build(rung);
      // Never offer a distractor equal to the answer, and never two identical
      // tiles — a duplicate tile is an unwinnable question.
      let guard = 0;
      while (guard++ < 24) {
        const uniq = Array.from(new Set(b.wrong.filter((w) => w !== b.answer)));
        if (uniq.length >= 2) {
          b = { ...b, wrong: uniq };
          break;
        }
        b = build(rung);
      }
      counter += 1;
      return {
        id: `stub-${counter}`,
        prompt: b.prompt,
        answer: b.answer,
        distractors: b.wrong.slice(0, 3),
        domain: b.domain,
        difficulty,
      };
    },
    report(r) {
      log.push(r);
      opts.onReport?.(r);
    },
    haptic(k) {
      // Standalone browsers get the Vibration API where it exists; the packaged
      // runtime replaces this with the native haptics plugin. Silent elsewhere.
      const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
      if (typeof nav.vibrate !== "function") return;
      const pattern: Record<string, number | number[]> = {
        light: 8,
        medium: 18,
        heavy: 34,
        success: [12, 40, 22],
        failure: [30, 60, 30],
      };
      try {
        nav.vibrate(pattern[k] ?? 10);
      } catch {
        /* a vibrate() rejection is never worth breaking a frame over */
      }
    },
    prefersReducedMotion() {
      return !!reduced?.matches;
    },
  };
}
