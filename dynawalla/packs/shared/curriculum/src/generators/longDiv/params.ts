/**
 * `gen.arith.long-div` parameters.
 *
 * The **quotient** is the parameterized quantity, not the dividend. Drawing a
 * dividend and dividing it gives a quotient of whatever width falls out, and the
 * two properties a division level actually cares about — how many quotient digits
 * the child has to produce, and whether one of them is a zero they will drop — are
 * then unstatable. Drawing the quotient and multiplying back makes both exact and
 * makes the dividend's width a consequence.
 *
 * Three combinations are rejected because the question would have no content:
 * asking for a remainder on a level that divides exactly (the answer is zero on
 * every seed), asking for a plain quotient on a level that does not (the answer
 * silently discards what is left over), and asking for an interior zero in a
 * one-digit quotient.
 */

import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type DivTask = "quotient" | "remainder" | "quotient-and-remainder";
export const DIV_TASKS: readonly DivTask[] = ["quotient", "remainder", "quotient-and-remainder"];

export type LongDivParams = {
  readonly task: DivTask;
  /** Digits of the quotient the child must produce. */
  readonly quotientDigits: number;
  /** Digits of the divisor. Never one digit wide *and* the value one. */
  readonly divisorDigits: number;
  /** The division comes out even. */
  readonly exact: boolean;
  /** The quotient carries an interior zero — the digit children drop. */
  readonly quotientZeros: boolean;
};

export const MAX_QUOTIENT_DIGITS = 4;
export const MAX_DIVISOR_DIGITS = 2;

export const longDivParamSchema: ParamSchema<LongDivParams> = {
  describe:
    "{ task: 'quotient'|'remainder'|'quotient-and-remainder', quotientDigits: 1..4, " +
    "divisorDigits: 1..2, exact: boolean, quotientZeros: boolean }",

  validate(raw: unknown): ParamResult<LongDivParams> {
    const read = reader(raw);
    const task = read.choice<DivTask>("task", DIV_TASKS);
    const quotientDigits = read.int("quotientDigits", 1, MAX_QUOTIENT_DIGITS);
    const divisorDigits = read.int("divisorDigits", 1, MAX_DIVISOR_DIGITS);
    const exact = read.boolean("exact");
    const quotientZeros = read.boolean("quotientZeros");

    if (read.clean()) {
      if (exact && task !== "quotient") {
        read.reject("task", "a level that divides exactly has no remainder to ask about");
      }
      if (!exact && task === "quotient") {
        read.reject("task", "asking for the quotient alone throws the remainder away without saying so");
      }
      if (quotientZeros && quotientDigits < 2) {
        read.reject("quotientZeros", "an interior zero needs a quotient at least two digits wide");
      }
    }
    return read.finish({ task, quotientDigits, divisorDigits, exact, quotientZeros });
  },
};
