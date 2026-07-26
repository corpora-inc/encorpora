/**
 * The three pieces of a generator family that are the same in every family, and
 * were copied five times before they were extracted.
 *
 * - `judge` is `GeneratorFamily.check`. It goes through `answerAccepted`, not
 *   `answerEquals`, so `AnswerSchema.fraction.equivalence` is a knob that does
 *   something: a skill that accepts any equivalent writing of the answer says so on
 *   its schema, and a checker that reached for the structural comparison would mark
 *   every child who wrote `2/4` wrong on a skill that accepts it.
 * - `distractorsFor` runs the family's mal-rules over a finished item.
 * - `chooseForm` validates the binding's forms against the family's own list.
 *
 * `gen.arith.column-op` predates all three and keeps its own copies; it is not
 * rewritten here because rewriting it would change nothing about its output and
 * everything about its CG-16 hashes' provenance.
 */

import { answerAccepted, answerEquals } from "../../types/answer.ts";
import type { AnswerValue } from "../../types/answer.ts";
import type { Distractor, Exercise } from "../../types/exercise.ts";
import type { FamilyId, FormId } from "../../types/ids.ts";
import type { Verdict } from "../../types/generator.ts";
import { classify, malRulesForFamily } from "../../malrules/registry.ts";
import type { Rng } from "../../rng/rng.ts";
import { InfeasibleLevelError } from "./errors.ts";

/**
 * `check`, for every family that has no reason to differ.
 *
 * A wrong answer that no mal-rule explains returns `{ correct: false }` with no
 * misconception, which is the honest outcome and the one CURRICULUM.md asks for
 * where the catalogue is thin: an unclassified error routes to a faded worked
 * example rather than to a repair for a bug the child may not have.
 */
export function judge(exercise: Exercise, submitted: AnswerValue): Verdict {
  if (answerAccepted(exercise.schema, exercise.answer.canonical, submitted)) return { correct: true };
  for (const accepted of exercise.answer.alsoAccept) {
    if (answerAccepted(exercise.schema, accepted, submitted)) return { correct: true };
  }
  const misconception = classify(exercise, submitted);
  return misconception === null ? { correct: false } : { correct: false, misconception };
}

/**
 * Every mal-rule output this item admits, as distractors.
 *
 * Two exclusions, and the second one is the one that is easy to get wrong. A
 * buggy procedure that lands on the right answer is not a distractor — but "the
 * right answer" here means *what the checker would accept*, not what
 * `answerEquals` says. On a schema that accepts any equivalent fraction, a
 * mal-rule output of `2/4` against a canonical `1/2` is a distractor the family's
 * own checker marks correct, which is exactly the contradiction CG-11 fails on.
 */
export function distractorsFor(family: FamilyId, exercise: Exercise): Distractor[] {
  const out: Distractor[] = [];
  for (const rule of malRulesForFamily(family)) {
    if (!rule.applies(exercise)) continue;
    const produced = rule.apply(exercise);
    if (produced === null) continue;
    if (answerAccepted(exercise.schema, exercise.answer.canonical, produced)) continue;
    if (out.some((existing) => answerEquals(existing.value, produced))) continue;
    out.push({ value: produced, misconception: rule.id });
  }
  return out;
}

/**
 * The form this seed draws.
 *
 * A binding that names a form the family cannot emit is a curriculum error that
 * CG-7 reports, and this is where it is detected: the alternative is a family that
 * silently substitutes its default and a level that never serves the form its row
 * claims.
 */
export function chooseForm(forms: readonly FormId[], allowed: readonly string[], rng: Rng): FormId {
  const first = forms[0];
  if (first === undefined) throw new InfeasibleLevelError("binding declares no forms");
  for (const form of forms) {
    if (!allowed.includes(form)) throw new InfeasibleLevelError(`unknown form ${JSON.stringify(form)}`);
  }
  return forms.length === 1 ? first : rng.pick(forms);
}
