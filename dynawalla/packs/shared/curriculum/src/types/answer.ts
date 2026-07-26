/**
 * Answer schemas and answer values.
 *
 * Four schemas in V1 (ARCHITECTURE L3). `decimal` is deliberately *not* a fifth: it
 * is `integer` + the number layer's `NumberFormat`, which is why `decimalPlaces`
 * rides on the schema instead of forking it.
 *
 * Every numeric answer value is a `Rational`. Comparison is exact and structural —
 * there is no tolerance, no epsilon and no float anywhere on this path.
 */

import type { Rational } from "../math/rational.ts";
import { eq as rationalEq, toString as rationalToString } from "../math/rational.ts";

export type AnswerSchema =
  | { readonly kind: "integer"; readonly digits: number; readonly decimalPlaces: number }
  | {
      readonly kind: "columnAlgorithm";
      readonly cols: number;
      readonly marks: "carry" | "borrow" | "none";
      readonly decimalPlaces: number;
    }
  | { readonly kind: "fraction"; readonly parts: readonly ("num" | "den" | "whole")[] }
  | { readonly kind: "choice"; readonly k: 2 | 3 | 4 };

export type AnswerSchemaKind = AnswerSchema["kind"];

/** A borrow or carry annotation a child writes above a column. */
export type ColumnMark = {
  readonly column: number;
  readonly kind: "borrow" | "carry";
  readonly value: number;
};

export type AnswerValue =
  | { readonly kind: "integer"; readonly value: Rational }
  | {
      readonly kind: "columnAlgorithm";
      readonly value: Rational;
      readonly marks: readonly ColumnMark[];
    }
  // Fractions keep the *written* numerator and denominator: 2/4 and 1/2 are the same
  // number and different answers, and which one is accepted is a curriculum decision
  // per skill, not an arithmetic one.
  | { readonly kind: "fraction"; readonly num: bigint; readonly den: bigint; readonly whole?: bigint }
  | { readonly kind: "choice"; readonly index: number };

export type AnswerValueKind = AnswerValue["kind"];

/**
 * Exact equality of two submitted answers.
 *
 * `columnAlgorithm` compares the *number* and ignores the marks: a child who
 * regroups mentally and writes only the digits is right. Marks are process
 * evidence for diagnosis, never a correctness condition.
 */
export function answerEquals(a: AnswerValue, b: AnswerValue): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "integer":
      return rationalEq(a.value, (b as Extract<AnswerValue, { kind: "integer" }>).value);
    case "columnAlgorithm":
      return rationalEq(a.value, (b as Extract<AnswerValue, { kind: "columnAlgorithm" }>).value);
    case "fraction": {
      const other = b as Extract<AnswerValue, { kind: "fraction" }>;
      return a.num === other.num && a.den === other.den && (a.whole ?? 0n) === (other.whole ?? 0n);
    }
    case "choice":
      return a.index === (b as Extract<AnswerValue, { kind: "choice" }>).index;
  }
}

/** Stable text form. Used for hashing, snapshots and dedupe — never shown to a child. */
export function answerToString(value: AnswerValue): string {
  switch (value.kind) {
    case "integer":
      return `int:${rationalToString(value.value)}`;
    case "columnAlgorithm": {
      const marks = value.marks
        .map((m) => `${String(m.column)}${m.kind === "borrow" ? "b" : "c"}${String(m.value)}`)
        .join(",");
      return `col:${rationalToString(value.value)}[${marks}]`;
    }
    case "fraction":
      return `frac:${(value.whole ?? 0n).toString()};${value.num.toString()}/${value.den.toString()}`;
    case "choice":
      return `choice:${String(value.index)}`;
  }
}

/** True when the schema can only be answered by choosing from a closed list (CG-13). */
export function isChoiceSchema(schema: AnswerSchema): boolean {
  return schema.kind === "choice";
}
