/**
 * Prompt and solution slots, built in one place.
 *
 * Seven families wrote their own `numberSlot`, three wrote `countSlot`, two wrote
 * `fractionSlot`, and one wrote `numberSlot` and `wholeSlot` side by side with
 * identical bodies. They agreed, which is the problem: nothing made them, and a
 * slot is the boundary between a generator and a translated template — the place
 * a silent disagreement about whether a digit is a `number` or a `count` would
 * show up as a plural category chosen by whichever family drew the item.
 *
 * `gen.arith.column-op` keeps its own two, unchanged: they predate this module and
 * rewriting them would move nothing except the provenance of its CG-16 hashes.
 */

import { rational } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import type { PromptSlot } from "../../types/exercise.ts";
import type { LocKey } from "../../types/ids.ts";

/** A whole number, written exactly. The common case. */
export function numberSlot(value: bigint): PromptSlot {
  return { kind: "number", value: rational(value), decimalPlaces: 0 };
}

/**
 * A number written to a fixed number of decimal places.
 *
 * The places ride along because `1.50` and `1.5` are the same number and different
 * notation, and the number layer needs the notation rather than the value's
 * denominator.
 */
export function decimalSlot(value: Rational, decimalPlaces: number): PromptSlot {
  return { kind: "number", value, decimalPlaces };
}

/**
 * A counted quantity — seven *hundreds*, column *three*.
 *
 * Separate from `numberSlot` because it selects a CLDR plural category (CG-14),
 * which is a fact about the sentence and not about the number.
 */
export function countSlot(value: number | bigint): PromptSlot {
  return { kind: "count", value: Number(value) };
}

/** A written fraction. `whole` is omitted when it is zero, never written as `0`. */
export function fractionSlot(num: bigint, den: bigint, whole = 0n): PromptSlot {
  return whole === 0n
    ? { kind: "fraction", num, den }
    : { kind: "fraction", num, den, whole };
}

/** A word the template needs and the generator must not spell. */
export function termSlot(key: LocKey): PromptSlot {
  return { kind: "term", key };
}
