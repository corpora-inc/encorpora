/**
 * `gen.number.place-value-decompose` mal-rules.
 *
 * One rule, and one is the honest number. Reading the *digit* where the question
 * asked for the *quantity* is the documented place-value error with a procedure
 * behind it, and it is the one this family can pose in two different tasks and
 * catch in both.
 *
 * The other candidate — counting places from the left instead of from the right —
 * is not shipped: it produces the correct answer whenever the two digits happen to
 * be equal, which is one item in ten, and the only ways to reach CG-12's 95%
 * divergence are to bias the content or to have `applies()` decline the items where
 * the bug is right. The second is the self-filtering the mal-rule contract forbids.
 * CURRICULUM.md's honesty rule covers the rest: an unclassified error, never an
 * invented bug.
 */

import { rational } from "../math/rational.ts";
import { PLACE_VALUE_FAMILY } from "../generators/placeValue/constants.ts";
import { readPlaceValueQuestion } from "../generators/placeValue/read.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import { malRuleId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";

export const MIS_DIGIT_FOR_VALUE = malRuleId("mis.ns.digit-for-value");

/**
 * The child answers with the digit itself.
 *
 * On "what is the digit in the hundreds place of 4,738 worth?" the answer is 700
 * and this produces 7. On "how many hundreds are in 4,738 altogether?" the answer
 * is 47 and this produces 7 again — the same reading, and the reason the two tasks
 * are in one family.
 *
 * It is **defined only where the question asks for a quantity**. On
 * `digit-in-place` the digit *is* the answer, so there is no misreading to make;
 * that is the procedure being undefined, not a filter on where it is wrong. Where
 * it is defined it is always wrong: the generator never asks about a place holding
 * a zero, and a `total-in-place` question always has at least two digits above the
 * place it counts.
 */
export const digitForValue: MalRule = {
  id: MIS_DIGIT_FOR_VALUE,
  family: PLACE_VALUE_FAMILY,
  // No Stage-2 contrast is built for this rule. The counting board could carry it,
  // and claiming `locateCapable` before the contrast pair exists would put a
  // representation on a child's screen that nothing draws.
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const question = readPlaceValueQuestion(exercise);
    return question !== null && question.task !== "digit-in-place";
  },

  apply(exercise: Exercise): AnswerValue | null {
    const question = readPlaceValueQuestion(exercise);
    if (question === null || question.task === "digit-in-place") return null;
    return { kind: "integer", value: rational(question.digit) };
  },
};

export const placeValueMalRules: readonly MalRule[] = [digitForValue];
