// The reaction tiers, and their millisecond budgets.
//
// This is the file the rest of the kit exists to serve. A prototype author
// writes `feel.react("snap")` and gets a tuned, coherent, seven-system response
// — shake, kick, hitstop, flash, squash, haptic, tone — that is correct on a
// 60 Hz phone and a 120 Hz iPad, and that a child can interrupt.
//
// ## Three separate clocks, and only one of them may ever block
//
//   verdictMs    when the child can SEE the answer was right. Always one frame.
//                Not tunable, not tiered, not negotiable. Every tier is 0 here
//                because the verdict paints on the next frame and the flourish
//                is what comes after it.
//   blockingMs   how long input is refused. **Zero for every tier but the
//                rarest one**, and even that one is skippable by tapping. This
//                single column is the difference between a product a fast child
//                loves and a product a fast child fights.
//   tailMs       how long the flourish keeps drawing. It plays *over* the next
//                problem — the next problem presents concurrently with the
//                tail. A tail is not a wait.
//
// The failure this prevents is the standard one: a designer wants the
// celebration to land, so the input handler is gated on the animation's
// completion, and now the child who knows 7×8 is made to watch 900 ms of
// brass every three seconds. That child stops being fast, because being fast
// stopped being rewarded. `tiers.test.ts` asserts `blockingMs === 0` for
// everything below `ascend`.
//
// ## Hitstop is only ever spent on success
//
// A freeze frame is a reward. Spending one on a wrong answer makes the retry
// slower at the exact moment a child needs the loop to be fastest, and it
// dignifies the mistake with the vocabulary of impact. `nudge` gets a
// directional kick instead: a one-way bump that says "that did not seat"
// without stopping the world. Asserted.
//
// ## Escalation keys on difficulty and repair, never on run length
//
// Inherited from MISSION.md and kept deliberately across the visual-direction
// change. `chooseTier` takes an outcome with no streak, no combo and no session
// counter, and there is nowhere to smuggle one in because the input type is the
// entire surface. The juice got much louder; the thing it is loud *about* did
// not change.

import type { HapticStyle } from "./haptics.ts"

export type TierName = "nudge" | "tick" | "snap" | "pop" | "slam" | "bloom" | "ascend"

export interface FeelTier {
  readonly name: TierName
  /** −1 is below the resting state; 5 is the top of the ladder. */
  readonly level: number

  /** Frames until the verdict is visible. Always 0 — see the header. */
  readonly verdictMs: 0
  /** Input refused for this long. 0 everywhere but `ascend`. */
  readonly blockingMs: number
  /** Total flourish length. Plays over the next problem. */
  readonly tailMs: number

  /** Wall-clock world freeze. Never frame-counted. */
  readonly hitstopMs: number
  /** Trauma added, 0…1. Visible amplitude is the square. */
  readonly trauma: number
  /**
   * Peak camera recoil, in **world units of displacement** — not raw impulse.
   *
   * `Kick.add` normalises through `Spring1D.impulseForPeak`, so 0.3 here means
   * the camera really moves 0.3 units at the peak. Before that normalisation
   * existed these numbers were arbitrary, and as measured the effect was ~250×
   * smaller than the number read. At the demo's camera distance the visible
   * half-height is ~3.7 units, so `ascend`'s 0.3 is an 8% frame displacement.
   */
  readonly kick: number
  /** Screen-space flash peak, 0…1. */
  readonly flash: number
  /** Flash colour as linear RGB. Warm for success, amber for a nudge. */
  readonly flashColor: readonly [number, number, number]
  /** World time scale during the moment. 1 = no slow-motion. */
  readonly timeScale: number
  /** ms for the time scale to ease back to 1. */
  readonly timeRecoverMs: number
  /** Particles emitted at peak, before the quality governor scales it. */
  readonly particles: number
  /** Scale overshoot on the thing that was hit. 1.18 = 18% bigger at peak. */
  readonly punchScale: number
  readonly haptic: HapticStyle | null
  /** Semitones above the pentatonic root. `null` for silence. */
  readonly tone: number | null
  /** Only one of these per session. */
  readonly oncePerSession: boolean
}

/**
 * The table.
 *
 * The numbers are a ladder, not seven independent choices: every column is
 * monotonic from `tick` to `ascend`, which is what makes the escalation legible
 * as escalation rather than as seven unrelated effects. `nudge` sits outside
 * the ladder deliberately and is measured against `snap`, not against `tick`.
 */
