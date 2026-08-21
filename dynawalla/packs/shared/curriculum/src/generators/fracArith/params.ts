/**
 * `gen.frac.arith` parameters.
 *
 * `lowestTerms` is the one knob here that changes what counts as a right answer
 * rather than what the item looks like, and it is spelled out because the two
 * readings are both defensible and a family that left it implicit would pick one
 * silently. On a level *about* adding fifths, `6/8` is a correct sum written
 * plainly; on a level whose goal includes simplifying, it is the step that was not
 * taken. The parameter selects `AnswerSchema.fraction.equivalence`, which is what a
 * renderer and a checker both read.
 */

import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type FracOp = "add" | "sub" | "mul";
export const FRAC_OPS: readonly FracOp[] = ["add", "sub", "mul"];

export type DenominatorRelation = "like" | "multiple" | "unlike";
export const DENOMINATOR_RELATIONS: readonly DenominatorRelation[] = ["like", "multiple", "unlike"];

export type FracArithParams =
  | {
      readonly op: "add" | "sub";
      readonly denominators: DenominatorRelation;
      readonly maxDenominator: number;
      readonly lowestTerms: boolean;
    }
  | {
      readonly op: "mul";
      /** A second fraction, or a whole number. */
      readonly wholeMultiplier: boolean;
      readonly maxDenominator: number;
      /** Largest whole multiplier. Never one: multiplying by one changes nothing. */
      readonly maxWhole: number;
      readonly lowestTerms: boolean;
    };

export const MIN_MAX_DENOMINATOR = 3;
export const MAX_MAX_DENOMINATOR = 24;

export const fracArithParamSchema: ParamSchema<FracArithParams> = {
  describe:
    "{ op: 'add'|'sub', denominators: 'like'|'multiple'|'unlike', maxDenominator: 3..24, lowestTerms: boolean } | " +
    "{ op: 'mul', wholeMultiplier: boolean, maxDenominator: 3..24, maxWhole: 2..12, lowestTerms: boolean }",

  validate(raw: unknown): ParamResult<FracArithParams> {
    const read = reader(raw);
    const op = read.choice<FracOp>("op", FRAC_OPS);
    const maxDenominator = read.int("maxDenominator", MIN_MAX_DENOMINATOR, MAX_MAX_DENOMINATOR);
    const lowestTerms = read.boolean("lowestTerms");

    if (op === "mul") {
      const wholeMultiplier = read.boolean("wholeMultiplier");
      const maxWhole = read.int("maxWhole", 2, 12);
      return read.finish({ op, wholeMultiplier, maxDenominator, maxWhole, lowestTerms });
    }

    const denominators = read.choice<DenominatorRelation>("denominators", DENOMINATOR_RELATIONS);
    if (read.clean() && denominators === "multiple" && maxDenominator < 6) {
      read.reject(
        "maxDenominator",
        "a denominator that is a multiple of another needs a ceiling of at least six (2 and 6, say)",
      );
    }
    if (read.clean() && denominators === "unlike" && maxDenominator < 5) {
      read.reject("maxDenominator", "two denominators neither of which divides the other need a ceiling of five");
    }
    return read.finish({ op, denominators, maxDenominator, lowestTerms });
  },
};
