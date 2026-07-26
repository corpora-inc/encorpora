/**
 * Exact rational arithmetic over BigInt.
 *
 * ADR-0006: no IEEE floats in any generator or checker. `0.1 + 0.2 !== 0.3` marks
 * correct decimal work *wrong*, deterministically, so no flaky-test detector would
 * ever surface it. Every numeric quantity that reaches an answer, a comparison or a
 * difficulty coefficient is a `Rational`.
 *
 * Invariants held by construction for every value produced by this module:
 *   - `d > 0n`
 *   - `gcd(|n|, d) === 1n`
 *   - `0` is exactly `{ n: 0n, d: 1n }`
 * so structural equality and `cmp` agree, and a value has exactly one representation.
 */

export type Rational = {
  readonly n: bigint;
  readonly d: bigint;
};

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

/** Construct a normalized rational. Throws on a zero denominator. */
export function rational(n: bigint, d: bigint = 1n): Rational {
  if (d === 0n) throw new RangeError("rational: zero denominator");
  let num = n;
  let den = d;
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  if (num === 0n) return ZERO;
  const g = gcd(num, den);
  return { n: num / g, d: den / g };
}

export const ZERO: Rational = { n: 0n, d: 1n };
export const ONE: Rational = { n: 1n, d: 1n };

/**
 * Lift a JS number. Rejects anything that is not a safe integer — the point of this
 * module is that a fractional `number` can never enter the system silently.
 */
export function fromSafeInt(v: number): Rational {
  if (!Number.isSafeInteger(v)) {
    throw new RangeError(`fromSafeInt: not a safe integer: ${String(v)}`);
  }
  return rational(BigInt(v));
}

/** `10^k` as a positive integer bigint. `k` must be >= 0. */
export function pow10(k: number): bigint {
  if (!Number.isSafeInteger(k) || k < 0) throw new RangeError(`pow10: bad exponent ${String(k)}`);
  let out = 1n;
  for (let i = 0; i < k; i++) out *= 10n;
  return out;
}

/** `value / 10^places`, exactly. The one sanctioned way to build a decimal. */
export function fromScaled(value: bigint, places: number): Rational {
  return rational(value, pow10(places));
}

export function add(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function sub(a: Rational, b: Rational): Rational {
  return rational(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function mul(a: Rational, b: Rational): Rational {
  return rational(a.n * b.n, a.d * b.d);
}

export function div(a: Rational, b: Rational): Rational {
  if (b.n === 0n) throw new RangeError("div: division by zero");
  return rational(a.n * b.d, a.d * b.n);
}

export function neg(a: Rational): Rational {
  return a.n === 0n ? ZERO : { n: -a.n, d: a.d };
}

export function abs(a: Rational): Rational {
  return a.n < 0n ? { n: -a.n, d: a.d } : a;
}

export function inv(a: Rational): Rational {
  if (a.n === 0n) throw new RangeError("inv: zero has no reciprocal");
  return rational(a.d, a.n);
}

export function cmp(a: Rational, b: Rational): -1 | 0 | 1 {
  const left = a.n * b.d;
  const right = b.n * a.d;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function eq(a: Rational, b: Rational): boolean {
  return a.n === b.n && a.d === b.d;
}

export function lt(a: Rational, b: Rational): boolean {
  return cmp(a, b) < 0;
}

export function lte(a: Rational, b: Rational): boolean {
  return cmp(a, b) <= 0;
}

export function gt(a: Rational, b: Rational): boolean {
  return cmp(a, b) > 0;
}

export function gte(a: Rational, b: Rational): boolean {
  return cmp(a, b) >= 0;
}

export function isZero(a: Rational): boolean {
  return a.n === 0n;
}

export function isInteger(a: Rational): boolean {
  return a.d === 1n;
}

export function sign(a: Rational): -1 | 0 | 1 {
  if (a.n < 0n) return -1;
  if (a.n > 0n) return 1;
  return 0;
}

export function min(a: Rational, b: Rational): Rational {
  return cmp(a, b) <= 0 ? a : b;
}

export function max(a: Rational, b: Rational): Rational {
  return cmp(a, b) >= 0 ? a : b;
}

/** The integer value, or `null` when the rational is not an integer. */
export function asInteger(a: Rational): bigint | null {
  return a.d === 1n ? a.n : null;
}

/** Floor of the value, as a bigint. Exact for negatives too. */
export function floor(a: Rational): bigint {
  const q = a.n / a.d;
  const r = a.n % a.d;
  return r < 0n ? q - 1n : q;
}

/**
 * `value * 10^places` when that product is an integer, else `null`.
 * This is the bridge to a digit-wise column algorithm: a decimal problem is an
 * integer problem plus a decimal-point position, and nothing else.
 */
export function toScaled(a: Rational, places: number): bigint | null {
  const scaled = a.n * pow10(places);
  return scaled % a.d === 0n ? scaled / a.d : null;
}

/**
 * Exact fixed-place decimal string, or `null` when the value does not fit in
 * `places` decimal digits. Never rounds: rounding is a display decision that
 * belongs to the number layer (ARCHITECTURE L2), not to the arithmetic.
 *
 * The separator is always `.`; localizing it is the number layer's job (CG-14).
 */
export function toDecimalString(a: Rational, places: number): string | null {
  const scaled = toScaled(a, places);
  if (scaled === null) return null;
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(places + 1, "0");
  const whole = digits.slice(0, digits.length - places);
  const frac = places === 0 ? "" : `.${digits.slice(digits.length - places)}`;
  return `${negative ? "-" : ""}${whole}${frac}`;
}

/** Canonical `n/d` (or `n` when integral). Stable, used for hashing and snapshots. */
export function toString(a: Rational): string {
  return a.d === 1n ? a.n.toString() : `${a.n.toString()}/${a.d.toString()}`;
}

const INTEGER_PATTERN = /^[+-]?\d+$/;
const FRACTION_PATTERN = /^([+-]?\d+)\/(\d+)$/;
const DECIMAL_PATTERN = /^([+-]?)(\d*)\.(\d+)$/;

/**
 * Parse `"3"`, `"-3/4"` or `"0.75"` into an exact rational.
 *
 * This is the only place a decimal *string* becomes a number in this package, and it
 * goes through BigInt digits — never `parseFloat`. `parseRational("0.1")` is exactly
 * one tenth.
 */
export function parseRational(text: string): Rational {
  const s = text.trim();
  if (INTEGER_PATTERN.test(s)) return rational(BigInt(s));

  const frac = FRACTION_PATTERN.exec(s);
  if (frac) {
    const [, num, den] = frac;
    if (num === undefined || den === undefined) throw new SyntaxError(`parseRational: ${text}`);
    return rational(BigInt(num), BigInt(den));
  }

  const dec = DECIMAL_PATTERN.exec(s);
  if (dec) {
    const [, signPart, wholePart, fracPart] = dec;
    if (fracPart === undefined) throw new SyntaxError(`parseRational: ${text}`);
    const digits = `${wholePart === undefined || wholePart === "" ? "0" : wholePart}${fracPart}`;
    const value = BigInt(digits) * (signPart === "-" ? -1n : 1n);
    return rational(value, pow10(fracPart.length));
  }

  throw new SyntaxError(`parseRational: cannot parse ${JSON.stringify(text)}`);
}
