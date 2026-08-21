/**
 * Reading a division back out of a finished `Exercise`, for the mal-rules.
 * The published contract only; never throws.
 */

import { asInteger } from "../../math/rational.ts";
import type { Exercise } from "../../types/exercise.ts";
import {
  PROMPT_KEY_QUOTIENT,
  PROMPT_KEY_QUOTIENT_REMAINDER,
  PROMPT_KEY_REMAINDER,
  SLOT_DIVIDEND,
  SLOT_DIVISOR,
} from "./constants.ts";
import type { DivTask } from "./params.ts";

export type Division = {
  readonly task: DivTask;
  readonly dividend: bigint;
  readonly divisor: bigint;
  readonly quotient: bigint;
  readonly remainder: bigint;
};

function taskOf(key: string): DivTask | null {
  if (key === PROMPT_KEY_QUOTIENT) return "quotient";
  if (key === PROMPT_KEY_REMAINDER) return "remainder";
  if (key === PROMPT_KEY_QUOTIENT_REMAINDER) return "quotient-and-remainder";
  return null;
}

export function readDivision(exercise: Exercise): Division | null {
  const task = taskOf(exercise.prompt.key);
  if (task === null) return null;

  const dividendSlot = exercise.prompt.slots[SLOT_DIVIDEND];
  const divisorSlot = exercise.prompt.slots[SLOT_DIVISOR];
  if (dividendSlot === undefined || dividendSlot.kind !== "number") return null;
  if (divisorSlot === undefined || divisorSlot.kind !== "number") return null;

  const dividend = asInteger(dividendSlot.value);
  const divisor = asInteger(divisorSlot.value);
  if (dividend === null || divisor === null) return null;
  if (dividend < 0n || divisor <= 0n) return null;

  return { task, dividend, divisor, quotient: dividend / divisor, remainder: dividend % divisor };
}
