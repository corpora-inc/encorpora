/**
 * `gen.arith.times-table` constants — ids, locale keys and every difficulty
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
 * A times-table fact has no columns and no regrouping, so the same three slots
 * `gen.arith.number-facts` spends on value-bounded facts are spent here on the
 * three parameters that make one table fact harder than another. Each
 * substitution is a falsifiable claim, stated:
 *
 * - **`0.15` per factor above the root's two** spends the `noAnchor` slot, and it
 *   is three times the coefficient `number-facts` uses per unit of range. That is
 *   the claim, and it is the whole shape of this family: one more in a sum is one
 *   more count, and one more in a factor is **a whole further table** — the step
 *   from the five times table to the six times table is not the step from `4 + 5`
 *   to `4 + 6`. Ten steps from two to twelve then span 1.50 logits, which is about
 *   the span the addition ladder takes from `3 + 5` to `4,003 − 87`.
 * - **`0.15·division`** reuses `number-facts`'s subtraction coefficient unchanged,
 *   because it is the same phenomenon: the inverse direction of a fact a child
 *   has, at the same range. `48 ÷ 6` is `6 × 8` read backwards exactly as `15 − 8`
 *   is `8 + 7` read backwards, and claiming a different number for it would be two
 *   answers to one question.
 * - **`−0.10·includeTrivial`** is `number-facts`'s `includeZero` coefficient, for
 *   the same reason and with the same reading: not a claim that `0 × 4` is a tenth
 *   of a logit below `2 × 4`, but that *admitting* the zero and identity facts to a
 *   level lowers that level's expected difficulty a little, because they are a
 *   minority of a set that is otherwise unchanged.
 *
 * Every coefficient is an exact rational. `0.15` as a float would make `b` — and
 * therefore `P̂` — platform-dependent in the last bits.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const TIMES_TABLE_FAMILY = familyId("gen.arith.times-table");

/**
 * Bump whenever generated output changes for any seed. CG-16 keys its committed
 * output hashes on this value.
 */
export const TIMES_TABLE_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const TIMES_TABLE_FORMS = [FORM_FREE_ENTRY] as const;

export const PROMPT_KEY_MUL = locKey("dw.prompt.times-table.mul");
export const PROMPT_KEY_DIV = locKey("dw.prompt.times-table.div");

export const SOLUTION_KEY_READ = locKey("dw.solution.times-table.read");
/** Count in steps of the larger factor, the smaller factor's many times. */
export const SOLUTION_KEY_SKIP_COUNT = locKey("dw.solution.times-table.skip-count");
/** Any number of nothings is nothing. */
export const SOLUTION_KEY_TIMES_ZERO = locKey("dw.solution.times-table.times-zero");
/** One of something is that something. */
export const SOLUTION_KEY_TIMES_ONE = locKey("dw.solution.times-table.times-one");
/** `48 ÷ 6` as "what do you multiply 6 by to reach 48?". */
export const SOLUTION_KEY_MISSING_FACTOR = locKey("dw.solution.times-table.missing-factor");
/** Nothing shared between any number of hands leaves each hand with nothing. */
export const SOLUTION_KEY_ZERO_SHARED = locKey("dw.solution.times-table.zero-shared");
/** Sharing between one leaves the whole. */
export const SOLUTION_KEY_DIVIDE_BY_ONE = locKey("dw.solution.times-table.divide-by-one");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.times-table.result");

/**
 * Every locale key this family can emit. The i18n gate reads this rather than
 * grepping, so a new template that nobody translated fails loudly.
 */
export const TIMES_TABLE_LOC_KEYS = [
  PROMPT_KEY_MUL,
  PROMPT_KEY_DIV,
  SOLUTION_KEY_READ,
  SOLUTION_KEY_SKIP_COUNT,
  SOLUTION_KEY_TIMES_ZERO,
  SOLUTION_KEY_TIMES_ONE,
  SOLUTION_KEY_MISSING_FACTOR,
  SOLUTION_KEY_ZERO_SHARED,
  SOLUTION_KEY_DIVIDE_BY_ONE,
  SOLUTION_KEY_RESULT,
] as const;

/** Prompt slot names. Stable: they are part of the translated template. */
export const SLOT_FIRST = "first";
export const SLOT_SECOND = "second";
export const SLOT_DIVIDEND = "dividend";
export const SLOT_DIVISOR = "divisor";
export const SLOT_ANSWER = "answer";
/** The factor counted in, and how many of those steps are taken. */
export const SLOT_STEP = "step";
export const SLOT_TIMES = "times";
/** The other factor, on the two facts where one of them decides the answer. */
export const SLOT_OTHER = "other";

/** 0.15 per factor above the root's two — a whole further table each time. */
export const COEFF_FACTOR_OVER_ROOT = rational(15n, 100n);
/** 0.15 for the inverse direction — `number-facts`'s subtraction coefficient. */
export const COEFF_DIVISION = rational(15n, 100n);
/** −0.10 when the zero and identity facts are in the set. */
export const COEFF_INCLUDE_TRIVIAL = rational(-10n, 100n);

/** The table every level is measured against — the twos, the first one taught. */
export const ROOT_MAX_FACTOR = 2;

/** Free entry is the only form; the offset is stated so the contract is total. */
export const FORM_OFFSET_FREE_ENTRY = rational(0n);
