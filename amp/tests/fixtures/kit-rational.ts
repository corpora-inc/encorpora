/** Exact rationals and a parser for the equations the kit families display. */
export type Q = [number, number];
const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
export const q = (n: number, d = 1): Q => {
  if (d < 0) [n, d] = [-n, -d];
  const k = g(n, d) || 1;
  return [n / k, d / k];
};
export const add = (a: Q, b: Q): Q => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const sub = (a: Q, b: Q): Q => q(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
export const mul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);
export const div = (a: Q, b: Q): Q => q(a[0] * b[1], a[1] * b[0]);
export const eq = (a: Q, b: Q) => a[0] === b[0] && a[1] === b[1];
export const isZero = (a: Q) => a[0] === 0;

/** "−3/2", "5", "\tfrac{3}{2}" → rational. */
export function parseQ(raw: string): Q {
  const s = raw
    .replaceAll("−", "-")
    .replace(/\\tfrac\{(-?\d+)\}\{(\d+)\}/g, "$1/$2")
    .replace(/\s+/g, "");
  const m = s.match(/^(-?)(\d+)(?:\/(\d+))?$/);
  if (!m) throw new Error(`Not a rational: ${raw}`);
  return q((m[1] ? -1 : 1) * Number(m[2]), m[3] ? Number(m[3]) : 1);
}

/** The right side of "name = m x + k" (name y or g(x)): slope and constant. */
export function parseSlopeIntercept(text: string): { m: Q; k: Q } {
  const s = text
    .replaceAll("$", "")
    .replaceAll("−", "-")
    .replace(/\\tfrac\{(-?\d+)\}\{(\d+)\}/g, "$1/$2")
    .replace(/\s+/g, "");
  const rhs = s.split("=")[1]!;
  const m = rhs.match(/^(-?)(\d+(?:\/\d+)?)?x(?:([+-])(\d+(?:\/\d+)?))?$/);
  if (!m) throw new Error(`Not slope-intercept: ${text}`);
  const slope = mul(q(m[1] ? -1 : 1), m[2] ? parseQ(m[2]) : q(1));
  const k = m[3] ? mul(q(m[3] === "-" ? -1 : 1), parseQ(m[4]!)) : q(0);
  return { m: slope, k };
}

/** "ax + by = c" with integer coefficients (a, b nonzero or absent). */
export function parseStandard(text: string): {
  a: number;
  b: number;
  c: number;
} {
  const s = text.replaceAll("$", "").replaceAll("−", "-").replace(/\s+/g, "");
  const m = s.match(/^(-?\d*)x([+-]\d*)y=(-?\d+)$/);
  if (!m) throw new Error(`Not standard form: ${text}`);
  const coeff = (t: string) =>
    t === "" || t === "+" ? 1 : t === "-" ? -1 : Number(t);
  return { a: coeff(m[1]!), b: coeff(m[2]!), c: Number(m[3]) };
}
