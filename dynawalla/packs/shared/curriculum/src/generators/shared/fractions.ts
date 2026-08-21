/**
 * Written fractions, and the arithmetic on them that keeps the writing.
 *
 * `Rational` normalizes — `2/4` and `1/2` are the same value and the same object.
 * A fraction *answer* is not a value: on `simplify-to-lowest-terms`, `2/4` and
 * `1/2` are two different answers and exactly one of them is right. So every
 * fraction family works in written `(num, den, whole)` triples and converts to
 * `Rational` only to assert that the written answer has the value exact arithmetic
 * says it should.
 *
 * Nothing here reduces unless it is asked to.
 */

import { rational } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import type { AnswerSchema, AnswerValue, FractionEquivalence } from "../../types/answer.ts";

/** A fraction as it is written down: numerator, denominator, optional whole part. */
export type WrittenFraction = {
  readonly whole: bigint;
  readonly num: bigint;
  readonly den: bigint;
};

export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) throw new RangeError("lcm: zero has no least common multiple");
  const divisor = gcd(a, b);
  return (a / divisor) * b;
}

/** `num/den` in lowest terms, denominator positive. */
export function reduce(num: bigint, den: bigint): { num: bigint; den: bigint } {
  if (den === 0n) throw new RangeError("reduce: zero denominator");
  const sign = den < 0n ? -1n : 1n;
  const n = num * sign;
  const d = den * sign;
  if (n === 0n) return { num: 0n, den: 1n };
  const divisor = gcd(n, d);
  return { num: n / divisor, den: d / divisor };
}

export function isReduced(num: bigint, den: bigint): boolean {
  return gcd(num, den) === 1n;
}

/** The exact value of a written fraction. Non-negative parts only — see `answer.ts`. */
export function valueOf(written: WrittenFraction): Rational {
  return rational(written.whole * written.den + written.num, written.den);
}

/** The `AnswerValue` for a written fraction. `whole` is omitted when it is zero. */
export function fractionAnswer(written: WrittenFraction): AnswerValue {
  return written.whole === 0n
    ? { kind: "fraction", num: written.num, den: written.den }
    : { kind: "fraction", num: written.num, den: written.den, whole: written.whole };
}

/**
 * The schema for a fraction answer.
 *
 * `equivalence` defaults to `as-written`, which is the strict reading and the only
 * safe default: a skill that accepts any equivalent form has to say so, and a skill
 * that forgot to say so marks nothing wrong that should have been right.
 */
export function fractionSchema(
  parts: readonly ("num" | "den" | "whole")[],
  equivalence: FractionEquivalence = "as-written",
): AnswerSchema {
  return { kind: "fraction", parts, equivalence };
}

export const PROPER_PARTS = ["num", "den"] as const;
export const MIXED_PARTS = ["whole", "num", "den"] as const;

/** `whole + num/den` written as a single improper fraction, unreduced. */
export function toImproper(written: WrittenFraction): WrittenFraction {
  return { whole: 0n, num: written.whole * written.den + written.num, den: written.den };
}

/** `num/den` written as a mixed number, unreduced. Requires `den > 0`. */
export function toMixed(num: bigint, den: bigint): WrittenFraction {
  if (den <= 0n) throw new RangeError("toMixed: denominator must be positive");
  return { whole: num / den, num: num % den, den };
}
