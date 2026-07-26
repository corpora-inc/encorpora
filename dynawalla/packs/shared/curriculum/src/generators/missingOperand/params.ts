/**
 * `gen.arith.missing-operand` parameters.
 *
 * Five sentence shapes, each a different question about the same equals sign:
 *
 * - `add-unknown` — `a + ☐ = c`, the missing addend.
 * - `sub-unknown` — `a − ☐ = c`, where the undoing is a subtraction.
 * - `sub-unknown-minuend` — `☐ − a = c`, where it is an addition.
 * - `mul-unknown` — `a × ☐ = c`, always exact; a missing factor with a remainder
 *   is a sentence with no whole-number answer.
 * - `both-sides` — `a + b = ☐ + d`.
 *
 * `balance` is rejected on every shape but `both-sides`: the scale carries "these
 * two sides are worth the same", and a sentence with one side is a scale with one
 * pan.
 */

import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type SentenceShape =
  | "add-unknown"
  | "sub-unknown"
  | "sub-unknown-minuend"
  | "mul-unknown"
  | "both-sides";

export const SENTENCE_SHAPES: readonly SentenceShape[] = [
  "add-unknown",
  "sub-unknown",
  "sub-unknown-minuend",
  "mul-unknown",
  "both-sides",
];

export type MissingOperandParams = {
  readonly shape: SentenceShape;
  /** Digit width of the numbers written on the card. */
  readonly digits: number;
  /** Draw the balance scale beside the sentence. `both-sides` only. */
  readonly balance: boolean;
};

export const MAX_DIGITS = 4;

export const missingOperandParamSchema: ParamSchema<MissingOperandParams> = {
  describe:
    "{ shape: 'add-unknown'|'sub-unknown'|'sub-unknown-minuend'|'mul-unknown'|'both-sides', " +
    "digits: 1..4, balance: boolean }",

  validate(raw: unknown): ParamResult<MissingOperandParams> {
    const read = reader(raw);
    const shape = read.choice<SentenceShape>("shape", SENTENCE_SHAPES);
    const digits = read.int("digits", 1, MAX_DIGITS);
    const balance = read.boolean("balance");

    if (read.clean()) {
      if (balance && shape !== "both-sides") {
        read.reject("balance", "the balance scale draws two sides; only both-sides has them");
      }
      if (shape === "mul-unknown" && digits > 2) {
        read.reject("digits", "a missing factor beyond two digits is a long division wearing a box");
      }
    }
    return read.finish({ shape, digits, balance });
  },
};
