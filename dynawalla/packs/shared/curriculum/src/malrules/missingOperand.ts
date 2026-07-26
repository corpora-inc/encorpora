/**
 * `gen.arith.missing-operand` mal-rules — the equals sign read as an instruction.
 *
 * These two are the best-evidenced errors in elementary algebra. On `8 + 4 = ☐ + 5`
 * the correct answer is 7; the two documented wrong answers are **12** (the total of
 * the side that is complete — "the equals sign means write the answer") and **17**
 * (every number on the card added up). Both are produced here by running the
 * procedure, and both are wrong on every item they are defined on: the generator
 * never writes a zero on the card, so 12 and 17 and 7 are three different numbers.
 *
 * They are also never both right about the same wrong answer, which matters more
 * than it looks: `classify` returns `null` the moment two rules explain one
 * response, and a Stage-2 repair built for the wrong one of these is a repair for a
 * belief the child does not hold.
 */

import { rational } from "../math/rational.ts";
import { MISSING_OPERAND_FAMILY } from "../generators/missingOperand/constants.ts";
import { readSentence } from "../generators/missingOperand/read.ts";
import type { Sentence } from "../generators/missingOperand/read.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import { malRuleId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";

export const MIS_EQUALS_AS_OPERATOR = malRuleId("mis.alg.equals-as-operator");
export const MIS_ADD_ALL_NUMBERS = malRuleId("mis.alg.add-all-numbers");

/**
 * The total of the complete side, written into the box.
 *
 * Defined only on `both-sides`: it takes a side that is finished to total, and a
 * sentence with one operator does not have one.
 */
export const equalsAsOperator: MalRule = {
  id: MIS_EQUALS_AS_OPERATOR,
  family: MISSING_OPERAND_FAMILY,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const sentence = readSentence(exercise);
    return sentence !== null && sentence.shape === "both-sides";
  },

  apply(exercise: Exercise): AnswerValue | null {
    const sentence = readSentence(exercise);
    if (sentence === null || sentence.shape !== "both-sides") return null;
    return { kind: "integer", value: rational(sentence.leftA + sentence.leftB) };
  },
};

/** Every number on the card, added. */
function allNumbers(sentence: Sentence): bigint {
  return sentence.shape === "both-sides"
    ? sentence.leftA + sentence.leftB + sentence.rightKnown
    : sentence.known + sentence.total;
}

/**
 * Defined on three of the five shapes, and the two exclusions are different kinds
 * of undefined.
 *
 * `mul-unknown` has no addition on the card at all, so a child reaching for one is
 * not making *this* mistake.
 *
 * `☐ − a = c` is the sharper case, and the sweep is what found it: adding every
 * number on the card gives `a + c`, which is the **correct** answer to that
 * sentence. The buggy procedure and the right one are the same procedure there, so
 * the bug is not instantiated — exactly the reading `mis.add.smaller-from-larger`
 * already uses for a subtraction with nothing to regroup. Leaving it in would have
 * shipped a rule that agrees with the answer on a quarter of its items, and a
 * "diagnosis" that fires on correct work is worse than none.
 */
export const addAllNumbers: MalRule = {
  id: MIS_ADD_ALL_NUMBERS,
  family: MISSING_OPERAND_FAMILY,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const sentence = readSentence(exercise);
    return sentence !== null && sentence.shape !== "mul-unknown" && sentence.shape !== "sub-unknown-minuend";
  },

  apply(exercise: Exercise): AnswerValue | null {
    const sentence = readSentence(exercise);
    if (sentence === null || sentence.shape === "mul-unknown") return null;
    if (sentence.shape === "sub-unknown-minuend") return null;
    return { kind: "integer", value: rational(allNumbers(sentence)) };
  },
};

export const missingOperandMalRules: readonly MalRule[] = [equalsAsOperator, addAllNumbers];
