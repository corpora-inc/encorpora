// The app's half of the renderer contract (gate CG-8): the list of what this
// bundle can actually draw. `renderers.test.ts` asserts it and the curriculum's
// declaration agree in both directions.
//
// No JSX here, deliberately: the tests run under
// `node --experimental-strip-types`, which does not compile JSX, so the *list*
// has to be importable without the components. `ui/Representation.tsx` is the
// dispatch, and `representation.test.ts` reads its source to check every id in
// this list is wired to a case.
//
// The counting board is not in the drawable set. It is a *contrast*
// representation, built from an exercise and a wrong answer by `contrast.ts`
// rather than from a `RepSpec`, and `judge.LOCATABLE_REPRESENTATIONS` is its
// half of the same contract — a different question, so a different list.

import { repSpecDefect, REP_BALANCE_SCALE, REP_COUNTING_BOARD, REP_NUMBER_LINE } from "./curriculum.ts"
import type { RepId, RepSpec } from "./curriculum.ts"

/** Representations an item may ask for by `RepSpec` and this bundle will draw. */
export const DRAWABLE_REPRESENTATIONS: readonly RepId[] = [REP_NUMBER_LINE, REP_BALANCE_SCALE]

/**
 * Representations that exist as components but are not driven by a `RepSpec`.
 * The counting board is built from an exercise; nothing asks for it by id.
 */
export const CONTRAST_REPRESENTATIONS: readonly RepId[] = [REP_COUNTING_BOARD]

/** Every representation this bundle can put on a screen, however it is driven. */
export const RENDERED_REPRESENTATIONS: readonly RepId[] = [
  ...DRAWABLE_REPRESENTATIONS,
  ...CONTRAST_REPRESENTATIONS,
]

/**
 * Can this spec be drawn as it stands?
 *
 * Both halves: an id nothing renders, and a spec the renderer would have to
 * guess at. `Representation.tsx` asks this before drawing and draws nothing when
 * the answer is no — a card whose representation cannot be drawn is still a card
 * whose *answer* can be, so the child gets the problem rather than an error.
 */
export function representationDefect(spec: RepSpec): string | null {
  if (!DRAWABLE_REPRESENTATIONS.includes(spec.rep)) return `no renderer for "${spec.rep}"`
  return repSpecDefect(spec.rep, spec.params)
}
