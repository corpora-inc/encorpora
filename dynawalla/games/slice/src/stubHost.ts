// A local stub Host so the game is playable standalone with `npm run dev`.
//
// Three properties the real runtime will also have to honour, and which are
// asserted by `src/test/stubHost.test.ts`:
//
//   1. **Exact arithmetic.** Every operand, answer and distractor is an
//      integer. No float ever reaches an answer string or a comparison.
//   2. **Seeded and deterministic.** Same seed → same question stream, forever.
//   3. **Distractors are real mal-rule outputs** — what a child who has a
//      specific broken procedure actually writes down. Not `answer + 1` noise.
//      A wrong slice in this game costs a lamp, so the wrong values have to be
//      the ones worth learning to reject.

import type { Host, Question } from "./contract.ts"
import { Rng } from "./core/rng.ts"

type Domain = "mul" | "add" | "sub" | "div"

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
    const d = ((x % 10) + (y % 10)) % 10
    out += d * place
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
    const dx = x % 10
    const dy = y % 10
    out += Math.abs(dx - dy) * place
    place *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

/** Multiplying by a two-digit number and adding only the units partial product. */
function mulForgotTensPartial(a: number, b: number): number {
  return a * (b % 10)
}

function malRulesFor(domain: Domain, a: number, b: number, answer: number): number[] {
  switch (domain) {
    case "mul":
      return [
        a * (b - 1), // slid one row up the times table
        a * (b + 1), // slid one row down
        a + b, // reached for the wrong operation
        mulForgotTensPartial(a, b),
        reverseDigits(answer),
        answer - a, // dropped the last addend of repeated addition
      ]
    case "add":
      return [
        addNoCarry(a, b),
        a + b - 10, // carried but never added the carry in
        a + b + 10, // carried twice
        Math.abs(a - b), // wrong operation
        reverseDigits(answer),
      ]
    case "sub":
      return [
        subSmallerFromLarger(a, b),
        a - b + 10, // borrowed without decrementing the next column
        a - b - 10, // decremented twice
        a + b, // wrong operation
        reverseDigits(answer),
      ]
    case "div":
      return [
        a - b, // wrong operation
        answer + 1, // off-by-one in the quotient, the classic estimation slip
        answer - 1,
        b, // read the divisor back out
        reverseDigits(answer),
      ]
  }
}

function operandsFor(domain: Domain, difficulty: number, rng: Rng): [number, number] {
  // difficulty is clamped to 1..10 and stretches the operand range. Answers stay
  // at three digits or fewer at every difficulty: a numeral in this game is read
  // at speed on a moving object and four digits is not legible at 320px.
  const d = Math.max(1, Math.min(10, Math.round(difficulty)))
  switch (domain) {
    case "mul": {
      const hi = 3 + d // 4..13
      const a = rng.int(2, hi)
      const b = rng.int(2, hi)
      return [a, b]
    }
    case "add": {
      const hi = 8 + d * 9 // 17..98
      return [rng.int(3, hi), rng.int(3, hi)]
    }
    case "sub": {
      const hi = 10 + d * 9 // 19..100
      const a = rng.int(6, hi)
      const b = rng.int(2, Math.max(2, a - 1))
      return [a, b]
    }
    case "div": {
      const hi = 3 + d // 4..13
      const b = rng.int(2, hi)
      const q = rng.int(2, hi)
      return [b * q, b]
    }
  }
}

function evaluate(domain: Domain, a: number, b: number): number {
  switch (domain) {
    case "mul":
      return a * b
    case "add":
      return a + b
    case "sub":
      return a - b
    case "div":
      return a / b // exact by construction: `a` was built as b * q
  }
}

const GLYPH: Record<Domain, string> = { mul: "×", add: "+", sub: "−", div: "÷" }

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  /** Observe reports — the dev harness draws a running accuracy readout from this. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Observe haptics so the harness can show they fired on a device that has none. */
  onHaptic?: (k: string) => void
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x5eed1ce)
  let n = 0
  const domains: Domain[] = ["mul", "mul", "add", "sub", "div"]

  return {
    next(o) {
      const difficulty = Math.max(1, Math.min(10, Math.round(o?.difficulty ?? 3)))
      const domain = (o?.domain as Domain | undefined) ?? rng.pick(domains)
      const [a, b] = operandsFor(domain, difficulty, rng)
      const answer = evaluate(domain, a, b)

      // Mal-rule outputs, deduped, filtered to values that are legal on screen:
      // a positive integer of at most three digits that is not the answer.
      const seen = new Set<number>([answer])
      const pool: number[] = []
      for (const v of malRulesFor(domain, a, b, answer)) {
        if (!Number.isInteger(v) || v < 1 || v > 999 || seen.has(v)) continue
        seen.add(v)
        pool.push(v)
      }
      rng.shuffle(pool)

      // Top up from near-misses if a particular (a, b) collapsed several
      // mal-rules onto the same value — 4 × 4 makes "one row up" and "one row
      // down" and the reversal all collide.
      for (let k = 1; pool.length < 3 && k < 40; k++) {
        for (const v of [answer + k, answer - k]) {
          if (pool.length >= 3) break
          if (!Number.isInteger(v) || v < 1 || v > 999 || seen.has(v)) continue
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
        console.warn("[slice] navigator.vibrate refused")
      }
    },

    prefersReducedMotion() {
      if (opts.reducedMotion !== undefined) return opts.reducedMotion
      return (
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    },
  }
}
