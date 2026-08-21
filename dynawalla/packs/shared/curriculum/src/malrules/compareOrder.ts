/**
 * `gen.number.compare-order` mal-rules — whole-number bias, in two notations.
 *
 * Both rules are the same belief: that a number written with more of something is
 * bigger. In fractions it is the denominator; in decimals it is the digits after
 * the point. CURRICULUM.md files them as one root, `mis.frac.whole-number-bias`, so
 * a child who holds it is repaired once rather than twice.
 *
 * Each rule's `applies()` names a **property of the item**, never a property of the
 * answer. That distinction is what separates a bug that is undefined on an item
 * from a bug that is being hidden where it happens to be right:
 *
 * - The fraction rule is defined where the two fractions share a numerator. With
 *   one numerator, the larger denominator is the smaller number as a matter of
 *   arithmetic, so the rule is wrong on every such item and the mal-rule never has
 *   to look at the answer to know it.
 * - The decimal rule is defined where the two numbers are written to different
 *   numbers of places. Its level poses the discriminating item — equal whole parts,
 *   longer writing on the smaller number — as a declared content decision, because
 *   `0.5` against `0.625` is an item a child can get right while holding exactly
 *   the belief being tested.
 */

import { cmp } from "../math/rational.ts";
import { COMPARE_ORDER_FAMILY } from "../generators/compareOrder/constants.ts";
import { operandAnswer, operandValue, readComparePair } from "../generators/compareOrder/read.ts";
import type { CompareOperand, ComparePair } from "../generators/compareOrder/read.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import { malRuleId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";
import { MIS_WHOLE_NUMBER_BIAS } from "./roots.ts";

export const MIS_LARGER_DENOMINATOR_LARGER_FRACTION = malRuleId(
  "mis.frac.larger-denominator-larger-fraction",
);
export const MIS_LONGER_IS_BIGGER = malRuleId("mis.dec.longer-is-bigger");

/** The operand the child picks, given which one their rule says is "bigger". */
function pickedBy(pair: ComparePair, believedBigger: CompareOperand): AnswerValue {
  const believedSmaller = believedBigger === pair.left ? pair.right : pair.left;
  return operandAnswer(pair.task === "greater" ? believedBigger : believedSmaller);
}

function sameNumeratorPair(pair: ComparePair): boolean {
  return (
    pair.left.kind === "fraction" &&
    pair.right.kind === "fraction" &&
    pair.left.num === pair.right.num &&
    pair.left.den !== pair.right.den
  );
}

export const largerDenominatorLargerFraction: MalRule = {
  id: MIS_LARGER_DENOMINATOR_LARGER_FRACTION,
  family: COMPARE_ORDER_FAMILY,
  parent: MIS_WHOLE_NUMBER_BIAS,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const pair = readComparePair(exercise);
    return pair !== null && sameNumeratorPair(pair);
  },

  apply(exercise: Exercise): AnswerValue | null {
    const pair = readComparePair(exercise);
    if (pair === null || !sameNumeratorPair(pair)) return null;
    if (pair.left.kind !== "fraction" || pair.right.kind !== "fraction") return null;
    const believedBigger = pair.left.den > pair.right.den ? pair.left : pair.right;
    return pickedBy(pair, believedBigger);
  },
};

function differentPlaceCounts(pair: ComparePair): boolean {
  return (
    pair.left.kind === "number" &&
    pair.right.kind === "number" &&
    pair.left.decimalPlaces !== pair.right.decimalPlaces &&
    // Whole numbers of the same width are not what this rule is about, and a whole
    // number written with more digits genuinely is bigger.
    (pair.left.decimalPlaces > 0 || pair.right.decimalPlaces > 0) &&
    cmp(operandValue(pair.left), operandValue(pair.right)) !== 0
  );
}

export const longerIsBigger: MalRule = {
  id: MIS_LONGER_IS_BIGGER,
  family: COMPARE_ORDER_FAMILY,
  parent: MIS_WHOLE_NUMBER_BIAS,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const pair = readComparePair(exercise);
    return pair !== null && differentPlaceCounts(pair);
  },

  apply(exercise: Exercise): AnswerValue | null {
    const pair = readComparePair(exercise);
    if (pair === null || !differentPlaceCounts(pair)) return null;
    if (pair.left.kind !== "number" || pair.right.kind !== "number") return null;
    const believedBigger = pair.left.decimalPlaces > pair.right.decimalPlaces ? pair.left : pair.right;
    return pickedBy(pair, believedBigger);
  },
};

export const compareOrderMalRules: readonly MalRule[] = [
  largerDenominatorLargerFraction,
  longerIsBigger,
];
