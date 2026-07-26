/**
 * `gen.arith.multidigit-mul` mal-rules.
 *
 * All three run the buggy procedure rather than computing a shortcut from the
 * correct answer, and all three are wrong on every item they are defined on as a
 * matter of arithmetic rather than of measurement:
 *
 * - An unshifted second partial product multiplies by the multiplier's **digit
 *   sum**, which is strictly smaller than the multiplier for any multiplier of ten
 *   or more, so the product is strictly too small.
 * - The same slip against a power of ten leaves the multiplicand exactly as it was
 *   (`digitSum(10^k) = 1`), and `top × 1 ≠ top × 10^k` for `k ≥ 1` and `top > 0`.
 * - Adding the carry before multiplying adds `(multiplier − 1) × carryIn` at every
 *   column the correct pass carries **into**, all of which are positive, so the
 *   buggy product is strictly larger. The condition is carries *in*, not carries
 *   *out*: see `procedure.ts`, where the algebra is written out and the
 *   counterexample to the carries-out reading (`50 × 2`) is named.
 *
 * `applies()` asks about the item's own structure — how many digits the multiplier
 * has, whether it is a power of ten, and whether the standard algorithm carries
 * into a column. None of those questions touches the answer, which is what keeps
 * CG-12's divergence a measurement rather than a tautology.
 */

import { rational } from "../math/rational.ts";
import { MULTIDIGIT_MUL_FAMILY } from "../generators/multidigitMul/constants.ts";
import {
  carryBeforeMultiply,
  digitSum,
  littleEndianDigits,
  passCarriesInward,
} from "../generators/multidigitMul/procedure.ts";
import { readFactors } from "../generators/multidigitMul/read.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import { malRuleId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";
import { MIS_MUL_SHIFT_NOT_APPLIED } from "./roots.ts";

export const MIS_PARTIAL_PRODUCT_MISALIGNED = malRuleId("mis.mul.partial-product-misaligned");
export const MIS_FORGOT_THE_SHIFT = malRuleId("mis.mul.forgot-the-shift");
export const MIS_CARRY_ADDED_BEFORE_MULTIPLYING = malRuleId("mis.mul.carry-added-before-multiplying");

/** `10`, `100`, `1000`, … — one leading digit of one, and nothing else. */
function isPowerOfTen(value: bigint): boolean {
  if (value < 10n) return false;
  let remaining = value;
  while (remaining % 10n === 0n) remaining /= 10n;
  return remaining === 1n;
}

/**
 * Every partial product written in the units column — no placeholder zero under
 * the second row.
 *
 * `47 × 23` becomes `47 × 3 + 47 × 2 = 141 + 94 = 235`, which is `47 × 5`. Defined
 * wherever there is a second partial product to misplace **and the multiplier is
 * not a power of ten**: multiplying by a power of ten is a one-row item the
 * generator walks through as a place-value shift rather than as two partial
 * products, and the child who answers `47` to `47 × 100` has not misaligned a row
 * they never wrote. That case is `mis.mul.forgot-the-shift`, which produces the
 * same number and asks for a different repair; the two predicates are disjoint so
 * `classify` still names exactly one of them.
 */
export const partialProductMisaligned: MalRule = {
  id: MIS_PARTIAL_PRODUCT_MISALIGNED,
  family: MULTIDIGIT_MUL_FAMILY,
  parent: MIS_MUL_SHIFT_NOT_APPLIED,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const factors = readFactors(exercise);
    return factors !== null && factors.bottom >= 10n && factors.top > 0n && !isPowerOfTen(factors.bottom);
  },

  apply(exercise: Exercise): AnswerValue | null {
    const factors = readFactors(exercise);
    if (factors === null || factors.bottom < 10n || factors.top <= 0n) return null;
    if (isPowerOfTen(factors.bottom)) return null;
    return { kind: "integer", value: rational(factors.top * digitSum(factors.bottom)) };
  },
};

/**
 * The place-value shift never applied: `47 × 100` answered as `47`.
 *
 * The same root cause as the misaligned partial product — the zeros that move the
 * product up a place were not written — on the item where it is most visible and
 * where the repair is different. Defined wherever the multiplier is a power of ten
 * and the multiplicand is positive, on which `top ≠ top × 10^k` for every `k ≥ 1`.
 */
export const forgotTheShift: MalRule = {
  id: MIS_FORGOT_THE_SHIFT,
  family: MULTIDIGIT_MUL_FAMILY,
  parent: MIS_MUL_SHIFT_NOT_APPLIED,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const factors = readFactors(exercise);
    return factors !== null && factors.top > 0n && isPowerOfTen(factors.bottom);
  },

  apply(exercise: Exercise): AnswerValue | null {
    const factors = readFactors(exercise);
    if (factors === null || factors.top <= 0n || !isPowerOfTen(factors.bottom)) return null;
    return { kind: "integer", value: rational(factors.top) };
  },
};

/**
 * `(digit + carry) × multiplier`, instead of `digit × multiplier + carry`.
 *
 * Defined where a single-digit multiplier of two or more meets a multiplicand the
 * standard algorithm carries **into a column** on — with no carry coming *in* there
 * is nothing to add in the wrong order, so the buggy procedure is not instantiated.
 * That is the procedure being undefined on the item, which the mal-rule contract
 * allows, and not a filter on where it happens to be right: on every item where it
 * *is* defined it is wrong, and `procedure.ts` shows why.
 *
 * The distinction between carrying *in* and carrying *out* is load-bearing and is
 * not a nicety. Under the carries-out reading this predicate is true on `50 × 2`,
 * where the buggy pass returns the correct `100` — 7,980 such items among the
 * 795,390 the reading admits over `10..99999 × 2..9`.
 */
export const carryAddedBeforeMultiplying: MalRule = {
  id: MIS_CARRY_ADDED_BEFORE_MULTIPLYING,
  family: MULTIDIGIT_MUL_FAMILY,
  locateCapable: false,

  applies(exercise: Exercise): boolean {
    const factors = readFactors(exercise);
    if (factors === null || factors.bottom < 2n || factors.bottom > 9n) return false;
    return passCarriesInward(littleEndianDigits(factors.top), Number(factors.bottom));
  },

  apply(exercise: Exercise): AnswerValue | null {
    const factors = readFactors(exercise);
    if (factors === null || factors.bottom < 2n || factors.bottom > 9n) return null;
    const digits = littleEndianDigits(factors.top);
    if (!passCarriesInward(digits, Number(factors.bottom))) return null;
    return { kind: "integer", value: rational(carryBeforeMultiply(digits, Number(factors.bottom))) };
  },
};

export const multidigitMulMalRules: readonly MalRule[] = [
  partialProductMisaligned,
  forgotTheShift,
  carryAddedBeforeMultiplying,
];
