/**
 * Local stub Host so POLARITY is playable standalone with `npm run dev`.
 *
 * Every value here is an exact integer — no float reaches an answer or a
 * comparison. The subject is signed integers, because that is literally the
 * ship's mechanic: polarity is a sign and the core is a running signed sum.
 *
 * Distractors are real mal-rule outputs — the wrong answer a child actually
 * produces when a specific procedure breaks — not random noise. That matters
 * here more than usual: a distractor becomes a physical mine on the playfield,
 * so a distractor that no one would ever pick is a wasted obstacle.
 *
 * Difficulty is adaptive (up on fast + correct, down on wrong), which is what
 * the real host does, so swapping it in changes nothing about how this feels.
 */
import type { Ask, Host, Question } from "./contract.ts";
import { makeRng, type Rng } from "./core/rng.ts";
import { MINUS, fmtInt } from "./math/signed.ts";

// ---------------------------------------------------------------------------
// mal-rules — documented signed-integer errors
// ---------------------------------------------------------------------------

/** Adds magnitudes and keeps the sign of the larger one: −7 + 4 → −11. */
export function malSignOfLarger(a: number, b: number): number {
  const mag = Math.abs(a) + Math.abs(b);
  const dom = Math.abs(a) >= Math.abs(b) ? a : b;
  return dom < 0 ? -mag : mag;
}

/** Drops every minus sign and does the operation on magnitudes. */
export function malSignsDropped(a: number, b: number, op: "+" | "-" | "*"): number {
  const x = Math.abs(a);
  const y = Math.abs(b);
  return op === "+" ? x + y : op === "-" ? x - y : x * y;
}

/** "Always take the smaller from the larger": a − b becomes b − a. */
export function malSubtractReversed(a: number, b: number): number {
  return b - a;
}

/** Sees a − (−b) and cancels one minus too many: a − (−b) → a − b. */
export function malDoubleNegCollapsed(a: number, b: number): number {
  return a - Math.abs(b);
}

/** Reads a − b with b negative as a plain sum of magnitudes with a's sign. */
export function malSubtractAsAdd(a: number, b: number): number {
  return a + b;
}

/** "Two minuses in a product must leave a minus somewhere": (−a)(−b) → −ab. */
export function malProductAlwaysNegative(a: number, b: number): number {
  return -Math.abs(a * b);
}

/** Counts the endpoints as well as the steps on the number line. */
export function malOffByOne(v: number): number {
  return v >= 0 ? v + 1 : v - 1;
}

// ---------------------------------------------------------------------------
// question families
// ---------------------------------------------------------------------------

type Built = { prompt: string; answer: number; wrong: number[]; domain: string };

const NEG = (n: number): string => (n < 0 ? `(${MINUS}${-n})` : `${n}`);

/** a + b, mixed signs. The bread and butter. */
function intAdd(rng: Rng, hard: number): Built {
  const span = 6 + Math.round(hard * 14);
  let a = rng.i(1, span) * rng.sign();
  let b = rng.i(1, span) * rng.sign();
  if (rng.chance(0.55) && Math.sign(a) === Math.sign(b)) b = -b; // favour mixed signs
  if (a === -b) b += rng.sign(); // avoid a trivial 0 too often
  return {
    prompt: `${fmtInt(a)} + ${NEG(b)}`,
    answer: a + b,
    wrong: [malSignOfLarger(a, b), malSignsDropped(a, b, "+"), a - b, malOffByOne(a + b)],
    domain: "int-add",
  };
}

/** a − b including a − (−b), the single most productive error site. */
function intSub(rng: Rng, hard: number): Built {
  const span = 6 + Math.round(hard * 14);
  const a = rng.i(1, span) * (rng.chance(0.55) ? -1 : 1);
  const b = rng.i(1, span) * (rng.chance(0.5) ? -1 : 1);
  return {
    prompt: `${fmtInt(a)} ${MINUS} ${NEG(b)}`,
    answer: a - b,
    wrong: [
      malSubtractAsAdd(a, b),
      malSubtractReversed(a, b),
      malDoubleNegCollapsed(a, b),
      malSignsDropped(a, b, "-"),
    ],
    domain: "int-sub",
  };
}

