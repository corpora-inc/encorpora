/**
 * Reading a place-value question back out of a finished `Exercise`.
 *
 * Mal-rules are `(exercise) => AnswerValue | null`: they see the published exercise
 * contract and never the generator's internals, which is what lets the same
 * function serve as a distractor source at authoring time and as a diagnosis at
 * runtime. So they need a supported way to recover what was asked, and this is it.
 *
 * Never throws. A rule handed an item from another family declines it.
 */

import { asInteger, pow10 } from "../../math/rational.ts";
import type { Exercise } from "../../types/exercise.ts";
import {
  PLACE_TERM_KEYS,
  PROMPT_KEY_DIGIT_IN_PLACE,
  PROMPT_KEY_DIGIT_VALUE,
  PROMPT_KEY_TOTAL_IN_PLACE,
  SLOT_NUMBER,
  SLOT_PLACE,
} from "./constants.ts";
import type { PlaceValueTask } from "./params.ts";

export type PlaceValueQuestion = {
  readonly task: PlaceValueTask;
  readonly value: bigint;
  /** Counted from the units column, which is place 0. */
  readonly place: number;
  /** The digit written in that place. */
  readonly digit: bigint;
};

function taskOf(key: string): PlaceValueTask | null {
  if (key === PROMPT_KEY_DIGIT_VALUE) return "digit-value";
  if (key === PROMPT_KEY_DIGIT_IN_PLACE) return "digit-in-place";
  if (key === PROMPT_KEY_TOTAL_IN_PLACE) return "total-in-place";
  return null;
}

export function readPlaceValueQuestion(exercise: Exercise): PlaceValueQuestion | null {
  const task = taskOf(exercise.prompt.key);
  if (task === null) return null;

  const numberSlot = exercise.prompt.slots[SLOT_NUMBER];
  const placeSlot = exercise.prompt.slots[SLOT_PLACE];
  if (numberSlot === undefined || numberSlot.kind !== "number") return null;
  if (placeSlot === undefined || placeSlot.kind !== "term") return null;

  const value = asInteger(numberSlot.value);
  if (value === null || value < 0n) return null;

  const place = PLACE_TERM_KEYS.indexOf(placeSlot.key);
  if (place < 0) return null;

  return { task, value, place, digit: (value / pow10(place)) % 10n };
}
