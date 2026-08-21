/**
 * `gen.number.compare-order` parameters.
 *
 * A discriminated union rather than one flat record with dead fields. Column-op
 * spells `acrossZero must be 0 for add` as a validator message because both of its
 * operations share every other field; these three number types share almost
 * nothing, and a flat record would make every level table carry four zeroes whose
 * meaning is "not this kind of number".
 */

import { MAX_WHOLE_DIGITS } from "../shared/draw.ts";
import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type CompareTask = "greater" | "lesser";
export const COMPARE_TASKS: readonly CompareTask[] = ["greater", "lesser"];

export type NumberType = "whole" | "fraction" | "decimal";
export const NUMBER_TYPES: readonly NumberType[] = ["whole", "fraction", "decimal"];

export type CompareOrderParams =
  | {
      readonly numberType: "whole";
      readonly task: CompareTask;
      /** Both numbers are written with exactly this many digits. */
      readonly digits: number;
      /** How many leading digits the two numbers are made to share. */
      readonly sharedPrefix: number;
    }
  | {
      readonly numberType: "decimal";
      readonly task: CompareTask;
      /** Digits in the whole part of both numbers. */
      readonly digits: number;
      /** Places after the point on the shorter-written number. */
      readonly decimalPlaces: number;
      /** Extra places on the longer-written one. Zero would defeat the point. */
      readonly placeGap: number;
    }
  | {
      readonly numberType: "fraction";
      readonly task: CompareTask;
      /** Denominators are drawn from 2..maxDenominator. */
      readonly maxDenominator: number;
      /**
       * Draw both fractions with the same numerator.
       *
       * This is a *content* decision with a diagnostic purpose, declared in the
       * level table where a reader can see it, and it is what makes
       * `mis.frac.larger-denominator-larger-fraction` measurable: with one
       * numerator, the larger denominator is the smaller number as a matter of
       * arithmetic, so the buggy rule is wrong on every such item without the
       * mal-rule ever inspecting the correct answer.
       */
      readonly sameNumerator: boolean;
    };

export const MIN_DENOMINATOR = 3;
export const MAX_DENOMINATOR = 60;

export const compareOrderParamSchema: ParamSchema<CompareOrderParams> = {
  describe:
    "{ numberType: 'whole', task, digits: 2..7, sharedPrefix: 0..digits-1 } | " +
    "{ numberType: 'decimal', task, digits: 1..5, decimalPlaces: 1..3, placeGap: 1..2 } | " +
    "{ numberType: 'fraction', task, maxDenominator: 3..60, sameNumerator: boolean }",

  validate(raw: unknown): ParamResult<CompareOrderParams> {
    const read = reader(raw);
    const numberType = read.choice<NumberType>("numberType", NUMBER_TYPES);
    const task = read.choice<CompareTask>("task", COMPARE_TASKS);

    if (numberType === "whole") {
      const digits = read.int("digits", 2, MAX_WHOLE_DIGITS);
      const sharedPrefix = read.int("sharedPrefix", 0, Math.max(0, digits - 1));
      return read.finish({ numberType, task, digits, sharedPrefix });
    }

    if (numberType === "decimal") {
      const digits = read.int("digits", 1, 5);
      const decimalPlaces = read.int("decimalPlaces", 1, 3);
      const placeGap = read.int("placeGap", 1, 2);
      if (read.clean() && decimalPlaces + placeGap > 4) {
        read.reject("placeGap", "a number written to more than four places is not an elementary decimal");
      }
      return read.finish({ numberType, task, digits, decimalPlaces, placeGap });
    }

    const maxDenominator = read.int("maxDenominator", MIN_DENOMINATOR, MAX_DENOMINATOR);
    const sameNumerator = read.boolean("sameNumerator");
    if (read.clean() && sameNumerator && maxDenominator < 4) {
      read.reject(
        "maxDenominator",
        "a same-numerator pair needs a numerator below two different denominators; 4 is the smallest that admits one",
      );
    }
    return read.finish({ numberType, task, maxDenominator, sameNumerator });
  },
};
