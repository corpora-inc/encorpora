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
import { LADDER } from "./ladder.ts"
import type { Card } from "./session.ts"

/**
 * The ladder position as a 0…1 difficulty.
 *
 * The stand-in for `(b_item − θ_s)` until the learner model lands at M5. It is
 * an item property against a fixed ladder, which is the honest version of "this
 * one was harder" when there is no estimate of the child in the system at all.
 */
export function difficultyOf(rung: number): number {
  const top = LADDER.length - 1
  if (top <= 0) return 0
  return Math.min(Math.max(rung, 0), top) / top
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
    difficulty: difficultyOf(card.rung),
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
