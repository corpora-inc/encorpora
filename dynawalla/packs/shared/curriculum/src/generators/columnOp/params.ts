/**
 * `gen.arith.column-op` parameters and their validator.
 *
 * The validator is not decoration: it is the first half of "never emits a
 * contradictory or ambiguous problem". It rejects parameter combinations that no
 * digit assignment could satisfy — three borrows in a two-digit problem, a borrow
 * across a zero with no digit left to regroup from, a subtrahend longer than the
 * minuend — so `generate()` can treat an infeasible draw as a bug rather than as
 * input it has to guess about.
 */

import type { ParamIssue, ParamResult, ParamSchema } from "../../types/generator.ts";

export type ColumnOp = "add" | "sub";

export type ColumnOpParams = {
  readonly op: ColumnOp;
  /** Digit count of the top operand, decimal digits included. */
  readonly digits: number;
  /** Digit count of the bottom operand, decimal digits included. */
  readonly operandDigits: number;
  /** Exactly how many columns regroup (borrow for `sub`, carry for `add`). */
  readonly regroupings: number;
  /** `sub` only: how many zeros in the minuend a single borrow travels through. */
  readonly acrossZero: number;
  readonly decimalPlaces: number;
  /** Allow `a − a = 0`. Off by default: a zero answer teaches nothing here. */
  readonly allowZeroResult: boolean;
};

export const MIN_DIGITS = 2;
export const MAX_DIGITS = 6;
export const MAX_DECIMAL_PLACES = 2;

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Columns that may carry an *extra* regrouping, beyond the ones the across-zero
 * chain already accounts for. Exported because both the validator and the
 * generator need exactly the same answer, and a disagreement between them is the
 * bug class this family is most likely to have.
 */
export function extraRegroupColumns(params: ColumnOpParams): number[] {
  const { op, digits, operandDigits, acrossZero } = params;
  const columns: number[] = [];
  if (op === "sub") {
    // A borrow at column i needs a bottom digit at i (or a zero-run continuation,
    // which the chain below already owns), and the top column can never borrow out
    // or the answer would be negative.
    const lo = acrossZero > 0 ? acrossZero + 2 : 0;
    const hi = Math.min(digits - 2, operandDigits - 1);
    for (let i = lo; i <= hi; i++) columns.push(i);
    return columns;
  }
  // A carry at column i needs a bottom digit at i. Carrying out of the top column
  // is allowed: the sum simply gains a digit.
  for (let i = 0; i <= operandDigits - 1; i++) columns.push(i);
  return columns;
}

/** Regroupings the across-zero chain accounts for on its own. */
export function chainRegroupings(params: ColumnOpParams): number {
  return params.op === "sub" && params.acrossZero > 0 ? params.acrossZero + 1 : 0;
}

function validateShape(raw: unknown, issues: ParamIssue[]): ColumnOpParams | null {
  if (typeof raw !== "object" || raw === null) {
    issues.push({ path: "", message: "params must be an object" });
    return null;
  }
  const r = raw as Record<string, unknown>;
  const op = r["op"];
  if (op !== "add" && op !== "sub") {
    issues.push({ path: "op", message: 'op must be "add" or "sub"' });
  }
  for (const key of ["digits", "operandDigits", "regroupings", "acrossZero", "decimalPlaces"]) {
    if (!isInt(r[key])) issues.push({ path: key, message: `${key} must be an integer` });
  }
  if (typeof r["allowZeroResult"] !== "boolean") {
    issues.push({ path: "allowZeroResult", message: "allowZeroResult must be a boolean" });
  }
  if (issues.length > 0) return null;
  return {
    op: op as ColumnOp,
    digits: r["digits"] as number,
    operandDigits: r["operandDigits"] as number,
    regroupings: r["regroupings"] as number,
    acrossZero: r["acrossZero"] as number,
    decimalPlaces: r["decimalPlaces"] as number,
    allowZeroResult: r["allowZeroResult"] as boolean,
  };
}

export const columnOpParamSchema: ParamSchema<ColumnOpParams> = {
  describe:
    "{ op: 'add'|'sub', digits: 2..6, operandDigits: 1..digits, regroupings: int, " +
    "acrossZero: int (sub only), decimalPlaces: 0..2, allowZeroResult: boolean }",

  validate(raw: unknown): ParamResult<ColumnOpParams> {
    const issues: ParamIssue[] = [];
    const p = validateShape(raw, issues);
    if (p === null) return { ok: false, issues };

    if (p.digits < MIN_DIGITS || p.digits > MAX_DIGITS) {
      issues.push({ path: "digits", message: `digits must be ${MIN_DIGITS}..${MAX_DIGITS}` });
    }
    if (p.operandDigits < 1 || p.operandDigits > p.digits) {
      issues.push({ path: "operandDigits", message: "operandDigits must be 1..digits" });
    }
    if (p.decimalPlaces < 0 || p.decimalPlaces > MAX_DECIMAL_PLACES) {
      issues.push({ path: "decimalPlaces", message: `decimalPlaces must be 0..${MAX_DECIMAL_PLACES}` });
    }
    if (p.decimalPlaces > Math.min(p.digits, p.operandDigits)) {
      issues.push({
        path: "decimalPlaces",
        message: "decimalPlaces cannot exceed the digit count of either operand",
      });
    }
    if (p.regroupings < 0) {
      issues.push({ path: "regroupings", message: "regroupings must be >= 0" });
    }
    if (p.acrossZero < 0) {
      issues.push({ path: "acrossZero", message: "acrossZero must be >= 0" });
    }
    if (p.op === "add" && p.acrossZero !== 0) {
      issues.push({ path: "acrossZero", message: "acrossZero applies to subtraction only" });
    }
    if (issues.length > 0) return { ok: false, issues };

    if (p.op === "sub") {
      if (p.regroupings > p.digits - 1) {
        issues.push({
          path: "regroupings",
          message: "the top column cannot borrow out; regroupings must be <= digits - 1",
        });
      }
      if (p.acrossZero > 0) {
        if (p.acrossZero > p.digits - 2) {
          issues.push({
            path: "acrossZero",
            message: "a borrow across zeros needs a non-zero digit above the run to regroup from",
          });
        }
        if (p.regroupings < p.acrossZero + 1) {
          issues.push({
            path: "regroupings",
            message: `a run of ${String(p.acrossZero)} zeros already implies ${String(p.acrossZero + 1)} regroupings`,
          });
        }
      }
    } else if (p.regroupings > p.digits) {
      issues.push({ path: "regroupings", message: "regroupings must be <= digits" });
    }
    if (issues.length > 0) return { ok: false, issues };

    const extra = p.regroupings - chainRegroupings(p);
    const columns = extraRegroupColumns(p);
    if (extra > columns.length) {
      issues.push({
        path: "regroupings",
        message:
          `${String(p.regroupings)} regroupings are not placeable: the chain accounts for ` +
          `${String(chainRegroupings(p))} and only ${String(columns.length)} further column(s) can regroup`,
      });
    }
    if (issues.length > 0) return { ok: false, issues };
    return { ok: true, value: p };
  },
};
