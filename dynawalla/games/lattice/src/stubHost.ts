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
//   3. **A named `difficulty` is a HINT, and it is clamped.** `dynawalla-app`'s
//      `items.next` honours it within `HINT_BAND` — one rung — of where the
//      host's own evidence stands, and clamps it there otherwise. See
//      `HINT_BAND` below: this is the one the stub did not model, and not
//      modelling it is how THE LATTICE shipped a screen with no ring on it.
//   4. **A named `maxDifficulty` or `minDifficulty` is a CAPABILITY, and it is
//      absolute.** The ceiling floors where the request rounds and the floor
//      ceils, both bind after the band and both beat it, because they are the
//      pack saying what it can physically draw rather than what it thinks the
//      child is ready for. Only the ceiling moves the child's ladder, and only
//      downward, and only when it bites.
//   5. **With nothing named, the rung is the host's own position**, and that
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
 * How far from its own evidence the host will follow a pack's `difficulty`.
 *
 * `dynawalla-app/src/packs/items.ts`, `HINT_BAND`, and it is **one rung**. This
 * constant is the whole reason the founder saw `NO RESONATOR — SWEEP ON` on a
 * fresh profile: THE LATTICE asks for rung 16 and up, the host's own `progress`
 * opens every session at 0, so every draw of every arming came back from rung 1
 * with an answer under seven — and nothing under twelve can carry a factor tree.
 * All six draws missed, the arena stalled, and the stall could not clear because
 * the only thing that moves `progress` is a report and the only thing that
 * produces a report is a resonator.
 *
 * A `minDifficulty` is the way out and it is not a way round: it is the pack
 * saying what it can physically draw, so the host honours it absolutely and
 * never moves the child's ladder for it.
 */
export const HINT_BAND = 1

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

/**
 * The largest operand a rung draws.
 *
 * The base is set by the header's last calibration point — **"past 999 from
 * about rung 47"** — and it is a statement about the *answer*, which is two
 * operands. `3 · 1.115^47` is 500, so rung 47 is where a sum first reaches a
 * thousand and rung 48 is where the game's `MAX_TARGET` stops being reachable.
 *
 * It was 1.125, and that put the sum past 999 from rung 44: at rung 47, 57% of
 * answers were over the ceiling and only 16% were resonant. Nothing noticed for
 * as long as nothing sat there. Modelling `HINT_BAND` put the game exactly
 * there — a standing `maxDifficulty` pulls the host's own ladder down onto it,
 * and the band then serves the two rungs either side of it and no others — and
 * ten minutes of perfect play went from ten seconds without a question to
 * eighty. That was the stub being wrong about the top of the ladder rather than
 * the game being wrong about anything: `game/ladder.ts`'s table, measured
 * against the shipped curriculum graph, has rung 46 at **57% usable**, and a
 * model that says 26% would have this pack tuned against a rung that does not
 * exist.
 */
export function operandCeilingAt(rung: number): number {
  const clamped = Math.max(0, Math.min(SPAN, Math.round(rung)))
  return Math.max(2, Math.round(3 * Math.pow(1.115, clamped)))
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
  onDraw?: (draw: {
    asked: number | null
    ceiling: number | null
    /** The render floor the pack stated, if any. See `band`. */
    bottom: number | null
    rung: number
    id: string
  }) => void
  /** Observe skips, so a test can hold the pack to closing what it discards. */
  onSkip?: (questionId: string) => void
  /**
   * Model `HINT_BAND` — the host's clamp on a pack's `difficulty`.
   *
   * **On by default, because the shipped host does it and this stub not doing it
   * is how THE LATTICE shipped with no resonator on the screen.** From host
   * 0.3.7 a `difficulty` is a *hint*, honoured only within one rung either side
   * of where the host's own evidence stands, and that evidence opens every
   * session at rung 0. A pack whose content sits above the child is therefore
   * starved unless it also states a `minDifficulty`, which is a capability and
   * is honoured absolutely. See `dynawalla-app/src/packs/items.ts`, `HINT_BAND`.
   *
   * Off only for the tests that are measuring the *pack's* own ladder in
   * isolation and need the rung they asked for.
   */
  band?: boolean
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
  const band = opts.band !== false

  /** Where the host's own ladder is, carried as a real number like `items.ts`. */
  let progress = standing === null ? 0 : standing * SPAN
  let step = STEP_START
  const served = new Map<string, { rung: number; digits: number }>()
  const rungs: number[] = []

  const host: StubHost = {
    next(o) {
      const asked = o?.difficulty === undefined ? standing : toUnit(o.difficulty)
      const ceiling = o?.maxDifficulty === undefined ? null : toUnit(o.maxDifficulty)
      const bottom = o?.minDifficulty === undefined ? null : toUnit(o.minDifficulty)
      // **The anchor: the rung the host's own evidence left the child on.** Read
      // once, before anything the pack asked for is looked at, and never written
      // back to from a request — which is what stops the band being a ratchet a
      // pack climbs one rung a question. See `items.next`.
      const anchor = Math.floor(progress)
      let rung = anchor
      if (asked !== null) {
        // A request *rounds* to the nearest rung and is then pulled inside the
        // band. With `band` off it is honoured as asked, which is the pre-0.3.7
        // wire and is only for tests measuring the pack's own ladder.
        const want = Math.round(asked * SPAN)
        rung = band ? Math.max(anchor - HINT_BAND, Math.min(anchor + HINT_BAND, want)) : want
      }
      if (ceiling !== null) {
        // The ceiling *floors* where the request rounds, exactly as `items.next`
        // does it: rounding a cap can only round it up, and a cap that can be
        // rounded over is not a cap. It binds after the band and it wins.
        const cap = Math.floor(ceiling * SPAN)
        rung = Math.min(rung, cap)
        // A standing ceiling pins the ladder itself, downward only and only when
        // it bites — a position above content the pack cannot draw is a fiction.
        if (cap < anchor) progress = Math.max(0, cap) + (progress - anchor)
      }
      if (bottom !== null) {
        // The floor *ceils*, for the mirror of the reason the cap floors, and it
        // wins over the band for the same reason the ceiling does: it is not a
        // pedagogy request, it is the pack saying what it can physically draw.
        // It never moves `progress` — the mirror write would let a pack promote
        // a child by declaring a manifest.
        const floor = Math.ceil(bottom * SPAN)
        rung = Math.max(rung, floor)
        // An empty window is a pack bug, and the ceiling wins it: serving above
        // what a pack can render is a blank screen in front of a child.
        if (ceiling !== null) rung = Math.min(rung, Math.floor(ceiling * SPAN))
      }
      rung = Math.max(0, Math.min(SPAN, rung))

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
      opts.onDraw?.({ asked, ceiling, bottom, rung, id })
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
