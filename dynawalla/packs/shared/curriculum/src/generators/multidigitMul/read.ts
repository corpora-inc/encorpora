/**
 * Reading a multiplication back out of a finished `Exercise`, for the mal-rules.
 * The published contract only; never throws.
 */

import { asInteger } from "../../math/rational.ts";
import type { Exercise } from "../../types/exercise.ts";
import { PROMPT_KEY_PRODUCT, SLOT_BOTTOM, SLOT_TOP } from "./constants.ts";

export type Factors = { readonly top: bigint; readonly bottom: bigint };

export function readFactors(exercise: Exercise): Factors | null {
  if (exercise.prompt.key !== PROMPT_KEY_PRODUCT) return null;
  const top = exercise.prompt.slots[SLOT_TOP];
  const bottom = exercise.prompt.slots[SLOT_BOTTOM];
  if (top === undefined || top.kind !== "number") return null;
  if (bottom === undefined || bottom.kind !== "number") return null;
  const topValue = asInteger(top.value);
  const bottomValue = asInteger(bottom.value);
  if (topValue === null || bottomValue === null) return null;
  if (topValue < 0n || bottomValue < 0n) return null;
  return { top: topValue, bottom: bottomValue };
}
