/**
 * A local stub Host so the game is playable standalone with `npm run dev` — and,
 * more importantly, so the negotiation in `core/ask.ts` can be *measured*.
 *
 * When the Dynawalla runtime lands it replaces this wholesale. Until then this
 * file must honour every rule the real host will:
 *
 *  - **Exact arithmetic.** Every number here is an integer. No float appears in
 *    an answer, in a distractor, or in any comparison. `Number.isSafeInteger` is
 *    asserted on the way out.
 *  - **Seeded and deterministic.** Same seed, same stream of questions, forever.
 *  - **Distractors are real mal-rule outputs** — the specific wrong answers
 *    children actually produce, not random noise.
 *
 * ## It deliberately does NOT know about the polyp ladder
 *
 * The previous version biased its answers onto the ladder, which made every test
 * that measured reachability vacuous: the thing under test was handed a stream
 * that could not fail. This one models `dynawalla-app/src/packs/items.ts` instead
 * — column operations at the operand widths the curriculum's own skill bindings
 * declare — so the answers are the same shape and the same size as the real ones,
 * ladder or no ladder.
 *
 * It also models the two mechanisms `ask.ts` leans on, because a stub that lacks
 * them tests a game nobody ships:
 *
 *  - **a prefetch pool**, so `focus` has something to search;
 *  - **`focus`**, which finds a pooled question whose answer is in the wanted set
 *    and hands that one over — exactly what `packs/shared/game-host` does;
 *  - **`skip`**, which closes an item and records nothing.
 */

import type { Host, Question } from './contract.ts'
import { makeRng, type Rng } from './core/rng.ts'
import { onLadder } from './core/ladder.ts'

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

/** Multiplication answered as addition. n x 4 -> n + 4. */
function mulAsAdd(n: number, k: number): number {
  return n + k
}

/* ------------------------------------------------------------------ families */

type Built = { prompt: string; answer: number; distractors: number[]; domain: string }

/**
 * Clamp anything a caller hands us into 1..10. `Math.round(NaN)` is NaN and NaN
 * survives both `Math.min` and `Math.max`, so a bad difficulty would sail
 * straight through a naive clamp and out into `Question.difficulty`.
 */
export function clampDifficulty(d: unknown): number {
  const n = Math.round(Number(d))
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(10, n))
}

/**
 * Operand widths per rung, read off the shipped bindings in
 * `packs/shared/curriculum/src/graph/domains/add.ts`: `plus(2,2,1)`,
 * `plus(3,3,2)`, `plus(4,2,1)`, `plus(5,3,3)`, `sub(6,3,3)` and so on. Each pair
 * is (digits of the first operand, digits of the second).
 */
const WIDTHS: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [2, 1],
  [2, 2],
  [3, 1],
  [3, 2],
  [3, 3],
  [4, 2],
  [4, 4],
  [5, 3],
  [6, 3],
]

function widthsFor(difficulty: number): readonly [number, number] {
  return WIDTHS[clampDifficulty(difficulty) - 1] ?? [1, 1]
}

function digitsOf(rng: Rng, n: number): number {
  if (n <= 1) return rng.int(1, 9)
  const lo = 10 ** (n - 1)
  return rng.int(lo, lo * 10 - 1)
}

function buildAdd(rng: Rng, difficulty: number): Built {
  const [wa, wb] = widthsFor(difficulty)
  const a = digitsOf(rng, wa)
  const b = digitsOf(rng, wb)
  return {
    prompt: `${a} + ${b}`,
    answer: a + b,
    distractors: [addNoCarry(a, b), carryOnce(a + b), a + b - 10, a + b + 1],
    domain: 'add.column',
  }
}

function buildSub(rng: Rng, difficulty: number): Built {
  const [wa, wb] = widthsFor(difficulty)
  // The minuend is drawn at least two, so the difference is at least one. Left
  // unguarded, `1 − 1` came out as an answer of ZERO and `stubHost.test.ts` caught
  // it — a zero answer is not a target any number of polyps can build.
  const a = Math.max(2, digitsOf(rng, wa))
  let b = digitsOf(rng, Math.min(wb, wa))
  if (b >= a) b = a - 1
  return {
    prompt: `${a} − ${b}`,
    answer: a - b,
    distractors: [subSmallerFromLarger(a, b), a - b + 10, a - b - 10, a - b - 1],
    domain: 'sub.column',
  }
}

