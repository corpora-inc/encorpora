/**
 * `gen.frac.equivalence-simplify` parameters.
 *
 * `maxDenominator` bounds the denominator a child **reads**, not an intermediate:
 * a simplification item whose written denominator is 96 is an item about factoring
 * 96, and a level that meant "halves through twelfths" would silently pose it.
 */

import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type EquivalenceTask = "simplify" | "build" | "to-mixed" | "to-improper";

export const EQUIVALENCE_TASKS: readonly EquivalenceTask[] = [
  "simplify",
  "build",
  "to-mixed",
  "to-improper",
];

export type FracEquivalenceParams = {
  readonly task: EquivalenceTask;
  /** The largest denominator that appears anywhere on the card. */
  readonly maxDenominator: number;
  /** The largest scaling factor between a fraction and its equivalent. */
  readonly maxFactor: number;
  /** The largest whole part in a mixed number. */
  readonly maxWhole: number;
};

export const MIN_MAX_DENOMINATOR = 4;
export const MAX_MAX_DENOMINATOR = 60;

export const fracEquivalenceParamSchema: ParamSchema<FracEquivalenceParams> = {
  describe:
    "{ task: 'simplify'|'build'|'to-mixed'|'to-improper', maxDenominator: 4..60, " +
    "maxFactor: 2..9, maxWhole: 1..20 }",

  validate(raw: unknown): ParamResult<FracEquivalenceParams> {
    const read = reader(raw);
    const task = read.choice<EquivalenceTask>("task", EQUIVALENCE_TASKS);
    const maxDenominator = read.int("maxDenominator", MIN_MAX_DENOMINATOR, MAX_MAX_DENOMINATOR);
    const maxFactor = read.int("maxFactor", 2, 9);
    const maxWhole = read.int("maxWhole", 1, 20);

    if (read.clean() && (task === "simplify" || task === "build") && maxDenominator < 2 * maxFactor) {
      // The written fraction is a reduced one scaled up, so its denominator is at
      // least twice the factor. A ceiling below that admits no item at all.
      read.reject(
        "maxDenominator",
        `a factor of up to ${String(maxFactor)} needs a denominator ceiling of at least ${String(2 * maxFactor)}`,
      );
    }
    return read.finish({ task, maxDenominator, maxFactor, maxWhole });
  },
};
