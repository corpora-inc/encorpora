// A local stub Host so the game is playable standalone with `npm run dev`.
//
// The real host arrives with the curriculum package. Until then this generates
// the domain CLAIM is built on — a fraction or a percentage of the arena — with
// exact integer answers and distractors that are real mal-rule outputs rather
// than random near-misses.
//
// Seeded: the same seed replays the same question sequence, forever.

import type { Host, Question } from "./contract.ts"
import { makeRng, hashSeed, type Rng } from "./game/rng.ts"
import { partOf, percentOf } from "./game/exact.ts"

type FracSpec = { n: number; d: number }

// Every denominator here divides 7200 exactly. `partOf` throws if one ever
// stops doing so, which is the point — a silent rounding is a wrong answer.
const EASY: FracSpec[] = [
  { n: 1, d: 2 },
  { n: 1, d: 4 },
  { n: 3, d: 4 },
  { n: 1, d: 3 },
  { n: 2, d: 3 },
]
const MID: FracSpec[] = [
  { n: 3, d: 5 },
  { n: 2, d: 5 },
  { n: 5, d: 8 },
  { n: 3, d: 8 },
  { n: 7, d: 10 },
  { n: 5, d: 6 },
  { n: 4, d: 5 },
]
const HARD: FracSpec[] = [
  { n: 7, d: 8 },
  { n: 9, d: 10 },
  { n: 5, d: 12 },
  { n: 7, d: 12 },
  { n: 11, d: 12 },
  { n: 7, d: 9 },
  { n: 5, d: 9 },
]

const PERCENTS_EASY = [25, 50, 75, 40, 60]
const PERCENTS_MID = [30, 70, 35, 65, 45, 55, 80]
const PERCENTS_HARD = [85, 90, 15, 95, 5, 12, 88]

/**
 * Mal-rules for "a/b of N". Each is a mistake children actually make, not a
 * jittered answer — which is what makes a wrong pick informative.
 */
function fractionMalRules(total: number, n: number, d: number): number[] {
  const out: number[] = []
  const push = (v: number): void => {
    if (Number.isInteger(v) && v > 0 && v <= total) out.push(v)
  }
  // Divided but forgot to multiply back up ("found one part, stopped").
  push(total / d)
  // Took the complement — counted the pieces left over instead.
  push(partOfSafe(total, d - n, d))
  // Off by one part in each direction — miscounted the shading.
  push(partOfSafe(total, n + 1, d))
  push(partOfSafe(total, n - 1, d))
  // Flipped the fraction.
  push(partOfSafe(total, d, n))
  return out
}

function partOfSafe(total: number, n: number, d: number): number {
  if (n <= 0 || d <= 0) return -1
  const num = total * n
  return num % d === 0 ? num / d : -1
}

/** Mal-rules for "p% of N": place-value slips and the complement. */
function percentMalRules(total: number, p: number): number[] {
  const out: number[] = []
  const push = (v: number): void => {
    if (Number.isInteger(v) && v > 0 && v <= total) out.push(v)
  }
  push(percentOfSafe(total, 100 - p)) // complement
  push(percentOfSafe(total, p * 10)) // decimal shifted the wrong way
  push(percentOfSafe(total, p / 10))
  push(percentOfSafe(total, p + 10)) // slid one gridline on the meter
  push(percentOfSafe(total, p - 10))
  return out
}

function percentOfSafe(total: number, p: number): number {
  if (p <= 0 || p > 100) return -1
  const num = total * p
  return num % 100 === 0 ? num / 100 : -1
}

function distinct(answer: number, candidates: number[], want: number, rng: Rng): string[] {
  const seen = new Set<number>([answer])
  const out: string[] = []
  for (const c of rng.shuffle(candidates.slice())) {
    if (seen.has(c)) continue
    seen.add(c)
    out.push(String(c))
    if (out.length === want) break
  }
  return out
}

export type StubHostOptions = {
  seed?: number | string
  /** Cell count of the arena interior. Every question is a part of this. */
  total: number
  /** Test seam: report() sink. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Test seam: force reduced motion on or off. */
  reducedMotion?: boolean
}

export function createStubHost(opts: StubHostOptions): Host {
  const total = opts.total
  const seedNum =
    typeof opts.seed === "string"
      ? hashSeed(opts.seed)
      : typeof opts.seed === "number"
        ? opts.seed
        : hashSeed(`claim-${Math.floor(Date.now() / 1000)}`)
  const rng = makeRng(seedNum)

  let served = 0
  let lastAnswer = -1

  const build = (): Question => {
    // Difficulty ramps over the first ~14 questions and then holds. The game's
    // own ladder is what escalates after that; the host only has to keep up.
    const difficulty = Math.min(1, served / 14)
    const tier = difficulty < 0.34 ? 0 : difficulty < 0.7 ? 1 : 2
    const asPercent = served > 2 && rng.int(100) < 34

    let answer: number
    let prompt: string
    let pool: number[]

    if (asPercent) {
      const list = tier === 0 ? PERCENTS_EASY : tier === 1 ? PERCENTS_MID : PERCENTS_HARD
      const p = rng.pick(list)
      answer = percentOf(total, p)
      prompt = `${p}% of ${total}`
      pool = percentMalRules(total, p)
    } else {
      const list = tier === 0 ? EASY : tier === 1 ? MID : HARD
      const f = rng.pick(list)
      answer = partOf(total, f.n, f.d)
      prompt = `${f.n}/${f.d} of ${total}`
      pool = fractionMalRules(total, f.n, f.d)
    }

    served++
    return {
      id: `claim-q-${served}-${rng.state().toString(36)}`,
      prompt,
      answer: String(answer),
      distractors: distinct(answer, pool, 2, rng),
      domain: asPercent ? "percent-of-area" : "fraction-of-area",
      difficulty,
    }
  }

  return {
    next(): Question {
      // Never serve the same target twice running — a repeated goal reads as a
      // bug, and it wastes a rep.
      let q = build()
      for (let i = 0; i < 6 && Number(q.answer) === lastAnswer; i++) q = build()
      lastAnswer = Number(q.answer)
      return q
    },

    report(r): void {
      opts.onReport?.(r)
    },

    haptic(kind): void {
      // Degrade silently: a browser without the Vibration API just gets nothing.
      const nav = globalThis.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
      if (typeof nav?.vibrate !== "function") return
      const pattern =
        kind === "light"
          ? 8
          : kind === "medium"
            ? 18
            : kind === "heavy"
              ? [26, 30, 14]
              : kind === "success"
                ? [14, 40, 14, 40, 26]
                : [40, 60, 40]
      try {
        nav.vibrate(pattern)
      } catch {
        /* a vibration is never load-bearing */
      }
    },

    prefersReducedMotion(): boolean {
      if (typeof opts.reducedMotion === "boolean") return opts.reducedMotion
      return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    },
  }
}
