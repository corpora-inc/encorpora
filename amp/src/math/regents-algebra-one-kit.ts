import { gcd } from "./chain-kit";

/** Exact text helpers for the Regents Algebra I families. */
export const sgn = (v: number) => (v < 0 ? "-" : "+");
/** "x + 3" / "x - 3" / "x" for an inner shift. */
export const xShift = (k: number, v = "x") =>
  k === 0 ? v : `${v} ${sgn(k)} ${Math.abs(k)}`;
/** a x^2 + b x + c as TeX text. */
export function quad(a: number, b: number, c: number): string {
  const lead = a === 1 ? "x^2" : a === -1 ? "-x^2" : `${a}x^2`;
  const mid =
    b === 0 ? "" : ` ${sgn(b)} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x`;
  const end = c === 0 ? "" : ` ${sgn(c)} ${Math.abs(c)}`;
  return lead + mid + end;
}
/** (x + h)^2 + k vertex form as TeX text. */
export function vertexForm(h: number, k: number): string {
  const sq = h === 0 ? "x^2" : `(x ${sgn(h)} ${Math.abs(h)})^2`;
  return k === 0 ? sq : `${sq} ${sgn(k)} ${Math.abs(k)}`;
}
/** {a, b, c} as TeX text, sorted ascending. */
export const setTex = (values: number[]) =>
  `\\{${[...new Set(values)].sort((p, q) => p - q).join(", ")}\\}`;
/** (x + p)(x + q) from roots-style offsets, e.g. factorPair(-20, 6) = (x - 20)(x + 6). */
export const factorPair = (p: number, q: number) =>
  `(x ${sgn(p)} ${Math.abs(p)})(x ${sgn(q)} ${Math.abs(q)})`;
export const divisors = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);
export const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));
export { gcd };
