// The reaction vocabulary, and the one rule that keeps it honest.
//
// `docs/EXPERIENCE_DESIGN.md` fixes the tiers and their budgets, and fixes two
// invariants that this module exists to make testable:
//
//   1. **Escalation is on difficulty and repair, never on run length.** A
//      combo-momentum function is exactly the loop this product bans, so the
//      input to `reactionTier` carries no streak, no chain and no combo, and
//      `reaction.test.ts` asserts that by name over `REACTION_INPUT_KEYS`.
//   2. **`energy(SLIP) < energy(SEAT)`.** Being wrong must not be the more
//      interesting thing to watch. In a wrestling game that invariant has teeth,
//      because a body going limp under a three-count is inherently more animated
//      than one standing up — which is why the pinfall here is *silence*: the
//      crowd bed cuts, nothing bursts, and the only motion is the referee's hand
//      coming down. The canon called for that beat and the invariant demands it.

export type ReactionTier = -1 | 0 | 1 | 2 | 3

export const SLIP: ReactionTier = -1
export const SEAT: ReactionTier = 0
export const ENGAGE: ReactionTier = 1
export const ILLUMINATE: ReactionTier = 2
export const MECHANISM: ReactionTier = 3

/**
 * The complete set of things the tier may be computed from. Frozen and exported
 * so a test can assert that nothing resembling a run length was ever added.
 */
export const REACTION_INPUT_KEYS = ["difficulty", "minTaps", "taps", "repaired"] as const

export type ReactionInput = {
  /** 0..1, normalised from whatever the host reports. */
  difficulty: number
  /** The fewest taps the escape could have cost. */
  minTaps: number
  /** What it actually cost. */
  taps: number
  /** The child hit a known mal-rule total on the way and got out anyway. */
  repaired: boolean
}

export type Reaction = {
  tier: ReactionTier
  /** How long the effect owns the screen. Nothing ever waits for it. */
  budgetMs: number
  /** Particle budget at the reference quality tier. */
  particles: number
  /** Peak audio gain, 0..1. */
  peakGain: number
  /** How many things move at once. */
  elements: number
}

export const REACTIONS: Record<ReactionTier, Reaction> = {
  [-1]: { tier: SLIP, budgetMs: 260, particles: 0, peakGain: 0.16, elements: 2 },
  0: { tier: SEAT, budgetMs: 200, particles: 10, peakGain: 0.4, elements: 4 },
  1: { tier: ENGAGE, budgetMs: 450, particles: 34, peakGain: 0.55, elements: 6 },
  2: { tier: ILLUMINATE, budgetMs: 900, particles: 90, peakGain: 0.7, elements: 9 },
  3: { tier: MECHANISM, budgetMs: 1800, particles: 190, peakGain: 0.85, elements: 13 },
}

/** budgetMs × particles × peakGain × animatedElements, with a floor of 1 particle. */
export function energy(r: Reaction): number {
  return r.budgetMs * Math.max(1, r.particles) * r.peakGain * r.elements
}

/**
 * Which reaction an escape earns.
 *
 * Takes exactly one argument, and that argument is a pure description of *this*
 * fall. There is deliberately nowhere to put "and they have won six in a row".
 */
export function reactionTier(input: ReactionInput): ReactionTier {
  const difficulty = Math.max(0, Math.min(1, input.difficulty))
  // Weight in "how much work was that": the length of the decomposition plus
  // how far the curriculum has climbed, plus a fixed step for repairing a
  // mal-rule you used to fire — which the design doc reserves tier 2 for.
  let weight = 0
  if (input.minTaps >= 4) weight += 1
  if (input.minTaps >= 6) weight += 1
  if (difficulty >= 0.34) weight += 1
  if (difficulty >= 0.7) weight += 1
  // An escape taken in more taps than it needed is still an escape, and it is
  // still exact. It just does not climb.
  if (input.taps > input.minTaps + 2) weight -= 1
  if (input.repaired) weight += 2

  if (weight <= 0) return SEAT
  if (weight === 1) return ENGAGE
  if (weight <= 3) return ILLUMINATE
  return MECHANISM
}
