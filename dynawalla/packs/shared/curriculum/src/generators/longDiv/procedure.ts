/**
 * Long division, once, for the generator's walkthrough and for the mal-rules.
 *
 * A quotient digit is written for every dividend digit from the first position at
 * which the running partial dividend reaches the divisor — which is exactly where
 * the written quotient starts, and exactly the rule a child who drops an interior
 * zero has half-learned.
 */

import { digitsOf } from "../shared/draw.ts";

export type DivisionStep = {
  /** The partial dividend at this column, after the digit was brought down. */
  readonly partial: bigint;
  /** The quotient digit written above this column. */
  readonly digit: number;
  /** `digit × divisor`, the number written under the partial. */
  readonly product: bigint;
  /** What is left after subtracting, and carried into the next column. */
  readonly leftover: bigint;
};

export function longDivisionSteps(dividend: bigint, divisor: bigint): DivisionStep[] {
  if (divisor <= 0n) throw new RangeError("longDivisionSteps: divisor must be positive");
  const steps: DivisionStep[] = [];
  let partial = 0n;
  let started = false;

  for (const digit of digitsOf(dividend)) {
    partial = partial * 10n + BigInt(digit);
    // Before the partial first reaches the divisor no quotient digit is written —
    // that is why 4,208 ÷ 4 has four quotient digits and 208 ÷ 4 has two.
    if (!started && partial < divisor) continue;
    started = true;
    const quotientDigit = partial / divisor;
    const product = quotientDigit * divisor;
    const leftover = partial - product;
    steps.push({ partial, digit: Number(quotientDigit), product, leftover });
    partial = leftover;
  }

  return steps;
}

/**
 * The quotient with every non-leading zero left out — the written result of the
 * child who, at a column where the partial dividend is smaller than the divisor,
 * brings the next digit down without first writing the zero.
 *
 * Strictly smaller than the quotient whenever there is a zero to drop, because
 * removing a digit removes a place, so the two can never coincide.
 */
export function withoutInteriorZeros(quotient: bigint): bigint {
  const digits = digitsOf(quotient);
  const kept = digits.filter((digit, index) => index === 0 || digit !== 0);
  let value = 0n;
  for (const digit of kept) value = value * 10n + BigInt(digit);
  return value;
}

/** True when the quotient carries a zero anywhere but its leading position. */
export function hasInteriorZero(quotient: bigint): boolean {
  return digitsOf(quotient).some((digit, index) => index > 0 && digit === 0);
}
