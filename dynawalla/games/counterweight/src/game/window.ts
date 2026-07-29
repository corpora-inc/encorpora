// THE PRESS WINDOW — how long the round may last.
//
// `docs/EXPERIENCE_DESIGN.md` states this as a prohibition rather than a target:
//
//     T=0→C COMPREHENSION | not budgeted | The child's time. Measured, never
//     limited.
//
// A steelyard round cannot take that literally — the whistle has to blow or the
// beam never gets judged. What it CAN hold, and what this module exists to
// guarantee, is the invariant underneath it:
//
//     **The window is monotone non-decreasing in the item's difficulty, and a
//     pure function of the item.**
//
// Nothing in this file may read a bout number, a Turk, an arm, an elapsed time
// or a speed. That is the decoupling, stated structurally, and the reason the
// defect this replaces cannot be written here again.
//
// ── What it replaces ────────────────────────────────────────────────────────
//
// The window used to be `timingForBout()`: 13.0 s at the first Turk, falling
// 1.1 s per Turk to a 7.6 s floor. The bout counter is also what escalates the
// arithmetic, so the two moved together in opposite directions — the child got
// less time exactly as the sums got harder. Measured on this package's own
// solver bot, a player who took the house table's own p90 thinking time for a
// two-digit regrouping (14 s) held **0 of 78 rounds** and never put a Turk over.
//
// Worse, at the floor the game was arithmetically impossible on its own hardest
// rung. A four-digit column sum decomposes into a median 13 strikes and a p90 of
// 20 (max 27 measured over 400 draws), and `strain.ts` shears the beam if those
// blows are struck faster than the steel can bleed — `BASE_STRAIN /
// BLEED_PER_SEC`, one blow every third of a second. Twenty blows at the fastest
// safe cadence is 7.0 s of pure motor work inside a 7.6 s window: 0.6 s left for
// a sum whose own documented p90 is forty seconds. Twenty-seven blows did not
// fit at all.
//
// ── What it is now ──────────────────────────────────────────────────────────
//
// Two terms, both functions of the item alone, both monotone in its width:
//
//   * **Comprehension.** The house cadence table's p90 — the time to actually do
//     the arithmetic. Not the p50: the window is the point at which the whistle
//     takes the round away, so it is sized for the child who is slow today.
//   * **Motor.** The time to physically strike the plates the answer decomposes
//     into, priced at the fastest cadence the steel tolerates indefinitely. This
//     is the term the old window did not have at all, and it is why this game
//     needs a longer window than a game where the answer is a tap.
//
// The sum is a ceiling nobody fluent ever touches — the round ends the moment
// SEAT is struck — not a pace anybody is held to.

import { BASE_STRAIN, BLEED_PER_SEC } from "./strain.ts"

/**
 * Seconds by column count, from `docs/EXPERIENCE_DESIGN.md`: index 1 is the
 * single-digit fact's p90, index 2 and index 4 are the two rows the table names
 * outright (6 s/14 s for two-digit regrouping, 16 s/40 s for the `5,001 − 2,798`
 * class), and index 3 is between them. Strictly increasing, which is half of the
 * invariant.
 *
 * The same table `beam` reads in `beam/src/sim/window.ts`. Duplicated rather
 * than imported because a game pack is a standalone build with its own
 * `package.json` and nothing here may reach into a sibling; the audit's proposed
 * `packs/shared/pacing` is where these two eventually meet.
 */
const BY_COLUMNS = [6, 6, 11, 18, 32] as const

/**
 * What regrouping is worth on top, per column count.
 *
 * `11 + 3 = 14` is the two-digit-with-regrouping row exactly and `32 + 8 = 40`
 * is the `5,001 − 2,798` row exactly. Each is small enough that
 * `BY_COLUMNS[n] + REGROUPING[n] <= BY_COLUMNS[n + 1]`, which is the other half
 * of the invariant and is asserted rather than assumed.
 */
const REGROUPING = [0, 0, 3, 5, 8] as const

