/**
 * `gen.arith.long-div` mal-rules.
 *
 * `mis.div.divisor-must-be-smaller` — the belief that you divide the bigger number
 * by the smaller one — is named in CURRICULUM.md and is **not** here. Its home is
 * an item where the divisor is the larger number, and this family never poses one:
 * whole-number long division with a divisor bigger than the dividend has no
 * whole-number quotient. The bug belongs with the word-problem families, where the
 * child chooses the operation, and with fraction division in V2. Shipping a
 * version of it that could never fire would be a registry entry pretending to
 * cover a misconception nothing tests.
 */

import { rational } from "../math/rational.ts";
import { LONG_DIV_FAMILY } from "../generators/longDiv/constants.ts";
import { hasInteriorZero, withoutInteriorZeros } from "../generators/longDiv/procedure.ts";
import { readDivision } from "../generators/longDiv/read.ts";
import { fractionAnswer } from "../generators/shared/fractions.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import { malRuleId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";

export const MIS_REMAINDER_DROPPED = malRuleId("mis.div.remainder-dropped");
export const MIS_QUOTIENT_ZERO_SKIPPED = malRuleId("mis.div.quotient-zero-skipped");

/**
 * What is left over is thrown away — the division "came out even".
 *
 * Written two ways, because the item asks two ways: a remainder of zero where the
 * remainder was the question, and a mixed number with nothing in its fraction part
 * where the whole answer was. Defined only where something is actually left over,
 * and wrong on every such item.
 */
export const remainderDropped: MalRule = {
  id: MIS_REMAINDER_DROPPED,
  family: LONG_DIV_FAMILY,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const division = readDivision(exercise);
    return division !== null && division.remainder > 0n && division.task !== "quotient";
  },

  apply(exercise: Exercise): AnswerValue | null {
    const division = readDivision(exercise);
    if (division === null || division.remainder === 0n) return null;
    if (division.task === "remainder") return { kind: "integer", value: rational(0n) };
    if (division.task === "quotient-and-remainder") {
      return fractionAnswer({ whole: division.quotient, num: 0n, den: division.divisor });
    }
    return null;
  },
};

/**
 * The zero in the quotient is never written.
 *
 * At a column where the partial dividend is smaller than the divisor, the child
 * brings the next digit down without first recording the zero above the line:
 * `4,208 ÷ 4` is written as `152` rather than `1,052`. Removing a digit removes a
 * place, so the buggy quotient is strictly smaller than the correct one and the two
 * can never coincide.
 *
 * Defined on the tasks whose answer *is* the quotient. On a remainder question the
 * dropped zero changes the working and not the answer that was asked for, so there
 * is nothing for the rule to produce.
 */
export const quotientZeroSkipped: MalRule = {
  id: MIS_QUOTIENT_ZERO_SKIPPED,
  family: LONG_DIV_FAMILY,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const division = readDivision(exercise);
    if (division === null || division.task === "remainder") return false;
    return hasInteriorZero(division.quotient);
  },

  apply(exercise: Exercise): AnswerValue | null {
    const division = readDivision(exercise);
    if (division === null || division.task === "remainder") return null;
    if (!hasInteriorZero(division.quotient)) return null;
    const written = withoutInteriorZeros(division.quotient);
    return division.task === "quotient"
      ? { kind: "integer", value: rational(written) }
      : fractionAnswer({ whole: written, num: division.remainder, den: division.divisor });
  },
};

export const longDivMalRules: readonly MalRule[] = [remainderDropped, quotientZeroSkipped];
