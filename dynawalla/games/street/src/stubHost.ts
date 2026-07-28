// A local stub Host so the game is playable standalone with `npm run dev`.
//
// It serves what the shipped curriculum actually serves: whole-number column
// addition and subtraction, the `add` domain, because that is the only domain
// with `active` rows in it. Nothing here is a claim about coverage — the real
// host owns the ladder — it is a claim about *shape*, so that the plate the
// harness draws is the plate a tablet draws.
//
// Three properties the real runtime also honours, asserted by
// `src/stubHost.test.ts`:
//
//   1. **Exact arithmetic.** Every operand, answer and distractor is an
//      integer. No float ever reaches an answer string or a comparison.
//   2. **Seeded and deterministic.** Same seed → same question stream, forever.
//   3. **Distractors are real mal-rule outputs** — what a child running a
//      specific broken procedure writes down. Not `answer ± 1` noise. Dropping
//      a carry, taking the smaller digit from the larger, borrowing without
//      decrementing the column you borrowed from, and reaching for the wrong
//      operation are the four that account for most of what goes on a page.

import type { Host, Question } from "./contract.ts"
import { Rng } from "./core/rng.ts"

type Domain = "add" | "sub"

/** Digit-reversal: 63 → 36. A transcription slip, not noise. */
function reverseDigits(n: number): number {
  let out = 0
  let m = Math.abs(n)
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
    out += ((x % 10) + (y % 10)) % 10 * place
    place *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

/** The smaller-from-larger bug: 52 − 27 → 35, taking |2 − 7| in the ones. */
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

/**
 * Borrowing without decrementing the column borrowed from: every column that
 * needed a regroup gets its ten and the next column is left untouched.
 */
function subBorrowNoDecrement(a: number, b: number): number {
  let out = 0
  let place = 1
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    const dx = x % 10
    const dy = y % 10
    out += (dx < dy ? dx + 10 - dy : dx - dy) * place
    place *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

function malRulesFor(domain: Domain, a: number, b: number, answer: number): number[] {
  if (domain === "add") {
    return [
      addNoCarry(a, b),
      answer - 10, // carried, never added the carry in
      answer + 10, // carried twice
      Math.abs(a - b), // reached for the wrong operation
      reverseDigits(answer),
    ]
  }
  return [
    subSmallerFromLarger(a, b),
    subBorrowNoDecrement(a, b),
    answer + 10, // decremented nothing after the borrow
    a + b, // reached for the wrong operation
    reverseDigits(answer),
  ]
}

/**
 * Operands by difficulty, in the shape of the `add` domain's level tables:
 * two digits without regrouping at the bottom, three and four digits with
 * regrouping at the top. Every result is a positive integer.
 */
function operandsFor(domain: Domain, difficulty: number, rng: Rng): [number, number] {
  const d = Math.max(1, Math.min(10, Math.round(difficulty)))
  const hi = d <= 2 ? 49 : d <= 4 ? 99 : d <= 7 ? 499 : 4999
  if (domain === "add") {
    const a = rng.int(d <= 2 ? 11 : 12, hi)
    const b = rng.int(d <= 2 ? 11 : 12, hi)
    return [a, b]
  }
  const a = rng.int(Math.max(21, Math.floor(hi / 3)), hi)
  const b = rng.int(11, Math.max(12, a - 1))
  return [a, b]
}

const GLYPH: Record<Domain, string> = { add: "+", sub: "−" }

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  /** Observe reports — the dev harness draws a running accuracy readout from this. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Observe haptics so the harness can show they fired on a device that has none. */
  onHaptic?: (k: string) => void
  /** Observe stopping points, which a real host may answer with a sheet. */
  onTransition?: (kind: string, label?: string) => void
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x57ee7)
  let n = 0

  return {
    next(o) {
      const difficulty = Math.max(1, Math.min(10, Math.round(o?.difficulty ?? 3)))
      const domain: Domain = rng.chance(0.5) ? "add" : "sub"
      const [a, b] = operandsFor(domain, difficulty, rng)
      const answer = domain === "add" ? a + b : a - b

      // Mal-rule outputs, deduped, filtered to values that are legal on a
      // rivet: a positive integer that is not the answer.
      const seen = new Set<number>([answer])
      const pool: number[] = []
      for (const v of malRulesFor(domain, a, b, answer)) {
        if (!Number.isInteger(v) || v < 1 || seen.has(v)) continue
        seen.add(v)
        pool.push(v)
      }
      rng.shuffle(pool)

      // Top up from near-misses when a particular (a, b) collapsed several
      // mal-rules onto the same value.
      for (let k = 1; pool.length < 3 && k < 40; k++) {
        for (const v of [answer + k, answer - k]) {
          if (pool.length >= 3) break
          if (!Number.isInteger(v) || v < 1 || seen.has(v)) continue
          seen.add(v)
          pool.push(v)
        }
      }

      n++
      return {
        id: `stub-${n}`,
        prompt: `${a} ${GLYPH[domain]} ${b}`,
        answer: String(answer),
        distractors: pool.slice(0, 3).map(String),
        domain,
        difficulty,
      } satisfies Question
    },

    report(r) {
      opts.onReport?.(r)
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
        // A browser that exposes vibrate but refuses it (no user gesture yet,
        // or a policy block) must never take the frame down with it.
        console.warn("[street] navigator.vibrate refused")
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
