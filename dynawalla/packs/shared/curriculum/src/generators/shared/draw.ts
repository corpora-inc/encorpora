/**
 * Drawing whole numbers, exactly.
 *
 * `Rng.nextInt` works in `number` because rejection sampling needs a uint32 range,
 * and every quantity a generator writes down is a `bigint` or a `Rational`. These
 * are the two conversions between those worlds, in one place, with the bound that
 * makes them safe stated as a constant rather than assumed.
 *
 * `MAX_WHOLE_DIGITS` is 7 because `nextInt` rejects a range wider than a uint32:
 * eight digits spans 90,000,000, which is fine, but nine spans 900,000,000 and the
 * next step after that does not fit. Seven is well inside the bound, is more than
 * elementary arithmetic ever needs, and makes the failure a validator message
 * rather than a `RangeError` from three layers down.
 */

import { pow10 } from "../../math/rational.ts";
import type { Rng } from "../../rng/rng.ts";
import { InfeasibleLevelError } from "./errors.ts";

export const MAX_WHOLE_DIGITS = 7;

/** How many decimal digits `value` is written with. `0` is one digit. */
export function digitCount(value: bigint): number {
  const magnitude = value < 0n ? -value : value;
  return magnitude.toString().length;
}

/**
 * A whole number written with exactly `digits` digits — no leading zero, so a
 * 4-digit draw is 1000..9999 and never 0472.
 */
export function drawWithDigits(rng: Rng, digits: number): bigint {
  if (digits < 1 || digits > MAX_WHOLE_DIGITS) {
    throw new InfeasibleLevelError(`drawWithDigits: ${String(digits)} digits is outside 1..${String(MAX_WHOLE_DIGITS)}`);
  }
  if (digits === 1) return BigInt(rng.nextInt(1, 9));
  const lo = pow10(digits - 1);
  const hi = pow10(digits) - 1n;
  return lo + BigInt(rng.nextInt(0, Number(hi - lo)));
}

/** A whole number in `[lo, hi]`, both inclusive. */
export function drawBetween(rng: Rng, lo: bigint, hi: bigint): bigint {
  if (hi < lo) {
    throw new InfeasibleLevelError(`drawBetween: empty range ${lo.toString()}..${hi.toString()}`);
  }
  return lo + BigInt(rng.nextInt(0, Number(hi - lo)));
}

/**
 * A whole number in `[lo, hi]` that is not `forbidden`.
 *
 * Drawn by picking from the range with one value removed rather than by retrying,
 * so the draw count is fixed and the exercise stream does not depend on how many
 * rejections happened — a retry loop here would make `Rng.draws()` (and therefore
 * every later draw) depend on the value it rejected.
 */
export function drawBetweenExcluding(rng: Rng, lo: bigint, hi: bigint, forbidden: bigint): bigint {
  if (forbidden < lo || forbidden > hi) return drawBetween(rng, lo, hi);
  if (hi === lo) throw new InfeasibleLevelError("drawBetweenExcluding: the range holds only the forbidden value");
  const drawn = drawBetween(rng, lo, hi - 1n);
  return drawn >= forbidden ? drawn + 1n : drawn;
}

/**
 * The digits of `value`, most significant first. Non-negative values only.
 *
 * Both orders are here rather than one each in the two families that first needed
 * them: which end a digit array starts at is the thing this package is most likely
 * to get wrong twice, and `gen.arith.column-op`'s own header records a drift
 * between two copies of a digit-wise procedure that shipped a broken walkthrough.
 */
export function digitsOf(value: bigint): number[] {
  if (value < 0n) throw new RangeError("digitsOf: negative value");
  return value
    .toString()
    .split("")
    .map((character) => Number(character));
}

/** The digits of `value`, units first — the order a column algorithm runs in. */
export function littleEndianDigits(value: bigint): number[] {
  return digitsOf(value).reverse();
}
