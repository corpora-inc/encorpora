/**
 * Reading a fraction calculation back out of a finished `Exercise`, for the
 * mal-rules. The published contract only; never throws.
 */

import { asInteger } from "../../math/rational.ts";
import type { Exercise, PromptSlot } from "../../types/exercise.ts";
import {
  PROMPT_KEY_ADD,
  PROMPT_KEY_MUL,
  PROMPT_KEY_MUL_WHOLE,
  PROMPT_KEY_SUB,
  SLOT_LEFT,
  SLOT_RIGHT,
} from "./constants.ts";

export type FracOperation = "add" | "sub" | "mul" | "mul-whole";

export type FracOperands = {
  readonly operation: FracOperation;
  readonly leftNum: bigint;
  readonly leftDen: bigint;
  /** On `mul-whole` this is the whole number, with `rightDen` one. */
  readonly rightNum: bigint;
  readonly rightDen: bigint;
};

function operationOf(key: string): FracOperation | null {
  if (key === PROMPT_KEY_ADD) return "add";
  if (key === PROMPT_KEY_SUB) return "sub";
  if (key === PROMPT_KEY_MUL) return "mul";
  if (key === PROMPT_KEY_MUL_WHOLE) return "mul-whole";
  return null;
}

function fractionOf(slot: PromptSlot | undefined): { num: bigint; den: bigint } | null {
  if (slot === undefined) return null;
  if (slot.kind === "fraction") {
    if (slot.whole !== undefined && slot.whole !== 0n) return null;
    return slot.den > 0n ? { num: slot.num, den: slot.den } : null;
  }
  if (slot.kind === "number") {
    const whole = asInteger(slot.value);
    return whole === null ? null : { num: whole, den: 1n };
  }
  return null;
}

export function readFracOperands(exercise: Exercise): FracOperands | null {
  const operation = operationOf(exercise.prompt.key);
  if (operation === null) return null;
  const left = fractionOf(exercise.prompt.slots[SLOT_LEFT]);
  const right = fractionOf(exercise.prompt.slots[SLOT_RIGHT]);
  if (left === null || right === null) return null;
  return {
    operation,
    leftNum: left.num,
    leftDen: left.den,
    rightNum: right.num,
    rightDen: right.den,
  };
}
