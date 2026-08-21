/**
 * Fraction mal-rules, across two families.
 *
 * `mis.frac.add-numerators-and-denominators` is the deepest-evidenced error in
 * elementary fractions and is a child of `mis.frac.whole-number-bias`, the same
 * root as reading a larger denominator as a larger number. Both are the belief that
 * a fraction is two whole numbers that happen to be written one above the other.
 *
 * Each one is wrong on every item it is defined on, provably rather than
 * empirically:
 *
 * - The mediant `(a+c)/(b+d)` lies strictly between `a/b` and `c/d`, and a sum of
 *   two positive fractions is strictly greater than both. They cannot be equal.
 * - Scaling both parts of a fraction by the whole multiplier leaves the value
 *   alone, and `a/b × w` for `w ≥ 2` does not.
 * - Writing the whole part in front of the numerator multiplies it by a power of
 *   ten; turning a mixed number into an improper fraction multiplies it by the
 *   denominator. The generator never poses the one denominator on which those are
 *   the same operation.
 *
 * `mis.mul.makes-bigger` is **not** here, and CURRICULUM.md's honesty rule is why.
 * The documented finding is that children choose the operation that makes a number
 * larger — it is a belief about which calculation to do, and its executable home is
 * the word-problem families, where the child picks. In a written calculation there
 * is nothing to pick, and a "procedure" invented to stand for it would be a bug
 * nobody has observed.
 */

import { FRAC_ARITH_FAMILY } from "../generators/fracArith/constants.ts";
import { readFracOperands } from "../generators/fracArith/read.ts";
import { FRAC_EQUIVALENCE_FAMILY } from "../generators/fracEquivalence/constants.ts";
import { readEquivalenceItem } from "../generators/fracEquivalence/read.ts";
import { fractionAnswer } from "../generators/shared/fractions.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import { malRuleId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";
import { MIS_WHOLE_NUMBER_BIAS } from "./roots.ts";

export const MIS_ADD_NUMERATORS_AND_DENOMINATORS = malRuleId(
  "mis.frac.add-numerators-and-denominators",
);
export const MIS_SCALE_BOTH_PARTS = malRuleId("mis.frac.scale-both-parts");
export const MIS_MIXED_NUMBER_CONCATENATION = malRuleId("mis.frac.mixed-number-concatenation");

/** `a/b + c/d = (a+c)/(b+d)`. */
export const addNumeratorsAndDenominators: MalRule = {
  id: MIS_ADD_NUMERATORS_AND_DENOMINATORS,
  family: FRAC_ARITH_FAMILY,
  parent: MIS_WHOLE_NUMBER_BIAS,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const operands = readFracOperands(exercise);
    return operands !== null && operands.operation === "add";
  },

  apply(exercise: Exercise): AnswerValue | null {
    const operands = readFracOperands(exercise);
    if (operands === null || operands.operation !== "add") return null;
    return fractionAnswer({
      whole: 0n,
      num: operands.leftNum + operands.rightNum,
      den: operands.leftDen + operands.rightDen,
    });
  },
};

/**
 * `a/b × w = (a·w)/(b·w)` — the equivalent-fractions rule, applied to a product.
 *
 * The result is `a/b` again, which is what makes it recognisable: the child
 * multiplied and the number did not change.
 */
export const scaleBothParts: MalRule = {
  id: MIS_SCALE_BOTH_PARTS,
  family: FRAC_ARITH_FAMILY,
  parent: MIS_WHOLE_NUMBER_BIAS,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const operands = readFracOperands(exercise);
    return operands !== null && operands.operation === "mul-whole" && operands.rightNum >= 2n;
  },

  apply(exercise: Exercise): AnswerValue | null {
    const operands = readFracOperands(exercise);
    if (operands === null || operands.operation !== "mul-whole" || operands.rightNum < 2n) return null;
    return fractionAnswer({
      whole: 0n,
      num: operands.leftNum * operands.rightNum,
      den: operands.leftDen * operands.rightNum,
    });
  },
};

/** `w n/d` written as `wn/d` — the whole part pushed in front of the numerator. */
export const mixedNumberConcatenation: MalRule = {
  id: MIS_MIXED_NUMBER_CONCATENATION,
  family: FRAC_EQUIVALENCE_FAMILY,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const item = readEquivalenceItem(exercise);
    return item !== null && item.task === "to-improper" && item.whole > 0n;
  },

  apply(exercise: Exercise): AnswerValue | null {
    const item = readEquivalenceItem(exercise);
    if (item === null || item.task !== "to-improper" || item.whole <= 0n) return null;
    const concatenated = BigInt(`${item.whole.toString()}${item.num.toString()}`);
    return fractionAnswer({ whole: 0n, num: concatenated, den: item.den });
  },
};

export const fracArithMalRules: readonly MalRule[] = [addNumeratorsAndDenominators, scaleBothParts];
export const fracEquivalenceMalRules: readonly MalRule[] = [mixedNumberConcatenation];
export const fractionMalRules: readonly MalRule[] = [...fracArithMalRules, ...fracEquivalenceMalRules];
