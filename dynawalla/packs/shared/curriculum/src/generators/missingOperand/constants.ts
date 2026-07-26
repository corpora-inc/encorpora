/**
 * `gen.arith.missing-operand` — ids, locale keys and difficulty coefficients.
 *
 *   b = b_skill + 0.30·(digits − 2) + shapeOffset + formOffset
 *
 * **Every sentence shape is its own template key, and that is the point.** Where
 * the box sits is not decoration a renderer can be trusted to guess: `a − ☐ = c`
 * and `☐ − a = c` are different questions with different answers, and a family that
 * carried the placement as a parameter rather than in the key would hand the
 * renderer two items it could not tell apart.
 *
 * `both-sides` carries the largest offset because it is not a harder version of the
 * others, it is the one the equals sign is really about: on `8 + 4 = ☐ + 5` roughly
 * 5% of grade 1–2 children answer 7, and in one sample all 145 sixth graders
 * answered 12 or 17.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";
import { REP_BALANCE_SCALE } from "../../render/representations.ts";

export { REP_BALANCE_SCALE };

export const MISSING_OPERAND_FAMILY = familyId("gen.arith.missing-operand");
export const MISSING_OPERAND_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const MISSING_OPERAND_FORMS = [FORM_FREE_ENTRY] as const;

/** `a + ☐ = c` */
export const PROMPT_KEY_ADD_UNKNOWN = locKey("dw.prompt.missing-operand.add-unknown");
/** `a − ☐ = c` */
export const PROMPT_KEY_SUB_UNKNOWN = locKey("dw.prompt.missing-operand.sub-unknown");
/** `☐ − a = c` */
export const PROMPT_KEY_SUB_UNKNOWN_MINUEND = locKey("dw.prompt.missing-operand.sub-unknown-minuend");
/** `a × ☐ = c` */
export const PROMPT_KEY_MUL_UNKNOWN = locKey("dw.prompt.missing-operand.mul-unknown");
/** `a + b = ☐ + d` */
export const PROMPT_KEY_BOTH_SIDES = locKey("dw.prompt.missing-operand.both-sides");

export const SOLUTION_KEY_READ_RELATION = locKey("dw.solution.missing-operand.read-relation");
export const SOLUTION_KEY_BALANCE_SIDES = locKey("dw.solution.missing-operand.balance-sides");
export const SOLUTION_KEY_UNDO = locKey("dw.solution.missing-operand.undo");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.missing-operand.result");

export const MISSING_OPERAND_LOC_KEYS = [
  PROMPT_KEY_ADD_UNKNOWN,
  PROMPT_KEY_SUB_UNKNOWN,
  PROMPT_KEY_SUB_UNKNOWN_MINUEND,
  PROMPT_KEY_MUL_UNKNOWN,
  PROMPT_KEY_BOTH_SIDES,
  SOLUTION_KEY_READ_RELATION,
  SOLUTION_KEY_BALANCE_SIDES,
  SOLUTION_KEY_UNDO,
  SOLUTION_KEY_RESULT,
] as const;

export const SLOT_KNOWN = "known";
export const SLOT_TOTAL = "total";
export const SLOT_LEFT_A = "leftA";
export const SLOT_LEFT_B = "leftB";
export const SLOT_RIGHT_KNOWN = "rightKnown";
export const SLOT_LEFT_TOTAL = "leftTotal";
export const SLOT_ANSWER = "answer";

export const COEFF_DIGIT_OVER_TWO = rational(30n, 100n);
/** The plainest of the five: a missing addend with the total on the right. */
export const OFFSET_ADD_UNKNOWN = rational(-35n, 100n);
/** Undoing runs the other way: the answer is what is *left*, not what is missing. */
export const OFFSET_SUB_UNKNOWN = rational(0n);
/** The unknown is the number being taken from, so the undoing is an addition. */
export const OFFSET_SUB_UNKNOWN_MINUEND = rational(25n, 100n);
/** A missing factor is a division nobody wrote down. */
export const OFFSET_MUL_UNKNOWN = rational(45n, 100n);
/** Numbers on both sides of the equals sign. */
export const OFFSET_BOTH_SIDES = rational(55n, 100n);

export const FORM_OFFSET_FREE_ENTRY = rational(0n);
