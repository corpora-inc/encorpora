/**
 * `gen.arith.times-table` parameters and their validator.
 *
 * A table fact is bounded by a **factor**, not by a digit count and not by a
 * value. "Multiply a one-digit number by a one-digit number" is `9 × 8` as readily
 * as `2 × 3`, and there is no total that means "the tables up to five" — `4 × 3`
 * and `12 × 1` reach the same twelve and are not the same content. `maxFactor` is
 * therefore the one quantity a level table names, and it is the same quantity for
 * both directions: `6 × 8` and `48 ÷ 6` are the same fact read two ways, exactly
 * as `7 + 8` and `15 − 8` are in `gen.arith.number-facts`.
 *
 * The validator rejects the two combinations that would make a level either empty
 * of content or two skills at once, so `generate()` can treat a thin fact set as a
 * bug rather than as input it has to guess about.
 */

import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type TimesTableOp = "mul" | "div";

export const TIMES_TABLE_OPS: readonly TimesTableOp[] = ["mul", "div"];

export type TimesTableParams = {
  readonly op: TimesTableOp;
  /**
   * The largest factor the level reaches. For `mul` both factors are drawn up to
   * it; for `div` the divisor and the quotient are, which makes the dividend as
   * large as `maxFactor²`.
   */
  readonly maxFactor: number;
  /**
   * Admit the facts that are decided by one operand alone: `0 × n`, `n × 1`,
   * `0 ÷ n` and `n ÷ 1`.
   */
  readonly includeTrivial: boolean;
};

/** The twos: the first table taught, and the smallest level worth posing. */
export const MIN_MAX_FACTOR = 2;
/** England mandates the tables to 12 × 12 by Y4, and nothing needs 13. */
export const MAX_MAX_FACTOR = 12;
/**
 * Below this, a level with the trivial facts taken out has fewer than nine
 * problems in it — `{2,3} × {2,3}` is four — and a level of four items is a
 * flashcard, not a rung.
 */
export const MIN_UNTRIVIAL_FACTOR = 4;
/**
 * The zero and identity facts belong at the bottom of the ladder. A twelve times
 * table that also draws `0 × 11` is two skills sharing one mastery record: the
 * child who knows the zero property and not the twelves reads as half-fluent at
 * both.
 */
export const MAX_TRIVIAL_FACTOR = 5;

export const timesTableParamSchema: ParamSchema<TimesTableParams> = {
  describe: "{ op: 'mul'|'div', maxFactor: 2..12, includeTrivial: boolean }",

  validate(raw: unknown): ParamResult<TimesTableParams> {
    const read = reader(raw);
    const op = read.choice<TimesTableOp>("op", TIMES_TABLE_OPS);
    const maxFactor = read.int("maxFactor", MIN_MAX_FACTOR, MAX_MAX_FACTOR);
    const includeTrivial = read.boolean("includeTrivial");

    if (read.clean()) {
      if (!includeTrivial && maxFactor < MIN_UNTRIVIAL_FACTOR) {
        read.reject(
          "maxFactor",
          `a level without the trivial facts needs factors to at least ${String(MIN_UNTRIVIAL_FACTOR)}`,
        );
      }
      if (includeTrivial && maxFactor > MAX_TRIVIAL_FACTOR) {
        read.reject(
          "includeTrivial",
          `the zero and identity facts belong below the ${String(MAX_TRIVIAL_FACTOR)} times table`,
        );
      }
    }
    return read.finish({ op, maxFactor, includeTrivial });
  },
};
