// Writing an exact number down.
//
// The one place a `Rational` becomes characters on a surface that is not the
// column slate: a choice option, a number-line label, a balance pan. All three
// need the *same* answer to "how is this number written", or a child reads `3/4`
// on the line and `0.75` on the option beside it.
//
// Not the number layer — `NumberFormat` (grouping, numbering system, direction,
// the locale's separator) is PR-2.2. This produces the unformatted string that
// layer will take as input, in the notation the mathematics is in. Nothing here
// rounds and nothing divides: `1/3` as a decimal is `null`, not `0.333`.

import { DECIMAL_SEPARATOR } from "./entry.ts"
import { exact } from "./curriculum.ts"
import type { ChoiceOption, Rational } from "./curriculum.ts"

/**
 * A number written to a fixed number of decimal places, in the separator the
 * entry models accept.
 *
 * The round trip that matters: whatever this writes, `integerEntry.value` reads
 * back to the identical `Rational`. `entry.test.ts` asserts it over a table
 * rather than trusting the two functions to have been written on the same day.
 */
export function writeDecimal(value: Rational, places: number): string | null {
  const plain = exact.toDecimalString(value, places)
  // `toDecimalString` always writes `.`; the separator is a constant so that the
  // number layer has one place to change and this cannot drift from what the
  // keypad emits.
  return plain === null ? null : plain.replace(".", DECIMAL_SEPARATOR)
}

/**
 * The gap between the whole number and the fraction of a mixed number.
 *
 * A no-break space, written as an escape so it is visible in the source rather
 * than being a character nobody can see in a diff. An ordinary space lets
 * `2 1/3` break after the `2` at 320 px, where it reads as two numbers.
 */
export const MIXED_GAP = "\u00a0"

/**
 * A fraction written the way a child writes it: `3/4`, or `2 1/3` when there is
 * a whole part.
 */
export function writeFraction(num: bigint, den: bigint, whole?: bigint): string {
  const body = `${num.toString()}/${den.toString()}`
  return whole === undefined || whole === 0n ? body : `${whole.toString()}${MIXED_GAP}${body}`
}

/** One choice option, written. Never `null`: both option kinds are writable. */
export function writeChoiceOption(option: ChoiceOption): string {
  return option.kind === "fraction"
    ? writeFraction(option.num, option.den, option.whole)
    : // A drawn option carries the places it was drawn to, so an option set of
      // `0.5` and `0.50` cannot exist — and if a generator ever emitted a value
      // that does not fit its own declared places, the fallback is the exact
      // rational rather than a rounded lie.
      (writeDecimal(option.value, option.decimalPlaces) ?? exact.toString(option.value))
}

/**
 * A position on a number line, written.
 *
 * `mark` of `denominator` parts past `from`. A whole number is written as one —
 * `2`, never `2/1` — because the line is drawn in whole units and the tick a
 * child is pointing at is one of them.
 *
 * **`BigInt`, not `Math.trunc(mark / denominator)`.** The first cut divided in
 * floats. It was exact for every spec `repSpecDefect` admits — the 24-interval
 * cap keeps both operands small — but that is a bound in another module holding
 * up a correctness property here, and the rule this file is written under is
 * that nothing on the path from a number to the characters a child reads goes
 * through a float. `repSpecDefect` guarantees safe integers, so `BigInt` is
 * total on them.
 *
 * **A negative position is written the way `fractionRational` reads one.** The
 * sign rides on the whole part — "negative two and three quarters" is `-2 - 3/4`
 * — so a quarter to the right of `-3` is `-2 3/4` and never `-3 1/4`, which is
 * a different number (`-13/4`) in the notation the answer layer speaks. The
 * naive `from + trunc(mark/den)` wrote the second one. No V1 content has a
 * negative origin; `repSpecDefect` permits one, and the first integer line would
 * have read the label off by half a unit.
 */
export function writeLinePosition(from: number, mark: number, denominator: number): string {
  const den = BigInt(denominator)
  // The position as one exact fraction: `(from·den + mark) / den`.
  const total = BigInt(from) * den + BigInt(mark)
  const negative = total < 0n
  const magnitude = negative ? -total : total
  const whole = magnitude / den
  const rest = magnitude - whole * den
  const signed = (n: bigint): bigint => (negative ? -n : n)
  if (rest === 0n) return signed(whole).toString()
  return whole === 0n ? writeFraction(signed(rest), den) : writeFraction(rest, den, signed(whole))
}
