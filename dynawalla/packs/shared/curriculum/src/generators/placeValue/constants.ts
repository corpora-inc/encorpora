/**
 * `gen.number.place-value-decompose` — ids, locale keys and difficulty coefficients.
 *
 * The difficulty shape follows CURRICULUM.md:
 *
 *   b = b_skill + 0.30·(digits − 2) + 0.20·place − 0.35·specialCase + formOffset
 *
 * `regroupings` and `zeroBorrowThrough` are column-op parameters and contribute
 * nothing here. `place` takes the 0.20 slot the doc spends on `noAnchor`, because
 * asking about the ten-thousands place is harder than asking about the tens for the
 * same reason `noAnchor` is a difficulty term: there is no landmark to count from.
 * `specialCase` is spent on `digit-in-place`, which is the one task of the three
 * that needs no arithmetic at all — reading a digit off the page.
 *
 * `place` is drawn from a range, so the parameter-derived difficulty uses the
 * range's midpoint. The midpoint of an integer range is a half, which is exactly
 * why it is a `Rational` and not a number.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";
/**
 * Re-exported, not redeclared. The place names are shared with
 * `gen.number.round-estimate` and `gen.number.compare-order`, and two spellings of
 * one `LocKey` is a template nobody translated twice.
 */
export { PLACE_TERM_KEYS } from "../shared/placeTerms.ts";
import { PLACE_TERM_KEYS } from "../shared/placeTerms.ts";

export const PLACE_VALUE_FAMILY = familyId("gen.number.place-value-decompose");

/** Bump whenever generated output changes for any seed. CG-16 keys its hashes on it. */
export const PLACE_VALUE_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const PLACE_VALUE_FORMS = [FORM_FREE_ENTRY] as const;

export const PROMPT_KEY_DIGIT_VALUE = locKey("dw.prompt.place-value.digit-value");
export const PROMPT_KEY_DIGIT_IN_PLACE = locKey("dw.prompt.place-value.digit-in-place");
export const PROMPT_KEY_TOTAL_IN_PLACE = locKey("dw.prompt.place-value.total-in-place");

export const SOLUTION_KEY_LOCATE = locKey("dw.solution.place-value.locate");
export const SOLUTION_KEY_UNIT_WORTH = locKey("dw.solution.place-value.unit-worth");
export const SOLUTION_KEY_GROUP = locKey("dw.solution.place-value.group");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.place-value.result");

/** Every locale key this family can emit. Read by CG-19 rather than grepped. */
export const PLACE_VALUE_LOC_KEYS = [
  PROMPT_KEY_DIGIT_VALUE,
  PROMPT_KEY_DIGIT_IN_PLACE,
  PROMPT_KEY_TOTAL_IN_PLACE,
  SOLUTION_KEY_LOCATE,
  SOLUTION_KEY_UNIT_WORTH,
  SOLUTION_KEY_GROUP,
  SOLUTION_KEY_RESULT,
  ...PLACE_TERM_KEYS,
] as const;

export const SLOT_NUMBER = "number";
export const SLOT_PLACE = "place";
export const SLOT_DIGIT = "digit";
export const SLOT_UNIT = "unit";
export const SLOT_ANSWER = "answer";
export const SLOT_REST = "rest";

/** 0.30 per digit beyond two. */
export const COEFF_DIGIT_OVER_TWO = rational(30n, 100n);
/** 0.20 per place above the units column, at the drawn range's midpoint. */
export const COEFF_PLACE = rational(20n, 100n);
/** −0.35 for `digit-in-place`, the one task that is reading rather than arithmetic. */
export const COEFF_SPECIAL_CASE = rational(-35n, 100n);
/** +0.45 for `total-in-place`: "how many hundreds altogether" is a regrouped count. */
export const COEFF_REGROUPED_COUNT = rational(45n, 100n);

export const FORM_OFFSET_FREE_ENTRY = rational(0n);
