/**
 * Local stub Host. Seeded, deterministic, exact integer arithmetic only.
 *
 * It exists so the game is playable standalone with `npm run dev`. The real
 * curriculum will replace it wholesale; nothing outside this file knows it exists.
 *
 * Distractors are real mal-rule outputs — the errors a child actually makes —
 * because in this game a distractor is a place on the ground, and landing there
 * has to mean something.
 */

import type { Host, Question } from './contract.ts'
import { makeRng, shuffled, type Rng } from './core/rng.ts'
// The one MIN_GAP. It used to be typed out here as well, and it now sets the
// strongest wind the game can blow (`WIND_MAX = MIN_GAP - 2`), so a second copy is
// a way for the stub's keeps and the real wind bounds to drift apart in silence.
export { MIN_GAP } from './sim/ballistics.ts'

import { MIN_GAP } from './sim/ballistics.ts'

/** Towers stand at their own value in metres, so answers must fit the field. */
export const ANSWER_MIN = 14
export const ANSWER_MAX = 118

export type Report = { questionId: string; correct: boolean; ms: number; answered: string }

type Cand = { prompt: string; answer: number; mal: number[]; domain: string }

const uniqInt = (xs: number[]): number[] => Array.from(new Set(xs))

function reverseDigits(n: number): number {
  const s = String(n)
  if (s.length < 2) return -1
  const r = Number(s.split('').reverse().join(''))
  return r === n ? -1 : r
}

/** a + b with the errors that actually happen: dropped carry, carry twice, off-by-ten. */
function genAdd(rng: Rng, d: number): Cand {
  const hi = d < 0.3 ? 12 : d < 0.6 ? 29 : 58
  const lo = d < 0.3 ? 4 : d < 0.6 ? 8 : 14
  let a = rng.int(lo, hi)
  let b = rng.int(lo, hi)
  if (a + b < ANSWER_MIN) b += ANSWER_MIN - (a + b)
  if (a + b > ANSWER_MAX) a -= a + b - ANSWER_MAX
  const answer = a + b
  const droppedCarry = (a % 10) + (b % 10) >= 10 ? answer - 10 : answer + 10
  const mal = uniqInt([
    droppedCarry,
    answer + 10,
    answer - 10,
    answer + 9,
    answer + b, // counted the second addend twice
    reverseDigits(answer),
  ])
  return { prompt: `${a} + ${b}`, answer, mal, domain: 'add-sub' }
}

/** a − b. The great mal-rule: subtract the smaller digit from the larger, per column. */
function genSub(rng: Rng, d: number): Cand {
  const hi = d < 0.3 ? 40 : d < 0.6 ? 78 : 130
  let a = rng.int(ANSWER_MIN + 8, hi)
  let b = rng.int(3, Math.max(4, Math.floor(a / 2)))
  if (a - b < ANSWER_MIN) b = a - ANSWER_MIN
  if (a - b > ANSWER_MAX) a = ANSWER_MAX + b
  const answer = a - b
  // smaller-from-larger, column by column
  let sml = 0
  let place = 1
  for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    sml += Math.abs((x % 10) - (y % 10)) * place
    place *= 10
  }
  const mal = uniqInt([
    sml,
    answer + 10, // forgot to decrement the borrowed column
    answer - 10,
    answer + 1,
    answer - 1,
    reverseDigits(answer),
  ])
  return { prompt: `${a} − ${b}`, answer, mal, domain: 'add-sub' }
}

/** a × b. Off-by-one-group is the error worth making visible on the ground. */
function genMul(rng: Rng, d: number): Cand {
  const table = d < 0.35 ? rng.int(2, 6) : d < 0.7 ? rng.int(3, 9) : rng.int(6, 12)
  const other = d < 0.35 ? rng.int(3, 9) : d < 0.7 ? rng.int(4, 11) : rng.int(5, 12)
  let a = table
  let b = other
  if (a * b < ANSWER_MIN) b = Math.ceil(ANSWER_MIN / a)
  if (a * b > ANSWER_MAX) b = Math.floor(ANSWER_MAX / a)
  const answer = a * b
  const mal = uniqInt([
    answer - a, // one group short
    answer + a, // one group long
    answer - b,
    answer + b,
    a + b, // added instead
    reverseDigits(answer),
  ])
  return { prompt: `${a} × ${b}`, answer, mal, domain: 'mul-div' }
}

