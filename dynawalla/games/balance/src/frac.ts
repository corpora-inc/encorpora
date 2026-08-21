// Exact rational arithmetic on small integers.
//
// Every quantity a child can be right or wrong about lives here. No float ever
// touches an answer or a comparison: `0.1 + 0.2 !== 0.3` would mark correct work
// wrong, deterministically. Floats appear only in `toNumber`, which is for
// physics and pixels and is never consulted to decide anything.

export type Frac = { readonly n: number; readonly d: number }; // d > 0, gcd(|n|, d) === 1

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function frac(n: number, d = 1): Frac {
  if (!Number.isInteger(n) || !Number.isInteger(d)) {
    throw new Error(`frac() requires integers, got ${n}/${d}`);
  }
  if (d === 0) throw new Error("frac() denominator is zero");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  if (n === 0) return { n: 0, d: 1 };
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export const ZERO: Frac = { n: 0, d: 1 };

export function add(a: Frac, b: Frac): Frac {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function sub(a: Frac, b: Frac): Frac {
  return frac(a.n * b.d - b.n * a.d, a.d * b.d);
}
export function mulInt(a: Frac, k: number): Frac {
  return frac(a.n * k, a.d);
}
export function neg(a: Frac): Frac {
  return { n: -a.n, d: a.d };
}
export function eq(a: Frac, b: Frac): boolean {
  return a.n === b.n && a.d === b.d;
}
/** -1, 0 or 1 — exact, via cross multiplication (denominators are positive). */
export function cmp(a: Frac, b: Frac): -1 | 0 | 1 {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
}
export function isZero(a: Frac): boolean {
  return a.n === 0;
}
export function isPositive(a: Frac): boolean {
  return a.n > 0;
}
export function isInteger(a: Frac): boolean {
  return a.d === 1;
}

/** Float, for physics and layout only. Never for a comparison that judges a child. */
export function toNumber(a: Frac): number {
  return a.n / a.d;
}

/** Canonical string: "7", "-3", "3/4". This is what goes into `Question.answer`. */
export function toKey(a: Frac): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`;
}

export function parseFrac(s: string): Frac | null {
  const m = /^\s*(-?\d+)\s*(?:\/\s*(\d+)\s*)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  const d = m[2] === undefined ? 1 : Number(m[2]);
  if (d === 0) return null;
  return frac(n, d);
}

/** Exact integer division, or null when it does not divide. */
export function exactDiv(total: number, k: number): number | null {
  if (k === 0) return null;
  if (total % k !== 0) return null;
  return total / k;
}
