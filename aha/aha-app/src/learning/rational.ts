/** Bounded exact arithmetic: no eval, floating-point grading or provider answer key. */
export interface Rational { n: bigint; d: bigint }
const MAX_DIGITS = 18;
export function gcd(a: bigint, b: bigint): bigint {
 a = a < 0n ? -a : a; b = b < 0n ? -b : b;
 while (b) [a,b] = [b,a % b]; return a;
}
export function rational(n: bigint, d = 1n): Rational {
 if (!d) throw new Error('A denominator cannot be zero.');
 if (d < 0n) { n = -n; d = -d; }
 const divisor = gcd(n,d); return {n:n/divisor,d:d/divisor};
}
export function parseRational(raw: string): Rational {
 if (typeof raw !== 'string' || raw.length > 80) throw new Error('Enter a number, decimal, or fraction.');
 const s = raw.trim().replace(/−/g,'-');
 const mixed = /^([+-]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
 if (mixed) {
  if (mixed.slice(2).some(x => x.length > MAX_DIGITS)) throw new Error('Number is too large.');
  const whole = BigInt(mixed[2]), part = BigInt(mixed[3]), den = BigInt(mixed[4]);
  if (!den || part >= den) throw new Error('Use a proper fractional part for a mixed number.');
  return rational((mixed[1] === '-' ? -1n : 1n) * (whole * den + part), den);
 }
 const fraction = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/.exec(s);
 if (fraction) {
  if (fraction.slice(1).some(x=>x.replace(/[+-]/,'').length > MAX_DIGITS)) throw new Error('Number is too large.');
  return rational(BigInt(fraction[1]),BigInt(fraction[2]));
 }
 if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) throw new Error('Enter a number, decimal, or fraction.');
 if (s.replace(/[^0-9]/g,'').length > MAX_DIGITS) throw new Error('Number is too large.');
 const negative = s.startsWith('-'); const [whole, part = ''] = s.replace(/^[+-]/,'').split('.');
 return rational((negative ? -1n : 1n)*BigInt((whole || '0') + part),10n ** BigInt(part.length));
}
export const formatRational = (r:Rational) => r.d === 1n ? String(r.n) : `${r.n}/${r.d}`;
export const add = (a:Rational,b:Rational) => rational(a.n*b.d+b.n*a.d,a.d*b.d);
export const subtract = (a:Rational,b:Rational) => rational(a.n*b.d-b.n*a.d,a.d*b.d);
export const multiply = (a:Rational,b:Rational) => rational(a.n*b.n,a.d*b.d);
export const divide = (a:Rational,b:Rational) => rational(a.n*b.d,a.d*b.n);
export const compare = (a:Rational,b:Rational): -1|0|1 => a.n*b.d < b.n*a.d ? -1 : a.n*b.d > b.n*a.d ? 1 : 0;
export const toNumber = (a:Rational) => Number(a.n)/Number(a.d);
