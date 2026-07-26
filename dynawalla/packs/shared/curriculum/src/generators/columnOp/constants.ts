/**
 * `gen.arith.column-op` constants — ids, locale keys and every difficulty
 * coefficient, in one place.
 *
 * CURRICULUM.md pins the shape of the difficulty function:
 *
 *   b = b_skill
 *     + 0.55·regroupings
 *     + 0.30·(maxDigits − 2)
 *     + 0.25·zeroBorrowThrough
 *     + 0.20·noAnchor
 *     − 0.35·specialCase
 *     + repOffset + formOffset
 *
 * with every coefficient in one `constants.ts`. Of those terms, `regroupings`,
 * `maxDigits` and `zeroBorrowThrough` are column-op parameters. `noAnchor` and
 * `specialCase` are not — this family has no anchor or special-case parameter — so
 * they contribute zero here and the 0.20 slot is spent instead on `decimalPlaces`,
 * which is a column-op parameter and does make an item harder. That substitution is
 * a deliberate, falsifiable claim about difficulty; gate EG-5 is what tests it.
 *
 * Every coefficient is an exact rational. `0.55` as a float would make `b` — and
 * therefore `P̂` — platform-dependent in the last bits.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const COLUMN_OP_FAMILY = familyId("gen.arith.column-op");

/**
 * Bump whenever generated output changes for any seed. CG-16 keys its committed
 * output hashes on this value.
 */
export const COLUMN_OP_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const FORM_COLUMN = "column";
export const COLUMN_OP_FORMS = [FORM_FREE_ENTRY, FORM_COLUMN] as const;

export const PROMPT_KEY_SUB = locKey("dw.prompt.column-op.sub");
export const PROMPT_KEY_ADD = locKey("dw.prompt.column-op.add");

export const SOLUTION_KEY_SETUP = locKey("dw.solution.column-op.setup");
export const SOLUTION_KEY_REGROUP = locKey("dw.solution.column-op.regroup");
export const SOLUTION_KEY_CARRY = locKey("dw.solution.column-op.carry");
export const SOLUTION_KEY_COLUMN = locKey("dw.solution.column-op.column");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.column-op.result");

/**
 * Every locale key this family can emit. The i18n gate (CG-19, PR-4.7) reads this
 * rather than grepping, so a new template that nobody translated fails loudly.
 */
export const COLUMN_OP_LOC_KEYS = [
  PROMPT_KEY_SUB,
  PROMPT_KEY_ADD,
  SOLUTION_KEY_SETUP,
  SOLUTION_KEY_REGROUP,
  SOLUTION_KEY_CARRY,
  SOLUTION_KEY_COLUMN,
  SOLUTION_KEY_RESULT,
] as const;

/** Prompt slot names. Stable: they are part of the translated template. */
export const SLOT_TOP = "top";
export const SLOT_BOTTOM = "bottom";
export const SLOT_ANSWER = "answer";
export const SLOT_COLUMN = "column";
export const SLOT_VALUE = "value";
export const SLOT_DIGIT = "digit";

/** 0.55 per regrouping (borrow or carry). */
export const COEFF_REGROUPING = rational(55n, 100n);
/** 0.30 per digit beyond two. */
export const COEFF_DIGIT_OVER_TWO = rational(30n, 100n);
/** 0.25 per zero a borrow has to travel through. */
export const COEFF_ZERO_BORROW_THROUGH = rational(25n, 100n);
/** 0.20 per decimal place (see the note above about the `noAnchor` slot). */
export const COEFF_DECIMAL_PLACE = rational(20n, 100n);

/**
 * Form offsets. The column form draws the scaffold — the grid, the place-value
 * alignment and the space for regrouping marks — so the same numbers are easier
 * there than in free entry. Provisional until the M2 playtest (T-03).
 */
export const FORM_OFFSET_FREE_ENTRY = rational(0n);
export const FORM_OFFSET_COLUMN = rational(-15n, 100n);

/** Bounds the deterministic retry loop that rejects degenerate draws. */
export const MAX_GENERATE_ATTEMPTS = 32;
