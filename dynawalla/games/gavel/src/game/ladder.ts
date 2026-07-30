// What the room looks like at a given intensity, and what THE GAVEL is willing
// to put on a tablet.
//
// **No wall clock reaches this file.** `intensity` moves on `settle`, which THE
// GAVEL calls once per *settled lot* with a fixed nominal step — never per frame
// and never with a real delta. So the room escalates on lots worked, which is
// achievement, and two sittings that make the same decisions get the same room
// however long the child took over each one. `test/antimash.test.ts` is the
// proof, and `test/ladder.test.ts` is the guard on the shape.
//
// **Nothing here is a comprehension window, because the game has no clock at
// all.** There is nothing to be monotone in difficulty: a lot waits.

import {
  SECOND_GRADE_FLOW,
  countAt,
  observe as flowObserve,
  settle as flowSettle,
  revealMs as flowRevealMs,
  valueAt,
  type FlowSpec,
} from "../../../../packs/shared/game-pacing/index.ts"
import type { Question } from "../contract.ts"

/**
 * The controller shape: `SECOND_GRADE_FLOW` with three overrides.
 *
 * **`laboredScore: 1` is the load-bearing one.** The shared spec pays a correct
 * answer between `laboredScore` (0.55) and 1 depending on how quick it was, and THE
 * GAVEL deliberately never tells it how quick — see `observe`. Left at 0.55 that
 * makes flawless play score exactly 0.55 forever, which is `strugglingBelow`, which
 * `demandFor` maps to the FLOOR: a child who never made a mistake would have been
 * held at the easiest content in the product for the whole session, and the only
 * symptom would have been a game that never got harder. In a game with no clock,
 * correctness is the only evidence there is, so it has to be full evidence.
 *
 * The two climb constants are slower than ARENA's because this controller is
 * stepped **once per lot** rather than once per frame. At `climbBoost: 14` a
 * flawless player crossed the whole curriculum ladder in about four lots, which is
 * not a climb, it is a jump — and at 8 the first step of a climb from a standing
 * start was larger than the first step of a fall, which inverts the one asymmetry the
 * shared module insists on: relief is not something to be earned.
 */
export const SPEC: FlowSpec = {
  ...SECOND_GRADE_FLOW,
  laboredScore: 1,
  climbSeconds: 420,
  climbBoost: 6,
}

/**
 * Nominal seconds charged to the controller per settled lot.
 *
 * A number, not a measurement. `settle` needs a step to move on and the only
 * honest step in a game with no clock is "one lot happened": six is roughly what
 * a lot takes when a child knows what they are doing, so `climbSeconds` reads
 * as "seventy unhurried lots to cross the whole ladder at the slowest climb", and
 * `climbBoost` carries somebody who is obviously fluent up in about a dozen.
 */
export const LOT_STEP_SECONDS = 6

/** How many rival bidders are in the room. */
export function tabletCount(intensity: number): number {
  return countAt(intensity, MIN_TABLETS, MAX_TABLETS)
}

export const MIN_TABLETS = 3
export const MAX_TABLETS = 5

/**
 * How far above the room the broker's offer sits, on a lot worth buying.
 *
 * **This band does NOT ride the intensity, and it was written that way first.** The
 * obvious escalation was to squeeze it — nine coins of headroom at the calm end,
 * three at the hard end — and it is a trap, measured in `test/bots.test.ts`. At a
 * margin of three, the arithmetic-free strategy of bidding one under the broker's
 * offer earns one coin and the keen bid earns four, so the whole reward for reading
 * the room collapses to three coins and, at a margin of two, the blind bid *is* the
 * keen bid. Squeezing the margin does not make the game harder; it makes the
 * arithmetic worth less.
 *
 * Wide, and the reward for precision scales with it: the keen bid pays
 * `2 × (margin − 1)`, which averages nine coins against the blind strategy's one.
 * Escalation is carried by the rung the questions come from, by how many rivals are
 * in the room, and by how often the offer is not worth chasing at all.
 */
export const MIN_MARGIN = 2
export const MAX_MARGIN = 9

/**
 * How often the broker's offer is too low to be worth bidding at all.
 *
 * A lot whose offer is at or one coin above the highest rival bid cannot be
 * flipped for a profit by anybody, and the only right move is to fold the
 * paddle. These are what make the inequality load-bearing rather than
 * decorative: without them a child could ignore the offer entirely, always bid
 * one over, and never be wrong.
 *
 * Zero at the very bottom of the ladder. The first lots a child ever sees should
 * all be winnable — a trap is a lesson about a rule they have not been taught
 * yet.
 */
