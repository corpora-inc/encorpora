/**
 * A local stub Host so the game is playable standalone with `npm run dev`.
 *
 * When the Dynawalla runtime lands it replaces this wholesale. Until then this
 * file must honour every rule the real host will:
 *
 *  - **Exact arithmetic.** Every number here is an integer. No float appears in
 *    an answer, in a distractor, or in any comparison. `Number.isSafeInteger`
 *    is asserted on the way out.
 *  - **Seeded and deterministic.** Same seed, same stream of questions, forever.
 *  - **Distractors are real mal-rule outputs** — the specific wrong answers
 *    children actually produce, not random noise. A distractor a child would
 *    never write teaches nothing and makes the answer guessable.
 *
 * ABYSSAL BLOOM leans on one extra property: answers are biased to land ON the
 * polyp value ladder, because the primary way to answer is to hand the vent a
 * polyp whose printed value *is* the answer.
 */

import type { Host, Question } from './contract.ts'
import { makeRng, type Rng } from './core/rng.ts'
import { SEEDS, onLadder, MAX_STEP } from './core/ladder.ts'

/* ------------------------------------------------------------------ mal-rules */

/** Column-wise addition that drops every carry. 96+96 -> 82. */
function addNoCarry(a: number, b: number): number {
  let out = 0
  let mul = 1
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    const d = ((x % 10) + (y % 10)) % 10
    out += d * mul
    mul *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

/** Doubles only the units digit; the rest is copied. 96 -> 92 (9|12->9|2). */
function doubleUnitsOnly(a: number): number {
  const units = a % 10
  return a - units + ((units * 2) % 10)
}

/** Column subtraction taking the smaller digit from the larger in each column. */
function subSmallerFromLarger(a: number, b: number): number {
  let out = 0
  let mul = 1
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    const dx = x % 10
    const dy = y % 10
    out += Math.abs(dx - dy) * mul
    mul *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

/** Carries one place too far — adds an extra ten. */
function carryOnce(a: number): number {
  return a + 10
}

/** Halving that halves the leading digit and copies the rest. 48 -> 28. */
function halveLeadingOnly(a: number): number {
  const s = String(a)
  const lead = Number(s[0])
  if (!Number.isInteger(lead) || lead < 2) return a - 1
  return Number(String(Math.floor(lead / 2)) + s.slice(1))
}

/** Multiplication answered as addition. n x 4 -> n + 4. */
function mulAsAdd(n: number, k: number): number {
  return n + k
}

/** One doubling short — the "stopped a rung early" error. */
function oneRungShort(answer: number): number {
  return Math.floor(answer / 2)
}

/** One doubling too far. */
function oneRungLong(answer: number): number {
  return answer * 2
}

/* ------------------------------------------------------------------ families */

type Built = { prompt: string; answer: number; distractors: number[]; domain: string }

/** Every ladder value with rank inside [loStep, hiStep], ascending. */
function ladderBand(loStep: number, hiStep: number): number[] {
  const out: number[] = []
  for (let step = loStep; step <= Math.min(hiStep, MAX_STEP); step++) {
    for (const s of SEEDS) out.push(s * 2 ** step)
  }
  return out.sort((x, y) => x - y)
}

/**
 * Clamp anything a caller hands us into 1..10. `Math.round(NaN)` is NaN and
 * NaN survives both `Math.min` and `Math.max`, so a bad difficulty would sail
 * straight through a naive clamp and out into `Question.difficulty`. Guard it
 * here once rather than at four call sites.
 */
export function clampDifficulty(d: unknown): number {
  const n = Math.round(Number(d))
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(10, n))
}

/** difficulty 1..10 -> the step window answers are drawn from. */
function bandFor(difficulty: number): [number, number] {
  const d = clampDifficulty(difficulty)
  const table: Array<[number, number]> = [
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 6],
    [5, 7],
    [6, 8],
    [7, 9],
    [8, 10],
    [9, 12],
  ]
  return table[d - 1] ?? [1, 3]
}

function buildDouble(rng: Rng, answer: number): Built {
  const half = answer / 2
  return {
    prompt: `${half} + ${half}`,
    answer,
    distractors: [
      addNoCarry(half, half),
      doubleUnitsOnly(half),
      carryOnce(answer),
      rng.chance(1, 2) ? oneRungShort(answer) : half + 2,
    ],
    domain: 'add.double',
  }
}

function buildTimesTwo(_rng: Rng, answer: number): Built {
  const half = answer / 2
  return {
    prompt: `${half} × 2`,
    answer,
    distractors: [mulAsAdd(half, 2), addNoCarry(half, half), doubleUnitsOnly(half), carryOnce(answer)],
    domain: 'mul.double',
  }
}

function buildHalve(_rng: Rng, answer: number): Built {
  const whole = answer * 2
  return {
    prompt: `half of ${whole}`,
    answer,
    distractors: [halveLeadingOnly(whole), oneRungShort(answer), whole - 2, answer + 10],
    domain: 'div.halve',
  }
}

