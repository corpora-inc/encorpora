/** Exact helpers for the Algebra II Regents families. */
export const gcd = (a: number, b: number): number =>
  b ? gcd(b, a % b) : Math.abs(a);

/** Standard normal CDF through a Taylor/continued-fraction erf, accurate to
 * about 1e-12 (checked against table values in the tests). */
export function erf(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3) {
    let term = ax;
    let sum = ax;
    for (let k = 1; k < 80; k++) {
      term *= (-ax * ax) / k;
      sum += term / (2 * k + 1);
    }
    return (Math.sign(x) * 2 * sum) / Math.sqrt(Math.PI);
  }
  // Continued fraction for erfc for large |x|.
  let f = 0;
  for (let k = 60; k >= 1; k--) f = k / 2 / (ax + f);
  const erfc = Math.exp(-ax * ax) / Math.sqrt(Math.PI) / (ax + f);
  return Math.sign(x) * (1 - erfc);
}
export const normalCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/** Round a nonnegative BigInt ratio to the nearest integer; `clear` is false
 * when the fractional part is within 0.03 of one half (a rounding tie risk). */
export function roundDiv(
  num: bigint,
  den: bigint,
): { value: bigint; clear: boolean } {
  const q = num / den;
  const rem = num - q * den;
  const twice = rem * 2n;
  const value = twice >= den ? q + 1n : q;
  const gap = twice > den ? twice - den : den - twice; // |2 rem - den|
  return { value, clear: gap * 100n > den * 6n };
}
export const withCommas = (v: number | bigint) => v.toLocaleString("en-US");

/** Polynomial text (TeX, no dollars) from coefficients, highest degree first. */
export function polyTex(coefs: number[], v = "x"): string {
  const deg = coefs.length - 1;
  let out = "";
  coefs.forEach((c, i) => {
    if (c === 0) return;
    const d = deg - i;
    const abs = Math.abs(c);
    const body =
      d === 0
        ? String(abs)
        : `${abs === 1 ? "" : abs}${v}${d === 1 ? "" : `^{${d}}`}`;
    out +=
      out === ""
        ? c < 0
          ? `-${body}`
          : body
        : ` ${c < 0 ? "-" : "+"} ${body}`;
  });
  return out === "" ? "0" : out;
}
/** Binomial a*x + b, as text. */
export const binomial = (a: number, b: number, v = "x") => polyTex([a, b], v);
export const isSquarefree = (n: number) => {
  for (let d = 2; d * d <= n; d++) if (n % (d * d) === 0) return false;
  return true;
};
export const isPerfectSquare = (n: number) =>
  n >= 0 && Number.isInteger(Math.sqrt(n));
