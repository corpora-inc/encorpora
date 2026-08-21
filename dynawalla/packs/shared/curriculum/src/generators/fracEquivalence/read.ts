/**
 * Reading an equivalence item back out of a finished `Exercise`, for the mal-rules.
 * The published contract only; never throws.
 */

import type { Exercise } from "../../types/exercise.ts";
import {
  PROMPT_KEY_BUILD,
  PROMPT_KEY_SIMPLIFY,
  PROMPT_KEY_TO_IMPROPER,
  PROMPT_KEY_TO_MIXED,
  SLOT_FRACTION,
} from "./constants.ts";
import type { EquivalenceTask } from "./params.ts";

export type EquivalenceItem = {
  readonly task: EquivalenceTask;
  readonly whole: bigint;
  readonly num: bigint;
  readonly den: bigint;
};

function taskOf(key: string): EquivalenceTask | null {
  if (key === PROMPT_KEY_SIMPLIFY) return "simplify";
  if (key === PROMPT_KEY_BUILD) return "build";
  if (key === PROMPT_KEY_TO_MIXED) return "to-mixed";
  if (key === PROMPT_KEY_TO_IMPROPER) return "to-improper";
  return null;
}

export function readEquivalenceItem(exercise: Exercise): EquivalenceItem | null {
  const task = taskOf(exercise.prompt.key);
  if (task === null) return null;
  const slot = exercise.prompt.slots[SLOT_FRACTION];
  if (slot === undefined || slot.kind !== "fraction") return null;
  if (slot.den <= 0n || slot.num < 0n) return null;
  return { task, whole: slot.whole ?? 0n, num: slot.num, den: slot.den };
}