/**
 * The fastest cadence the steel tolerates for ever.
 *
 * A blow outside the resonance window costs `BASE_STRAIN`; the beam bleeds
 * `BLEED_PER_SEC`. Strike slower than this ratio and strain trends to zero
 * however long the plan is; strike faster and it climbs until the beam shears.
 * So this is not a comfort figure — it is the floor the game's own physics puts
 * under a correct player's execution, and pricing the motor budget below it
 * would be the game shearing children for doing the arithmetic right.
 */
export const SUSTAINABLE_STRIKE_SECONDS = BASE_STRAIN / BLEED_PER_SEC

/**
 * What one strike is budgeted at: the sustainable cadence with a little room for
 * a child's hand finding the plate.
 */
export const STRIKE_SECONDS = 0.35

/**
 * Strikes budgeted per column.
 *
 * `places.ts` decomposes every delta into balanced base-ten, and
 * `places.test.ts` proves no low place is ever struck more than five times. The
 * top pillar can exceed it — nothing above it to borrow from — which is what the
 * clamp on `MAX_PRESS_SECONDS` and the generous comprehension term at four
 * columns cover between them.
 */
export const STRIKES_PER_COLUMN = 5

/** Nothing is ever answerable for less than this, whatever the parser makes of it. */
export const MIN_PRESS_SECONDS = 9

/**
 * Nor for more. Not a budget — a guard against a malformed prompt parsing as
 * nine columns and leaving a round open for two minutes.
 */
export const MAX_PRESS_SECONDS = 52

export type Item = {
  /** As the child reads it: `473 + 168`. */
  readonly prompt: string
  /** The canonical value the host revealed. Never computed here. */
  readonly answer: number
}

/**
 * The widest column count in the item — the operands and the answer together.
 *
 * The answer counts twice over here. It is a column wider than either operand
 * whenever the top place carries, and it is also the value the child's pan has
 * to travel to, so it sets the motor cost as well as the reading cost.
 */
export function widestColumn(item: Item): number {
  let widest = 1
  for (const run of item.prompt.match(/\d+/g) ?? []) widest = Math.max(widest, run.length)
  if (Number.isInteger(item.answer) && item.answer > 0) {
    widest = Math.max(widest, String(Math.abs(item.answer)).length)
  }
  return widest
}

const OPERATOR = /^\s*(\d+)\s*([+\-−–])\s*(\d+)\s*$/

/**
 * Does this item need a carry or a borrow anywhere?
 *
 * A prompt this cannot parse reads as **true**, which is the longer window.
 * Guessing in the child's favour is the only direction this function is allowed
 * to be wrong in.
 */
export function needsRegrouping(prompt: string): boolean {
  const m = OPERATOR.exec(prompt)
  if (!m) return true
  const a = Number(m[1])
  const b = Number(m[3])
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return true
  const add = m[2] === "+"
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    if (add && (x % 10) + (y % 10) >= 10) return true
    if (!add && x % 10 < y % 10) return true
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return false
}

/** Columns, clamped to the table. */
function columnsOf(item: Item): number {
  return Math.max(1, Math.min(BY_COLUMNS.length - 1, widestColumn(item)))
}

/** The arithmetic's own time, off the house table. Nothing else is in here. */
export function comprehensionSeconds(item: Item): number {
  const columns = columnsOf(item)
  const base = BY_COLUMNS[columns] ?? MIN_PRESS_SECONDS
  return base + (needsRegrouping(item.prompt) ? (REGROUPING[columns] ?? 0) : 0)
}

/** The time to strike the plates, at a cadence the steel survives. */
export function motorSeconds(item: Item): number {
  return columnsOf(item) * STRIKES_PER_COLUMN * STRIKE_SECONDS
}

/**
 * The whole window for this item, in milliseconds.
 *
 * Monotone non-decreasing in both inputs — more columns is never less time, and
 * needing to regroup is never less time than not needing to — and a function of
 * the item alone.
 */
export function pressMsFor(item: Item): number {
  const seconds = comprehensionSeconds(item) + motorSeconds(item)
  return Math.round(Math.max(MIN_PRESS_SECONDS, Math.min(MAX_PRESS_SECONDS, seconds)) * 1000)
}
