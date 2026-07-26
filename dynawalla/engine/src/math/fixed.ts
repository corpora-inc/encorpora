/**
 * Fixed-point scalars.
 *
 * The learner model needs logistic probabilities and exponential decay, which
 * cannot be exact rationals. It also may not use floats: acceptance item M-05
 * bans floating-point arithmetic in `engine/` outright, and there is a second,
 * independent reason — gate EG-2 requires identical seeds to produce
 * **byte-identical transcripts across macOS and Linux**, and float accumulation
 * order is exactly the kind of thing that survives one refactor and not the next.
 *
 * So every model quantity is an integer count of millionths, and every operation
 * that could round goes through BigInt. No `number` in this package ever holds a
 * fractional value.
 *
 * Range: values are held as JS numbers, so |value| must stay under 2^53 / 10^6 ≈
 * 9 × 10^9. Every product and quotient is bounds-checked rather than trusted.
 */

declare const fixBrand: unique symbol;

/** An integer count of millionths. Never fractional. */
export type Fix = number & { readonly [fixBrand]: true };

export const FIX_SCALE = 1_000_000;
const SCALE = BigInt(FIX_SCALE);

export const ZERO = 0 as Fix;
export const ONE = FIX_SCALE as Fix;

function assertInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${what}: fixed-point values are safe integers, got ${String(value)}`);
  }
}

function toFix(value: bigint, what: string): Fix {
  const out = Number(value);
  if (!Number.isSafeInteger(out)) {
    throw new RangeError(`${what}: fixed-point overflow (${value.toString()})`);
  }
  return out as Fix;
}

/** Round half away from zero, in exact integer arithmetic. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError("divRound: division by zero");
  const sign = denominator < 0n ? -1n : 1n;
  const d = denominator * sign;
  const n = numerator * sign;
  const q = n / d;
  const r = n % d;
  const twice = (r < 0n ? -r : r) * 2n;
  if (twice < d) return q;
  return n < 0n ? q - 1n : q + 1n;
}

/** A whole number as a fixed-point value. */
export function fromInt(value: number): Fix {
  assertInteger(value, "fromInt");
  return toFix(BigInt(value) * SCALE, "fromInt");
}

/** A raw count of millionths. The only way to write a fractional constant here. */
export function fromMicro(value: number): Fix {
  assertInteger(value, "fromMicro");
  return value as Fix;
}

/** `numerator / denominator`, rounded to the nearest millionth. */
export function fromRatio(numerator: number, denominator: number): Fix {
  assertInteger(numerator, "fromRatio");
  assertInteger(denominator, "fromRatio");
  if (denominator === 0) throw new RangeError("fromRatio: zero denominator");
  return toFix(divRound(BigInt(numerator) * SCALE, BigInt(denominator)), "fromRatio");
}

export function toMicro(value: Fix): number {
  return value;
}

/** Nearest whole number. */
export function toRoundedInt(value: Fix): number {
  return Number(divRound(BigInt(value), SCALE));
}

export function add(a: Fix, b: Fix): Fix {
  return toFix(BigInt(a) + BigInt(b), "add");
}

export function sub(a: Fix, b: Fix): Fix {
  return toFix(BigInt(a) - BigInt(b), "sub");
}

export function neg(a: Fix): Fix {
  return -a as Fix;
}

export function abs(a: Fix): Fix {
  return (a < 0 ? -a : a) as Fix;
}

export function mul(a: Fix, b: Fix): Fix {
  return toFix(divRound(BigInt(a) * BigInt(b), SCALE), "mul");
}

export function div(a: Fix, b: Fix): Fix {
  if (b === 0) throw new RangeError("div: division by zero");
  return toFix(divRound(BigInt(a) * SCALE, BigInt(b)), "div");
}

/** `a * numerator / denominator` with a single rounding step. */
export function scale(a: Fix, numerator: number, denominator: number): Fix {
  assertInteger(numerator, "scale");
  assertInteger(denominator, "scale");
  if (denominator === 0) throw new RangeError("scale: zero denominator");
  return toFix(divRound(BigInt(a) * BigInt(numerator), BigInt(denominator)), "scale");
}

export function cmp(a: Fix, b: Fix): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function lt(a: Fix, b: Fix): boolean {
  return a < b;
}

export function lte(a: Fix, b: Fix): boolean {
  return a <= b;
}

export function gt(a: Fix, b: Fix): boolean {
  return a > b;
}

export function gte(a: Fix, b: Fix): boolean {
  return a >= b;
}

export function min(a: Fix, b: Fix): Fix {
  return a <= b ? a : b;
}

export function max(a: Fix, b: Fix): Fix {
  return a >= b ? a : b;
}

export function clamp(value: Fix, low: Fix, high: Fix): Fix {
  if (low > high) throw new RangeError("clamp: empty range");
  return value < low ? low : value > high ? high : value;
}

/** Integer square root of a non-negative bigint (Newton's method, exact). */
export function isqrt(value: bigint): bigint {
  if (value < 0n) throw new RangeError("isqrt: negative value");
  if (value < 2n) return value;
  let guess = value;
  let next = (guess + 1n) / 2n;
  while (next < guess) {
    guess = next;
    next = (guess + value / guess) / 2n;
  }
  return guess;
}

/** Square root, rounded down to the millionth. */
export function sqrt(value: Fix): Fix {
  if (value < 0) throw new RangeError("sqrt: negative value");
  return toFix(isqrt(BigInt(value) * SCALE), "sqrt");
}

/**
 * Decimal text, for diagnostics and golden transcripts. Exact: a fixed-point
 * value is an integer, so printing it cannot lose anything.
 */
export function format(value: Fix, places = 6): string {
  if (places < 0 || places > 6) throw new RangeError("format: 0..6 places");
  const negative = value < 0;
  const micro = BigInt(negative ? -value : value);
  const divisor = 10n ** BigInt(6 - places);
  const rounded = divRound(micro, divisor);
  const digits = rounded.toString().padStart(places + 1, "0");
  const whole = digits.slice(0, digits.length - places);
  const fraction = places === 0 ? "" : `.${digits.slice(digits.length - places)}`;
  return `${negative && rounded !== 0n ? "-" : ""}${whole}${fraction}`;
}
