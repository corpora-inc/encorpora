/**
 * `gen.arith.number-facts` constants — ids, locale keys and every difficulty
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
 * A number fact has no digits and no columns, so the two place-value terms are
 * zero here and the slots are spent on the three parameters that do make one
 * fact harder than another. Each substitution is a falsifiable claim, stated:
 *
 * - **`0.55·crossesTen` reuses the regrouping coefficient unchanged**, because
 *   crossing ten *is* the regrouping — one column wide, with the ten carried in
 *   the child's head instead of written above a line. Claiming a different number
 *   for the same phenomenon measured on the same children would be two answers to
 *   one question.
 * - **`0.05` per unit of range** above the root spends the `noAnchor` slot. It is
 *   small on purpose: `2 + 3` and `4 + 5` are not far apart, and a coefficient
 *   large enough to separate them would put `9 + 1` above a crossing fact.
 * - **`−0.35·picture`** is the `specialCase` slot, at its documented size. A
 *   ten-frame drawn beside the numerals turns a recall question into a counting
 *   question, which is the largest single scaffold this family has.
 * - **`0.15·subtraction`** has no slot in the sketch and is a term this family
 *   adds. Taking away is harder than putting together at the same range, on every
 *   curriculum that orders the two, and a family that scored `5 − 2` and `2 + 3`
 *   identically would order the ladder wrongly at its own root.
 * - **`−0.10·includeZero`** is not a claim that `0 + 1` is only a tenth of a logit
 *   below `1 + 1`. It is the claim that *admitting* the identity facts to a level
 *   lowers that level's expected difficulty a little, because they are a minority
 *   of a set that is otherwise unchanged.
 *
 * Every coefficient is an exact rational. `0.55` as a float would make `b` — and
 * therefore `P̂` — platform-dependent in the last bits.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const NUMBER_FACTS_FAMILY = familyId("gen.arith.number-facts");

/**
 * Bump whenever generated output changes for any seed. CG-16 keys its committed
 * output hashes on this value.
 */
export const NUMBER_FACTS_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const NUMBER_FACTS_FORMS = [FORM_FREE_ENTRY] as const;

export const PROMPT_KEY_ADD = locKey("dw.prompt.number-facts.add");
export const PROMPT_KEY_SUB = locKey("dw.prompt.number-facts.sub");

export const SOLUTION_KEY_READ = locKey("dw.solution.number-facts.read");
/** Start at the larger number and count on. The within-ten addition strategy. */
export const SOLUTION_KEY_COUNT_ON = locKey("dw.solution.number-facts.count-on");
/** Start at the whole and count back. The within-ten subtraction strategy. */
export const SOLUTION_KEY_COUNT_BACK = locKey("dw.solution.number-facts.count-back");
/** `7 + 8` as `7 + 3` to ten and `5` more. The make-ten bridge. */
export const SOLUTION_KEY_BRIDGE_UP = locKey("dw.solution.number-facts.bridge-up");
/** `15 − 8` as `15 − 5` down to ten and `3` more. The same bridge, downward. */
export const SOLUTION_KEY_BRIDGE_DOWN = locKey("dw.solution.number-facts.bridge-down");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.number-facts.result");

/**
 * Every locale key this family can emit. The i18n gate reads this rather than
 * grepping, so a new template that nobody translated fails loudly.
 */
export const NUMBER_FACTS_LOC_KEYS = [
  PROMPT_KEY_ADD,
  PROMPT_KEY_SUB,
  SOLUTION_KEY_READ,
  SOLUTION_KEY_COUNT_ON,
  SOLUTION_KEY_COUNT_BACK,
  SOLUTION_KEY_BRIDGE_UP,
  SOLUTION_KEY_BRIDGE_DOWN,
  SOLUTION_KEY_RESULT,
] as const;

/** Prompt slot names. Stable: they are part of the translated template. */
export const SLOT_FIRST = "first";
export const SLOT_SECOND = "second";
export const SLOT_ANSWER = "answer";
/** The larger addend a count-on starts from, and the count taken from there. */
export const SLOT_FROM = "from";
export const SLOT_COUNT = "count";
/** How far the first number is from ten, and how much of the second is left. */
export const SLOT_TO_TEN = "toTen";
export const SLOT_REST = "rest";

/** 0.55 for a fact that crosses ten — column-op's regrouping coefficient. */
export const COEFF_CROSS_TEN = rational(55n, 100n);
/** 0.05 per unit of range above the root's three. */
export const COEFF_RANGE_OVER_ROOT = rational(5n, 100n);
/** 0.15 for subtraction. */
export const COEFF_SUBTRACTION = rational(15n, 100n);
/** −0.35 when the quantity is drawn as well as written. */
export const COEFF_PICTURE = rational(-35n, 100n);
/** −0.10 when the identity facts are in the set. */
export const COEFF_INCLUDE_ZERO = rational(-10n, 100n);

/** The range every level is measured against — the root, `0 + 1`. */
export const ROOT_MAX_TOTAL = 3;

/** Free entry is the only form; the offset is stated so the contract is total. */
export const FORM_OFFSET_FREE_ENTRY = rational(0n);