/** Three terms — the running-sum skill the core gauge trains directly. */
function intChain(rng: Rng, hard: number): Built {
  const span = 4 + Math.round(hard * 9);
  const a = rng.i(1, span) * rng.sign();
  const b = rng.i(1, span) * rng.sign();
  const c = rng.i(1, span) * rng.sign();
  return {
    prompt: `${fmtInt(a)} + ${NEG(b)} + ${NEG(c)}`,
    answer: a + b + c,
    wrong: [
      a + b - c,
      malSignOfLarger(a + b, c),
      Math.abs(a) + Math.abs(b) + Math.abs(c),
      a - b + c,
    ],
    domain: "int-chain",
  };
}

/** Sign rules for a product, kept small so the answer stays on an orb. */
function intMul(rng: Rng, hard: number): Built {
  const hi = 3 + Math.round(hard * 5);
  const a = rng.i(2, hi) * rng.sign();
  const b = rng.i(2, Math.min(hi, 7)) * rng.sign();
  return {
    prompt: `${NEG(a)} × ${NEG(b)}`,
    answer: a * b,
    wrong: [
      malProductAlwaysNegative(a, b),
      malSignsDropped(a, b, "*"),
      -(a * b),
      a + b, // the perennial "multiply looks like add" slip
    ],
    domain: "int-mul",
  };
}

/** Missing addend — reads as "what do I have to absorb to get there". */
function intMissing(rng: Rng, hard: number): Built {
  const span = 5 + Math.round(hard * 12);
  const a = rng.i(1, span) * rng.sign();
  const ans = rng.i(1, span) * rng.sign();
  const c = a + ans;
  return {
    prompt: `${fmtInt(a)} + ? = ${fmtInt(c)}`,
    answer: ans,
    wrong: [c - Math.abs(a), Math.abs(c) - Math.abs(a), a - c, -ans],
    domain: "int-missing",
  };
}

/** Distance between two integers on the line — always non-negative. */
function intDist(rng: Rng, hard: number): Built {
  const span = 6 + Math.round(hard * 14);
  const a = rng.i(-span, span);
  const b = rng.i(-span, span);
  if (a === b) return intDist(rng, hard);
  return {
    prompt: `${fmtInt(a)} to ${fmtInt(b)}`,
    answer: Math.abs(b - a),
    wrong: [b - a, a - b, Math.abs(a) + Math.abs(b), Math.abs(Math.abs(b) - Math.abs(a))],
    domain: "int-dist",
  };
}

type Gen = (rng: Rng, hard: number) => Built;

const EASY: readonly Gen[] = [intAdd, intSub, intMissing];
const MID: readonly Gen[] = [intAdd, intSub, intChain, intMul, intMissing, intDist];
const HARD: readonly Gen[] = [intSub, intChain, intMul, intMissing, intDist];

const BY_DOMAIN: Record<string, Gen> = {
  "int-add": intAdd,
  "int-sub": intSub,
  "int-chain": intChain,
  "int-mul": intMul,
  "int-missing": intMissing,
  "int-dist": intDist,
};

// ---------------------------------------------------------------------------
// assembly
// ---------------------------------------------------------------------------

/**
 * The range THIS stub draws from, and nothing more.
 *
 * It is not what the game can print — `core/labels.ts` claims a tile for any
 * integer — and reading it as a limit is how a defect survived a whole build:
 * the dev harness stayed inside ±40, so `npm run dev` never showed a blank orb
 * while the shipped pack showed almost nothing else. `core/labels.test.ts`
 * measures the real curriculum instead of this.
 */
export const VALUE_MIN = -40;
export const VALUE_MAX = 40;

function inRange(n: number): boolean {
  return Number.isInteger(n) && n >= VALUE_MIN && n <= VALUE_MAX;
}

