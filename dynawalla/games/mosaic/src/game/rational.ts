/**
 * Exact rational arithmetic on integers. No floats ever reach an answer or a
 * comparison — `0.1 + 0.2 !== 0.3` would mark a correct child wrong, silently
 * and deterministically, which is the worst failure this product can have.
 *
 * Every value on a tile and every rule target is a `Rat`. Integers are `n/1`.
 * All `Rat`s in circulation are reduced with a positive denominator, which
 * makes equality a two-field compare and ordering one cross-multiplication.
 */
export type Rat = { readonly n: number; readonly d: number };

export function gcd(a: number, b: number): number {
  a = a < 0 ? -a : a;
  b = b < 0 ? -b : b;
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

/** Reduce, and normalise the sign onto the numerator. */
export function rat(n: number, d = 1): Rat {
  if (d === 0) throw new Error("rational with zero denominator");
  if (!Number.isInteger(n) || !Number.isInteger(d)) {
    throw new Error(`rational from non-integers: ${n}/${d}`);
  }
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

export const int = (n: number): Rat => ({ n, d: 1 });

export const isInt = (a: Rat): boolean => a.d === 1;

export function add(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function sub(a: Rat, b: Rat): Rat {
  return rat(a.n * b.d - b.n * a.d, a.d * b.d);
}
export function mul(a: Rat, b: Rat): Rat {
  return rat(a.n * b.n, a.d * b.d);
}
export function div(a: Rat, b: Rat): Rat {
  if (b.n === 0) throw new Error("division by zero");
  return rat(a.n * b.d, a.d * b.n);
}

/** Reduced form makes this a field compare; no cross-multiply needed. */
export function eq(a: Rat, b: Rat): boolean {
  return a.n === b.n && a.d === b.d;
}

/** -1 | 0 | 1. Denominators are positive, so the cross-multiply is safe. */
export function cmp(a: Rat, b: Rat): number {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}

/** Exact "b divides a" for integers. Non-integers are never divisors here. */
export function divides(divisor: Rat, of: Rat): boolean {
  if (!isInt(divisor) || !isInt(of)) return false;
  if (divisor.n === 0) return false;
  return of.n % divisor.n === 0;
}

/** Display string. Integers render bare; fractions render `n/d`. */
export function ratText(a: Rat): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`;
}

/** Exact percent, or null when the value is not a whole number of percent. */
export function percentText(a: Rat): string | null {
  const num = a.n * 100;
  if (num % a.d !== 0) return null;
  return `${num / a.d}%`;
}
