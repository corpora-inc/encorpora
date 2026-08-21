/**
 * `gen.number.place-value-decompose` parameters.
 *
 * Three tasks over one number, and the validator's job is to reject the
 * combinations that would produce a question with no answer or with two.
 *
 * - `digit-value` ("what is the digit in the hundreds place worth?") and
 *   `total-in-place` ("how many hundreds altogether?") must not ask about the units
 *   column: in units both questions collapse onto `digit-in-place` and the item
 *   teaches nothing.
 * - `total-in-place` must leave at least two digits above the place it asks about,
 *   or the "altogether" count *is* the digit and the question is the same question
 *   asked twice.
 */

import { MAX_WHOLE_DIGITS } from "../shared/draw.ts";
import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type PlaceValueTask = "digit-value" | "digit-in-place" | "total-in-place";

export const PLACE_VALUE_TASKS: readonly PlaceValueTask[] = [
  "digit-value",
  "digit-in-place",
  "total-in-place",
];

export type PlaceValueParams = {
  readonly task: PlaceValueTask;
  /** Digit count of the number the question is about. */
  readonly digits: number;
  /** Lowest place the question may ask about, counted from the units column. */
  readonly minPlace: number;
  readonly maxPlace: number;
};

export const MIN_DIGITS = 2;

export const placeValueParamSchema: ParamSchema<PlaceValueParams> = {
  describe:
    "{ task: 'digit-value'|'digit-in-place'|'total-in-place', digits: 2..7, " +
    "minPlace: 0..digits-1, maxPlace: minPlace..digits-1 }",

  validate(raw: unknown): ParamResult<PlaceValueParams> {
    const read = reader(raw);
    const task = read.choice<PlaceValueTask>("task", PLACE_VALUE_TASKS);
    const digits = read.int("digits", MIN_DIGITS, MAX_WHOLE_DIGITS);
    const minPlace = read.int("minPlace", 0, digits - 1);
    const maxPlace = read.int("maxPlace", 0, digits - 1);

    if (read.clean()) {
      if (maxPlace < minPlace) {
        read.reject("maxPlace", "maxPlace must be at least minPlace");
      }
      if (task !== "digit-in-place" && minPlace < 1) {
        read.reject(
          "minPlace",
          `${task} in the units column is the same question as digit-in-place; minPlace must be at least 1`,
        );
      }
      if (task === "total-in-place" && maxPlace > digits - 2) {
        read.reject(
          "maxPlace",
          "total-in-place needs two digits above the place it counts, or the total is the digit itself",
        );
      }
    }

    return read.finish({ task, digits, minPlace, maxPlace });
  },
};
