/**
 * Answer schemas and answer values.
 *
 * Four schemas in V1 (ARCHITECTURE L3). `decimal` is deliberately *not* a fifth: it
 * is `integer` + the number layer's `NumberFormat`, which is why `decimalPlaces`
 * rides on the schema instead of forking it.
 *
 * Every numeric answer value is a `Rational`. Comparison is exact and structural —
 * there is no tolerance, no epsilon and no float anywhere on this path.
 *
 * `fraction.equivalence` and `choice.options` are here because a renderer receives
 * the **schema** and nothing else: `EntryModel.init`, `.keys` and `.value` take a
 * schema, not an `Exercise`. Anything the surface must know to draw an answer, or
 * to decide what counts as the same answer, has to be on the schema or it is not
 * knowable where it is needed.
 *
 * - **`equivalence`** answers "is `2/4` the same answer as `1/2`?" — a curriculum
 *   decision per skill, not an arithmetic one, since on `simplify-to-lowest-terms`
 *   accepting `2/4` marks the thing being taught as correct. Omitted means
 *   `as-written`, the strict reading and the safe default.
 * - **`options`** is the drawn list, in the order `AnswerValue.choice.index`
 *   indexes. Without it a choice item is a number `k` with nothing to put on the
 *   screen, and the shuffle deciding which slot holds the answer has nowhere
 *   deterministic to live.
 */

import type { Rational } from "../math/rational.ts";
import {
  abs as rationalAbs,
  add as rationalAdd,
  eq as rationalEq,
  rational,
  sub as rationalSub,
  toString as rationalToString,
} from "../math/rational.ts";

/**
 * One drawn option of a choice item.
 *
 * Two kinds, both numbers, and the omission is the point. A word option would
 * have to be a `LocKey` — CG-19 forbids a rendered string anywhere in an
 * `Exercise` — and there is no i18n runtime to resolve one, so a renderer that
 * accepted `term` today would draw `dw.opt.line-of-symmetry` on a child's
 * screen. Adding the kind before the layer that can draw it is exactly the
 * failure CG-8 exists to stop, so the kind waits for PR-1.6 and the skills that
 * need words stay `draft` until then.
 *
 * `count` is absent for a different reason: an option is a thing to write, and a
 * plural-sensitive count is a thing to say.
 */
export type ChoiceOption =
  | { readonly kind: "number"; readonly value: Rational; readonly decimalPlaces: number }
  | { readonly kind: "fraction"; readonly num: bigint; readonly den: bigint; readonly whole?: bigint };

/** Which *written* forms of the same number count as the same answer. */
export type FractionEquivalence =
  /** `1/2` only. `2/4` is a different answer — which is the point of simplifying. */
  | "as-written"
  /** Any fraction equal in value, however written. `2/4`, `1/2` and `3/6` all pass. */
  | "any-equivalent";

export type AnswerSchema =
  | { readonly kind: "integer"; readonly digits: number; readonly decimalPlaces: number }
  | {
      readonly kind: "columnAlgorithm";
      readonly cols: number;
      readonly marks: "carry" | "borrow" | "none";
      readonly decimalPlaces: number;
    }
  | {
      readonly kind: "fraction";
      readonly parts: readonly ("num" | "den" | "whole")[];
      /** Absent means `as-written`. */
      readonly equivalence?: FractionEquivalence;
    }
  | {
      readonly kind: "choice";
      readonly k: 2 | 3 | 4;
      /** Exactly `k` of them, in the order `AnswerValue.choice.index` indexes. */
      readonly options: readonly ChoiceOption[];
    };

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
  // per skill, not an arithmetic one. `AnswerSchema.fraction.equivalence` is where
  // that decision is written down and `answerAccepted` is where it is applied.
  | { readonly kind: "fraction"; readonly num: bigint; readonly den: bigint; readonly whole?: bigint }
  | { readonly kind: "choice"; readonly index: number };

export type AnswerValueKind = AnswerValue["kind"];

export type FractionValue = Extract<AnswerValue, { kind: "fraction" }>;

/**
 * The exact value of a written fraction.
 *
 * A mixed number is `whole ± num/den`, and the sign rides on `whole` when there is
 * one: "negative two and a third" is `-2 - 1/3`, never `-2 + 1/3`. Written out
 * because the naive `whole + num/den` is right for every V1 item (elementary
 * fractions are non-negative) and silently wrong the first time integers arrive.
 *
 * Throws on a zero denominator, which is what `rational` does and what an entry
 * model must never hand over.
 */
export function fractionRational(value: FractionValue): Rational {
  const whole = value.whole ?? 0n;
  const part = rational(value.num, value.den);
  return whole < 0n
    ? rationalSub(rational(whole), rationalAbs(part))
    : rationalAdd(rational(whole), part);
}

/**
 * Exact equality of two submitted answers, **as written**.
 *
 * `columnAlgorithm` compares the *number* and ignores the marks: a child who
 * regroups mentally and writes only the digits is right. Marks are process
 * evidence for diagnosis, never a correctness condition.
 *
 * This is the structural comparison. Anything schema-dependent — which is to say
 * anything about equivalent *forms* — is `answerAccepted` below, so that a caller
 * holding only two values can still ask the narrow question.
 */
