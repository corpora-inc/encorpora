import { gcd } from "./chain-kit";

/** Small exact-text helpers shared by the Regents-style families. */
export { gcd };

/** TeX for an integer with a true minus sign: -3 -> "-3". */
export const n = (v: number) => String(v);
/** "+ 5" / "- 5" joiner text for a term added to an expression: signedTerm(-5) = "- 5". */
export const signedTerm = (v: number) => (v < 0 ? `- ${-v}` : `+ ${v}`);
/** Coefficient text for a variable term: 1 -> "", -1 -> "-". */
export const coef = (v: number) => (v === 1 ? "" : v === -1 ? "-" : String(v));
/** a*x + b as TeX text (no dollar signs), skipping zero and unit pieces. */
export function linear(a: number, b: number, x = "x"): string {
  const first = a === 0 ? "" : `${coef(a)}${x}`;
  if (a === 0) return String(b);
  if (b === 0) return first;
  return `${first} ${signedTerm(b)}`;
}
/** Reduced fraction as TeX; whole numbers print plainly. */
export function frac(num: number, den: number): string {
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den) || 1;
  num /= g;
  den /= g;
  if (den === 1) return String(num);
  return `${num < 0 ? "-" : ""}\\frac{${Math.abs(num)}}{${den}}`;
}
/** Round half up (away from zero for ties) to `places` decimals; exact text. */
export function roundText(x: number, places: number): string {
  const f = 10 ** places;
  const scaled = Math.round(Math.abs(x) * f + 1e-9);
  const text = (scaled / f).toFixed(places);
  return (x < 0 && scaled !== 0 ? "-" : "") + text;
}
export const pickFrom = <T>(
  r: (lo: number, hi: number) => number,
  items: readonly T[],
): T => items[r(0, items.length - 1)]!;
/** Draw an integer in [lo, hi] that is not zero. */
export const nonzero = (
  r: (lo: number, hi: number) => number,
  lo: number,
  hi: number,
) => {
  for (;;) {
    const v = r(lo, hi);
    if (v !== 0) return v;
  }
};
/** Parenthesize only negative numbers: par(-2) = "(-2)", par(3) = "3". */
export const par = (v: number | string) =>
  String(v).startsWith("-") ? `(${v})` : String(v);
