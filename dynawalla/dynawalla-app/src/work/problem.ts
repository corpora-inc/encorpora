// Reading a column-op item back out of the exercise contract.
//
// The slate, the verdict and the counting board all need the written operands.
// They read them from `Exercise.prompt.slots`, which is the *public* contract —
// the same surface the mal-rules are required to use (`curriculum/.../digits.ts`
// says so in as many words). Nothing here reaches into the generator's private
// draw.
//
// This is NOT the number layer. `NumberFormat` — decimal separator, grouping,
// numbering system, direction — is PR-2.2 and owns every locale question. What
// this module produces is the *unformatted* digit string a formatter will later
// take as input, and the digit array the counting board places counters from.
// An English build renders `5001`, not `5,001`, until that layer lands.

import { exact, PROMPT_KEY_ADD, PROMPT_KEY_SUB, SLOT_BOTTOM, SLOT_TOP } from "./curriculum.ts"
import type { Exercise, Rational } from "./curriculum.ts"

export type ColumnOp = "add" | "sub"

export interface ColumnProblem {
  readonly op: ColumnOp
  /** The minuend / first addend, exactly as written. */
  readonly top: string
  readonly bottom: string
  /** Scaled to whole units at `decimalPlaces`, so digit work stays integral. */
  readonly topScaled: bigint
  readonly bottomScaled: bigint
  readonly decimalPlaces: number
}

/** Big-endian digits of a non-negative integer: index 0 is the leading digit. */
export function digitsOf(value: bigint): number[] {
  if (value < 0n) throw new RangeError("digitsOf: negative value")
  return value
    .toString()
    .split("")
    .map((c) => Number(c))
}

/**
 * The plain digit string for an exact value written to `decimalPlaces`.
 *
 * Returns `null` rather than guessing when the value cannot be written at that
 * precision — a third is not a decimal, and rendering `0.333` would be the app
 * inventing a number the curriculum did not produce.
 */
export function plainDigits(value: Rational, decimalPlaces: number): string | null {
  return exact.toDecimalString(value, decimalPlaces)
}

function numberSlot(exercise: Exercise, name: string): { value: Rational; decimalPlaces: number } | null {
  const slot = exercise.prompt.slots[name]
  if (slot === undefined || slot.kind !== "number") return null
  return { value: slot.value, decimalPlaces: slot.decimalPlaces }
}

/** The written operands, or `null` when this is not a column-op item. Never throws. */
export function readProblem(exercise: Exercise): ColumnProblem | null {
  const op: ColumnOp | null =
    exercise.prompt.key === PROMPT_KEY_SUB
      ? "sub"
      : exercise.prompt.key === PROMPT_KEY_ADD
        ? "add"
        : null
  if (op === null) return null

  const top = numberSlot(exercise, SLOT_TOP)
  const bottom = numberSlot(exercise, SLOT_BOTTOM)
  if (top === null || bottom === null) return null
  if (top.decimalPlaces !== bottom.decimalPlaces) return null

  const decimalPlaces = top.decimalPlaces
  const topScaled = exact.toScaled(top.value, decimalPlaces)
  const bottomScaled = exact.toScaled(bottom.value, decimalPlaces)
  if (topScaled === null || bottomScaled === null) return null
  if (topScaled < 0n || bottomScaled < 0n) return null

  const topText = plainDigits(top.value, decimalPlaces)
  const bottomText = plainDigits(bottom.value, decimalPlaces)
  if (topText === null || bottomText === null) return null

  return { op, top: topText, bottom: bottomText, topScaled, bottomScaled, decimalPlaces }
}

/** The answer as a plain digit string, or `null` for a schema the slate cannot write. */
export function writtenAnswer(exercise: Exercise): string | null {
  const answer = exercise.answer.canonical
  if (answer.kind !== "integer" && answer.kind !== "columnAlgorithm") return null
  const places = exercise.schema.kind === "choice" || exercise.schema.kind === "fraction"
    ? 0
    : exercise.schema.decimalPlaces
  return plainDigits(answer.value, places)
}
