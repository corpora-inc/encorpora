/**
 * The three `gen.arith.column-op` mal-rules.
 *
 * Each one *runs the buggy procedure* rather than computing a shortcut from the
 * correct answer. That matters: `mis.add.borrow-across-zero` happens to come out
 * as "the correct answer plus the 1,000 that was borrowed and never given up", but
 * that identity is a consequence of the procedure, not its definition, and encoding
 * the shortcut instead would silently stop matching the moment the borrow chain has
 * a different shape. The identity is asserted as a *test*, not used as the
 * implementation.
 *
 * The distinction the program has already got wrong once, and must not again:
 *
 *   5001 − 2798.  Correct: 2203.
 *   3797 is `mis.add.smaller-from-larger` — |5−2| |0−7| |0−9| |1−8|, the smaller
 *         digit taken from the larger in every column. It is not off by a
 *         place-value unit at all, and its contrast is the number line.
 *   3203 is `mis.add.borrow-across-zero` — regrouped all the way down, the zeros
 *         written as 9s, and the thousand never taken off the leading digit. It is
 *         exactly 1,000 more than the correct answer, which is what makes the
 *         counting board a real contradiction rather than an illustration.
 *
 * Both rules are individually valid and both diverge from the correct answer on
 * ≥95% of seeds, so CG-12 cannot catch a mapping error between them (see
 * ADAPTIVE_LEARNING.md). `columnOp.test.ts` asserts the mapping directly.
 */

import { digitsToRational, readOperands } from "../generators/columnOp/digits.ts";
import { answerValueFor } from "../generators/columnOp/answerValue.ts";
import { COLUMN_OP_FAMILY } from "../generators/columnOp/constants.ts";
import { addColumns, subtractColumns } from "../generators/columnOp/procedure.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import { malRuleId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";

export const MIS_SMALLER_FROM_LARGER = malRuleId("mis.add.smaller-from-larger");
export const MIS_BORROW_ACROSS_ZERO = malRuleId("mis.add.borrow-across-zero");
export const MIS_CARRY_DROPPED = malRuleId("mis.add.carry-dropped");

/**
 * The counting board is the LOCATE representation for borrow-across-zero.
 * Re-exported, not redeclared: the id belongs to `render/representations.ts`
 * with the other three, and two spellings of one `RepId` is a `RepSpec` that
 * matches no renderer.
 */
export { REP_COUNTING_BOARD } from "../render/representations.ts";
import { REP_COUNTING_BOARD } from "../render/representations.ts";

type Trace = {
  readonly digits: readonly number[];
  /** The buggy borrow chain crossed at least one zero. */
  readonly crossedZero: boolean;
  readonly defined: boolean;
};

const UNDEFINED_TRACE: Trace = { digits: [], crossedZero: false, defined: false };

/**
 * Column subtraction as a child performs it who regroups across a zero run —
 * writing the zeros as 9s — but never decrements the non-zero digit that the run
 * was supposed to borrow from.
 */
export function traceBorrowAcrossZero(
  top: readonly number[],
  bottom: readonly number[],
  cols: number,
): Trace {
  const work = [...top];
  const out: number[] = [];
  let crossedZero = false;

  for (let i = 0; i < cols; i++) {
    let t = work[i] ?? 0;
    const s = bottom[i] ?? 0;
    if (t < s) {
      let j = i + 1;
      while (j < cols && (work[j] ?? 0) === 0) {
        work[j] = 9;
        j += 1;
      }
      if (j >= cols) return UNDEFINED_TRACE;
      if (j > i + 1) {
        // The bug: the run of zeros became 9s and the digit above it was left alone.
        crossedZero = true;
      } else {
        work[j] = (work[j] ?? 0) - 1;
      }
      t += 10;
    }
    out.push(t - s);
  }
  return { digits: out, crossedZero, defined: true };
}