/** a ÷ b, always exact. */
function genDiv(rng: Rng, d: number): Cand {
  const b = d < 0.75 ? rng.int(2, 6) : rng.int(3, 9)
  const answer = d < 0.75 ? rng.int(ANSWER_MIN, 28) : rng.int(ANSWER_MIN, 44)
  const a = answer * b
  const mal = uniqInt([answer + 1, answer - 1, answer + b, answer - b, a - b, reverseDigits(answer)])
  return { prompt: `${a} ÷ ${b}`, answer, mal, domain: 'mul-div' }
}

/**
 * Pick `count` distractors: prefer real mal-rules, keep them legal and separable,
 * then fill with plausible near-magnitudes. Every value is an integer.
 */
export function spreadDistractors(answer: number, mal: number[], count: number, rng: Rng): number[] {
  const ok = (v: number, chosen: number[]): boolean =>
    Number.isInteger(v) &&
    v >= ANSWER_MIN &&
    v <= ANSWER_MAX &&
    Math.abs(v - answer) >= MIN_GAP &&
    chosen.every((c) => Math.abs(v - c) >= MIN_GAP)

  const chosen: number[] = []
  for (const m of shuffled(mal, rng)) {
    if (chosen.length >= count) break
    if (ok(m, chosen)) chosen.push(m)
  }
  // Fillers: still plausible magnitudes, just not mal-rule derived.
  let guard = 0
  while (chosen.length < count && guard++ < 400) {
    const sign = rng.chance(0.5) ? 1 : -1
    const step = MIN_GAP + rng.int(0, 14)
    const v = answer + sign * step
    if (ok(v, chosen)) chosen.push(v)
  }
  while (chosen.length < count) {
    // Last resort — walk the field for any legal slot. Deterministic.
    for (let v = ANSWER_MIN; v <= ANSWER_MAX && chosen.length < count; v++) {
      if (ok(v, chosen)) chosen.push(v)
    }
  }
  return chosen
}

export type StubOptions = {
  seed?: number
  /** how many distractors each question must carry (one per rival tower) */
  distractorCount?: number
  /** 0..1 — the wave sets this before pulling */
  difficulty?: number
  haptics?: (kind: 'light' | 'medium' | 'heavy' | 'success' | 'failure') => void
  onReport?: (r: Report) => void
}

export type StubHost = Host & {
  setDifficulty(d: number): void
  setDistractorCount(n: number): void
  readonly reports: Report[]
}

export function createStubHost(opts: StubOptions = {}): StubHost {
  const rng = makeRng(opts.seed ?? 0x5eed1e)
  let difficulty = opts.difficulty ?? 0
  let distractorCount = opts.distractorCount ?? 2
  let n = 0
  const reports: Report[] = []

  const reducedMotion = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return {
    reports,
    setDifficulty(d) {
      difficulty = Math.max(0, Math.min(1, d))
    },
    setDistractorCount(k) {
      distractorCount = Math.max(1, Math.min(5, Math.round(k)))
    },
    next(): Question {
      const d = difficulty
      const weights: Array<[() => Cand, number]> = [
        [() => genAdd(rng, d), d < 0.25 ? 5 : 2],
        [() => genSub(rng, d), d < 0.15 ? 2 : 3],
        [() => genMul(rng, d), d < 0.3 ? 0 : 4],
        [() => genDiv(rng, d), d < 0.55 ? 0 : 2],
      ]
      const total = weights.reduce((s, w) => s + w[1], 0)
      let r = rng.next() * total
      let cand: Cand = weights[0][0]()
      for (const [make, w] of weights) {
        r -= w
        if (r <= 0) {
          cand = make()
          break
        }
      }
      // Safety net: the field is the answer space, so an answer must fit in it.
      if (cand.answer < ANSWER_MIN || cand.answer > ANSWER_MAX) cand = genAdd(rng, 0.2)
      const distractors = spreadDistractors(cand.answer, cand.mal, distractorCount, rng)
      n += 1
      return {
        id: `q${n}-${cand.answer}`,
        prompt: cand.prompt,
        answer: String(cand.answer),
        distractors: distractors.map(String),
        domain: cand.domain,
        difficulty: d,
      }
    },
    report(r) {
      reports.push(r)
      opts.onReport?.(r)
    },
    haptic(kind) {
      opts.haptics?.(kind)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        const ms =
          kind === 'light' ? 8 : kind === 'medium' ? 18 : kind === 'heavy' ? 42 : kind === 'success' ? 26 : 34
        try {
          navigator.vibrate(kind === 'success' ? [16, 40, 26] : kind === 'failure' ? [30, 60, 30] : ms)
        } catch {
          /* haptics are a garnish; never let them throw into the frame */
        }
      }
    },
    prefersReducedMotion: reducedMotion,
  }
}