/**
 * Pick three distinct, in-range distractors, preferring genuine mal-rules and
 * padding with near-misses only if the mal-rules collide. At least one keeps
 * the answer's sign where possible: same-sign distractors are the ones that
 * are actually dangerous in flight, since you can phase through the others.
 */
export function chooseDistractors(answer: number, wrong: number[], rng: Rng): string[] {
  const seen = new Set<number>([answer]);
  const out: number[] = [];
  const push = (n: number): void => {
    if (out.length >= 3) return;
    if (!inRange(n) || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  const sameSign = wrong.filter((w) => w !== 0 && answer !== 0 && Math.sign(w) === Math.sign(answer));
  for (const w of rng.shuffle(sameSign.slice())) push(w);
  for (const w of rng.shuffle(wrong.slice())) push(w);
  for (let d = 1; out.length < 3 && d < 24; d++) {
    push(answer + d);
    push(answer - d);
  }
  return rng.shuffle(out).map(fmtInt);
}

/**
 * A game's difficulty number as a 0..1 ladder position.
 *
 * Transcribed from `toUnit` in `packs/shared/game-host/index.ts` — a value below
 * 1 is a fraction, 1..10 is a ladder index, and `1` is read as the BOTTOM. The
 * stub cannot import the real host (this file exists so POLARITY runs with no
 * host at all), and a stub that read the request on a different scale from the
 * shipping host would be a dev harness that agrees with nothing — which is
 * precisely how the blank-orb defect survived a whole build.
 */
export function toUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 1) return Math.max(0, value);
  return Math.min(1, (value - 1) / 9);
}

export type StubOpts = {
  seed?: number;
  /** starting difficulty 0..1 */
  difficulty?: number;
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void;
};

/** Build the standalone host. Seeded, so a dev run is reproducible. */
export function makeStubHost(opts: StubOpts = {}): Host & { difficulty(): number } {
  const rng = makeRng(opts.seed ?? 0x50147);
  let hard = Math.min(1, Math.max(0, opts.difficulty ?? 0.18));
  /** A standing ceiling, 0..1. Stands until the game names a different one. */
  let ceiling = 1;
  let n = 0;

  const build = (want?: Ask): Question => {
    // The ceiling is a hard cap and the request is a wish, same as the real
    // service: `maxDifficulty` floors, `difficulty` does not.
    if (want?.maxDifficulty !== undefined) ceiling = toUnit(want.maxDifficulty);
    const asked = want?.difficulty === undefined ? hard : toUnit(want.difficulty);
    const d = Math.min(1, Math.max(0, Math.min(asked, ceiling)));
    const table = d < 0.3 ? EASY : d < 0.68 ? MID : HARD;
    const pinned = want?.domain ? BY_DOMAIN[want.domain] : undefined;
    let b: Built | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const cand = (pinned ?? rng.pick(table))(rng, d);
      if (inRange(cand.answer)) {
        b = cand;
        break;
      }
    }
    if (!b) b = intAdd(rng, 0.2);
    n++;
    return {
      id: `stub-${n}-${b.domain}`,
      prompt: b.prompt,
      answer: fmtInt(b.answer),
      distractors: chooseDistractors(b.answer, b.wrong, rng),
      domain: b.domain,
      difficulty: d,
    };
  };

  return {
    next: (o) => build(o),
    report: (r) => {
      if (r.correct) hard = Math.min(1, hard + (r.ms < 5200 ? 0.055 : 0.022));
      else hard = Math.max(0, hard - 0.085);
      opts.onReport?.(r);
    },
    haptic: (k) => {
      const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
      if (typeof nav.vibrate !== "function") return;
      const pat: Record<string, number | number[]> = {
        light: 8,
        medium: 16,
        heavy: 34,
        success: [12, 26, 18],
        failure: [30, 42, 30],
      };
      try {
        nav.vibrate(pat[k] ?? 10);
      } catch (e) {
        console.warn("[polarity] vibrate failed", e);
      }
    },
    prefersReducedMotion: () =>
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
    difficulty: () => hard,
  };
}
