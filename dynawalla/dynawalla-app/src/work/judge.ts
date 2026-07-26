// Judging and diagnosis.
//
// Two claims live here and both are load-bearing.
//
// **The mathematics is real.** Correctness is `family.check`, which is exact
// structural comparison of `Rational`s. No tolerance, no epsilon, no float, no
// model, no language model. A child's answer is right or it is not, and the same
// answer is judged the same way on every device forever.
//
// **A wrong answer is not just wrong.** If it *equals* the output of an
// executable buggy procedure, we know which procedure the child ran. That is the
// product. `classify` returns the single rule that explains the answer, or `null`
// when none or several do — an ambiguous diagnosis is worse than none, because
// Stage 2 would then show a contradiction built for a misconception the child may
// not hold.
//
// The routing decision — Stage 1 VERIFY or Stage 2 LOCATE — is made here and
// nowhere else. A rule may be tagged LOCATE-capable in the curriculum and still
// route to Stage 1 in *this build*, because tagging is a curriculum claim and
// drawing the contrast is an app capability. `LOCATABLE_REPRESENTATIONS` is the
// app's half of that contract; it is the reason a curriculum PR cannot silently
// promise a child a representation this bundle cannot draw.

import { familyById, malRuleById, REP_COUNTING_BOARD } from "./curriculum.ts"
import type { AnswerValue, Exercise, MalRuleId, RepId } from "./curriculum.ts"

/** Contrast representations this bundle can actually draw. */
export const LOCATABLE_REPRESENTATIONS: readonly RepId[] = [REP_COUNTING_BOARD]

export interface Diagnosis {
  /** Internal forever. No learner-facing string ever names it (M-16). */
  readonly misconception: MalRuleId
  /** The contrast representation to show, or `null` for Stage 1. */
  readonly contrast: RepId | null
}

export type Judgement =
  | { readonly kind: "seated" }
  | { readonly kind: "struck"; readonly diagnosis: Diagnosis | null }

/**
 * Exact judgement plus diagnosis. Synchronous and pure: nothing here reads a
 * clock, touches storage or awaits anything, because it runs between the child's
 * commit and the next painted frame.
 */
export function judge(exercise: Exercise, submitted: AnswerValue): Judgement {
  const family = familyById(exercise.family)
  if (family === undefined) throw new RangeError(`judge: no family ${exercise.family}`)

  const verdict = family.check(exercise, submitted)
  if (verdict.correct) return { kind: "seated" }

  // The family's verdict is the single source of diagnosis, and not a partial
  // one: `check` calls the same global `classify` this module would, and
  // `classify` already filters the registry to `exercise.family`. A second pass
  // could find nothing. It used to run one anyway — `verdict.misconception ??
  // classify(…)` — re-executing every mal-rule's full column procedure on the
  // unexplained-wrong branch to reach the same `undefined`.
  //
  // The contract: a family that wants its wrong answers diagnosed classifies
  // them in `check`. `diagnosis.test.ts` asserts the one this build serves does.
  const misconception = verdict.misconception
  if (misconception === undefined) return { kind: "struck", diagnosis: null }

  return { kind: "struck", diagnosis: { misconception, contrast: contrastFor(misconception) } }
}

/**
 * The contrast representation bound to a misconception, if this build can draw
 * it. `null` routes to Stage 1.
 */
export function contrastFor(misconception: MalRuleId): RepId | null {
  const rule = malRuleById(misconception)
  if (rule === undefined || !rule.locateCapable) return null
  const rep = rule.contrastRep
  if (rep === undefined) return null
  return LOCATABLE_REPRESENTATIONS.includes(rep) ? rep : null
}
