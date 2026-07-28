// A local stub Host so the game is playable standalone with `npm run dev`.
//
// It serves what the live curriculum serves. Only the `add` domain has active
// rows — whole-number column addition and subtraction, with and without
// regrouping — so this stub serves exactly that and nothing else. A stub that
// handed out division while the ladder cannot is a stub that lies about the
// game, and the first thing anyone would notice on a real device is that the
// mathematics changed.
//
// Three properties the real runtime also honours, all asserted in
// `src/test/stubHost.test.ts`:
//
//   1. **Exact arithmetic.** Every operand, answer and distractor is an
//      integer. No float ever reaches an answer string or a comparison.
//   2. **Seeded and deterministic.** Same seed → same question stream, forever.
//   3. **Distractors are real mal-rule outputs** — what a child running a
//      specific broken procedure actually writes down. Not `answer + 1` noise.

import type { Host, Question } from "./contract.ts"
import { Rng } from "./core/rng.ts"

type Domain = "add" | "sub"

/** Digit-reversal: 63 → 36. A real transcription slip. */
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
    out += ((x % 10) + (y % 10)) % 10 * place
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
      addNoCarry(a, b), // wrote the carry down and never added it in
      answer - 10, // carried, then dropped the carry in the tens
      answer + 10, // carried twice
      answer - 100, // the same slip a column further left
      Math.abs(a - b), // reached for the wrong operation
      reverseDigits(answer),
    ]
  }
  return [
    subSmallerFromLarger(a, b), // took the small digit from the large one
    answer + 10, // borrowed without decrementing the next column
    answer - 10, // decremented twice
    answer + 100, // the same slip a column further left
    a + b, // wrong operation
    reverseDigits(answer),
  ]
}

function operandsFor(domain: Domain, difficulty: number, rng: Rng): [number, number] {
  // Difficulty is clamped to 1..10 and stretches the operand range, walking the
  // active ladder: two digits without regrouping at the bottom, three digits
  // with it at the top. Answers stay at three digits, because a numeral on an
  // automaton is read at speed and four digits is not legible at 320px.
  const d = Math.max(1, Math.min(10, Math.round(difficulty)))
  if (domain === "add") {
    const hi = 12 + d * 45 // 57..462
    return [rng.int(6, hi), rng.int(6, hi)]
  }
  const hi = 24 + d * 60 // 84..624
  const a = rng.int(14, hi)
  const b = rng.int(4, Math.max(5, a - 2))
  return [a, b]
}

const GLYPH: Record<Domain, string> = { add: "+", sub: "−" }

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  /** Observe reports — the dev harness draws a running accuracy readout. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Observe haptics so the harness can show they fired on a device with none. */
  onHaptic?: (k: string) => void
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0xbea3)
  let n = 0
  const domains: Domain[] = ["add", "add", "sub"]

  return {
    next(o) {
      const difficulty = Math.max(1, Math.min(10, Math.round(o?.difficulty ?? 3)))
      const domain = (o?.domain as Domain | undefined) ?? rng.pick(domains)
      const [a, b] = operandsFor(domain, difficulty, rng)
      const answer = domain === "add" ? a + b : a - b

      // Mal-rule outputs, deduped, filtered to values that are legal on a hull:
      // a positive integer of at most three digits that is not the answer.
      const seen = new Set<number>([answer])
      const pool: number[] = []
      for (const v of malRulesFor(domain, a, b, answer)) {
        if (!Number.isInteger(v) || v < 2 || v > 999 || seen.has(v)) continue
        seen.add(v)
        pool.push(v)
      }
      rng.shuffle(pool)

      // Top up from place-value slips if a particular (a, b) collapsed several
      // mal-rules onto the same value — 30 + 30 makes "no carry" and the answer
      // and the reversal all collide.
      for (const k of [20, 30, 90, 200, 11, 9]) {
        if (pool.length >= 3) break
        for (const v of [answer + k, answer - k]) {
          if (pool.length >= 3) break
          if (!Number.isInteger(v) || v < 2 || v > 999 || seen.has(v)) continue
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
        console.warn("[beam] navigator.vibrate refused")
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
