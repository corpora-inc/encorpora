// What the world and the character are told about an answer.
//
// The one place the work surface, the construction and the character meet, and
// it is a pure function so the meeting can be asserted rather than clicked
// through. `Q-05` forbids `src/world/` and `src/reactions/` from importing
// anything here; the arrow only ever points this way.
//
// Three claims live in this file, and each is a test in `respond.test.ts`:
//
//   1. **A wrong answer places nothing.** Not "places less" — nothing. The
//      construction is the record of what the child got right, and `P-04` says
//      it never regresses, which is only meaningful if it also never advances
//      on a miss.
//   2. **A wrong answer earns SLIP and can earn nothing else.** The tier is
//      decided from this outcome, and `correct: false` short-circuits every
//      escalation path in `chooseTier`.
//   3. **Escalation is difficulty and repair.** `difficultyOf` is the ladder
//      position and nothing else — not how many in a row, not how fast, not how
//      many today. There is no argument here that could carry a run length.

import { aperturesIn, milestoneAt } from "../world/construction.ts"
import type { Observation } from "../character/voice.ts"
import type { Outcome } from "../reactions/tiers.ts"
import { difficultyRange, engineCatalog } from "./catalog.ts"
import type { PlannedCard } from "./plan.ts"
import type { Card } from "./session.ts"

/**
 * The item's difficulty as a 0…1 number, for the reaction tier.
 *
 * It is `b_item` normalised over the range the catalog can actually serve — an
 * item property, not a claim about the child. `(b_item − θ_s)` is the quantity
 * the learner model reasons about, and it is deliberately *not* what the world
 * reacts to: a child and the model can disagree about whether something was
 * hard, and the reaction should follow the problem.
 *
 * This replaced the ladder position, which was the same idea against a fixed
 * seven-rung table. Now that difficulty is a curriculum fact rather than an
 * index, so is this.
 */
export function difficultyOf(plan: PlannedCard): number {
  const { low, high } = difficultyRange()
  const b = engineCatalog().byId.get(plan.skillId)?.levels[plan.level]?.b
  if (b === undefined || high <= low) return 0
  return Math.min(1, Math.max(0, (b - low) / (high - low)))
}

export interface Response {
  readonly outcome: Outcome
  /** Something worth remarking on, or `null` — which is the usual answer. */
  readonly observation: Observation | null
}

/**
 * How to respond to a judged card.
 *
 * `placed` is the construction count **after** any placement, so the milestone
 * is read from the world's new state rather than guessed from the old one.
 * Returns `null` for a card that is not a problem — a contrast pair is not
 * answered, so nothing responds to it.
 */
export function respond(card: Card, correct: boolean, placed: number): Response | null {
  if (card.kind !== "problem") return null

  const milestone = correct ? milestoneAt(placed) : null
  // The repair item is the one served after a contrast pair, from the rung
  // whose parameters guarantee the step that broke. Getting *that* right is the
  // product working, and it is the only thing here that is about the child's
  // understanding rather than about the item.
  const repaired = correct && card.role === "repair"

  const outcome: Outcome = {
    correct,
    difficulty: difficultyOf(card.plan),
    repaired,
    milestone,
  }

  const observation: Observation | null = repaired
    ? { kind: "repaired", apertures: null }
    : milestone === null
      ? null
      : { kind: "closed", apertures: aperturesIn(milestone) }

  return { outcome, observation }
}