function buildSum(rng: Rng, answer: number): Built {
  // a + b = answer, with a on the ladder so the child can also *see* the addend.
  const a = rng.int(Math.floor(answer / 4), Math.floor((answer * 3) / 4))
  const b = answer - a
  return {
    prompt: `${a} + ${b}`,
    answer,
    distractors: [addNoCarry(a, b), carryOnce(answer), answer - 10, a + b + 1],
    domain: 'add.sum',
  }
}

function buildDiff(rng: Rng, answer: number): Built {
  const b = rng.int(Math.floor(answer / 3), answer - 1)
  const a = answer + b
  return {
    prompt: `${a} − ${b}`,
    answer,
    distractors: [subSmallerFromLarger(a, b), answer + 10, answer - 10, a - b - 1],
    domain: 'sub.diff',
  }
}

function buildTimesFour(_rng: Rng, answer: number): Built {
  const q = answer / 4
  return {
    prompt: `${q} × 4`,
    answer,
    distractors: [mulAsAdd(q, 4), q * 2, oneRungLong(answer), addNoCarry(q * 2, q * 2)],
    domain: 'mul.four',
  }
}

function buildTriple(_rng: Rng, answer: number): Built {
  const third = answer / 3
  return {
    prompt: `${third} + ${third} + ${third}`,
    answer,
    distractors: [third * 2, addNoCarry(third * 2, third), answer + third, carryOnce(answer)],
    domain: 'add.triple',
  }
}

/* ------------------------------------------------------------------ the host */

export type StubHostOpts = {
  seed?: number
  /** Called on every report — the dev HUD uses it. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Force reduced motion on, for QA. */
  forceReducedMotion?: boolean
}

export function makeStubHost(opts: StubHostOpts = {}): Host {
  const rng = makeRng(opts.seed ?? 0x5eed1e)
  let n = 0

  const build = (difficulty: number): Built => {
    const [lo, hi] = bandFor(difficulty)
    const band = ladderBand(lo, hi)
    const answer = rng.pick(band)

    // Which families can express THIS answer exactly, with integers only?
    const families: Array<(r: Rng, a: number) => Built> = []
    if (answer % 2 === 0) {
      families.push(buildDouble, buildDouble, buildTimesTwo)
      if (difficulty >= 3) families.push(buildHalve)
    }
    families.push(buildSum)
    if (difficulty >= 4) families.push(buildDiff)
    if (difficulty >= 5 && answer % 4 === 0) families.push(buildTimesFour)
    if (difficulty >= 6 && answer % 3 === 0) families.push(buildTriple)

    return rng.pick(families)(rng, answer)
  }

  const next = (o?: { domain?: string; difficulty?: number }): Question => {
    const difficulty = clampDifficulty(o?.difficulty ?? 1)
    let b = build(difficulty)
    // If a caller asked for a domain, try a few draws to honour it. Never loop
    // forever; a near-miss domain is far better than a stalled answer path.
    if (o?.domain) {
      for (let i = 0; i < 8 && !b.domain.startsWith(o.domain); i++) b = build(difficulty)
    }

    const seen = new Set<number>([b.answer])
    const distractors: string[] = []
    for (const d of b.distractors) {
      if (!Number.isSafeInteger(d) || d <= 0 || seen.has(d)) continue
      seen.add(d)
      distractors.push(String(d))
      if (distractors.length === 3) break
    }
    // Guarantee three. Pad with off-by-ladder-rung values, which are themselves
    // the "grabbed the neighbouring polyp" error this board makes easy to make.
    let pad = 1
    while (distractors.length < 3) {
      const cand = b.answer + pad * (pad % 2 === 0 ? -1 : 1) * 2
      if (Number.isSafeInteger(cand) && cand > 0 && !seen.has(cand)) {
        seen.add(cand)
        distractors.push(String(cand))
      }
      pad++
      if (pad > 40) break
    }

    if (!Number.isSafeInteger(b.answer)) throw new Error('stubHost produced a non-integer answer')

    n++
    return {
      id: `sq-${n}`,
      prompt: b.prompt,
      answer: String(b.answer),
      distractors,
      domain: b.domain,
      difficulty,
    }
  }

  const mediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null

  return {
    next,
    report(r) {
      opts.onReport?.(r)
    },
    haptic(k) {
      // Web fallback. The native plugin replaces this; `navigator.vibrate` does
      // not exist in iOS WKWebView, so this is a silent no-op there by design.
      const nav = typeof navigator !== 'undefined' ? navigator : null
      if (!nav || typeof nav.vibrate !== 'function') return
      const ms = { light: 8, medium: 16, heavy: 32, success: 24, failure: 40 }[k]
      try {
        nav.vibrate(ms)
      } catch {
        /* some browsers throw on a gesture-less vibrate; nothing to do */
      }
    },
    prefersReducedMotion() {
      if (opts.forceReducedMotion) return true
      return mediaQuery?.matches ?? false
    },
  }
}

/** Exported for tests: is every question's answer usable as a polyp value? */
export { onLadder }
