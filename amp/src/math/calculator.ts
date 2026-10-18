import type { TemplateMetadata } from "./contracts";

/** Where computation is the skill being practiced, the calculator stays off.
 * Elsewhere — as on the SAT, which allows a calculator throughout the math
 * section — understanding and setting up the operations is the point. */
const COMPUTATION_STRANDS = new Set([
  "number",
  "operations",
  "fractions",
  "decimals",
]);
const COMPUTATION_TEMPLATES = new Set([
  "integer-power",
  "operation-order",
  "median-data",
  "range-data",
  "interquartile-range-data",
]);
export function calculatorAllowed(
  template: Pick<TemplateMetadata, "id">,
  strand: string | undefined,
  grade: number,
): boolean {
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
