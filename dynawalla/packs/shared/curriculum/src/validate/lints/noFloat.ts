/**
 * The no-float lint (acceptance item M-05, ADR-0006).
 *
 * `0.1 + 0.2 !== 0.3` marks correct decimal work *wrong*, deterministically, so no
 * flaky-test detector will ever surface it. This lint is the only guard, and a
 * suppression comment inside `curriculum/` or `engine/` is a review blocker.
 *
 * What it catches: a fractional numeric literal, a negative-exponent literal, a
 * transcendental or random `Math` member, `parseFloat`, and the float-formatting
 * methods. Comments and string literals are excluded — see `scan.ts`.
 *
 * What it does not catch, stated so nobody over-trusts it: `/` between two values
 * that happen to be non-integers at runtime. Integer division on `number` is a
 * legitimate and exact operation (`(a - (a % b)) / b`), and no regex can tell the
 * two apart. The structural defence against that is that every quantity in these
 * two packages is either a `bigint`, a `Rational`, or a documented fixed-point
 * integer, and the tests compare against exact rational arithmetic.
 */

import type { LintHit, SourceFile } from "./scan.ts";
import { findInCode } from "./scan.ts";

/**
 * Built from a word list rather than written as one literal, so this file does not
 * match its own lint when the lint is run over the package that contains it.
 */
const FLOAT_MATH_MEMBERS = [
  "random",
  "exp",
  "expm1",
  "log",
  "log1p",
  "log2",
  "log10",
  "pow",
  "sqrt",
  "cbrt",
  "hypot",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "fround",
  "E",
  "PI",
  "LN2",
  "LN10",
  "LOG2E",
  "LOG10E",
  "SQRT2",
  "SQRT1_2",
];

export const FLOAT_PATTERNS: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: "fractional numeric literal", pattern: /(?<![\w$.])\d[\d_]*\.\d/ },
  { name: "leading-dot numeric literal", pattern: /(?<![\w$.)\]])\.\d/ },
  { name: "negative-exponent literal", pattern: /(?<![\w$.])\d[\d_]*(\.\d+)?[eE]-\d/ },
  { name: "floating-point Math member", pattern: new RegExp(`\\bMath\\.(${FLOAT_MATH_MEMBERS.join("|")})\\b`) },
  { name: "parseFloat", pattern: /\bparseFloat\s*\(/ },
  { name: "Number.parseFloat", pattern: /\bNumber\s*\.\s*parseFloat\b/ },
  { name: "Number.EPSILON", pattern: /\bNumber\s*\.\s*EPSILON\b/ },
  { name: "toFixed", pattern: /\.toFixed\s*\(/ },
  { name: "toPrecision", pattern: /\.toPrecision\s*\(/ },
];

export type FloatViolation = LintHit & { readonly rule: string };

export function findFloatViolations(file: SourceFile): FloatViolation[] {
  const out: FloatViolation[] = [];
  for (const { name, pattern } of FLOAT_PATTERNS) {
    for (const hit of findInCode(file, pattern)) out.push({ ...hit, rule: name });
  }
  return out;
}
