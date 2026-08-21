// THE ABANDONMENT GUARD — how long the counter waits for a hand.
//
// **There is no clock on the answer, and there is nothing on the screen that
// counts down.** This module is what is left after the round timer was deleted,
// and it is a different kind of thing.
//
// ── What was here before, and why it went ───────────────────────────────────
//
// This file used to be `window.ts` and it computed a *press window*: a per-item
// ceiling on the whole round, drawn as a bar that drained across the bottom of
// the yard and turned red in its last 28%. The window itself was already
// generous — `43 + 25` got 14.5 s, `5,001 − 2,798` got 47.0 s, both of them
// monotone in the item and derived from the house cadence table, and both of
// them measured against this package's own solver bot.
//
// The founder played it anyway and said: *"the action is rushed by the timer
// going down."*
//
// That is the finding. A visible draining countdown is an anxiety cue
// **regardless of how much time it grants**, because what a child reads off it
// is not "I have 34 s left", it is "something is being taken away from me right
// now". `games/claim` reached the same conclusion and deleted its draining ring
// outright, and the rule it wrote down is the rule here:
//
//     **A clock may never take anything away from a child.**
//
// So the round has no length. A child may sit and look at the column for as long
// as they like, strike a plate, sit and check it again, and nothing anywhere is
// counting.
//
// ── Why anything survives at all ────────────────────────────────────────────
//
// One thing does have to end a round nobody is playing: a pack left open on a
// windowsill must not hold an item checked out of the host forever, and the
// beam does have to get judged or racked eventually. So what is left is an
// **abandonment guard**, and it is defined by three properties, each of which is
// the opposite of a countdown:
//
//   1. **It measures nothing happening.** Not the round — the *silence*. Any
//      hand on the rack sets it back to zero, so it can only ever fire on a
//      child who has stopped playing, never on one who is working.
//   2. **It is derived from the item**, monotone non-decreasing in its
//      difficulty, exactly as the window was. A four-digit borrow gets longer
//      silence than `3 + 4`.
//   3. **It is not drawn.** Nothing in `render/` reads it. There is no bar, no
//      ring and no number, so there is nothing for a child to watch.
//
// And when it does fire, the lot simply goes back on the barrow: no verdict, no
// run lost, nothing reported to the host. A child who was still carrying the
// hundreds column has told us nothing about what they know, and a game that
// filed that as a wrong answer would be lying to the curriculum about them.
//
// ── The size of it ──────────────────────────────────────────────────────────
//
// The window was sized at the p90 of the arithmetic plus the motor cost of
// striking the plates. Neither term is right for a guard:
//
//   * The motor term is gone, because every blow in the plan refills the guard.
//     The guard never has to cover execution; it only has to cover a *pause*.
//   * The comprehension term is doubled. The p90 is the time the slow child
//     needs, and a guard sized at what the slow child needs will fire on the
//     slow child. A guard has to clear the tail, not sit on top of it.
//
// The result is longer than the whole old window at every width, and it is
// refilled on top of that:
//
//     3 + 4          window  9.0 s → silence 30 s
//     43 + 25        window 14.5 s → silence 30 s
//     47 + 25        window 17.5 s → silence 30 s
//     473 + 168      window 28.3 s → silence 46 s
//     5,001 − 2,798  window 47.0 s → silence 80 s
//
// Nothing in this file may read a round number, an elapsed time, a run or a
// speed. That is the same prohibition the window carried, and it is stated
// structurally: `guardMsFor` takes one item and returns one number.

import { BASE_STRAIN, BLEED_PER_SEC } from "./strain.ts"

/**
 * Seconds by column count, from `docs/EXPERIENCE_DESIGN.md`: index 1 is the
 * single-digit fact's p90, index 2 and index 4 are the two rows the table names
 * outright (6 s/14 s for two-digit regrouping, 16 s/40 s for the `5,001 − 2,798`
 * class), and index 3 is between them. Strictly increasing, which is half of the
 * monotonicity claim.
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
 * of the monotonicity claim and is asserted rather than assumed.
 */
