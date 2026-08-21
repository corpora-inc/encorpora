/**
 * `gen.arith.multidigit-mul` parameters.
 *
 * `carries` is a level property rather than an accident of the draw, for the same
 * reason column-op's `regroupings` is: "multiply a three-digit number by six" is
 * not one skill, it is the carrying one and the non-carrying one, and a level that
 * lets the draw decide serves a mixture of the two and can measure neither.
 *
 * A single-digit multiplier of 1 is rejected on a carrying level because nothing
 * times one can carry, which is a contradiction rather than an empty draw.
 */

import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type MulShape = "general" | "power-of-ten";
export const MUL_SHAPES: readonly MulShape[] = ["general", "power-of-ten"];

export type MultidigitMulParams =
  | {
      readonly shape: "general";
      /** Digits of the multiplicand. */
      readonly digits: number;
      /** Digits of the multiplier. */
      readonly multiplierDigits: number;
      /** The units column of the first partial product carries. */
      readonly carries: boolean;
    }
  | {
      readonly shape: "power-of-ten";
      readonly digits: number;
      /** The multiplier is `10^k` for a `k` drawn from 1..maxPower. */
      readonly maxPower: number;
    };

export const MAX_MULTIPLICAND_DIGITS = 5;
/**
 * Five, raised from three.
 *
 * The program's stated ceiling is `48,826 × 82,726`, and at a three-digit
 * multiplier that item was not merely unauthored — it was **unstatable**, because
 * no parameter object could describe it. Nothing else changes: `generate` reads
 * `multiplierDigits` in a loop and drew a four-digit multiplier correctly the whole
 * time, so no existing level's output moves and `familyRev` does not turn over.
 * The bound stays a bound rather than becoming `Infinity` because a level table is
 * a place a typo lands, and a twelve-digit multiplier is a typo and not a lesson.
 */
export const MAX_MULTIPLIER_DIGITS = 5;
export const MAX_POWER = 4;

export const multidigitMulParamSchema: ParamSchema<MultidigitMulParams> = {
  describe:
    "{ shape: 'general', digits: 2..5, multiplierDigits: 1..5, carries: boolean } | " +
    "{ shape: 'power-of-ten', digits: 2..5, maxPower: 1..4 }",

  validate(raw: unknown): ParamResult<MultidigitMulParams> {
    const read = reader(raw);
    const shape = read.choice<MulShape>("shape", MUL_SHAPES);
    const digits = read.int("digits", 2, MAX_MULTIPLICAND_DIGITS);

    if (shape === "power-of-ten") {
      const maxPower = read.int("maxPower", 1, MAX_POWER);
      return read.finish({ shape, digits, maxPower });
    }

    const multiplierDigits = read.int("multiplierDigits", 1, MAX_MULTIPLIER_DIGITS);
    const carries = read.boolean("carries");
    if (read.clean() && !carries && multiplierDigits > 1) {
      // A multi-digit multiplier forms several partial products and the second one
      // starts from a shifted column; "no carry anywhere" is then a constraint on
      // every pass at once, and the digit ranges that satisfy it are so narrow that
      // the level would pose the same few dozen items forever. A level that wants
      // the non-carrying case asks for it with a single-digit multiplier.
      read.reject("carries", "a non-carrying level needs a single-digit multiplier");
    }
    return read.finish({ shape, digits, multiplierDigits, carries });
  },
};
