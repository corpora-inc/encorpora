/**
 * `gen.frac.arith` — ids, locale keys and difficulty coefficients.
 *
 *   b = b_skill + 0.05·maxDenominator + 0.55·unlikeDenominators + 0.30·multipleDenominators
 *       + 0.25·lowestTerms − 0.35·wholeMultiplier + formOffset
 *
 * Finding a common denominator is the step change in fraction addition, so it takes
 * the 0.55 slot; the case where one denominator is already a multiple of the other
 * takes 0.30, because the common denominator is one of the two you were given.
 * Multiplying by a whole number takes the `specialCase` slot: the denominator does
 * not move, which is precisely why children think it should.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const FRAC_ARITH_FAMILY = familyId("gen.frac.arith");
export const FRAC_ARITH_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const FRAC_ARITH_FORMS = [FORM_FREE_ENTRY] as const;

export const PROMPT_KEY_ADD = locKey("dw.prompt.frac-arith.add");
export const PROMPT_KEY_SUB = locKey("dw.prompt.frac-arith.sub");
export const PROMPT_KEY_MUL = locKey("dw.prompt.frac-arith.mul");
export const PROMPT_KEY_MUL_WHOLE = locKey("dw.prompt.frac-arith.mul-whole");

export const SOLUTION_KEY_COMMON_DENOMINATOR = locKey("dw.solution.frac-arith.common-denominator");
export const SOLUTION_KEY_RESTATE = locKey("dw.solution.frac-arith.restate");
export const SOLUTION_KEY_COMBINE = locKey("dw.solution.frac-arith.combine");
export const SOLUTION_KEY_MULTIPLY_PARTS = locKey("dw.solution.frac-arith.multiply-parts");
export const SOLUTION_KEY_SIMPLIFY = locKey("dw.solution.frac-arith.simplify");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.frac-arith.result");

export const FRAC_ARITH_LOC_KEYS = [
  PROMPT_KEY_ADD,
  PROMPT_KEY_SUB,
  PROMPT_KEY_MUL,
  PROMPT_KEY_MUL_WHOLE,
  SOLUTION_KEY_COMMON_DENOMINATOR,
  SOLUTION_KEY_RESTATE,
  SOLUTION_KEY_COMBINE,
  SOLUTION_KEY_MULTIPLY_PARTS,
  SOLUTION_KEY_SIMPLIFY,
  SOLUTION_KEY_RESULT,
] as const;

export const SLOT_LEFT = "left";
export const SLOT_RIGHT = "right";
export const SLOT_DENOMINATOR = "denominator";
export const SLOT_LEFT_SCALED = "leftScaled";
export const SLOT_RIGHT_SCALED = "rightScaled";
export const SLOT_COMBINED = "combined";
export const SLOT_ANSWER = "answer";

export const COEFF_DENOMINATOR = rational(5n, 100n);
/** 0.55: finding a common denominator neither operand gave you. */
export const COEFF_UNLIKE = rational(55n, 100n);
/** 0.30: the common denominator is one of the two on the card. */
export const COEFF_MULTIPLE = rational(30n, 100n);
/** 0.25 when the answer must be written in lowest terms. */
export const COEFF_LOWEST_TERMS = rational(25n, 100n);
/** The special case: a whole multiplier leaves the denominator alone. */
export const COEFF_WHOLE_MULTIPLIER = rational(-35n, 100n);

export const FORM_OFFSET_FREE_ENTRY = rational(0n);