export function answerEquals(a: AnswerValue, b: AnswerValue): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "integer":
      return rationalEq(a.value, (b as Extract<AnswerValue, { kind: "integer" }>).value);
    case "columnAlgorithm":
      return rationalEq(a.value, (b as Extract<AnswerValue, { kind: "columnAlgorithm" }>).value);
    case "fraction": {
      const other = b as FractionValue;
      return a.num === other.num && a.den === other.den && (a.whole ?? 0n) === (other.whole ?? 0n);
    }
    case "choice":
      return a.index === (b as Extract<AnswerValue, { kind: "choice" }>).index;
  }
}

/**
 * Does `submitted` count as `expected` **under this schema**?
 *
 * Exactly `answerEquals`, widened in the one place a schema says a different
 * writing of the same number is the same answer. Nothing here is a tolerance:
 * `any-equivalent` compares two exact rationals, and a comparison that is not
 * exact does not exist on this path.
 *
 * `0.5` is never an accepted fraction and `1/2` is never an accepted decimal —
 * the kinds differ, so `answerEquals` already says no and this does not widen
 * across kinds. That is deliberate: a fraction card draws a fraction entry, so a
 * child cannot type `0.5` into it, and a skill that genuinely wants both notations
 * lists the second one in `Exercise.answer.alsoAccept`, where the curriculum can
 * see it.
 *
 * **This is on the judging path**, and it has to be: `GeneratorFamily.check` calls
 * it, so `equivalence` is a knob that does something. It shipped as one that did
 * not — `check` compared with `answerEquals` and nothing in the program reached
 * here — which would have marked every child who wrote `2/4` on a skill that
 * accepts any equivalent wrong. A family that reaches for `answerEquals` in its
 * checker is declining a decision the curriculum already made.
 */
export function answerAccepted(
  schema: AnswerSchema,
  expected: AnswerValue,
  submitted: AnswerValue,
): boolean {
  if (
    schema.kind === "fraction" &&
    schema.equivalence === "any-equivalent" &&
    expected.kind === "fraction" &&
    submitted.kind === "fraction"
  ) {
    return rationalEq(fractionRational(expected), fractionRational(submitted));
  }
  return answerEquals(expected, submitted);
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

/**
 * Is this schema drawable as written — enough fields, enough options, a legal
 * decimal position?
 *
 * The renderer's precondition, stated once. A generator that emits a four-option
 * choice with three options, or a fraction with no denominator, produces a card
 * the app cannot draw, and the failure would otherwise be a blank cell on a
 * child's screen rather than a red gate.
 */
export function schemaDefect(schema: AnswerSchema): string | null {
  switch (schema.kind) {
    // A decimal answer is always written with a whole-number digit — `0.75`, never
    // `.75` — so a schema whose places consume its whole capacity is not a defect,
    // it is a schema whose renderer must floor the whole part at one column. Only
    // an impossible width is a defect.
    case "integer":
      if (schema.digits < 1) return "integer schema has no digit capacity";
      if (schema.decimalPlaces < 0) return "integer schema has negative decimalPlaces";
      if (schema.decimalPlaces > schema.digits) return "integer schema has more places than digits";
      return null;
    case "columnAlgorithm":
      if (schema.cols < 1) return "columnAlgorithm schema has no columns";
      if (schema.decimalPlaces < 0) return "columnAlgorithm schema has negative decimalPlaces";
      if (schema.decimalPlaces >= schema.cols) {
        return "columnAlgorithm schema has no whole-number column left for its decimal places";
      }
      return null;
    case "fraction": {
      if (!schema.parts.includes("num")) return "fraction schema has no numerator";
      if (!schema.parts.includes("den")) return "fraction schema has no denominator";
      if (new Set(schema.parts).size !== schema.parts.length) return "fraction schema repeats a part";
      return null;
    }
    case "choice": {
      if (schema.options.length !== schema.k) {
        return `choice schema declares k=${String(schema.k)} and carries ${String(schema.options.length)} option(s)`;
      }
      // Two options of the same value are two right answers, or two wrong ones,
      // and an item with either is the "contradictory, ambiguous or degenerate"
      // case this program forbids outright. Compared as **exact rationals**, not
      // as the strings they are written as: `1/2` and `{ value: 1/2,
      // decimalPlaces: 1 }` write as `1/2` and `0.5` and are the same number, so
      // a child choosing the second of them is right and marked wrong. Value
      // equality subsumes written collision — two options that write alike are
      // equal fractions or equal decimals, so they are equal here first.
      for (let i = 0; i < schema.options.length; i++) {
        for (let j = i + 1; j < schema.options.length; j++) {
          const a = schema.options[i];
          const b = schema.options[j];
          if (a === undefined || b === undefined) continue;
          if (rationalEq(choiceOptionValue(a), choiceOptionValue(b))) {
            return `choice schema offers option ${String(i + 1)} and option ${String(j + 1)} as the same number`;
          }
        }
      }
      return null;
    }
  }
}

/**
 * The exact value of a drawn option, whichever way it is written.
 *
 * Both kinds are numbers, so "are these two options the same option" is one
 * rational comparison and never a string one.
 */
export function choiceOptionValue(option: ChoiceOption): Rational {
  if (option.kind === "number") return option.value;
  const written: FractionValue = {
    kind: "fraction",
    num: option.num,
    den: option.den,
    ...(option.whole === undefined ? {} : { whole: option.whole }),
  };
  return fractionRational(written);
}
