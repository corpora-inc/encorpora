// The reaction vocabulary, and the two invariants that keep it honest.
//
// `EXPERIENCE_DESIGN.md` fixes both:
//
//   1. **`energy(SLIP) < energy(SEAT)`**, where energy is
//      `budgetMs × particles × peakGain × animatedElements`. Being wrong must
//      not be more interesting than being right. A street full of sparks off a
//      refused seam is exactly the failure this bans, and a ring-off is the
//      single most tempting thing in this game to over-animate.
//   2. **Escalation is on difficulty and on the strategic choice, never on run
//      length.** `reactionFor` takes what happened and the number it happened
//      to. It takes no streak, no combo, no wave index, and `energy.test.ts`
//      asserts the signature by calling it with everything the game knows and
//      showing the result does not move.

export type Beat =
  /** A seam refused. The mob stands split with the remainder over, and closes. */
  | "ringoff"
  /** Fists off locked arms. */
  | "bounce"
  /** A rivet caved in. */
  | "rivetWrong"
  /** Shoved back a block. */
  | "shove"
  /** A seam landed and the rectangle changed shape. */
  | "crack"
  /** A rank went down. */
  | "down"
  /** The shutter went up. */
  | "rivetRight"
  /** The street is empty. */
  | "cleared"
  /** A mob that refused every seam, taken with a fist. The best thing here. */
  | "solid"
  /** A block finished. Once per block, and the only tier-3 in the game. */
  | "block"

export type Tier = -1 | 0 | 1 | 2 | 3

export type Reaction = {
  readonly tier: Tier
  readonly budgetMs: number
  readonly particles: number
  readonly peakGain: number
  readonly elements: number
}

/** Tier budgets, straight from the reaction table in `EXPERIENCE_DESIGN.md`. */
export const TIER_BUDGET: Record<Tier, number> = {
  [-1]: 260,
  0: 200,
  1: 450,
  2: 900,
  3: 1800,
}

const BASE: Record<Beat, Reaction> = {
  // Slips. Two sparks, a quiet knock, one thing moving. Deliberately the
  // cheapest reactions in the file.
  ringoff: { tier: -1, budgetMs: 260, particles: 2, peakGain: 0.16, elements: 1 },
  bounce: { tier: -1, budgetMs: 240, particles: 2, peakGain: 0.14, elements: 1 },
  rivetWrong: { tier: -1, budgetMs: 260, particles: 2, peakGain: 0.15, elements: 1 },
  // A setback, and still not a spectacle. The mob leans in and the lamp swings;
  // nothing bursts.
  shove: { tier: -1, budgetMs: 260, particles: 3, peakGain: 0.18, elements: 2 },

  // Seats.
  crack: { tier: 0, budgetMs: 200, particles: 10, peakGain: 0.34, elements: 4 },
  down: { tier: 0, budgetMs: 200, particles: 8, peakGain: 0.3, elements: 3 },
  rivetRight: { tier: 0, budgetMs: 200, particles: 6, peakGain: 0.32, elements: 3 },

  // Rewards.
  cleared: { tier: 2, budgetMs: 900, particles: 22, peakGain: 0.42, elements: 6 },
  solid: { tier: 2, budgetMs: 900, particles: 26, peakGain: 0.46, elements: 7 },
  block: { tier: 3, budgetMs: 1800, particles: 34, peakGain: 0.5, elements: 9 },
}

/** `budgetMs × particles × peakGain × animatedElements`. The doc's formula. */
export function energy(r: Reaction): number {
  return r.budgetMs * r.particles * r.peakGain * r.elements
}

export type BeatContext = {
  /** The rank size the beat happened to. Difficulty, and the only escalator. */
  readonly size: number
  /** The seam struck was the one that clears the wave fastest. A choice, not a streak. */
  readonly bestSeam: boolean
}

/**
 * The reaction for a beat.
 *
 * A crack steps up one tier when the mob was large or when the seam struck was
 * the fastest one available — harder problems and better choices earn more,
 * which is the sanctioned escalation. Nothing else in the game escalates at
 * all.
 */
export function reactionFor(beat: Beat, ctx: BeatContext): Reaction {
  const base = BASE[beat]
  if (beat !== "crack") return base
  if (!ctx.bestSeam && ctx.size < 12) return base
  return {
    tier: 1,
    budgetMs: TIER_BUDGET[1],
    particles: 16,
    peakGain: 0.38,
    elements: 5,
  }
}

export type HapticCue = "light" | "medium" | "heavy" | "success" | "failure"

/**
 * What the street asks the device for. The host owns the waveform.
 *
 * A ring-off gets `light` and not `failure`: refusing a seam is how the child
 * finds out a number does not go, and the device must not editorialise about
 * it. The only `failure` in the game is being shoved back a block, which is the
 * only thing that actually takes something away.
 */
export const HAPTIC: Record<Beat, HapticCue> = {
  ringoff: "light",
  bounce: "light",
  rivetWrong: "light",
  shove: "failure",
  crack: "medium",
  down: "medium",
  rivetRight: "medium",
  cleared: "success",
  solid: "success",
  block: "success",
}

export const SLIPS: readonly Beat[] = ["ringoff", "bounce", "rivetWrong", "shove"] as const
export const SEATS: readonly Beat[] = ["crack", "down", "rivetRight"] as const
export const REWARDS: readonly Beat[] = ["cleared", "solid", "block"] as const
