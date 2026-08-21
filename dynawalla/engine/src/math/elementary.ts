/**
 * `ln`, `exp`, `pow` and `logit`, in integer arithmetic.
 *
 * `logistic.ts` computes σ and `e^-x`, which is everything Layer S needs. Two
 * other places need more:
 *
 * - **The scheduler inverts σ.** "Serve a card the child has an 80% chance on"
 *   is `b = θ − logit(0.80)`, and doing it any other way — scanning levels and
 *   calling σ on each — costs a sigmoid per candidate per slot, which is the
 *   difference between an `nextExercises(8)` that fits gate EG-4's 5 ms and one
 *   that does not.
 * - **FSRS-6 is a power law.** `S^-w9` and `(1 + F·t/S)^-d` have real exponents,
 *   so they need `exp(y·ln x)`. There is no way to write FSRS without one.
 *
 * Everything is computed at 10^-18 in BigInt and rounded once, at the end, to a
 * millionth. No `Math.log`, no `Math.exp`, no `**` on a fractional exponent —
 * gate EG-1's float scan bans all three, and gate EG-2 would be a coin flip with
 * any of them.
 *
 * Accuracy is checked in `elementary.test.ts` against published values and
 * against the identities (`exp(ln x) = x`, `ln(ab) = ln a + ln b`), which is an
 * oracle independent of this implementation.
 */

import { FIX_SCALE, ONE, ZERO, sub } from "./fixed.ts";
import type { Fix } from "./fixed.ts";

const SCALE18 = 10n ** 18n;
const MICRO_PER_SCALE18 = 10n ** 12n;

/** ln 2, to 18 places. */
const LN2_18 = 693_147_180_559_945_309n;

/** Terms in the atanh and exp series. Both converge geometrically here. */
const SERIES_TERMS = 40;

/** `exp` beyond this overflows the fixed-point range; clamped rather than thrown. */
export const EXP_MAX: Fix = (22 * FIX_SCALE) as Fix;

function divRound(numerator: bigint, denominator: bigint): bigint {
  const q = numerator / denominator;
  const r = numerator % denominator;
  const twice = (r < 0n ? -r : r) * 2n;
  if (twice < denominator) return q;
  return numerator < 0n ? q - 1n : q + 1n;
}

function toFix(value18: bigint, what: string): Fix {
  const micro = divRound(value18, MICRO_PER_SCALE18);
  const out = Number(micro);
  if (!Number.isSafeInteger(out)) throw new RangeError(`${what}: fixed-point overflow`);
  return out as Fix;
}

/**
 * `ln x` at 10^-18, for `x > 0`.
 *
 * Reduce `x` to `m ∈ [1, 2)` by halving, so `ln x = k·ln2 + ln m`; then
 * `ln m = 2·atanh(z)` with `z = (m−1)/(m+1) ∈ [0, 1/3)`. The series in `z`
 * converges on `z² ≤ 1/9`, which reaches 10^-19 well inside the term budget —
 * the naive `ln(1+u)` series would need thousands of terms at `u → 1`.
 */
function ln18(x18: bigint): bigint {
  if (x18 <= 0n) throw new RangeError("ln: non-positive argument");
  let mantissa = x18;
  let exponent = 0n;
  while (mantissa >= 2n * SCALE18) {
    mantissa = divRound(mantissa, 2n);
    exponent += 1n;
  }
  while (mantissa < SCALE18) {
    mantissa *= 2n;
    exponent -= 1n;
  }

  const z = divRound((mantissa - SCALE18) * SCALE18, mantissa + SCALE18);
  const zSquared = divRound(z * z, SCALE18);
  let term = z;
  let sum = z;
  for (let k = 1; k <= SERIES_TERMS; k++) {
    term = divRound(term * zSquared, SCALE18);
    if (term === 0n) break;
    sum += divRound(term, BigInt(2 * k + 1));
  }
  return exponent * LN2_18 + 2n * sum;
}

/** `e^x` at 10^-18, any sign. Range-reduced by `ln 2`, then Taylor. */
function exp18(x18: bigint): bigint {
  const k = divRound(x18, LN2_18);
  const r = x18 - k * LN2_18;

  let term = SCALE18;
  let sum = SCALE18;
  for (let i = 1; i <= SERIES_TERMS; i++) {
    term = divRound(term * r, SCALE18 * BigInt(i));
    if (term === 0n) break;
    sum += term;
  }

  if (k >= 0n) return sum << k;
  return divRound(sum, 1n << -k);
}

/** `ln x` for `x > 0`. */
export function ln(x: Fix): Fix {
  return toFix(ln18(BigInt(x) * MICRO_PER_SCALE18), "ln");
}

/** `e^x`, clamped at `EXP_MAX` so a runaway exponent saturates instead of throwing. */
export function exp(x: Fix): Fix {
  const bounded = x > EXP_MAX ? EXP_MAX : x;
  return toFix(exp18(BigInt(bounded) * MICRO_PER_SCALE18), "exp");
}

/** `base^exponent` for `base > 0`, via `exp(exponent · ln base)`. */
export function pow(base: Fix, exponent: Fix): Fix {
  if (base <= 0) throw new RangeError("pow: non-positive base");
  if (exponent === ZERO) return ONE;
  const product = divRound(ln18(BigInt(base) * MICRO_PER_SCALE18) * BigInt(exponent), BigInt(FIX_SCALE));
  return toFix(exp18(product), "pow");
}

/**
 * `logit(p) = ln(p / (1 − p))` — σ's inverse, and the scheduler's whole reason
 * for this file.
 *
 * Saturates rather than diverging: `p = 0` and `p = 1` are reachable values of a
 * `Fix` and asking for an item a child is certain to fail is a question with an
 * answer, which is "the hardest one there is".
 */
export const LOGIT_DOMAIN: Fix = (20 * FIX_SCALE) as Fix;

export function logit(p: Fix): Fix {
  if (p <= ZERO) return -LOGIT_DOMAIN as Fix;
  if (p >= ONE) return LOGIT_DOMAIN;
  const value = toFix(ln18(divRound(BigInt(p) * SCALE18, BigInt(sub(ONE, p)))), "logit");
  return value > LOGIT_DOMAIN ? LOGIT_DOMAIN : value < -LOGIT_DOMAIN ? (-LOGIT_DOMAIN as Fix) : value;
}
