/**
 * `gen.arith.long-div` — ids, locale keys and difficulty coefficients.
 *
 *   b = b_skill + 0.55·(divisorDigits − 1) + 0.30·(quotientDigits − 1)
 *       + 0.25·remainder + 0.35·quotientZeros + formOffset
 *
 * A second digit in the divisor is the step change in this algorithm — estimating
 * a quotient digit against a two-digit divisor is a different act from recalling a
 * table fact — so it takes the 0.55 slot. `quotientZeros` takes the `noAnchor`
 * slot at 0.35: the column where the partial dividend is smaller than the divisor
 * is exactly the column with no landmark, and it is where the zero goes missing.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const LONG_DIV_FAMILY = familyId("gen.arith.long-div");
export const LONG_DIV_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const LONG_DIV_FORMS = [FORM_FREE_ENTRY] as const;

export const PROMPT_KEY_QUOTIENT = locKey("dw.prompt.long-div.quotient");
export const PROMPT_KEY_REMAINDER = locKey("dw.prompt.long-div.remainder");
export const PROMPT_KEY_QUOTIENT_REMAINDER = locKey("dw.prompt.long-div.quotient-remainder");

export const SOLUTION_KEY_SETUP = locKey("dw.solution.long-div.setup");
export const SOLUTION_KEY_STEP = locKey("dw.solution.long-div.step");
export const SOLUTION_KEY_LEFTOVER = locKey("dw.solution.long-div.leftover");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.long-div.result");

export const LONG_DIV_LOC_KEYS = [
  PROMPT_KEY_QUOTIENT,
  PROMPT_KEY_REMAINDER,
  PROMPT_KEY_QUOTIENT_REMAINDER,
  SOLUTION_KEY_SETUP,
  SOLUTION_KEY_STEP,
  SOLUTION_KEY_LEFTOVER,
  SOLUTION_KEY_RESULT,
] as const;

export const SLOT_DIVIDEND = "dividend";
export const SLOT_DIVISOR = "divisor";
export const SLOT_PARTIAL = "partial";
export const SLOT_DIGIT = "digit";
export const SLOT_PRODUCT = "product";
export const SLOT_LEFTOVER = "leftover";
export const SLOT_ANSWER = "answer";
export const SLOT_REMAINDER = "remainder";

/** 0.55 for a two-digit divisor: estimation replaces recall. */
export const COEFF_DIVISOR_DIGIT = rational(55n, 100n);
/** 0.30 per quotient digit past the first. */
export const COEFF_QUOTIENT_DIGIT = rational(30n, 100n);
/** 0.25 when the division does not come out even. */
export const COEFF_REMAINDER = rational(25n, 100n);
/** 0.35 for a quotient with an interior zero — the column with no landmark. */
export const COEFF_QUOTIENT_ZEROS = rational(35n, 100n);

export const FORM_OFFSET_FREE_ENTRY = rational(0n);
