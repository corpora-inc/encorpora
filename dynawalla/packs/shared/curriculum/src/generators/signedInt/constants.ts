/**
 * `gen.arith.signed-int` constants — ids, locale keys and every difficulty
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
 * None of the place-value terms mean anything here, because **none of the
 * difficulty of signed arithmetic is in the arithmetic**. `(−7) + 4` is `7 − 4`
 * with a decision on the front, and a child who can do the second and not the
 * first has a sign problem rather than a subtraction problem. So the slots are
 * spent on where the minus signs are, and each substitution is a falsifiable
 * claim:
 *
 * - **`0.20` where the first operand is negative** takes the `noAnchor` slot at
 *   its documented size. It is the smallest of the three placements because the
 *   minus is read once, at the front, before anything else happens.
 * - **`0.35` where the *second* operand is negative** is larger than for the
 *   first, and that ordering is the claim. `7 + (−4)` and `7 − (−4)` put two signs
 *   next to each other, which is where the over-generalised "two negatives make a
 *   positive" fires; the same child reads `(−7) + 4` correctly far more often.
 * - **`0.45` where both are** is not `0.20 + 0.35`. The two placements do not
 *   compound: a child holding the sign rule gets `(−7) + (−4)` from the same one
 *   move that gets them `7 + (−4)`, and scoring it as the sum of two independent
 *   difficulties would put it above every item in the program.
 * - **`0.15·subtraction`** is `gen.arith.number-facts`'s coefficient unchanged,
 *   for the same phenomenon at a different range, and **`0.10·multiplication`**
 *   is below it deliberately. Multiplying signs is a *rule* — count the minuses —
 *   where subtracting them is a transformation the child has to perform first.
 *   Every curriculum that orders the two teaches multiplication of integers after
 *   subtraction and reports it as the easier of the two.
 * - **`0.05` per unit of magnitude** above ten is `number-facts`'s range
 *   coefficient, and it is small for the same reason: `(−7) + 4` and `(−17) + 14`
 *   are not far apart, and a coefficient large enough to separate them would put
 *   arithmetic size above sign placement, which is the wrong ordering for
 *   everything this family teaches.
 *
 * Every coefficient is an exact rational. `0.35` as a float would make `b` — and
 * therefore `P̂` — platform-dependent in the last bits.
 */

import { rational } from "../../math/rational.ts";
import { familyId, locKey } from "../../types/ids.ts";

export const SIGNED_INT_FAMILY = familyId("gen.arith.signed-int");

/**
 * Bump whenever generated output changes for any seed. CG-16 keys its committed
 * output hashes on this value.
 */
export const SIGNED_INT_FAMILY_REV = 1;

export const FORM_FREE_ENTRY = "free-entry";
export const SIGNED_INT_FORMS = [FORM_FREE_ENTRY] as const;

export const PROMPT_KEY_ADD = locKey("dw.prompt.signed-int.add");
export const PROMPT_KEY_SUB = locKey("dw.prompt.signed-int.sub");
export const PROMPT_KEY_MUL = locKey("dw.prompt.signed-int.mul");

export const SOLUTION_KEY_READ = locKey("dw.solution.signed-int.read");
/** `3 − 9`: three steps down to zero, and six more past it. */
export const SOLUTION_KEY_PAST_ZERO = locKey("dw.solution.signed-int.past-zero");
/** Subtracting a number is adding its opposite. The rung the rest turns on. */
export const SOLUTION_KEY_ADD_THE_OPPOSITE = locKey("dw.solution.signed-int.add-the-opposite");
/** Signs alike: add the sizes, keep the sign. */
export const SOLUTION_KEY_SAME_SIGNS = locKey("dw.solution.signed-int.same-signs");
/** Signs unlike: take the smaller size from the larger, keep the larger's sign. */
export const SOLUTION_KEY_DIFFERENT_SIGNS = locKey("dw.solution.signed-int.different-signs");
/** Multiply the sizes; the number of minus signs decides the sign. */
export const SOLUTION_KEY_SIGN_RULE = locKey("dw.solution.signed-int.sign-rule");
export const SOLUTION_KEY_RESULT = locKey("dw.solution.signed-int.result");

/**
 * Every locale key this family can emit. The i18n gate reads this rather than
 * grepping, so a new template that nobody translated fails loudly.
 */
export const SIGNED_INT_LOC_KEYS = [
  PROMPT_KEY_ADD,
  PROMPT_KEY_SUB,
  PROMPT_KEY_MUL,
  SOLUTION_KEY_READ,
  SOLUTION_KEY_PAST_ZERO,
  SOLUTION_KEY_ADD_THE_OPPOSITE,
  SOLUTION_KEY_SAME_SIGNS,
  SOLUTION_KEY_DIFFERENT_SIGNS,
  SOLUTION_KEY_SIGN_RULE,
  SOLUTION_KEY_RESULT,
] as const;

/** Prompt slot names. Stable: they are part of the translated template. */
export const SLOT_FIRST = "first";
export const SLOT_SECOND = "second";
export const SLOT_ANSWER = "answer";
/** How far past zero `3 − 9` goes, once zero has been reached. */
export const SLOT_PAST = "past";
/** The opposite of the second operand — what a subtraction becomes an addition of. */
export const SLOT_OPPOSITE = "opposite";
/** The two magnitudes, in the order the strategy names them. */
export const SLOT_LARGER = "larger";
export const SLOT_SMALLER = "smaller";
/** The product of the magnitudes, before the sign is decided. */
export const SLOT_SIZE = "size";
/** How many minus signs are on the card. A count: the template's plural turns on it. */
export const SLOT_NEGATIVES = "negatives";

/** 0.05 per unit of magnitude above ten. */
export const COEFF_MAGNITUDE_OVER_ROOT = rational(5n, 100n);
/** 0.15 for subtraction — `gen.arith.number-facts`'s coefficient, unchanged. */
export const COEFF_SUBTRACTION = rational(15n, 100n);
/** 0.10 for multiplication: a rule to apply, not a transformation to perform. */
export const COEFF_MULTIPLICATION = rational(10n, 100n);
/** 0.20 when the first operand carries the minus. */
export const COEFF_FIRST_NEGATIVE = rational(20n, 100n);
/** 0.35 when the second does, and two signs end up side by side. */
export const COEFF_SECOND_NEGATIVE = rational(35n, 100n);
/** 0.45 when both do. Not the sum of the two above — see the note at the top. */
export const COEFF_BOTH_NEGATIVE = rational(45n, 100n);

/** The magnitude every level is measured against — within ten, as everywhere else. */
export const ROOT_MAGNITUDE = 10;

/** Free entry is the only form; the offset is stated so the contract is total. */
export const FORM_OFFSET_FREE_ENTRY = rational(0n);
