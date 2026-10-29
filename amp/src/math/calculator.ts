import type { TemplateMetadata } from "./contracts";

/** Applied tasks can share a strand with arithmetic drills. Allow these by
 * task, even below grade 5: choosing operations, interpreting units, money or
 * remainders is the goal; hand calculation is supporting work. Keep pure
 * fraction/decimal chains, facts, algorithms and estimation calculator-free. */
const APPLIED_TEMPLATES = new Set([
  // Money and budgets.
  "price-count-chain",
  "budget-category-balance",
  "gross-net-pay",
  "gross-net-sentence",
  "purchase-change",
  "whole-pack-ribbon-choice",
  // Multi-step quantities, units and geometric models.
  "staar-multistep-stories",
  "staar-measure-chains",
  "conversion-chain-story",
  "perimeter-area-chain",
  "rectangle-chain-blanks",
  "division-remainder-story",
  "signed-changes-sum",
  "share-remainder-fractions",
  "dot-plot-arithmetic",
]);

/** Where computation itself is the skill, the calculator stays off. Data
 * summaries (mean, median, spread) permit arithmetic support: the learner
 * still has to read the data and choose and apply the statistic. */
const COMPUTATION_STRANDS = new Set([
  "number",
  "operations",
  "fractions",
  "decimals",
]);
const COMPUTATION_TEMPLATES = new Set([
  "complete-square-term",
  "complete-square-monic",
  "complete-square-nonmonic",
  "fraction-plot-difference",
  "fraction-plot-equal-share",
  "simplify-square-root",
  "combine-square-roots",
  "multiply-square-roots",
  "rationalize-radical-denominator",
  "rational-power",
  "negative-integer-power",
  "product-of-powers-exponent",
  "quotient-of-powers-exponent",
  "power-of-power-exponent",
  "integer-power",
  "power-missing-exponent",
  "power-repeated-product",
  "power-compare",
  "power-order-trap",
  "power-doubling-story",
  "operation-order",
  "greatest-monomial-factor",
  "monic-quadratic-factorization",
  "nonmonic-quadratic-factorization",
]);
export function calculatorAllowed(
  template: Pick<TemplateMetadata, "id">,
  strand: string | undefined,
  grade: number,
): boolean {
  if (APPLIED_TEMPLATES.has(template.id)) return true;
  if (COMPUTATION_TEMPLATES.has(template.id)) return false;
  if (strand && COMPUTATION_STRANDS.has(strand)) return false;
  return grade >= 5;
}

/** Evaluates a calculator expression without `eval`: + − × ÷ ^ √, brackets,
 * decimals, π and implied multiplication (2π, 3(4), (2)(3)). */
export function evaluate(expression: string): number {
  const tokens = tokenize(expression);
  let i = 0;
  const peek = () => tokens[i];
  const take = () => tokens[i++];
  function primary(): number {
    const t = take();
    if (t === undefined) throw new Error("Incomplete expression");
    if (t === "(") {
      const value = sum();
      if (take() !== ")") throw new Error("Missing )");
      return value;
    }
    if (t === "√") return Math.sqrt(unary());
    if (t === "π") return Math.PI;
    if (t === "-") return -unary();
    if (/^\d*\.?\d+$|^\d+\.$/.test(t)) return Number(t);
    throw new Error(`Unexpected ${t}`);
  }
  function unary(): number {
    if (peek() === "-") {
      take();
      return -unary();
    }
    return power();
  }
  function power(): number {
    const base = primary();
    if (peek() === "^") {
      take();
      return base ** unary();
    }
    return base;
  }
  function product(): number {
    let value = unary();
    for (;;) {
      const t = peek();
      if (t === "×" || t === "÷") {
        take();
        const right = unary();
        value = t === "×" ? value * right : value / right;
      } else if (
        t === "(" ||
        t === "π" ||
        t === "√" ||
        (t && /^[\d.]/.test(t))
      ) {
        value *= unary(); // implied multiplication
      } else return value;
    }
  }
  function sum(): number {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const t = take();
      const right = product();
      value = t === "+" ? value + right : value - right;
    }
    return value;
  }
  const value = sum();
  if (i !== tokens.length) throw new Error("Unexpected input");
  if (!Number.isFinite(value)) throw new Error("Undefined");
  return value;
}

function tokenize(expression: string): string[] {
  const source = expression
    .replace(/\s+/g, "")
    .replace(/[−–]/g, "-")
    .replace(/[*x]/g, "×")
    .replace(/\//g, "÷")
    .replace(/sqrt/g, "√")
    .replace(/pi/g, "π");
  const tokens = source.match(/\d*\.?\d+|\d+\.|[-+×÷^()√π]/g) ?? [];
  if (tokens.join("") !== source) throw new Error("Unexpected input");
  return tokens;
}

/** Shows a result the way a calculator does: up to 10 significant digits. */
export function formatResult(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(10)));
}
