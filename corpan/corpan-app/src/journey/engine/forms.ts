// journey/engine/forms.ts — the form-ladder state machine (engine.md §5.5).
// card.form = highest form PASSED (0 recognition, 1 cued recall, 2 production).
// Fails never demote card.form; struggle only affects PROPOSALS.

import { FORM_CEILING_P, PRODUCTION_READY_R } from "./constants.ts"
import type { FlowMode } from "./flow.ts"
import type { Rng } from "./rng.ts"
import type { ItemCard } from "./types.ts"

/** productionReady: R(now) ≥ 0.7 AND ≥1 prior pass at form ≥ 1. */
export function productionReady(card: ItemCard, retrievabilityNow: number): boolean {
  return retrievabilityNow >= PRODUCTION_READY_R && card.form >= 1
}

export function chooseForm(
  card: ItemCard,
  mode: FlowMode,
  retrievabilityNow: number,
  rng: Rng,
): 0 | 1 | 2 {
  let ceiling: 0 | 1 | 2 =
    mode === "struggle"
      ? card.form // de-escalate: repeat proven
      : (Math.min(card.form + 1, 2) as 0 | 1 | 2) // ratchet: next rung
  if (ceiling === 2 && !productionReady(card, retrievabilityNow)) ceiling = 1
  if (mode === "cruise") return ceiling // production bias
  return rng.next() < FORM_CEILING_P ? ceiling : card.form // consolidation
}

/** Stored-form ratchet (apply.ts only): pass at issued form f with
 *  !guessable ∧ f > card.form ⇒ card.form = f. */
export function ratchetForm(card: ItemCard, issuedForm: 0 | 1 | 2, guessable: boolean, passed: boolean): void {
  if (passed && !guessable && issuedForm > card.form) card.form = issuedForm
}
