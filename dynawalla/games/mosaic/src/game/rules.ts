/**
 * The rule is the whole tutorial.
 *
 * A banner sits above the wall showing one of five things, in numerals and
 * operator glyphs only — no prose, in any language:
 *
 *     × 6        break every tile that is a multiple of six
 *     24 ÷ ▪     break every tile that divides twenty-four
 *     = 12       break every tile whose face equals twelve
 *     = 1/2      ...including fractions, and `= 50%`
 *     > 40       break every tile greater than forty
 *
 * Tiles that do not match are not "wrong". They are masonry: the ball bounces
 * off them with a stone clunk and nothing bad happens. That is the whole reason
 * this works as a game — you cannot aim a ricochet precisely enough to be
 * punished for missing, so a miss costs time and nothing else.
 */
import type { Rat } from "./rational.ts";
import { cmp, divides, eq, int, isInt, percentText, rat, ratText } from "./rational.ts";

export type RuleKind = "multiple" | "factor" | "equals" | "greater" | "less";

export type Rule = {
  kind: RuleKind;
  /** The rule's operand: 6 for `× 6`, 24 for `24 ÷ ▪`, 1/2 for `= 1/2`. */
  target: Rat;
  /** `equals` only: render the target as a percent instead of a fraction. */
  asPercent?: boolean;
};

/** Is this tile face guilty under this rule? Exact integer/rational work. */
export function guilty(rule: Rule, value: Rat): boolean {
  switch (rule.kind) {
    case "multiple":
      // Multiples are an integer idea. A fraction tile is never a multiple.
      return isInt(value) && isInt(rule.target) && divides(rule.target, value);
    case "factor":
      // "divides 24" — 0 divides nothing, negatives are never generated.
      return isInt(value) && value.n > 0 && divides(value, rule.target);
    case "equals":
      return eq(value, rule.target);
    case "greater":
      return cmp(value, rule.target) > 0;
    case "less":
      return cmp(value, rule.target) < 0;
  }
}

/** The banner, as glyphs. `▪` is the tile placeholder. */
export function ruleBanner(rule: Rule): string {
  switch (rule.kind) {
    case "multiple":
      return `× ${ratText(rule.target)}`;
    case "factor":
      return `${ratText(rule.target)} ÷ ▪`;
    case "equals": {
      if (rule.asPercent) {
        const p = percentText(rule.target);
        if (p) return `= ${p}`;
      }
      return `= ${ratText(rule.target)}`;
    }
    case "greater":
      return `> ${ratText(rule.target)}`;
    case "less":
      return `< ${ratText(rule.target)}`;
  }
}

// ---------------------------------------------------------------------------
// Tile faces
// ---------------------------------------------------------------------------

/**
 * What is printed on a tile. `text` is display-ready; `value` is what the rule
 * is tested against. An expression tile forces evaluation before classification,
 * which is how a `> 40` wave becomes hard without changing any UI.
 */
export type Face = {
  text: string;
  value: Rat;
  /** Used only to pick a legible font size. */
  width: number;
};

export const faceInt = (n: number): Face => ({ text: String(n), value: int(n), width: String(n).length });

export const faceFrac = (n: number, d: number): Face => ({
  text: `${n}/${d}`,
  value: rat(n, d),
  width: String(n).length + String(d).length + 1,
});

export type Op = "+" | "−" | "×" | "÷";

/** An expression tile. Division is only ever generated to come out exact. */
export function faceExpr(a: number, op: Op, b: number): Face {
  let v: number;
  switch (op) {
    case "+":
      v = a + b;
      break;
    case "−":
      v = a - b;
      break;
    case "×":
      v = a * b;
      break;
    case "÷":
      if (b === 0 || a % b !== 0) throw new Error(`inexact division generated: ${a}÷${b}`);
      v = a / b;
      break;
  }
  const text = `${a}${op}${b}`;
  return { text, value: int(v), width: text.length };
}
