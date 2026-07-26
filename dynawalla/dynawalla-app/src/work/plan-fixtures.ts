// Planned cards for the M2 slice, for tests about the loop rather than selection.
//
// Test-only. Nothing in the app imports it, so it is not in the bundle. It sits
// beside `fixtures.ts` for the same reason that file exists: a test that wants a
// specific problem should get a real one rather than a hand-built object that can
// drift from what the app actually serves.

import { coldStart } from "../../../engine/src/index.ts"
import { DEFAULT_GRADE, engineCatalog } from "./catalog.ts"
import { rungAt } from "./ladder.ts"
import type { LearnerState, PlannedCard } from "./plan.ts"

/** A brand-new learner, as `store.ts` builds one on a first launch. */
export function startLearner(): LearnerState {
  return coldStart(engineCatalog(), DEFAULT_GRADE, 0)
}

/**
 * A planned card for one (skill, level) of the M2 slice.
 *
 * The tests below are about the loop and the world's response to it, not about
 * selection, so they name the card rather than asking the scheduler for one.
 */
export function planAt(step: number, seed: number): PlannedCard {
  const at = rungAt(step)
  return {
    cardId: `${at.skillId}#L${String(at.level)}#${String(seed)}`,
    skillId: at.skillId,
    level: at.level,
    formId: "free-entry",
    seed,
    pool: "FRONTIER",
    intent: "steady",
    pHat: 800_000 as PlannedCard["pHat"],
    operation: at.params.op,
    itemKey: `${at.skillId}#L${String(at.level)}#free-entry`,
  }
}