export const TIERS: Readonly<Record<TierName, FeelTier>> = {
  /** Wrong. Fast, warm, unambiguous, and over before the child is embarrassed. */
  nudge: {
    name: "nudge",
    level: -1,
    verdictMs: 0,
    blockingMs: 0,
    tailMs: 300,
    hitstopMs: 0,
    trauma: 0.16,
    kick: 0.045,
    flash: 0.1,
    flashColor: [1, 0.62, 0.22],
    timeScale: 1,
    timeRecoverMs: 0,
    particles: 0,
    punchScale: 0.94,
    haptic: "warning",
    tone: -5,
    oncePerSession: false,
  },

  /** A digit landed in the answer box. The smallest thing that responds. */
  tick: {
    name: "tick",
    level: 0,
    verdictMs: 0,
    blockingMs: 0,
    tailMs: 90,
    hitstopMs: 0,
    trauma: 0.05,
    kick: 0.012,
    flash: 0,
    flashColor: [1, 1, 1],
    timeScale: 1,
    timeRecoverMs: 0,
    particles: 0,
    punchScale: 1.06,
    haptic: "light",
    tone: 0,
    oncePerSession: false,
  },

  /**
   * Ordinary correct. **The most important row in the table**, because it is
   * ~85% of everything a child ever sees. 220 ms of tail, zero hitstop, zero
   * blocking: a child who answers in 1.4 s never once waits on this.
   */
  snap: {
    name: "snap",
    level: 1,
    verdictMs: 0,
    blockingMs: 0,
    tailMs: 220,
    hitstopMs: 0,
    trauma: 0.14,
    kick: 0.035,
    flash: 0.12,
    flashColor: [1, 0.93, 0.72],
    timeScale: 1,
    timeRecoverMs: 0,
    particles: 8,
    punchScale: 1.16,
    haptic: "light",
    tone: 7,
    oncePerSession: false,
  },

  /** Correct on a hard item. The first tier that freezes the world at all. */
  pop: {
    name: "pop",
    level: 2,
    verdictMs: 0,
    blockingMs: 0,
    tailMs: 400,
    hitstopMs: 40,
    trauma: 0.3,
    kick: 0.075,
    flash: 0.24,
    flashColor: [1, 0.9, 0.66],
    timeScale: 1,
    timeRecoverMs: 0,
    particles: 22,
    punchScale: 1.3,
    haptic: "medium",
    tone: 12,
    oncePerSession: false,
  },

  /** You got right the thing you used to get wrong. The repair tier. */
  slam: {
    name: "slam",
    level: 3,
    verdictMs: 0,
    blockingMs: 0,
    tailMs: 700,
    hitstopMs: 75,
    trauma: 0.46,
    kick: 0.13,
    flash: 0.36,
    flashColor: [1, 0.86, 0.6],
    timeScale: 0.72,
    timeRecoverMs: 180,
    particles: 48,
    punchScale: 1.42,
    haptic: "heavy",
    tone: 16,
    oncePerSession: false,
  },

  /** A thing in the world completed. A lamp lit, a stall built, a bell hung. */
  bloom: {
    name: "bloom",
    level: 4,
    verdictMs: 0,
    blockingMs: 0,
    tailMs: 1500,
    hitstopMs: 110,
    trauma: 0.62,
    kick: 0.2,
    flash: 0.5,
    flashColor: [1, 0.84, 0.55],
    timeScale: 0.5,
    timeRecoverMs: 260,
    particles: 110,
    punchScale: 1.55,
    haptic: "success",
    tone: 19,
    oncePerSession: false,
  },

  /**
   * The one enormous thing. Once a session, and the only tier permitted to
   * block — for 350 ms, and a tap skips it. Everything the kit can do fires at
   * once here, which is the point: it has to be obviously different in kind,
   * not just in amount, or "rare" reads as "slightly longer".
   */
  ascend: {
    name: "ascend",
    level: 5,
    verdictMs: 0,
    blockingMs: 350,
    tailMs: 2800,
    hitstopMs: 160,
    trauma: 0.85,
    kick: 0.3,
    flash: 0.7,
    flashColor: [1, 0.82, 0.5],
    timeScale: 0.32,
    timeRecoverMs: 420,
    particles: 200,
    punchScale: 1.75,
    haptic: "success",
    tone: 24,
    oncePerSession: true,
  },
} as const

export const TIER_ORDER: readonly TierName[] = [
  "nudge",
  "tick",
  "snap",
  "pop",
  "slam",
  "bloom",
  "ascend",
]

/**
 * How much of the child's attention a tier spends.
 *
 * Multiplicative in the things that actually compete for notice: how long it
 * draws, how much light it throws, how many parts move, and how much it slows
 * the world down. Particle count is additive-plus-one so a particle-free tier
 * still has a real energy and the ladder stays orderable.
 *
 * Two invariants are asserted against it in `tiers.test.ts`:
 *   `energy(nudge) < energy(snap)`  — being wrong is never the interesting
 *   moment, which is the one line of this product's ethics that shows up in the
 *   feel layer.
 *   the ladder `tick < snap < pop < slam < bloom < ascend` is strictly
 *   increasing, so escalation is legible.
 */
export function energy(t: FeelTier): number {
  const timeCost = t.timeScale < 1 ? 1 + (1 - t.timeScale) : 1
  const parts = 1 + t.particles
  const light = 0.25 + t.flash
  // Kick is in the formula on purpose. Without it a designer could satisfy
  // "wrong is quieter than right" on every other axis and still make failure
  // the physically emphatic moment through recoil alone — which is exactly the
  // "catapult falling short is more animated than a gear ticking" failure.
  const motion = 1 + Math.abs(t.punchScale - 1) * 4 + t.trauma * 2 + t.kick * 3
  return t.tailMs * parts * light * motion * timeCost
}

/* --------------------------------------------------------------- choosing */

/**
 * Everything the feel layer is allowed to know about what just happened.
 *
 * Four fields, and the absence of a fifth is the product rule: there is no
 * `streak`, no `combo`, no `runLength` and no session total, and there is
 * nowhere to add one without changing this type.
 */
export interface Outcome {
  readonly correct: boolean
  /** 0 at the bottom of the ladder, 1 at the top. */
  readonly difficulty: number
  /** This was the item that isolates a misconception, and it went in. */
  readonly repaired: boolean
  /** Something in the world completed. `"major"` is the once-a-session one. */
  readonly milestone: "minor" | "major" | null
}

/** Above this an item is hard enough to be worth freezing the world for. */
export const HARD = 0.6

/** Pure, total, stateless. The tier this outcome earns. */
export function chooseTier(o: Outcome): TierName {
  if (!o.correct) return "nudge"
  if (o.milestone === "major") return "ascend"
  if (o.milestone === "minor") return "bloom"
  if (o.repaired) return "slam"
  return o.difficulty >= HARD ? "pop" : "snap"
}
