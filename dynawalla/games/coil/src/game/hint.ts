// THE HINT — the cut, stated a little at a time, in the machine's own vocabulary.
//
// The founder's first report on this game was: *"the coil of 96 the instructions
// are confusing and I really have no idea what I'm doing."* The second, after the
// manual landed, was: **"needs more hints, hints don't fit on mobile."**
//
// What shipped was one hint and it was a line of text — `2×10  5×1` — drawn into
// the gauge with no measurement of any kind. On the founder's own handset it is
// about 151px of type starting 21px into a 122px panel, so it ran out of the
// gauge, across the SHEAR lever and off the glass. `hint.test.ts` measures that
// at real viewports. It is also the wrong *kind* of hint: it restates the demand
// the wall has already carved, once, and then has nothing further to say to a
// child who is stuck on the part that is actually hard.
//
// ## The part that is actually hard
//
// It is never "what is 72 − 25". It is: *twenty-five is two tens and five ones,
// this chain ends in two beads, so there is no joint on it worth twenty-five.*
// A child who has not seen that is not stuck on arithmetic, they are stuck on
// the machine — which is exactly the "I have no idea what I'm doing" report.
//
// So the escalation is four pictures of the SAME cut, and each one is a masking
// of the next. Nothing here is a sentence; THE LATTICE's hint took the same line
// and for the same reason, that copy ships about fifty times translated and a
// picture of the mechanic does not.
//
//   1. **THE SHAPE.** The demand, drawn as links, beside the piece the jaws are
//      already holding. Two drums and five beads against two beads. It says the
//      single most useful thing and says it in silhouettes: *this is what has to
//      come off, and it is not what you have.*
//   2. **THE CHANGE.** One crack mark per break the demand still needs. This is
//      the borrow, as a count: *you cannot take this until you open that many
//      links.* Zero marks is information too — *it is all there, go and find the
//      joint.*
//   3. **THE PLACE.** A ghost of the jaws, on the lane, at the link to put them
//      on next — live, and it moves every time the child cracks something. When
//      that link is one to open, the ten-for-one it yields is written beside it:
//      a drum shows `10×1`, a ring shows `10×10`. Numerals and a multiplication
//      sign, in a game whose whole subject is that ten of one place is one of
//      the next.
//   4. **THE NUMBER.** What the jaws are holding, and what the wall wants, as
//      two numerals. The gauge refuses to print these during normal play on
//      purpose — *"if it printed 25 the child would nudge until the digits
//      matched and the place value would be the machine's job instead of
//      theirs"* — and that judgement is exactly right for the gauge and exactly
//      wrong for a child who has been stuck for a minute and asked twice.
//
// ## What a hint costs: nothing
//
// Not a brick, not the wall, not the slag count, not the report. No counter says
// how many hints were taken and no string mentions needing help. This game
// already had the right instinct — *"punishing a child for thinking is the
// failure mode this whole programme exists to avoid"* — and a hint is thinking.
//
// ## The clock stops before the answer
//
// Stages 1 and 2 arrive on their own after a long stillness. **Stage 3 pins the
// exact joint, so the clock never reaches it.** Past `FREE_STAGES` a hint is
// something a child asks for with a thumb, by tapping the gauge — the panel that
// already answers "what am I holding". Nothing that happens to a child who is
// merely sitting there ever puts the answer on the screen.
//
// And the quiet is a **pure function of the item, monotone non-decreasing in the
// item's difficulty** — the same law THE LATTICE holds its hint to. The item's
// difficulty here is `breaksNeeded`, this game's own measure of how much change
// a demand costs. A demand that needs more change buys MORE silence, never less,
// because a child mid-borrow is working, not stuck.
//
// There is no countdown, no ring filling, no banner and no "hint in 3". A
// struggling child never sees a clock.

import { breaksNeeded, canBreak, linkValue } from "./place.ts"

/** The four pictures. See the list above. */
export const HINT_STAGES = 4

/**
 * The last stage the CLOCK may reach on its own.
 *
 * Two, because stage 3 puts a ghost of the jaws on the joint to aim at, and that
 * is the answer. A child who is merely sitting there gets the shape of the
 * demand and the number of links to open, and then it stops.
 */
export const FREE_STAGES = 2

