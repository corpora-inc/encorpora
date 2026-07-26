/**
 * Digit-array helpers, and the one way to read a column-op item's operands back
 * out of an `Exercise`.
 *
 * Mal-rules are `(exercise) => AnswerValue | null` — they see the public exercise
 * contract, not the generator's internals. That is what makes them usable for
 * diagnosis at runtime and for `gen.logic.error-analysis` content later. They
 * therefore need a supported way to recover the written digits, which is this.
 *
 * Digit arrays are **little-endian**: index 0 is the units column, which is the
 * order the column algorithm is actually performed in.
 */

import { fromScaled, toScaled } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import type { Exercise } from "../../types/exercise.ts";
import { PROMPT_KEY_ADD, PROMPT_KEY_SUB, SLOT_BOTTOM, SLOT_TOP } from "./constants.ts";
import type { ColumnOp } from "./params.ts";

export type Operands = {
  readonly op: ColumnOp;
  /** Little-endian digits of the top operand, padded to `cols`. */
  readonly top: readonly number[];
  /** Little-endian digits of the bottom operand, padded to `cols`. */
  readonly bottom: readonly number[];
  readonly cols: number;
  readonly decimalPlaces: number;
};

/** Little-endian digits of a non-negative integer, padded to at least `width`. */
export function toDigits(value: bigint, width: number): number[] {
  if (value < 0n) throw new RangeError("toDigits: negative value");
  const out: number[] = [];
  let rest = value;
  while (rest > 0n) {
    out.push(Number(rest % 10n));
    rest /= 10n;
  }
  while (out.length < width) out.push(0);
  return out;
}

/** Inverse of `toDigits`. */
export function fromDigits(digits: readonly number[]): bigint {
  let out = 0n;
  for (let i = digits.length - 1; i >= 0; i--) {
    const digit = digits[i];
    if (digit === undefined || digit < 0 || digit > 9) {
      throw new RangeError(`fromDigits: bad digit at ${String(i)}`);
    }
    out = out * 10n + BigInt(digit);
  }
  return out;
}

/** A digit array as a rational, given the decimal-point position. */
export function digitsToRational(digits: readonly number[], decimalPlaces: number): Rational {
  return fromScaled(fromDigits(digits), decimalPlaces);
}

function readNumberSlot(exercise: Exercise, name: string): { value: Rational; decimalPlaces: number } | null {
  const slot = exercise.prompt.slots[name];
  if (slot === undefined || slot.kind !== "number") return null;
  return { value: slot.value, decimalPlaces: slot.decimalPlaces };
}

/**
 * Recover the written operands, or `null` when the exercise is not a column-op
 * item. Never throws: a mal-rule handed an item from another family must simply
 * decline it.
 */
export function readOperands(exercise: Exercise): Operands | null {
  const op: ColumnOp | null =
    exercise.prompt.key === PROMPT_KEY_SUB ? "sub" : exercise.prompt.key === PROMPT_KEY_ADD ? "add" : null;
  if (op === null) return null;

  const top = readNumberSlot(exercise, SLOT_TOP);
  const bottom = readNumberSlot(exercise, SLOT_BOTTOM);
  if (top === null || bottom === null) return null;
  if (top.decimalPlaces !== bottom.decimalPlaces) return null;

  const decimalPlaces = top.decimalPlaces;
  const topScaled = toScaled(top.value, decimalPlaces);
  const bottomScaled = toScaled(bottom.value, decimalPlaces);
  if (topScaled === null || bottomScaled === null) return null;
  if (topScaled < 0n || bottomScaled < 0n) return null;

  const width = Math.max(topScaled.toString().length, bottomScaled.toString().length);
  return {
    op,
    top: toDigits(topScaled, width),
    bottom: toDigits(bottomScaled, width),
    cols: width,
    decimalPlaces,
  };
}

/** The digit at `index`, or 0 above the written number. */
export function digitAt(digits: readonly number[], index: number): number {
  return digits[index] ?? 0;
}
