// A local stub Host so the game is playable standalone with `npm run dev`.
//
// Three properties the real runtime also honours, each asserted by
// `src/test/stubHost.test.ts`:
//
//   1. **Exact arithmetic.** Every operand, answer and distractor is an
//      integer. No float ever reaches an answer string or a comparison.
//   2. **Seeded and deterministic.** Same seed → same question stream, forever.
//   3. **Distractors are real mal-rule outputs** — what a child with a specific
//      broken procedure actually writes down. Never `answer ± 1` noise. THE
//      LATTICE seeds the field so one of them is assemblable, so these values
//      are the wrong answers the game is actually able to hear.

import type { Host, Question } from "./contract.ts"
import { Rng } from "./core/rng.ts"

type Domain = "add" | "sub"

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

function malRulesFor(domain: Domain, a: number, b: number, answer: number): number[] {
  switch (domain) {
    case "add":
      return [
        addNoCarry(a, b),
        a + b - 10, // carried but never added the carry in
        a + b + 10, // carried twice
        Math.abs(a - b), // reached for the wrong operation
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
  }
}

function operandsFor(domain: Domain, difficulty: number, rng: Rng): [number, number] {
  // `difficulty` is clamped to 1..10 and stretches the operand range. Answers
  // stay under four digits at every difficulty: a resonator numeral is read at
  // speed while the arena is moving, and the primes behind a four-digit answer
  // are too many motes to hold.
  const d = Math.max(1, Math.min(10, Math.round(difficulty)))
  switch (domain) {
    case "add": {
      const hi = 8 + d * 9 // 17..98
      return [rng.int(3, hi), rng.int(3, hi)]
    }
    case "sub": {
      const hi = 12 + d * 9 // 21..102
      const a = rng.int(8, hi)
      const b = rng.int(2, Math.max(2, a - 2))
      return [a, b]
    }
  }
}

function evaluate(domain: Domain, a: number, b: number): number {
  return domain === "add" ? a + b : a - b
}

const GLYPH: Record<Domain, string> = { add: "+", sub: "−" }

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  difficulty?: number
  /** Observe reports — the dev harness draws a running accuracy readout. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Observe haptics so the harness shows they fired on a device that has none. */
  onHaptic?: (k: string) => void
  /** Observe stopping points. The real host may sheet the frame on one. */
  onTransition?: (kind: string, label?: string) => void
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x1a771ce)
  let n = 0
  const domains: Domain[] = ["add", "add", "sub"]

  const host: Host = {
    next(o) {
      const difficulty = Math.max(
        1,
        Math.min(10, Math.round(o?.difficulty ?? opts.difficulty ?? 3)),
      )
      const domain = (o?.domain as Domain | undefined) ?? rng.pick(domains)
      const [a, b] = operandsFor(domain, difficulty, rng)
      const answer = evaluate(domain, a, b)

      // Mal-rule outputs, deduped, filtered to values a resonator could legally
      // ask for: a positive integer of at most four digits that is not the
      // answer and is not 1 (a resonator asking for 1 opens to an empty hold).
      const seen = new Set<number>([answer])
      const pool: number[] = []
      for (const v of malRulesFor(domain, a, b, answer)) {
        if (!Number.isInteger(v) || v < 2 || v > 9999 || seen.has(v)) continue
        seen.add(v)
        pool.push(v)
      }
      rng.shuffle(pool)

      n++
      return {
        id: `stub-${n}`,
        prompt: `${a} ${GLYPH[domain]} ${b}`,
        answer: String(answer),
        distractors: pool.slice(0, 3).map(String),
        domain,
        difficulty: Math.max(0, Math.min(1, difficulty / 10)),
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
      } catch (error) {
        // A browser that exposes vibrate but refuses it (no user gesture yet,
        // or a policy block) must never take the frame down with it.
        console.warn("[lattice] navigator.vibrate refused", error)
      }
    },

    prefersReducedMotion() {
      if (opts.reducedMotion !== undefined) return opts.reducedMotion
      return (
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    },
  }

  // Optional on the contract and feature-detected by the game, so it is only
  // present when the harness asked to watch it — which is what makes the
  // game's `host.transition?.()` call path real rather than assumed.
  if (opts.onTransition) {
    host.transition = (kind, label) => {
      opts.onTransition?.(kind, label)
    }
  }

  return host
}
