// A local stub Host so the game is playable standalone with `npm run dev`.
//
// It serves what the real host serves: addition, subtraction and multiplication,
// which are the rows with `status: "active"` in the curriculum graph today. A dev
// harness that fed fractions would flatter the game with questions no child is
// asked, and a harness that fed only addition would hide the whole point of the
// board — the founder's example room is `12 + 5`, `3 × 5`, `8 × 1`, `15 − 2`, and
// mixed operations are what make the highest bid something you have to work out
// rather than something you can see.
//
// Four properties the real runtime also honours, asserted by
// `src/test/stubHost.test.ts`:
//
//   1. **Exact arithmetic.** Every operand, answer and distractor is an integer.
//      No float ever reaches an answer string or a comparison.
//   2. **Seeded and deterministic.** Same seed → same question stream, forever.
//   3. **Both difficulty scales are read the way `game-host` reads them** — a
//      value under 1 is a fraction, 1..10 is a ladder index — and `maxDifficulty`
//      is a ceiling the stream never crosses.
//   4. **Distractors are real mal-rule outputs**: what a child with a specific
//      broken procedure writes down, not `answer ± 1` noise. THE GAVEL does not
//      draw them, but the wire carries them and a stub that lies about the wire is
//      a stub that hides a defect.

import type { Ask, Host, Question } from "./contract.ts"
import { Rng } from "./core/rng.ts"

type Domain = "add" | "sub" | "mul"

/** Digit-reversal: 63 → 36. A real transcription slip, not noise. */
function reverseDigits(n: number): number {
  let out = 0
  let m = n
  while (m > 0) {
    out = out * 10 + (m % 10)
    m = Math.floor(m / 10)
  }
  return out
}

