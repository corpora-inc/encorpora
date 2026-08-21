/**
 * The logistic function, in integer arithmetic.
 *
 * `P = c + (1 − c)·σ(θ_s − b_item)` is the centre of the learner model, and σ needs
 * an exponential. This computes it with BigInt at 10^-18 and rounds the answer to a
 * millionth, so it is deterministic on every platform and contains no float.
 *
 * Method: reduce by 64, sum the Taylor series for `e^-r` (18 terms is far more than
 * enough at |r| ≤ 0.32), then square six times. The residual error is around 10^-15
 * relative — nine orders of magnitude below the millionth the result is rounded to.
 * `logistic.test.ts` checks the output against published values of σ, which is an
 * oracle independent of this implementation.
 */

import { ONE, ZERO, clamp, fromInt, fromMicro, neg, sub } from "./fixed.ts";
import type { Fix } from "./fixed.ts";

/** Exactly one half. σ(0) is this value and nothing near it. */
export const HALF = fromMicro(500_000);

const SCALE18 = 10n ** 18n;
const MICRO_PER_SCALE18 = 10n ** 12n;
const REDUCTION_SHIFTS = 6; // divide by 2^6 = 64, then square back six times
const REDUCTION = 64n;
const SERIES_TERMS = 18;

/** Beyond this the result is 0 or 1 to the last millionth anyway. */
export const SIGMOID_DOMAIN = fromInt(20);

function divRound(numerator: bigint, denominator: bigint): bigint {
  const q = numerator / denominator;
  const r = numerator % denominator;
  const twice = (r < 0n ? -r : r) * 2n;
  if (twice < denominator) return q;
  return numerator < 0n ? q - 1n : q + 1n;
}

/** `e^-x` at 10^-18, for `x >= 0`. */
function expNeg18(x18: bigint): bigint {
  const r = divRound(x18, REDUCTION);

  let term = SCALE18;
  let sum = SCALE18;
  for (let k = 1; k <= SERIES_TERMS; k++) {
    term = divRound(term * r, SCALE18 * BigInt(k));
    sum = k % 2 === 0 ? sum + term : sum - term;
  }

  let value = sum;
  for (let i = 0; i < REDUCTION_SHIFTS; i++) value = divRound(value * value, SCALE18);
  return value;
}

/**
 * `σ(x) = 1 / (1 + e^-x)`.
 *
 * Negative inputs are computed as `1 − σ(-x)` rather than directly, so the
 * identity `σ(-x) = 1 − σ(x)` holds exactly at the millionth rather than up to a
 * rounding step. A model whose predictions are not symmetric about zero would
 * bias every difficulty decision in one direction.
 */
export function sigmoid(x: Fix): Fix {
  const bounded = clamp(x, neg(SIGMOID_DOMAIN), SIGMOID_DOMAIN);
  if (bounded === ZERO) return HALF;
  if (bounded < 0) return sub(ONE, sigmoid(neg(bounded)));

  const x18 = BigInt(bounded) * MICRO_PER_SCALE18;
  const exp18 = expNeg18(x18);
  const sigma18 = divRound(SCALE18 * SCALE18, SCALE18 + exp18);
  const micro = divRound(sigma18, MICRO_PER_SCALE18);
  return clamp(Number(micro) as Fix, ZERO, ONE);
}

/** `e^-x` as a fixed-point value, for `x >= 0`. Used by the decay terms. */
export function expNeg(x: Fix): Fix {
  if (x < 0) throw new RangeError("expNeg: negative exponent");
  const bounded = clamp(x, ZERO, fromInt(40));
  const value = expNeg18(BigInt(bounded) * MICRO_PER_SCALE18);
  return Number(divRound(value, MICRO_PER_SCALE18)) as Fix;
}