function buildMul(rng: Rng, difficulty: number): Built {
  const [wa] = widthsFor(difficulty)
  const a = digitsOf(rng, Math.max(1, wa - 1))
  const k = rng.int(2, 9)
  return {
    prompt: `${a} × ${k}`,
    answer: a * k,
    distractors: [mulAsAdd(a, k), a * (k - 1), a * k + 10, a * k - a],
    domain: 'mul.short',
  }
}

function buildDiv(rng: Rng, difficulty: number): Built {
  const [wa] = widthsFor(difficulty)
  const k = rng.int(2, 9)
  const q = digitsOf(rng, Math.max(1, wa - 1))
  return {
    prompt: `${q * k} ÷ ${k}`,
    answer: q,
    distractors: [q + k, q * k, Math.max(1, q - 1), q + 10],
    domain: 'div.exact',
  }
}

/* ------------------------------------------------------------------ the host */

export type StubHostOpts = {
  seed?: number
  /** Called on every report — the dev HUD uses it. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Called on every skip, so a test can count refusals. */
  onSkip?: (questionId: string) => void
  /** Force reduced motion on, for QA. */
  forceReducedMotion?: boolean
}

/** How many questions the stub keeps ahead of the game, like the real adapter. */
export const STUB_POOL = 32

export function makeStubHost(opts: StubHostOpts = {}): Host {
  const rng = makeRng(opts.seed ?? 0x5eed1e)
  let serial = 0
  let wanted: number[] = []
  const open = new Set<string>()

  const build = (difficulty: number): Built => {
    const families = [buildAdd, buildAdd, buildSub, buildMul, buildDiv]
    return rng.pick(families)(rng, difficulty)
  }

  const make = (difficulty: number): Question => {
    const b = build(difficulty)
    const seen = new Set<number>([b.answer])
    const distractors: string[] = []
    for (const d of b.distractors) {
      if (!Number.isSafeInteger(d) || d <= 0 || seen.has(d)) continue
      seen.add(d)
      distractors.push(String(d))
      if (distractors.length === 3) break
    }
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
    serial++
    const q: Question = {
      id: `sq-${serial}`,
      prompt: b.prompt,
      answer: String(b.answer),
      distractors,
      domain: b.domain,
      difficulty: clampDifficulty(difficulty),
    }
    open.add(q.id)
    return q
  }

  /** The prefetch pool, so `focus` has something to search. */
  let pool: Question[] = []
  let pooledFor = 0

  const fill = (difficulty: number): void => {
    // A change of request throws the pool away, exactly as the real adapter's
    // `flush` does — otherwise a difficulty change lands thirty-two questions
    // later and nothing a game asks for is visible in what it is served.
    if (difficulty !== pooledFor) {
      pool = []
      pooledFor = difficulty
    }
    while (pool.length < STUB_POOL) pool.push(make(difficulty))
  }

  const next = (o?: { domain?: string; difficulty?: number; maxDifficulty?: number }): Question => {
    const ceiling = o?.maxDifficulty === undefined ? 10 : clampDifficulty(o.maxDifficulty)
    const difficulty = Math.min(ceiling, clampDifficulty(o?.difficulty ?? 1))
    fill(difficulty)
    if (wanted.length > 0) {
      const i = pool.findIndex((q) => wanted.includes(Number(q.answer)))
      if (i >= 0) {
        const [hit] = pool.splice(i, 1)
        fill(difficulty)
        if (hit) return o?.domain ? { ...hit, domain: o.domain } : hit
      }
    }
    const head = pool.shift() ?? make(difficulty)
    fill(difficulty)
    return o?.domain ? { ...head, domain: o.domain } : head
  }

  const mediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null

  return {
    next,
    report(r) {
      // Once per item, like the real adapter: an id already answered or skipped
      // is dropped rather than inflating a child's record.
      if (!open.delete(r.questionId)) return
      opts.onReport?.(r)
    },
    skip(id) {
      if (!open.delete(id)) return
      opts.onSkip?.(id)
    },
    focus({ wanted: values }) {
      wanted = values.slice(0, 32)
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

/** Exported for tests: is a value usable as a polyp value at all? */
export { onLadder }