const REGROUPING = [0, 0, 3, 5, 8] as const

/**
 * The fastest cadence the steel tolerates for ever.
 *
 * A blow outside the resonance window costs `BASE_STRAIN`; the beam bleeds
 * `BLEED_PER_SEC`. Strike slower than this ratio and strain trends to zero
 * however long the plan is; strike faster and it climbs until the beam shears.
 * Nothing budgets against it any more — there is no budget — but it is still the
 * floor the game's own physics puts under a correct player's execution, and
 * `guard.test.ts` holds the longest plan on the rack against it.
 */
export const SUSTAINABLE_STRIKE_SECONDS = BASE_STRAIN / BLEED_PER_SEC

/** What a child's hand actually costs per plate, comfortably clear of the above. */
export const STRIKE_SECONDS = 0.35

/**
 * How many multiples of the arithmetic's own p90 count as "nobody is there".
 *
 * Not a comfort margin — a definition. Sized at the p90 the guard would fire on
 * the child the p90 describes, which is the child this game keeps getting wrong.
 */
export const ABANDON_FACTOR = 2

/**
 * The shortest silence that can end a round, whatever the item.
 *
 * `3 + 4` has a p90 of six seconds; twelve seconds of stillness on it is still a
 * child thinking, or a child looking up at somebody in the room.
 *
 * Set from the bots rather than guessed. At twenty this floor put a solver that
 * paused thirty seconds before its first blow — a two-digit sum, so more than
 * twice the house p90 — into a **lapse on every single round**, three hundred of
 * them. Being generous here costs nothing: nothing in the game depends on a round
 * ending promptly, and the only thing a longer floor loses is how fast an
 * abandoned pack gives its item back.
 */
export const MIN_GUARD_SECONDS = 30

export type Item = {
  /** As the child reads it: `473 + 168`. */
  readonly prompt: string
  /** The canonical value the host revealed. Never computed here. */
  readonly answer: number
}

/**
 * The widest column count in the item — the operands and the answer together.
 *
 * The answer counts here too: it is a column wider than either operand whenever
 * the top place carries, and a child reading a five-digit total is reading five
 * columns whatever the operands looked like.
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
 * A prompt this cannot parse reads as **true**, which is the longer silence.
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

/**
 * Columns, clamped to the table.
 *
 * **This clamp is also the ceiling on the whole guard**, which is why there is no
 * `MAX_GUARD_SECONDS` constant: there was one, it could never bind, and its
 * docstring claimed to be doing a job this line already does. A nine-column
 * prompt is treated as the widest item the table knows about — four columns with
 * regrouping — so the longest silence anything can ask for is
 * `ABANDON_FACTOR × (32 + 8)`, and `guard.test.ts` asserts that figure directly.
 */
function columnsOf(item: Item): number {
  return Math.max(1, Math.min(BY_COLUMNS.length - 1, widestColumn(item)))
}

/**
 * The arithmetic's own p90, off the house table. Nothing else is in here.
 *
 * **This is measured, never limited.** It is not a budget the child is held to
 * — nothing is — it is only the scale the guard is sized against.
 */
export function comprehensionSeconds(item: Item): number {
  const columns = columnsOf(item)
  const base = BY_COLUMNS[columns] ?? MIN_GUARD_SECONDS
  return base + (needsRegrouping(item.prompt) ? (REGROUPING[columns] ?? 0) : 0)
}

/**
 * How long the counter waits for a hand on this item, in milliseconds.
 *
 * Monotone non-decreasing in both inputs — more columns is never less patience,
 * and needing to regroup is never less patience than not needing to — and a
 * function of the item alone.
 */
export function guardMsFor(item: Item): number {
  const seconds = ABANDON_FACTOR * comprehensionSeconds(item)
  return Math.round(Math.max(MIN_GUARD_SECONDS, seconds) * 1000)
}
