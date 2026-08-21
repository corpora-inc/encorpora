// A local stub Host so the game is playable standalone with `npm run dev`.
//
// It serves what the real host actually serves. Only the `add` domain has
// active rows in the curriculum graph, so this stub serves column addition and
// column subtraction and nothing else — a dev harness that fed multiplication
// would flatter the game with questions no child will ever be asked.
//
// Three properties the real runtime also honours, asserted by
// `src/test/stubHost.test.ts`:
//
//   1. **Exact arithmetic.** Every operand, answer and distractor is an
//      integer. No float ever reaches an answer string or a comparison.
//   2. **Seeded and deterministic.** Same seed → same question stream, forever.
//   3. **Distractors are real mal-rule outputs** — what a child with a specific
//      broken procedure writes down. Not `answer ± 1` noise. COLOSSUS stands
//      each one up as a slab a child can punch, so the wrong values have to be
//      the ones worth learning to reject.

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
      addNoCarry(a, b), // the carry never left the column it was made in
      answer - 10, // carried but never added the carry in
      answer + 10, // carried twice
      Math.abs(a - b), // reached for the wrong operation
      reverseDigits(answer),
    ]
  }
  return [
    subSmallerFromLarger(a, b),
    answer + 10, // borrowed without decrementing the next column
    answer - 10, // decremented twice
    a + b, // wrong operation
    reverseDigits(answer),
  ]
}

/** `difficulty` is 0..1, the same monotone reading of the ladder the host sends. */
function operandsFor(domain: Domain, difficulty: number, rng: Rng): [number, number] {
  const d = Math.max(0, Math.min(1, difficulty))
  const hi = Math.round(18 + d * 460) // 18..478
  if (domain === "add") return [rng.int(4, hi), rng.int(4, hi)]
  const a = rng.int(12, hi + 20)
  const b = rng.int(3, Math.max(3, a - 1))
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
  /** Observe stopping points, which a real host may put a sheet on top of. */
  onTransition?: (kind: string, label?: string) => void
  /** Pin the ladder instead of sweeping it. Useful for a screenshot. */
  difficulty?: number
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x5eed1ce)
  let n = 0

  return {
    next(o) {
      n++
      // Sweep the ladder across a session so the dev harness meets all three
      // slab tiers — one slab, then a pair, then a triple — the way a child
      // climbing the real ladder over weeks eventually does.
      const swept = opts.difficulty ?? Math.min(1, ((n - 1) % 24) / 20)
      const difficulty = Math.max(0, Math.min(1, o?.difficulty ?? swept))
      const domain: Domain = o?.domain === "sub" ? "sub" : rng.chance(0.45) ? "sub" : "add"
      const [a, b] = operandsFor(domain, difficulty, rng)
      const answer = domain === "add" ? a + b : a - b

      // Mal-rule outputs, deduped, filtered to values a slab can carry: a
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
        console.warn("[colossus] navigator.vibrate refused")
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
