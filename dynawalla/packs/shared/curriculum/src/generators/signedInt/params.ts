/**
 * `gen.arith.signed-int` parameters and their validator.
 *
 * Two things a level names, and neither of them is a digit count.
 *
 * **`negatives` — where the minus signs are.** Not how many: `(−7) + 4` and
 * `7 + (−4)` both have one, and they are not the same item to a child. The whole
 * difficulty of this family is in that placement, so a level that let the draw
 * decide would serve a mixture of two skills and could measure neither. It is the
 * same decision `gen.arith.multidigit-mul` makes about `carries`.
 *
 * **`maxMagnitude` — how big the numbers are, capped at twenty.** The cap is the
 * content, not a limitation waiting to be lifted: past twenty, `(−47) + 23` is
 * column arithmetic wearing a sign, and column arithmetic already has a family.
 * What this one teaches is which way the answer points, and it teaches it on
 * numbers a child can hold in their head so that nothing else can be the reason
 * they got it wrong. That cap is also why every level here declares
 * `closedFactSet`: bounded by magnitude, a level of this family is a fixed and
 * countable set of problems in exactly the sense `add-within-ten` is.
 *
 * `none` is subtraction only, and it is the on-ramp: `3 − 9`, written with no
 * minus sign anywhere and answered with one. For addition and multiplication a
 * level with no negative operand is not signed arithmetic at all — it is a fact
 * from another family with this family's name on the mastery record.
 */

import { reader } from "../shared/paramReader.ts";
import type { ParamResult, ParamSchema } from "../../types/generator.ts";

export type SignedOp = "add" | "sub" | "mul";
export const SIGNED_OPS: readonly SignedOp[] = ["add", "sub", "mul"];

/** Which operands carry a minus sign. */
export type SignPlacement = "none" | "first" | "second" | "both";
export const SIGN_PLACEMENTS: readonly SignPlacement[] = ["none", "first", "second", "both"];

export type SignedIntParams = {
  readonly op: SignedOp;
  /** Both magnitudes are drawn from `1..maxMagnitude`. Never zero — see below. */
  readonly maxMagnitude: number;
  readonly negatives: SignPlacement;
};

/** Below five, a level is a dozen items and a child sees each of them twice a run. */
export const MIN_MAGNITUDE = 5;
/** Past twenty this stops being about the sign. See the note at the top. */
export const MAX_MAGNITUDE = 20;

export const signedIntParamSchema: ParamSchema<SignedIntParams> = {
  describe: "{ op: 'add'|'sub'|'mul', maxMagnitude: 5..20, negatives: 'none'|'first'|'second'|'both' }",

  validate(raw: unknown): ParamResult<SignedIntParams> {
    const read = reader(raw);
    const op = read.choice<SignedOp>("op", SIGNED_OPS);
    const maxMagnitude = read.int("maxMagnitude", MIN_MAGNITUDE, MAX_MAGNITUDE);
    const negatives = read.choice<SignPlacement>("negatives", SIGN_PLACEMENTS);

    if (read.clean() && negatives === "none" && op !== "sub") {
      read.reject(
        "negatives",
        `${op} with no negative operand has no negative anywhere in it and is not signed arithmetic`,
      );
    }
    return read.finish({ op, maxMagnitude, negatives });
  },
};
