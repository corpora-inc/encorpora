/**
 * `gen.number.round-estimate` parameters.
 *
 * The place a level rounds to is drawn from a range, so one row covers "round to
 * the nearest ten or hundred" without two level tables. The validator rejects the
 * two combinations that produce a question with nothing in it: rounding to a place
 * at or above the number's own width (every answer is 0 or the number itself), and
 * a tie level whose place leaves no digit to be the deciding five.
 */

import { MAX_WHOLE_DIGITS } from "../shared/draw.ts";
import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type RoundEstimateParams = {
  readonly digits: number;
  /** Lowest place the level rounds to, counted from the units column. */
  readonly minPlace: number;
  readonly maxPlace: number;
  /**
   * Pose exact halfway numbers — 4,750 to the nearest hundred.
   *
   * Rounding half up is the convention; a level that never poses the tie never
   * finds out whether the child holds it.
   */
  readonly ties: boolean;
};

export const MIN_DIGITS = 2;

export const roundEstimateParamSchema: ParamSchema<RoundEstimateParams> = {
  describe: "{ digits: 2..7, minPlace: 1..digits-1, maxPlace: minPlace..digits-1, ties: boolean }",

  validate(raw: unknown): ParamResult<RoundEstimateParams> {
    const read = reader(raw);
    const digits = read.int("digits", MIN_DIGITS, MAX_WHOLE_DIGITS);
    const minPlace = read.int("minPlace", 1, Math.max(1, digits - 1));
    const maxPlace = read.int("maxPlace", 1, Math.max(1, digits - 1));
    const ties = read.boolean("ties");

    if (read.clean() && maxPlace < minPlace) {
      read.reject("maxPlace", "maxPlace must be at least minPlace");
    }
    return read.finish({ digits, minPlace, maxPlace, ties });
  },
};
