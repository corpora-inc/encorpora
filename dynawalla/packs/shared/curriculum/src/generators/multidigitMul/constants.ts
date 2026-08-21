/**
 * `gen.arith.multidigit-mul` — ids, locale keys and difficulty coefficients.
 *
 *   b = b_skill + 0.55·(multiplierDigits − 1) + 0.30·(digits − 2) + 0.25·carries
 *       − 0.35·powerOfTen + formOffset
 *
 * The 0.55 slot is column-op's `regroupings` coefficient spent on the thing that
 * plays the same role here: each further digit in the multiplier is another whole
 * partial product to form, place and add. `powerOfTen` takes the `specialCase`
 * slot, which is what it is — a multiplication with no partial products at all.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const MULTIDIGIT_MUL_FAMILY = familyId("gen.arith.multidigit-mul");
export const MULTIDIGIT_MUL_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const MULTIDIGIT_MUL_FORMS = [FORM_FREE_ENTRY] as const;

export const PROMPT_KEY_PRODUCT = locKey("dw.prompt.multidigit-mul.product");

export const SOLUTION_KEY_SETUP = locKey("dw.solution.multidigit-mul.setup");
export const SOLUTION_KEY_PARTIAL = locKey("dw.solution.multidigit-mul.partial");
export const SOLUTION_KEY_ADD_PARTIALS = locKey("dw.solution.multidigit-mul.add-partials");
export const SOLUTION_KEY_SHIFT = locKey("dw.solution.multidigit-mul.shift");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.multidigit-mul.result");

export const MULTIDIGIT_MUL_LOC_KEYS = [
  PROMPT_KEY_PRODUCT,
  SOLUTION_KEY_SETUP,
  SOLUTION_KEY_PARTIAL,
  SOLUTION_KEY_ADD_PARTIALS,
  SOLUTION_KEY_SHIFT,
  SOLUTION_KEY_RESULT,
] as const;

export const SLOT_TOP = "top";
export const SLOT_BOTTOM = "bottom";
export const SLOT_DIGIT = "digit";
export const SLOT_SHIFT = "shift";
export const SLOT_PARTIAL = "partial";
export const SLOT_ZEROS = "zeros";
export const SLOT_ANSWER = "answer";

/** 0.55 per partial product past the first. */
export const COEFF_PARTIAL_PRODUCT = rational(55n, 100n);
export const COEFF_DIGIT_OVER_TWO = rational(30n, 100n);
/** 0.25 when the single-digit pass carries. */
export const COEFF_CARRY = rational(25n, 100n);
/** The special case: multiplying by a power of ten moves digits and forms nothing. */
export const COEFF_POWER_OF_TEN = rational(-35n, 100n);

export const FORM_OFFSET_FREE_ENTRY = rational(0n);
