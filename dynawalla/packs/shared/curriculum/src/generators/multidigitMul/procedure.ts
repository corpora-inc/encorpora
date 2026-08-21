/**
 * The single-digit multiplication pass — the correct one, and whether it carries.
 *
 * One implementation, read by the generator (which needs to know a level carries)
 * and by the mal-rules (which need to know the bug is instantiated at all). Two
 * copies of this drifted in `gen.arith.column-op` and the drift shipped a worked
 * example that performed the misconception it existed to repair; there is one copy
 * here for that reason.
 *
 * Digit arrays are **little-endian**: index 0 is the units column, the order the
 * algorithm is performed in.
 */

/** Re-exported so a mal-rule reads one module rather than two. */
export { littleEndianDigits } from "../shared/draw.ts";
import { littleEndianDigits } from "../shared/draw.ts";

export type MulColumn = {
  /** The carry coming into this column from the one on its right. */
  readonly carryIn: number;
  /** `digit × multiplier + carryIn`, before the ten is taken out. */
  readonly total: number;
  readonly written: number;
  readonly carryOut: number;
};

/** The correct pass: multiply, then add the carry. */
export function singleDigitPass(digits: readonly number[], multiplier: number): MulColumn[] {
  const columns: MulColumn[] = [];
  let carry = 0;
  for (const digit of digits) {
    const total = digit * multiplier + carry;
    const carryOut = (total - (total % 10)) / 10;
    columns.push({ carryIn: carry, total, written: total % 10, carryOut });
    carry = carryOut;
  }
  return columns;
}

/**
 * True when the correct pass carries **out of** at least one column.
 *
 * This is the level-design question — "does this item exercise carrying at all" —
 * and it is what `carries: true` promises. It is **not** the condition under which
 * the add-the-carry-first bug is instantiated; use `passCarriesInward` for that.
 * The two differ on exactly the items whose only carry is out of the leading
 * column, where there is no column to its left to carry into: `50 × 2` carries out
 * of the tens and `passCarries` is true, but nothing is ever added in the wrong
 * order and the buggy pass reproduces `100` exactly.
 */
export function passCarries(digits: readonly number[], multiplier: number): boolean {
  return singleDigitPass(digits, multiplier).some((column) => column.carryOut > 0);
}

/**
 * True when the correct pass carries **into** at least one column — equivalently,
 * when some non-leading column carries out.
 *
 * This is the condition `carryBeforeMultiply` is defined under, and the reason is
 * in that function's docstring: a carry out of the most significant column is
 * never a carry into anything, so it cannot be added in the wrong order.
 */
export function passCarriesInward(digits: readonly number[], multiplier: number): boolean {
  return singleDigitPass(digits, multiplier).some((column) => column.carryIn > 0);
}

/**
 * The buggy pass: **add the carry, then multiply** — `(digit + carry) × multiplier`
 * instead of `digit × multiplier + carry`.
 *
 * Documented, and larger than the correct product exactly when the correct pass
 * carries **into** some column. Writing `b_i` for the carry this procedure brings
 * into column `i`, telescoping the written digits gives
 *
 *     buggy = m·N + (m − 1)·Σ_{i ≥ 1} b_i·10^i
 *
 * — the leading carry-out cancels against the digits the final loop writes, so the
 * sum runs over carries **in** and not over carries **out**. With `m ≥ 2` every
 * term of that sum is non-negative, so the two procedures agree iff every `b_i` is
 * zero. And `b_i` equals the correct pass's carry into column `i` for as long as
 * both are zero (`b_1 = ⌊d_0·m / 10⌋ = c_1`, and inductively `b_i = c_i` while
 * `c_1 … c_{i−1}` are all zero), so the first non-zero correct carry-in is a
 * non-zero `b_i` and the two products differ there.
 *
 * The condition is therefore "some column has a non-zero carry **in**", never
 * "some column carries out". `50 × 2` carries out of its leading column and the
 * two procedures both return `100`; brute-forced over every multiplicand
 * `10..99999` against every multiplier `2..9`, the carry-out reading admits 7,980
 * such collisions in 795,390 items and the carry-in reading admits 0 in 787,410.
 * That is why the mal-rule's `applies()` calls `passCarriesInward` — it is still a
 * question about the item's own structure and never about the answer.
 */
export function carryBeforeMultiply(digits: readonly number[], multiplier: number): bigint {
  let value = 0n;
  let unit = 1n;
  let carry = 0;
  for (const digit of digits) {
    const total = (digit + carry) * multiplier;
    value += BigInt(total % 10) * unit;
    carry = (total - (total % 10)) / 10;
    unit *= 10n;
  }
  while (carry > 0) {
    value += BigInt(carry % 10) * unit;
    carry = (carry - (carry % 10)) / 10;
    unit *= 10n;
  }
  return value;
}

/** The sum of a number's digits. The unshifted-partial-product bug multiplies by this. */
export function digitSum(value: bigint): bigint {
  return littleEndianDigits(value).reduce((total, digit) => total + BigInt(digit), 0n);
}