export function trapChance(intensity: number): number {
  if (intensity < 0.12) return 0
  return valueAt(intensity, 0.1, 0.3)
}

/** How long the settled room is held in front of the child, in milliseconds. */
export function revealHoldMs(intensity: number): number {
  // Floored, not merely taken: at the top of the ladder `revealMs` goes to zero,
  // and zero would tear the room down in the same frame the hammer fell. The
  // floor is the length of the animation, not a lesson.
  return Math.max(MIN_REVEAL_MS, flowRevealMs(SPEC, intensity))
}

export const MIN_REVEAL_MS = 900

/**
 * The success estimate after one more lot.
 *
 * **`seconds` is deliberately not passed.** `outcomeScore` would pay a bonus for
 * a quick answer, and a bonus that changes the *content* of the next question is
 * a clock wearing a different hat: think for longer and the room gets easier, so
 * a child who is careful is quietly demoted. THE GAVEL has no clock anywhere and
 * this is where one would have crept in. Latency is still measured and still
 * reported to the host — see `Auction.hammer` — because the learner model wants
 * it. The game just never spends it.
 */
export function observe(success: number, arithmeticWasRight: boolean): number {
  return flowObserve(SPEC, success, arithmeticWasRight)
}

/** Intensity after one settled lot. Nothing else may ever move it. */
export function settleAfterLot(intensity: number, success: number): number {
  return flowSettle(SPEC, intensity, success, LOT_STEP_SECONDS)
}

// ── what fits on a tablet ────────────────────────────────────────────────────

/**
 * The largest value a tablet can carry, and the paddle that has to hold one more.
 *
 * The chain is: a rival bids `v`, the broker's offer sits up to `MAX_MARGIN` above it,
 * and the child's bid sits above the rival — so the paddle has to hold `v + MAX_MARGIN`
 * and `MAX_TABLET_VALUE` is that bound read backwards from five digits.
 *
 * **It was 9,999, and that was a real cost.** `dw.mul.multidigit.times-one-digit` is
 * active and reaches `4827 × 6 = 28962`, so about half that rung's items were refused —
 * and the refusal used to cap the whole rung and everything above it, which took
 * `dw.add.regroup.subtract-across-zero` out of the run entirely even though its answers
 * fit a tablet perfectly. Widening the paddle is the honest half of that fix; the other
 * half is `rungCannotDraw` below, which no longer mistakes a magnitude for a rung.
 */
export const MAX_BID_DIGITS = 5
export const MAX_TABLET_VALUE = 99_999 - MAX_MARGIN

/** Narrowest tablet the gallery layout will ever produce, in CSS pixels. */
export const MIN_TABLET_W = 132
/** Text inset inside a tablet, per side. */
export const TABLET_PAD = 8
/**
 * The smallest a numeral a child has to read may be drawn.
 *
 * `PACING_AUDIT_2026-07.md` closes on this: `serpent`'s orbs print at four to
 * seven CSS pixels on a phone, "so the child guesses for a reason that has
 * nothing to do with time". Thirteen is a floor, not a target.
 */
export const MIN_NUMERAL_PX = 13
/** Mean advance of a digit in the face `render/scene.ts` draws, in ems. */
export const DIGIT_ADVANCE_EM = 0.63

/**
 * How many characters of prompt a tablet can hold.
 *
 * **Derived, not asserted.** `polarity` shipped `LABEL_MAX_CHARS = 8` with a
 * comment saying eight "still fits the cell without squeezing"; they overflowed
 * it by about 60% and nothing measured. This is arithmetic on the narrowest
 * tablet the layout can produce and the smallest numeral a child may be asked to
 * read, and `test/layout.test.ts` checks the renderer against the same numbers
 * rather than against this constant.
 */
export const PROMPT_MAX_CHARS = Math.floor(
  (MIN_TABLET_W - 2 * TABLET_PAD) / (MIN_NUMERAL_PX * DIGIT_ADVANCE_EM),
)

/** An exact non-negative integer, or null. Never rounds, never bends. */
export function tryParseBid(text: string): number | null {
  if (!/^\d{1,6}$/.test(text.trim())) return null
  const value = Number(text.trim())
  return Number.isSafeInteger(value) ? value : null
}

/**
 * The value a tablet would carry for this question, or null if it cannot.
 *
 * A tablet is a *price*. A price is a whole number of coins, it is not negative, and it
 * has to be small enough that one more coin than it still fits on the paddle. A
 * fraction, a decimal, a negative or a six-digit answer is refused — and refusing is
 * loud where it happens.
 *
 * The three reasons are not interchangeable, and `rungCannotDraw` is where that matters.
 */