/** Column addition with every carry dropped: 27 + 15 → 32. */
function addNoCarry(a: number, b: number): number {
  let out = 0
  let place = 1
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    out += (((x % 10) + (y % 10)) % 10) * place
    place *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

/** The smaller-from-larger bug: 52 − 27 → 35, taking |2−7| in the ones column. */
function subSmallerFromLarger(a: number, b: number): number {
  let out = 0
  let place = 1
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    out += Math.abs((x % 10) - (y % 10)) * place
    place *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

function malRulesFor(domain: Domain, a: number, b: number, answer: number): number[] {
  if (domain === "add") {
    return [
      addNoCarry(a, b), // the carry never left the column it was made in
      answer - 10, // carried but never added the carry in
      answer + 10, // carried twice
      Math.abs(a - b), // reached for the wrong operation
      reverseDigits(answer),
    ]
  }
  if (domain === "sub") {
    return [
      subSmallerFromLarger(a, b),
      answer + 10, // borrowed without decrementing the next column
      answer - 10, // decremented twice
      a + b, // wrong operation
      reverseDigits(answer),
    ]
  }
  return [
    a + b, // reached for the wrong operation
    a * b - a, // one row of the table short
    a * b + a, // one row of the table long
    a * (b - 1) + 1, // lost the last group and put one back
    reverseDigits(answer),
  ]
}

/** `difficulty` is 0..1, the same monotone reading of the ladder the host sends. */
function operandsFor(domain: Domain, difficulty: number, rng: Rng): [number, number] {
  const d = Math.max(0, Math.min(1, difficulty))
  if (domain === "mul") {
    const hi = 3 + Math.round(d * 9)
    return [rng.int(2, hi), rng.int(2, hi)]
  }
  const hi = Math.round(14 + d * 300)
  if (domain === "add") return [rng.int(3, hi), rng.int(3, hi)]
  const a = rng.int(10, hi + 20)
  const b = rng.int(2, Math.max(2, a - 1))
  return [a, b]
}

const GLYPH: Record<Domain, string> = { add: "+", sub: "−", mul: "×" }

/**
 * A game's difficulty number as a 0..1 ladder position.
 *
 * The rule `game-host` states and tests: under 1 is a fraction, 1..10 is a ladder
 * index, and exactly 1 is read as the BOTTOM. Copied rather than imported so the
 * dev harness reproduces the ambiguity the shipped app has rather than a kinder
 * version of it.
 */
export function toUnit(value: number | undefined): number | null {
  if (value === undefined || typeof value !== "number" || !Number.isFinite(value)) return null
  if (value < 1) return Math.max(0, value)
  return Math.min(1, (value - 1) / 9)
}

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  /** Observe reports — the dev harness draws a running accuracy readout from this. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Observe skips, so a harness can show the questions a round closed unanswered. */
  onSkip?: (questionId: string) => void
  /** Observe haptics so the harness can show they fired on a device that has none. */
  onHaptic?: (k: string) => void
  /** Observe stopping points, which a real host may put a sheet on top of. */
  onTransition?: (kind: string, label?: string) => void
  /** Pin the ladder instead of following what the game asks for. */
  difficulty?: number
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x5eed1ce)
  let n = 0
  let ceiling: number | null = null

  return {
    next(ask?: Ask) {
      n++
      const asked = toUnit(ask?.maxDifficulty)
      if (asked !== null) ceiling = asked
      const wanted = toUnit(ask?.difficulty) ?? 0
      const pinned = opts.difficulty === undefined ? null : toUnit(opts.difficulty)
      const target = pinned ?? wanted
      const difficulty = ceiling === null ? target : Math.min(target, ceiling)

      const roll = rng.next()
      const domain: Domain = roll < 0.42 ? "add" : roll < 0.72 ? "sub" : "mul"
      const [a, b] = operandsFor(domain, difficulty, rng)
      const answer = domain === "add" ? a + b : domain === "sub" ? a - b : a * b

      // Mal-rule outputs, deduped, filtered to values that could be a price: a
      // positive integer that is not the answer.
      const seen = new Set<number>([answer])
      const pool: number[] = []
      for (const v of malRulesFor(domain, a, b, answer)) {
        if (!Number.isInteger(v) || v < 1 || v > 9999 || seen.has(v)) continue
        seen.add(v)
        pool.push(v)
      }
      rng.shuffle(pool)

      // Top up from near-misses when a particular (a, b) collapsed several
      // mal-rules onto one value.
      for (let k = 1; pool.length < 3 && k < 40; k++) {
        for (const v of [answer + k, answer - k]) {
          if (pool.length >= 3) break
          if (!Number.isInteger(v) || v < 1 || v > 9999 || seen.has(v)) continue
          seen.add(v)
          pool.push(v)
        }
      }

      return {
        id: `stub-${String(n)}`,
        prompt: `${String(a)} ${GLYPH[domain]} ${String(b)}`,
        answer: String(answer),
        distractors: pool.slice(0, 3).map(String),
        domain,
        difficulty,
      } satisfies Question
    },

    report(r) {
      opts.onReport?.(r)
    },

    skip(questionId) {
      opts.onSkip?.(questionId)
    },

    haptic(k) {
      opts.onHaptic?.(k)
      const nav = globalThis.navigator as Navigator | undefined
      if (!nav || typeof nav.vibrate !== "function") return
      const ms =
        k === "light" ? 8 : k === "medium" ? 18 : k === "heavy" ? 34 : k === "success" ? 12 : 40
      try {
        if (k === "success") nav.vibrate([ms, 26, ms])
        else if (k === "failure") nav.vibrate([ms, 40, ms])
        else nav.vibrate(ms)
      } catch {
        // A browser that exposes vibrate but refuses it (no user gesture yet, or a
        // policy block) must never take the frame down with it.
        console.warn("[gavel] navigator.vibrate refused")
      }
    },

    prefersReducedMotion() {
      if (opts.reducedMotion !== undefined) return opts.reducedMotion
      return (
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    },

    transition(kind, label) {
      opts.onTransition?.(kind, label)
    },
  }
}
