/**
 * Reading a comparison back out of a finished `Exercise`, for the mal-rules.
 *
 * The two operands are prompt slots, which is the published contract; nothing here
 * reaches into the generator. Never throws — a rule handed another family's item
 * declines it.
 */

import { rational } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import type { AnswerValue } from "../../types/answer.ts";
import type { Exercise, PromptSlot } from "../../types/exercise.ts";
import { PROMPT_KEY_GREATER, PROMPT_KEY_LESSER, SLOT_LEFT, SLOT_RIGHT } from "./constants.ts";
import type { CompareTask } from "./params.ts";

export type CompareOperand =
  | { readonly kind: "number"; readonly value: Rational; readonly decimalPlaces: number }
  | { readonly kind: "fraction"; readonly num: bigint; readonly den: bigint };

export type ComparePair = {
  readonly task: CompareTask;
  readonly left: CompareOperand;
  readonly right: CompareOperand;
};

function operandOf(slot: PromptSlot | undefined): CompareOperand | null {
  if (slot === undefined) return null;
  if (slot.kind === "number") {
    return { kind: "number", value: slot.value, decimalPlaces: slot.decimalPlaces };
  }
  if (slot.kind === "fraction") {
    // A comparison never poses a mixed number: both operands are proper fractions
    // written as one numerator over one denominator, which is what makes "same
    // numerator" a readable property of the item.
    if (slot.whole !== undefined && slot.whole !== 0n) return null;
    return { kind: "fraction", num: slot.num, den: slot.den };
  }
  return null;
}

/** The exact value of an operand, whichever way it is written. */
export function operandValue(operand: CompareOperand): Rational {
  return operand.kind === "number" ? operand.value : rational(operand.num, operand.den);
}

/** The answer a child writes when they choose this operand. */
export function operandAnswer(operand: CompareOperand): AnswerValue {
  return operand.kind === "number"
    ? { kind: "integer", value: operand.value }
    : { kind: "fraction", num: operand.num, den: operand.den };
}

export function readComparePair(exercise: Exercise): ComparePair | null {
  const task: CompareTask | null =
    exercise.prompt.key === PROMPT_KEY_GREATER
      ? "greater"
      : exercise.prompt.key === PROMPT_KEY_LESSER
        ? "lesser"
        : null;
  if (task === null) return null;

  const left = operandOf(exercise.prompt.slots[SLOT_LEFT]);
  const right = operandOf(exercise.prompt.slots[SLOT_RIGHT]);
  if (left === null || right === null) return null;
  if (left.kind !== right.kind) return null;
  return { task, left, right };
}
