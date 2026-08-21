/**
 * `gen.arith.number-facts` parameters and their validator.
 *
 * A fact is bounded by a **value**, not by a digit count, and that is the whole
 * reason this family exists beside `gen.arith.column-op`. Digit count says
 * "two-digit minuend, one-digit subtrahend, one borrow", which is `94 − 6` as
 * readily as `15 − 8`; only a value bound says "within twenty, crossing ten".
 *
 * `maxTotal` is the largest number the fact reaches — the sum for addition, the
 * whole for subtraction. One parameter for both because it is one quantity:
 * `7 + 8 = 15` and `15 − 8 = 7` are the same fact read two ways, and a level
 * table that named them differently would obscure that.
 *
 * The validator rejects the combinations no fact could satisfy, so `generate()`
 * can treat an empty fact set as a bug rather than as input it has to guess about.
 */

import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type NumberFactsOp = "add" | "sub";

export const NUMBER_FACTS_OPS: readonly NumberFactsOp[] = ["add", "sub"];

export type NumberFactsParams = {
  readonly op: NumberFactsOp;
  /**
   * The largest number the fact reaches: the sum for `add`, the whole for `sub`.
   * The smallest useful level is `2`, which is `0 + 1`, `1 + 0`, `1 + 1`, `2 + 0`
   * and `0 + 2`.
   */
  readonly maxTotal: number;
  /** Only facts that cross ten — `7 + 8`, `15 − 8`. Excludes every zero operand. */
  readonly crossesTen: boolean;
  /** Admit the identity facts: `0 + n`, `n + 0`, `n − 0`, `n − n`. */
  readonly includeZero: boolean;
  /** Draw the quantity in a ten-frame beside the numerals. */
  readonly picture: boolean;
};

/** `0 + 1` needs a total of one; a level of only `1 + 0` and `0 + 1` is thin. */
export const MIN_MAX_TOTAL = 2;
/** `9 + 9`, and the largest teen a single-digit part can be taken from. */
export const MAX_MAX_TOTAL = 18;
/** Below this a fact does not cross ten at all. */
export const MIN_CROSSING_TOTAL = 11;
/** The ten-frame holds ten. A picture beyond it would be a different frame. */
export const MAX_PICTURE_TOTAL = 10;

export const numberFactsParamSchema: ParamSchema<NumberFactsParams> = {
  describe:
    "{ op: 'add'|'sub', maxTotal: 2..18, crossesTen: boolean, includeZero: boolean, picture: boolean }",

  validate(raw: unknown): ParamResult<NumberFactsParams> {
    const read = reader(raw);
    const op = read.choice<NumberFactsOp>("op", NUMBER_FACTS_OPS);
    const maxTotal = read.int("maxTotal", MIN_MAX_TOTAL, MAX_MAX_TOTAL);
    const crossesTen = read.boolean("crossesTen");
    const includeZero = read.boolean("includeZero");
    const picture = read.boolean("picture");

    if (read.clean()) {
      if (crossesTen && maxTotal < MIN_CROSSING_TOTAL) {
        read.reject("maxTotal", `a fact crossing ten reaches at least ${String(MIN_CROSSING_TOTAL)}`);
      }
      if (!crossesTen && maxTotal > MAX_PICTURE_TOTAL) {
        // A sum of eleven that does not cross ten needs an addend above nine, which
        // is place-value addition (`13 + 4`) and belongs to `gen.arith.column-op`.
        read.reject("maxTotal", "a fact that does not cross ten reaches at most ten");
      }
      if (crossesTen && includeZero) {
        read.reject("includeZero", "a zero operand cannot cross ten");
      }
      if (picture && crossesTen) {
        read.reject("picture", "the ten-frame holds ten; a crossing fact does not fit in it");
      }
      if (picture && maxTotal > MAX_PICTURE_TOTAL) {
        read.reject("picture", `the ten-frame holds ${String(MAX_PICTURE_TOTAL)}`);
      }
    }
    return read.finish({ op, maxTotal, crossesTen, includeZero, picture });
  },
};
