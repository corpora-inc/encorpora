/**
 * `gen.number.round-estimate` — ids, locale keys and difficulty coefficients.
 *
 *   b = b_skill + 0.30·(digits − 2) + 0.20·place + 0.35·ties + formOffset
 *
 * **Rounding half up, always.** Half-to-even is the convention of measurement and
 * of IEEE arithmetic; half-up is the convention every elementary curriculum in this
 * program's three frameworks teaches, and a generator that silently chose the other
 * one would mark a correct child wrong on one item in twenty. `ties` is a declared
 * level parameter rather than an accident of the draw, so a level either poses the
 * case that makes the convention visible or it does not.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const ROUND_ESTIMATE_FAMILY = familyId("gen.number.round-estimate");
export const ROUND_ESTIMATE_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const ROUND_ESTIMATE_FORMS = [FORM_FREE_ENTRY] as const;

export const PROMPT_KEY_ROUND = locKey("dw.prompt.round-estimate.round");

export const SOLUTION_KEY_NEIGHBOURS = locKey("dw.solution.round-estimate.neighbours");
export const SOLUTION_KEY_DECIDER = locKey("dw.solution.round-estimate.decider");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.round-estimate.result");

export const ROUND_ESTIMATE_LOC_KEYS = [
  PROMPT_KEY_ROUND,
  SOLUTION_KEY_NEIGHBOURS,
  SOLUTION_KEY_DECIDER,
  SOLUTION_KEY_RESULT,
] as const;

export const SLOT_NUMBER = "number";
export const SLOT_PLACE = "place";
export const SLOT_LOWER = "lower";
export const SLOT_UPPER = "upper";
export const SLOT_DIGIT = "digit";
export const SLOT_ANSWER = "answer";

export const COEFF_DIGIT_OVER_TWO = rational(30n, 100n);
export const COEFF_PLACE = rational(20n, 100n);
/** The tie is the case the convention is for, and the case children lose. */
export const COEFF_TIES = rational(35n, 100n);

export const FORM_OFFSET_FREE_ENTRY = rational(0n);
