// The reaction vocabulary: five tiers, and the rule that decides which one.
//
// The budgets are EXPERIENCE_DESIGN's, unchanged:
//
//   −1 SLIP        260 ms
//    0 SEAT        200 ms
//    1 ENGAGE      450 ms
//    2 ILLUMINATE  900 ms
//    3 MECHANISM  1800 ms   once per session, always skippable
//
// ## What escalation keys on, and what it must never key on
//
// MISSION forbids escalating celebration on streak or run length, and this is
// the file where that is either true or not. `chooseTier` takes an `Outcome`
// with four fields and none of them is a count of anything the child has done
// in a row. `tiers.test.ts` asserts it two ways: behaviourally, by handing the
// function a run length and a combo count and showing the answer does not move,
// and by scanning every source file under `src/reactions/` for the words.
//
// Escalation keys on **difficulty** and on **repair** — a harder item earns
// more, and getting right the item that isolates a misunderstanding you had a
// moment ago earns more than getting right an item you always could. At M2
// there is no learner model, so `difficulty` is the ladder position rather than
// `(b_item − θ_s)`. The shape of the rule is the shape it keeps; M5 replaces
// what fills the field, not what the field is.
//
// ## And the one inequality this product turns on
//
// `energy(SLIP) < energy(SEAT)`: being wrong must never be more interesting
// than being right. It is asserted here over the whole effect catalogue rather
// than tier-to-tier, in the strong form — the loudest slip is quieter than the
// quietest seat — and it is *also* playtested (`T-01`), because it is a proxy a
// determined designer can satisfy while still making failure the fun part.

import type { Milestone } from "../world/construction.ts"

export type TierName = "slip" | "seat" | "engage" | "illuminate" | "mechanism"

/** Loud to quiet, for the downgrade walk when a tier has nothing eligible. */
export const TIER_ORDER: readonly TierName[] = [
  "mechanism",
  "illuminate",
  "engage",
  "seat",
  "slip",
]

export interface Tier {
  readonly name: TierName
  /** EXPERIENCE_DESIGN's tier number. Negative is below the resting state. */
  readonly level: number
  readonly budgetMs: number
  /** Spendable once per session. Only MECHANISM is. */
  readonly oncePerSession: boolean
}

export const TIERS: Readonly<Record<TierName, Tier>> = {
  slip: { name: "slip", level: -1, budgetMs: 260, oncePerSession: false },
  seat: { name: "seat", level: 0, budgetMs: 200, oncePerSession: false },
  engage: { name: "engage", level: 1, budgetMs: 450, oncePerSession: false },
  illuminate: { name: "illuminate", level: 2, budgetMs: 900, oncePerSession: false },
  mechanism: { name: "mechanism", level: 3, budgetMs: 1800, oncePerSession: true },
}

/**
 * Everything the reaction layer is allowed to know about what just happened.
 *
 * Four fields, and the absence of a fifth is the product rule. There is no
 * `streak`, no `run`, no `combo` and no session total, and there is nowhere for
 * one to be smuggled in: this type is the entire input.
 */
export interface Outcome {
  readonly correct: boolean
  /**
   * How hard the item was: 0 at the bottom of the ladder, 1 at the top.
   * Stands in for `(b_item − θ_s)` until the learner model lands at M5.
   */
  readonly difficulty: number
  /** This answer was the one that followed a contrast pair, and it was right. */
  readonly repaired: boolean
  /** What closed in the world, if anything. */
  readonly milestone: Milestone | null
}

/** Above this, an item is hard enough to be worth engaging the machinery for. */
export const HARD = 0.6

/**
 * The tier this outcome deserves — before eligibility, and before the
 * once-a-session budget is checked. Pure, total, and stateless: whether the
 * MECHANISM is still available is the stage's business, not this function's,
 * which is what keeps the escalation rule readable in one screen.
 */
export function chooseTier(outcome: Outcome): TierName {
  if (!outcome.correct) return "slip"
  if (outcome.milestone !== null) {
    return outcome.milestone === "star" ? "illuminate" : "mechanism"
  }
  if (outcome.repaired) return "illuminate"
  return outcome.difficulty >= HARD ? "engage" : "seat"
}
