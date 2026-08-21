/**
 * Exact rational arithmetic over BigInt.
 *
 * A fraction that reaches an answer, a distractor or a comparison is NEVER a float.
 * `1/3 + 1/6` must be exactly `1/2`, and `0.333… + 0.1666…` is not. Floats appear in
 * this game only downstream of `toFloat`, and only ever to position a pixel.
 *
 * Invariants held by construction:
 *   - `d > 0n`
 *   - `gcd(|n|, d) === 1n`
 *   - zero is exactly `{ n: 0n, d: 1n }`
 * so structural equality and `cmp` agree and every value has one representation.
 */

export type Rat = { readonly n: bigint; readonly d: bigint };

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

export const ZERO: Rat = { n: 0n, d: 1n };
export const ONE: Rat = { n: 1n, d: 1n };

export function rat(n: bigint | number, d: bigint | number = 1n): Rat {
  const num0 = typeof n === "number" ? BigInt(assertInt(n)) : n;
  const den0 = typeof d === "number" ? BigInt(assertInt(d)) : d;
  if (den0 === 0n) throw new RangeError("rat: zero denominator");
  let num = num0;
  let den = den0;
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  if (num === 0n) return ZERO;
  const g = gcd(num, den);
  return { n: num / g, d: den / g };
}

function assertInt(v: number): number {
  if (!Number.isSafeInteger(v)) throw new RangeError(`rat: not a safe integer: ${String(v)}`);
  return v;
}

export function add(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function sub(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d - b.n * a.d, a.d * b.d);
}
export function mul(a: Rat, b: Rat): Rat {
  return rat(a.n * b.n, a.d * b.d);
}

/** -1 if a<b, 0 if equal, 1 if a>b. Exact: cross-multiplied integers. */
export function cmp(a: Rat, b: Rat): -1 | 0 | 1 {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}

export function eq(a: Rat, b: Rat): boolean {
  return a.n === b.n && a.d === b.d;
}

/** Canonical display form: "3/4", "1", "0", "2" — never "4/4" or "0/3". */
export function fmt(r: Rat): string {
  return r.d === 1n ? String(r.n) : `${r.n}/${r.d}`;
}

/**
 * Parse "3/4" | "3 / 4" | "2" | "-1/2". Returns null for anything else, including a
 * decimal — a decimal answer means the host is not speaking fractions and the caller
 * must fall back rather than guess.
 */
export function parseRat(s: string): Rat | null {
  const t = s.trim();
  const m = /^(-?\d{1,15})\s*(?:\/\s*(\d{1,15}))?$/.exec(t);
  if (!m) return null;
  const n = BigInt(m[1]!);
  const d = m[2] === undefined ? 1n : BigInt(m[2]);
  if (d === 0n) return null;
  return rat(n, d);
}

/** ONLY for rendering. Never for a comparison and never for an answer. */
export function toFloat(r: Rat): number {
  return Number(r.n) / Number(r.d);
}

/** True when 0 < r <= 1 — the range a position inside one bar can represent. */
export function inBar(r: Rat): boolean {
  return cmp(r, ZERO) > 0 && cmp(r, ONE) <= 0;
}