/**
 * Which columns regroup under the correct procedure — the yardstick the buggy ones
 * are measured against, and what the property tests use as the *definition* of a
 * level's regrouping count.
 *
 * Both read `procedure.ts`, which is also what the generator runs. A second copy of
 * the borrow procedure here is the divergence `params.ts` warns about, and it has
 * already happened once in this family.
 */
export function correctBorrows(
  top: readonly number[],
  bottom: readonly number[],
  cols: number,
): boolean[] {
  return subtractColumns(top, bottom, cols).columns.map((column) => column.borrowed);
}

/** Correct column addition carries. */
export function correctCarries(
  top: readonly number[],
  bottom: readonly number[],
  cols: number,
): boolean[] {
  return addColumns(top, bottom, cols).columns.map((column) => column.carried);
}

function output(exercise: Exercise, digits: readonly number[], decimalPlaces: number): AnswerValue {
  return answerValueFor(exercise.schema, digitsToRational(digits, decimalPlaces));
}

/**
 * `mis.add.smaller-from-larger` — in every column the smaller digit is taken from
 * the larger one, whichever is on top, and no regrouping happens at all.
 */
export const smallerFromLarger: MalRule = {
  id: MIS_SMALLER_FROM_LARGER,
  family: COLUMN_OP_FAMILY,
  // The contrast for this bug is magnitude (the answer is far too large), which is
  // a number-line contradiction, not a counting-board one. Stage 2 for it is not
  // built yet, so it is not tagged LOCATE-capable (CG-22).
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const operands = readOperands(exercise);
    if (operands === null || operands.op !== "sub") return false;
    // Undefined unless at least one column would have needed regrouping — with no
    // regrouping the buggy procedure and the correct one are the same procedure.
    return operands.top.some((digit, i) => (operands.bottom[i] ?? 0) > digit);
  },

  apply(exercise: Exercise): AnswerValue | null {
    const operands = readOperands(exercise);
    if (operands === null || operands.op !== "sub") return null;
    const digits = operands.top.map((digit, i) => Math.abs(digit - (operands.bottom[i] ?? 0)));
    return output(exercise, digits, operands.decimalPlaces);
  },
};

/**
 * `mis.add.borrow-across-zero` — regrouped all the way down through the zeros,
 * never decremented the digit above the run.
 */
export const borrowAcrossZero: MalRule = {
  id: MIS_BORROW_ACROSS_ZERO,
  family: COLUMN_OP_FAMILY,
  locateCapable: true,
  contrastRep: REP_COUNTING_BOARD,

  applies(exercise: Exercise): boolean {
    const operands = readOperands(exercise);
    if (operands === null || operands.op !== "sub") return false;
    const trace = traceBorrowAcrossZero(operands.top, operands.bottom, operands.cols);
    return trace.defined && trace.crossedZero;
  },

  apply(exercise: Exercise): AnswerValue | null {
    const operands = readOperands(exercise);
    if (operands === null || operands.op !== "sub") return null;
    const trace = traceBorrowAcrossZero(operands.top, operands.bottom, operands.cols);
    if (!trace.defined) return null;
    return output(exercise, trace.digits, operands.decimalPlaces);
  },
};

/**
 * `mis.add.carry-dropped` — every column added correctly, no carry ever recorded
 * or added into the next column.
 */
export const carryDropped: MalRule = {
  id: MIS_CARRY_DROPPED,
  family: COLUMN_OP_FAMILY,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const operands = readOperands(exercise);
    if (operands === null || operands.op !== "add") return false;
    return correctCarries(operands.top, operands.bottom, operands.cols).some(Boolean);
  },

  apply(exercise: Exercise): AnswerValue | null {
    const operands = readOperands(exercise);
    if (operands === null || operands.op !== "add") return null;
    const digits = operands.top.map((digit, i) => (digit + (operands.bottom[i] ?? 0)) % 10);
    return output(exercise, digits, operands.decimalPlaces);
  },
};

/** Registry order is stable: it fixes distractor order in generated items. */
export const columnOpMalRules: readonly MalRule[] = [
  smallerFromLarger,
  borrowAcrossZero,
  carryDropped,
];
