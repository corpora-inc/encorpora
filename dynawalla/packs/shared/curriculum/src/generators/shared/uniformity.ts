/**
 * Is a draw over a closed set uniform? Measured, in exact rationals.
 *
 * ## Why a family that enumerates still has to prove this
 *
 * `rng.pick` is unbiased and `factSet` is a list, so a uniform draw ought to be
 * automatic. It is not, and the failure is quiet: the moment a family draws its
 * operands *separately* rather than picking a member of an enumerated set — which
 * is what every other generator in this package does, for good reasons — the
 * distribution over problems stops being flat. Drawing `b` from `2..20` and then
 * `a` from `1..b−1` covers exactly the same forty-five pairs `3 − 9` needs and
 * gives the pairs with a small `b` nineteen times the weight of the pairs with a
 * large one. Every closure test still passes: every member is reached, and no
 * member outside the set ever is.
 *
 * A child would meet that as a level that keeps asking `1 − 2`. So the family
 * tests measure the shape of the draw as well as its support.
 *
 * ## The statistic, and the bound
 *
 * `χ² = Σ (Oᵢ − E)² / E` with `E = N / k`, computed as a `Rational` over BigInt —
 * `E` is very often not an integer and rounding it would put the whole test's
 * verdict at the mercy of the rounding.
 *
 * The bound is the normal approximation to the upper tail, `df + z·√(2·df)`,
 * with `z` taken well past the 0.999 point and a constant added so that it is also
 * safe at the small degrees of freedom where the approximation is worst:
 *
 *     χ² < df + 3.5·√(2·df) + 6
 *
 * At df = 8 that is 28.0 against a true 0.1% point of 26.1; at df = 35, 70.3
 * against 66.6; at df = 120, 180.2 against 173.6. Loose on purpose in the safe
 * direction — this is looking for a draw that is *wrong*, not for one that is
 * unlucky, and it is looking at a **deterministic** sample: the seeds are fixed, so
 * a pass is a pass on every machine for ever and a failure reproduces exactly.
 *
 * The square root never happens. `χ² − df − 6 < 3.5·√(2·df)` is squared into
 * `(2·(χ² − df − 6))² < 98·df`, which is exact in rationals, after the trivial
 * case where the left side is already negative.
 */

import { add, cmp, div, mul, rational, sub } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";

export type UniformityResult = {
  /** The statistic, exactly. */
  readonly chiSquare: Rational;
  /** `k − 1`, where `k` is the number of cells the draw could land in. */
  readonly degreesOfFreedom: number;
  /** How many cells were never drawn at all. Named separately: it is the loud failure. */
  readonly empty: number;
  readonly uniform: boolean;
};

/**
 * `counts` is one observed count per cell of the closed set, including the zeros.
 * A cell missing from the array is a cell the caller forgot, not a cell that was
 * never drawn, so callers build the array from the *set* and not from the draw.
 */
export function chiSquareUniform(counts: readonly number[]): UniformityResult {
  const cells = counts.length;
  if (cells < 2) throw new RangeError(`chiSquareUniform: ${String(cells)} cell(s) is not a distribution`);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) throw new RangeError("chiSquareUniform: nothing was drawn");

  // E = N/k, exactly. Σ (O − E)²/E = (k/N)·Σ (O − E)².
  const expected = rational(BigInt(total), BigInt(cells));
  let statistic = rational(0n);
  for (const count of counts) {
    const deviation = sub(rational(BigInt(count)), expected);
    statistic = add(statistic, div(mul(deviation, deviation), expected));
  }

  const df = cells - 1;
  const slack = sub(statistic, rational(BigInt(df + 6)));
  // Below the constant already: no tail to approximate.
  const uniform =
    cmp(slack, rational(0n)) <= 0 ||
    cmp(mul(mul(rational(2n), slack), mul(rational(2n), slack)), rational(BigInt(98 * df))) < 0;

  return {
    chiSquare: statistic,
    degreesOfFreedom: df,
    empty: counts.filter((count) => count === 0).length,
    uniform,
  };
}
