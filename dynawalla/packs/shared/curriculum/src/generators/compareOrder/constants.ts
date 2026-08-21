/**
 * `gen.number.compare-order` — ids, locale keys and difficulty coefficients.
 *
 *   b = b_skill + 0.30·(digits − 2) + 0.20·decimalPlaces + 0.35·sharedPrefix
 *       − 0.35·sameNumerator + 0.05·maxDenominator + formOffset
 *
 * `sharedPrefix` is this family's `noAnchor` term: two numbers that agree for
 * three digits give a child nothing to compare until the fourth, which is exactly
 * "no landmark to count from". `sameNumerator` takes the `specialCase` slot — a
 * comparison of two fractions with the same numerator is decided by one rule and
 * is the easiest fraction comparison there is, which is also why it is the one
 * that exposes whole-number bias.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const COMPARE_ORDER_FAMILY = familyId("gen.number.compare-order");

/** Bump whenever generated output changes for any seed. */
export const COMPARE_ORDER_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const COMPARE_ORDER_FORMS = [FORM_FREE_ENTRY] as const;

/**
 * "Which of these is the greater number? Write it." — never "type < or >".
 *
 * The relation symbol would be a closed list of three, which is the choice
 * laundering CG-13 exists to stop, and it is also the weaker task: writing the
 * greater number down requires deciding which one it is *and* transcribing it,
 * and the answer is a number the entry surfaces already draw.
 */
export const PROMPT_KEY_GREATER = locKey("dw.prompt.compare-order.greater");
export const PROMPT_KEY_LESSER = locKey("dw.prompt.compare-order.lesser");

export const SOLUTION_KEY_LINE_UP = locKey("dw.solution.compare-order.line-up");
export const SOLUTION_KEY_FIRST_DIFFERENCE = locKey("dw.solution.compare-order.first-difference");
export const SOLUTION_KEY_SAME_NUMERATOR = locKey("dw.solution.compare-order.same-numerator");
export const SOLUTION_KEY_COMMON_DENOMINATOR = locKey("dw.solution.compare-order.common-denominator");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.compare-order.result");

export const COMPARE_ORDER_LOC_KEYS = [
  PROMPT_KEY_GREATER,
  PROMPT_KEY_LESSER,
  SOLUTION_KEY_LINE_UP,
  SOLUTION_KEY_FIRST_DIFFERENCE,
  SOLUTION_KEY_SAME_NUMERATOR,
  SOLUTION_KEY_COMMON_DENOMINATOR,
  SOLUTION_KEY_RESULT,
] as const;

export const SLOT_LEFT = "left";
export const SLOT_RIGHT = "right";
export const SLOT_ANSWER = "answer";
export const SLOT_PLACE = "place";
export const SLOT_DENOMINATOR = "denominator";
export const SLOT_LEFT_SCALED = "leftScaled";
export const SLOT_RIGHT_SCALED = "rightScaled";

export const COEFF_DIGIT_OVER_TWO = rational(30n, 100n);
export const COEFF_DECIMAL_PLACE = rational(20n, 100n);
/** Every leading digit the two numbers share is one more column to read past. */
export const COEFF_SHARED_PREFIX = rational(35n, 100n);
/** The special case: one numerator, one rule. */
export const COEFF_SAME_NUMERATOR = rational(-35n, 100n);
/** Denominators past halves and thirds, per denominator. */
export const COEFF_DENOMINATOR = rational(5n, 100n);

export const FORM_OFFSET_FREE_ENTRY = rational(0n);
