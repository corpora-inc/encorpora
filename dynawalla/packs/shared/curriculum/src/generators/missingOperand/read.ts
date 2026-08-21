/**
 * Reading a number sentence back out of a finished `Exercise`, for the mal-rules.
 * The published contract only; never throws.
 */

import { asInteger } from "../../math/rational.ts";
import type { Exercise, PromptSlot } from "../../types/exercise.ts";
import {
  PROMPT_KEY_ADD_UNKNOWN,
  PROMPT_KEY_BOTH_SIDES,
  PROMPT_KEY_MUL_UNKNOWN,
  PROMPT_KEY_SUB_UNKNOWN,
  PROMPT_KEY_SUB_UNKNOWN_MINUEND,
  SLOT_KNOWN,
  SLOT_LEFT_A,
  SLOT_LEFT_B,
  SLOT_RIGHT_KNOWN,
  SLOT_TOTAL,
} from "./constants.ts";
import type { SentenceShape } from "./params.ts";

export type Sentence =
  | {
      readonly shape: "add-unknown" | "sub-unknown" | "sub-unknown-minuend" | "mul-unknown";
      /** The number written beside the box. */
      readonly known: bigint;
      /** The number on the other side of the equals sign. */
      readonly total: bigint;
    }
  | {
      readonly shape: "both-sides";
      readonly leftA: bigint;
      readonly leftB: bigint;
      readonly rightKnown: bigint;
    };

function shapeOf(key: string): SentenceShape | null {
  if (key === PROMPT_KEY_ADD_UNKNOWN) return "add-unknown";
  if (key === PROMPT_KEY_SUB_UNKNOWN) return "sub-unknown";
  if (key === PROMPT_KEY_SUB_UNKNOWN_MINUEND) return "sub-unknown-minuend";
  if (key === PROMPT_KEY_MUL_UNKNOWN) return "mul-unknown";
  if (key === PROMPT_KEY_BOTH_SIDES) return "both-sides";
  return null;
}

function whole(slot: PromptSlot | undefined): bigint | null {
  if (slot === undefined || slot.kind !== "number") return null;
  return asInteger(slot.value);
}

export function readSentence(exercise: Exercise): Sentence | null {
  const shape = shapeOf(exercise.prompt.key);
  if (shape === null) return null;

  if (shape === "both-sides") {
    const leftA = whole(exercise.prompt.slots[SLOT_LEFT_A]);
    const leftB = whole(exercise.prompt.slots[SLOT_LEFT_B]);
    const rightKnown = whole(exercise.prompt.slots[SLOT_RIGHT_KNOWN]);
    if (leftA === null || leftB === null || rightKnown === null) return null;
    return { shape, leftA, leftB, rightKnown };
  }

  const known = whole(exercise.prompt.slots[SLOT_KNOWN]);
  const total = whole(exercise.prompt.slots[SLOT_TOTAL]);
  if (known === null || total === null) return null;
  return { shape, known, total };
}
