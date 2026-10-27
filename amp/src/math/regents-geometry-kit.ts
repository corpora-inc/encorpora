import { gcd } from "./chain-kit";

export type R = (lo: number, hi: number) => number;
/** Redraw the model: generateVaried retries on this message. */
export const retry = (): never => {
  throw new Error("Need three retries");
};
/** True when x rounded to `places` is not within 0.03 of a rounding tie. */
export function clearOfTie(x: number, places: number): boolean {
  const s = Math.abs(x) * 10 ** places;
  return Math.abs(s - Math.floor(s) - 0.5) > 0.03;
}
/** Simplest radical form a*sqrt(b) of sqrt(n): returns [a, b]. */
export function radical(n: number): [number, number] {
  let a = 1;
  let rest = n;
  for (let f = 2; f * f <= rest; f++)
    while (rest % (f * f) === 0) {
      a *= f;
      rest /= f * f;
    }
  return [a, rest];
}
/** TeX (no dollar signs) for sqrt(n) simplified. */
export function radicalTex(n: number): string {
  const [a, b] = radical(n);
  if (b === 1) return String(a);
  return `${a === 1 ? "" : a}\\sqrt{${b}}`;
}
/** "y - 3" / "y + 3" / "y" for a point-slope factor. */
export const shifted = (v: string, c: number) =>
  c === 0 ? v : c > 0 ? `${v} - ${c}` : `${v} + ${-c}`;
/** Reduced slope TeX: frac(-2,3) = "-\frac{2}{3}". */
export function slopeTex(num: number, den: number): string {
  if (den < 0) [num, den] = [-num, -den];
  const g = gcd(num, den) || 1;
  num /= g;
  den /= g;
  if (den === 1) return String(num);
  return `${num < 0 ? "-" : ""}\\frac{${Math.abs(num)}}{${den}}`;
}
const toRad = (deg: number) => (deg * Math.PI) / 180;
export const sinD = (d: number) => Math.sin(toRad(d));
export const cosD = (d: number) => Math.cos(toRad(d));
export const tanD = (d: number) => Math.tan(toRad(d));
