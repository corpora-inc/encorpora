// A local stub Host so the game is playable standalone with `npm run dev`, and
// so the one thing this pack most needed to measure can be measured: **which
// rung of the host's ladder the game is actually playing on.**
//
// It used to be a difficulty knob from 1 to 10 that stretched an operand range.
// That is not the shape the runtime has, and it is why "the game never passes a
// difficulty" could sit in this package unnoticed: there was nothing here that a
// missing request would look wrong against. So the stub now models the wire:
//
//   1. **Sixty-six rungs**, the length of the shipped ladder.
//   2. **`toUnit`**, character for character the reading in
//      `packs/shared/game-host` — under 1 is a fraction, 1 or over is a ladder
//      index — so a request written here means what it means there.
//   3. **A named `difficulty` lands on exactly one rung.** `dynawalla-app`'s
//      `items.next` spreads a rung *only* when the pack named none; a pack that
//      drives its own difficulty is honoured as the point it asked for. So is
//      `maxDifficulty`, which floors rather than rounds.
//   4. **With nothing named, the rung is the host's own position**, and that
//      moves on `report` through the shipped staircase: an opening stride of four
//      rungs decaying by 0.72 toward one, a correct answer worth
//      `min(1, tail/latency)` of a stride, a wrong one worth a whole one down.
//      This is the part that makes a silent pack measurable — it is exactly the
//      mechanism that carried THE LATTICE from rung 0 to rung 49 and off the top
//      of its own usable band inside a hundred seconds.
//
// And the three promises it always kept, asserted by `src/test/stubHost.test.ts`:
// exact integers everywhere, seeded and deterministic forever, and distractors
// that are real mal-rule outputs rather than `answer ± 1` noise.
//
// The rung → operand-size curve is a smooth exponential rather than a copy of
// the shipped skill table. That is a deliberate simplification and it is the
// conservative one: the real ladder interleaves addition, multiplication and
// division, so its answer sizes are *not* monotone, and a monotone stub can
// never let a low rung hide a big answer from a test. Calibrated so the bands
// land where they land in the product — single digits at the bottom, two-digit
// sums around rung 18, three-digit around rung 30, past 999 from about rung 47.

import type { Host, Question } from "./contract.ts"
import { Rng } from "./core/rng.ts"

type Domain = "add" | "sub"

/** The shipped ladder's length. A request is a 0..1 position on it. */
export const RUNGS = 66
const SPAN = RUNGS - 1

/**
 * A difficulty on whichever of the two scales the caller speaks, as 0..1.
 *
 * The same rule as `packs/shared/game-host`, including its one ambiguous value:
 * `1` is read as the *bottom* of the ladder index scale and not the top of the
 * fraction scale, because serving the hardest content in the product to a child
 * who has just started is the failure the whole wire exists to prevent.
 */
export function toUnit(value: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (value < 1) return Math.max(0, value)
  return Math.min(1, (value - 1) / 9)
}

/** The largest operand a rung draws. */
export function operandCeilingAt(rung: number): number {
  const clamped = Math.max(0, Math.min(SPAN, Math.round(rung)))
  return Math.max(2, Math.round(3 * Math.pow(1.125, clamped)))
}

/** The staircase's constants, from `dynawalla-app/src/packs/items.ts`. */
const STEP_START = 4
const STEP_OPEN = 1
const STEP_DECAY = 0.72

/** The cadence table's p90, which is what a correct answer is measured against. */
function tailMsFor(digits: number): number {
  return digits <= 1 ? 6_000 : 14_000 + 13_000 * (digits - 2)
}

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

function operandsFor(domain: Domain, rung: number, rng: Rng): [number, number] {
  const hi = operandCeilingAt(rung)
  // A floor under the operands as well as a ceiling, because column arithmetic
  // is `40 + 51` and not `1 + 2`: without one, a two-digit rung spends a third of
  // its draws on single-digit sums and the rung stops meaning anything.
  const lo = Math.max(1, Math.round(hi * 0.35))
  switch (domain) {
    case "add":
      return [rng.int(lo, hi), rng.int(lo, hi)]
    case "sub": {
      const a = rng.int(lo, hi)
      const b = rng.int(1, Math.max(1, a - 1))
      return [a, b]
    }
  }
}

function evaluate(domain: Domain, a: number, b: number): number {
  return domain === "add" ? a + b : a - b
}

function digitsOf(n: number): number {
  return String(Math.abs(Math.round(n))).length
}