/**
 * The quiet before the first picture, and what it is allowed to depend on.
 *
 * `HINT_DWELL_MS` is what shipped and it is kept: nine seconds of stillness is
 * already a long time in front of a child. `PER_BREAK` buys silence for a demand
 * that costs change, because cracking links IS the work and a child in the
 * middle of it has not stopped.
 *
 * Both coefficients are **non-negative**, which is the whole proof of the
 * monotonicity law: `firstHintMs` is a sum of non-negative multiples of the
 * item's own difficulty, so it cannot decrease when that difficulty rises.
 * `hint.test.ts` asserts it exhaustively rather than taking the argument.
 */
export const HINT_DWELL_MS = 9_000
export const HINT_DWELL_PER_BREAK_MS = 2_500

/**
 * The gap between one picture and the next, as a fraction of the first quiet.
 *
 * The clock has only two pictures to give and spending them slowly is what makes
 * each one a separate thing that happened rather than a panel unfolding at a
 * child who has looked away. A child who wants them faster taps the gauge.
 */
export const HINT_STEP_FRACTION = 0.85

/** The item a hint is about. Everything `firstHintMs` is allowed to read. */
export type HintItem = {
  /** `breaksNeeded` for this demand on this coil. This game's own difficulty. */
  readonly breaks: number
}

/**
 * How long the game stays quiet before the first picture.
 *
 * **Pure in the item and monotone non-decreasing in it.** Not the clock, not how
 * many cuts have missed, not how long the child took last time, not the slag
 * count. Two calls with the same item return the same number forever.
 */
export function firstHintMs(item: HintItem): number {
  const breaks = Number.isFinite(item.breaks) ? Math.max(0, item.breaks) : 0
  return HINT_DWELL_MS + HINT_DWELL_PER_BREAK_MS * breaks
}

/**
 * Which stage the clock alone has reached after `elapsedMs` on this item.
 *
 * `0` is "nothing at all", and it is where a child who is getting on with it
 * spends the whole round. The result is capped at `FREE_STAGES` by the caller,
 * not here, so that the schedule and the ceiling stay separately readable.
 */
export function scheduledStage(elapsedMs: number, item: HintItem): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  const first = firstHintMs(item)
  if (elapsedMs < first) return 0
  const step = Math.max(1, first * HINT_STEP_FRACTION)
  return 1 + Math.floor((elapsedMs - first) / step)
}

/**
 * The next physical act, read off the chain the child is actually holding.
 *
 * This is the live field marker, and everything about it is recomputed from the
 * chain rather than remembered — so it moves the instant a link is cracked, and
 * it cannot go stale or disagree with the board.
 *
 * The walk is the strategy the interaction affords and the same one
 * `breaksNeeded` counts with: come in from the tail taking whole links while
 * they fit, and stop at the first link that overshoots. Where it stops is the
 * whole answer to "what do I do now".
 */
export type Plan = {
  /** Breaks still needed, or `-1` when the demand cannot be reached at all. */
  readonly breaks: number
  /** The joint the jaws must finish at, once nothing is left to open. */
  readonly cut: number
  /** The link to open next, or `-1` when none is needed. */
  readonly breakIndex: number
  /** Where to put the jaws NOW: the link to open, or the joint to cut at. */
  readonly aim: number
  /** What the walk has taken before it stalls. */
  readonly taken: number
}

export function planFor(links: readonly number[], demand: number): Plan {
  let taken = 0
  let i = links.length - 1
  while (i >= 0) {
    const v = linkValue(links[i] as number)
    if (taken + v > demand) break
    taken += v
    i--
  }
  const cut = i + 1
  if (taken === demand) return { breaks: 0, cut, breakIndex: -1, aim: cut, taken }
  // The walk stalled. `i` is the link that overshoots — the one to crack open,
  // which is precisely where the jaws have to be parked, because the jaws are
  // the only place in this game a link can be cracked.
  if (i < 0 || !canBreak(links, i)) {
    return { breaks: -1, cut, breakIndex: -1, aim: cut, taken }
  }
  return { breaks: breaksNeeded(links, demand), cut, breakIndex: i, aim: i, taken }
}

/** The hint as it stands, handed to the renderer whole. */
export type HintState = {
  /** 0 = nothing drawn. Up to `HINT_STAGES`. */
  readonly stage: number
  /** The live plan the marker is drawn from. */
  readonly plan: Plan
  /** The demand, so the renderer never has to reach for the round. */
  readonly demand: number
  /** What the jaws are holding right now. */
  readonly holding: number
  /** True when a deliberate tap would show something the clock will not. */
  readonly more: boolean
}
