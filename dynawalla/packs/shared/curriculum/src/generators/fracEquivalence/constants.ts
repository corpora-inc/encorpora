/**
 * `gen.frac.equivalence-simplify` — ids, locale keys and difficulty coefficients.
 *
 *   b = b_skill + 0.05·maxDenominator + 0.30·(factor − 1) + 0.25·wholePart
 *       − 0.35·toMixed + formOffset
 *
 * Four tasks, one family, because all four are the same act: writing a number a
 * different way without changing it. Simplifying, building an equivalent fraction,
 * and moving between improper and mixed notation are the three places a child meets
 * that idea in elementary school, and separating them into families would hide the
 * fact that they can all be got wrong the same way.
 *
 * `toMixed` takes the `specialCase` slot: reading a division off an improper
 * fraction is the one direction that needs no multiplication at all.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const FRAC_EQUIVALENCE_FAMILY = familyId("gen.frac.equivalence-simplify");
export const FRAC_EQUIVALENCE_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const FRAC_EQUIVALENCE_FORMS = [FORM_FREE_ENTRY] as const;

export const PROMPT_KEY_SIMPLIFY = locKey("dw.prompt.frac-equivalence.simplify");
export const PROMPT_KEY_BUILD = locKey("dw.prompt.frac-equivalence.build");
export const PROMPT_KEY_TO_MIXED = locKey("dw.prompt.frac-equivalence.to-mixed");
export const PROMPT_KEY_TO_IMPROPER = locKey("dw.prompt.frac-equivalence.to-improper");

export const SOLUTION_KEY_COMMON_FACTOR = locKey("dw.solution.frac-equivalence.common-factor");
export const SOLUTION_KEY_SCALE = locKey("dw.solution.frac-equivalence.scale");
export const SOLUTION_KEY_DIVIDE_OUT = locKey("dw.solution.frac-equivalence.divide-out");
export const SOLUTION_KEY_WHOLES_IN = locKey("dw.solution.frac-equivalence.wholes-in");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.frac-equivalence.result");

export const FRAC_EQUIVALENCE_LOC_KEYS = [
  PROMPT_KEY_SIMPLIFY,
  PROMPT_KEY_BUILD,
  PROMPT_KEY_TO_MIXED,
  PROMPT_KEY_TO_IMPROPER,
  SOLUTION_KEY_COMMON_FACTOR,
  SOLUTION_KEY_SCALE,
  SOLUTION_KEY_DIVIDE_OUT,
  SOLUTION_KEY_WHOLES_IN,
  SOLUTION_KEY_RESULT,
] as const;

export const SLOT_FRACTION = "fraction";
export const SLOT_DENOMINATOR = "denominator";
export const SLOT_FACTOR = "factor";
export const SLOT_WHOLE = "whole";
export const SLOT_ANSWER = "answer";

/** 0.05 per unit of the denominator ceiling — bigger parts, more to hold. */
export const COEFF_DENOMINATOR = rational(5n, 100n);
/** 0.30 per unit of the scaling factor past one. */
export const COEFF_FACTOR = rational(30n, 100n);
/** 0.25 when a whole part is in play. */
export const COEFF_WHOLE_PART = rational(25n, 100n);
/** The special case: improper to mixed is one division and no multiplication. */
export const COEFF_TO_MIXED = rational(-35n, 100n);

export const FORM_OFFSET_FREE_ENTRY = rational(0n);