const GLYPH: Record<Domain, string> = { add: "+", sub: "−" }

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  /**
   * A standing difficulty, on either scale, for a caller that names none per
   * question. Absent, the stub opens at the bottom of the ladder like the real
   * host does — which is the whole point: a game that asks for nothing gets
   * `2 + 0` until the host's own staircase carries it somewhere else.
   */
  difficulty?: number
  /** Observe reports — the dev harness draws a running accuracy readout. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Observe haptics so the harness shows they fired on a device that has none. */
  onHaptic?: (k: string) => void
  /** Observe stopping points. The real host may sheet the frame on one. */
  onTransition?: (kind: string, label?: string) => void
  /** Observe every draw: what was asked for, and which rung answered. */
  onDraw?: (draw: { asked: number | null; ceiling: number | null; rung: number; id: string }) => void
  /** Observe skips, so a test can hold the pack to closing what it discards. */
  onSkip?: (questionId: string) => void
}

/** What the stub is willing to say about itself, for the tests that measure it. */
export type StubHost = Host & {
  /** The rung the host's own ladder is standing on, as an index. */
  position(): number
  /** Every rung actually served, in order. */
  servedRungs(): readonly number[]
  /** Question ids handed out and never answered or skipped. */
  openItems(): readonly string[]
}

export function createStubHost(opts: StubHostOptions = {}): StubHost {
  const rng = new Rng(opts.seed ?? 0x1a771ce)
  let n = 0
  const domains: Domain[] = ["add", "add", "sub"]
  const standing = opts.difficulty === undefined ? null : toUnit(opts.difficulty)

  /** Where the host's own ladder is, carried as a real number like `items.ts`. */
  let progress = standing === null ? 0 : standing * SPAN
  let step = STEP_START
  const served = new Map<string, { rung: number; digits: number }>()
  const rungs: number[] = []

  const host: StubHost = {
    next(o) {
      const asked = o?.difficulty === undefined ? standing : toUnit(o.difficulty)
      const ceiling = o?.maxDifficulty === undefined ? null : toUnit(o.maxDifficulty)
      let rung = Math.floor(progress)
      // Either field moves the rung, which is `items.next`'s own gate: a request
      // that names only a ceiling still has to be honoured, or the ceiling half of
      // the wire is modelled by nothing.
      if (asked !== null || ceiling !== null) {
        // The ceiling *floors* and the request *rounds*, exactly as `items.next`
        // does it: rounding a cap can only round it up, and a cap that can be
        // rounded over is not a cap.
        const cap = ceiling === null ? SPAN : Math.floor(ceiling * SPAN)
        // With no `difficulty` named, `items.next` reads the ladder's own position
        // as the request and then applies the cap to it.
        const want = asked === null ? Math.floor(progress) / Math.max(1, SPAN) : asked
        rung = Math.max(0, Math.min(SPAN, cap, Math.round(want * SPAN)))
        // The whole number the pack named, keeping the fraction already earned
        // toward the next rung.
        progress = rung + (progress - Math.floor(progress))
      }

      const domain = (o?.domain as Domain | undefined) ?? rng.pick(domains)
      const [a, b] = operandsFor(domain, rung, rng)
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
      const id = `stub-${n}`
      served.set(id, { rung, digits: Math.max(digitsOf(a), digitsOf(b)) })
      rungs.push(rung)
      opts.onDraw?.({ asked, ceiling, rung, id })
      return {
        id,
        prompt: `${a} ${GLYPH[domain]} ${b}`,
        answer: String(answer),
        distractors: pool.slice(0, 3).map(String),
        domain,
        difficulty: rung / SPAN,
      } satisfies Question
    },

    report(r) {
      const entry = served.get(r.questionId)
      // Once per item, like the real host: an id already answered or skipped, or
      // one that was never served, moves nothing.
      if (entry) {
        served.delete(r.questionId)
        if (r.correct) {
          const gain = Math.min(1, tailMsFor(entry.digits) / Math.max(1, r.ms))
          progress += gain * step
        } else {
          progress -= step
        }
        step = Math.max(STEP_OPEN, STEP_OPEN + (step - STEP_OPEN) * STEP_DECAY)
        progress = Math.max(0, Math.min(SPAN, progress))
      }
      opts.onReport?.(r)
    },

    skip(questionId) {
      // Closed and recorded as nothing: no outcome, no ladder movement. A skip
      // that moved the ladder would be a wrong answer for a question the child
      // was never shown.
      served.delete(questionId)
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

    position() {
      return Math.floor(progress)
    },

    servedRungs() {
      return rungs
    },

    openItems() {
      return [...served.keys()]
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