export function tabletValue(q: Question): number | null {
  if (!priceable(q.answer)) return null
  const value = tryParseBid(q.answer)
  if (value === null || value > MAX_TABLET_VALUE) return null
  if (visibleLength(q.prompt) > PROMPT_MAX_CHARS) return null
  return value
}

/**
 * Is this answer even the SHAPE of a price — a whole number, of any size or sign?
 *
 * Separate from `tabletValue` because it is the only refusal that is a fact about the
 * *representation a rung uses* rather than about one item. A fraction rung emits
 * fractions and a tenths rung emits decimals for every item it will ever produce; a
 * multiplication rung emits some answers that fit a five-digit paddle and some that do
 * not, from the very same rung.
 */
export function priceable(answer: string): boolean {
  return /^[+-]?\d+$/.test(answer.trim())
}

/** Characters that count against the tablet's width. */
export function visibleLength(prompt: string): number {
  return prompt.trim().length
}

/**
 * Is this refusal a fact about the RUNG, or only about this item?
 *
 * Getting this wrong in either direction is expensive, and it has been shipped both
 * ways in this repository:
 *
 *   * Too eager, and one unlucky item deletes a third of the curriculum. The first
 *     version of this function read "`tabletValue` said no" as a rung fact, and that
 *     included *magnitude*. On `dw.mul.multidigit.times-one-digit` — a live rung — a
 *     single `4827 × 6 = 28962` capped the stream below its ordinate for the rest of the
 *     run, which excluded 21 of the shipped ladder's 66 rungs including all three of
 *     `dw.add.regroup.subtract-across-zero`, a skill `pack.json` promises and whose
 *     answers fit a tablet perfectly. From the same rung, `1023 × 2 = 2046` is drawable.
 *     Magnitude depends on the operands drawn, so it is an ITEM fact.
 *   * Too shy, and a rung this game genuinely cannot draw is a soft-lock rather than a
 *     degradation: declining is per-item and the host serves by RUNG, so asking again at
 *     the same difficulty gets the same rung, the board spends its whole draw budget
 *     being refused, and the child is served a stall.
 *
 * So exactly two things are rung facts, and both are constants of this game rather than
 * of the item drawn:
 *
 *   * **The prompt is wider than a tablet.** The tablet is a fixed width, so if one
 *     item's prompt overflows it, every item from that rung does.
 *   * **The answer is not a whole number at all.** A fraction rung emits fractions and a
 *     tenths rung emits decimals, for every item, forever. Nothing from such a rung can
 *     ever be a price.
 *
 * Everything else — a value too large for the paddle, a negative value, a value already
 * on the board — is declined per item and caps nothing. `polarity` conflated exactly
 * this and pinned a whole session at the easiest rung in the product off one transient
 * empty pool.
 *
 * `id === ""` is the shared host's marker for "the pool ran dry, here is something
 * drawable". It describes no rung and must never cap one. Today's sentinel answers
 * `"0"`, which is a perfectly good price, so the checks below would refuse to cap on it
 * anyway — the id line is there because the sentinel belongs to the host and the next
 * one may not parse. `test/lot.test.ts` covers both, so the line is load-bearing
 * against a future host rather than against this one.
 */
export function rungCannotDraw(q: Question): boolean {
  if (q.id === "") return false
  if (visibleLength(q.prompt) > PROMPT_MAX_CHARS) return true
  return !priceable(q.answer)
}

/**
 * A 0..1 ladder position, spelled so the host cannot read it as the other scale.
 *
 * `packs/shared/game-host` reads a value below 1 as a fraction and 1..10 as a
 * ladder index, and resolves the one value both scales claim — `1` — as the
 * BOTTOM. A game that speaks fractions and ever reaches exactly 1 asks for the
 * hardest content in the product and is served the easiest. This game's
 * intensity reaches 1, so it speaks the unambiguous scale.
 */
export function ladderScale(unit: number): number {
  const u = Number.isFinite(unit) ? Math.min(1, Math.max(0, unit)) : 0
  return 1 + u * 9
}

/**
 * How far below a rung a ceiling is set when that rung turns out undrawable.
 *
 * The host floors `maxDifficulty × span` to a rung index, so an ordinate minus
 * anything strictly between zero and one rung excludes exactly that rung and
 * keeps every rung below it.
 */
export const CEILING_STEP = 1e-3
