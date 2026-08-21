// TEACHING THE GESTURE WITHOUT SAYING ANYTHING.
//
// The founder's note: *"Could have intuitive up == false, down == true
// instructions in the game .. subtle, premium."*
//
// The game had the rule written down in six paragraphs of a manual behind a `?`
// in the top-right corner. A child who has not read it spends a shot finding out
// which way is which, and a child who HAS read it has read six paragraphs to learn
// two arrows. Neither is acceptable and both were shipping.
//
// There are three teachers now and none of them is a sentence.
//
// ── 1. THE MARKS, always ────────────────────────────────────────────────────
//
// The chute at the top of the screen carries `≠`. The hoard at the bottom carries
// `=`. That is the entire instruction set, it is in the notation the game is
// already made of, and it needs no translation into any of the fifty languages
// this fleet ships in. `47 + 25 = 62`: swipe it UP to the `≠` to say it does not,
// DOWN to the `=` to say it does. The marks are permanent chrome — they are not a
// tutorial that gets dismissed, so there is nothing to miss and nothing to recall.
//
// ── 2. THE GHOST, until the first correct call ──────────────────────────────
//
// A translucent copy of the slate drifts down towards the `=`, fades, then drifts
// up towards the `≠`, and fades. Both gestures, in order, on a loop, while the
// real slate sits still and answerable underneath it.
//
// **It demonstrates the two MOVES and never the ANSWER.** That distinction is the
// whole safety of the feature: a ghost that drifted the way the current statement
// ought to go would be the game playing the round for the child, and every one of
// those rounds would enter the learner model as evidence about arithmetic they did
// not do.
//
// ── 3. THE HESITATION, which is a nudge and never a clock ───────────────────
//
// The ghost does not appear the instant the window opens. It fades in after
// `NUDGE_MS` of an untouched screen — long enough that a child who knows the
// gesture never sees it at all, and short enough to arrive while a child who does
// not is still looking for what to do.
//
// It is fixed, it does not accelerate, it does not count anything down and it goes
// away the moment a finger touches the glass. Speed is REWARDED in this game and
// never ENFORCED; a hint that got more urgent the longer a child thought would be
// a countdown wearing a costume.
//
// **And it stops for good after the first correct call** — `run.calls > 0` and the
// street never mentions it again for the rest of the run. A hint that outstays the
// moment it was needed is condescension, and this product does not do that to
// children.

import type { Call } from "../game/response.ts"
import type { Phase } from "../game/round.ts"

/** How long an untouched window waits before the ghost begins. */
export const NUDGE_MS = 900

/** How long the ghost takes to fade in once it starts. */
const NUDGE_RAMP_MS = 420

/** One full demonstration: down to the `=`, then up to the `≠`. */
export const CYCLE_MS = 2800

export type Hint = {
  /** 0..1 — how present the teaching is. Drives the two marks as well as the ghost. */
  readonly strength: number
  /** The gesture the ghost is demonstrating this half of the cycle. */
  readonly call: Call
  /** 0..1 along the ghost's travel towards its destination. */
  readonly drift: number
  /** 0..1 — how solid the ghost is. Zero under reduced motion: the marks carry it. */
  readonly alpha: number
}

export type HintInput = {
  readonly phase: Phase
  readonly elapsedMs: number
  readonly reduced: boolean
  readonly masked?: boolean
  /** Non-null while a finger is on the glass. A hint competes with nothing. */
  readonly dragging: boolean
  /** Correct calls made this run. The teaching ends at the first one. */
  readonly calls: number
}

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t))
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/**
 * What to teach right now, or null for nothing at all.
 *
 * Null is the common case and by a very long way: it is every frame of every round
 * after a child's first correct call, every frame with a finger down, and every
 * frame of a window younger than `NUDGE_MS`.
 */
export function hintFor(input: HintInput): Hint | null {
  if (input.phase !== "call") return null
  if (input.masked === true) return null
  if (input.dragging) return null
  // The one gate that matters. One correct call is proof the gesture landed.
  if (input.calls > 0) return null

  const since = input.elapsedMs - NUDGE_MS
  if (since <= 0) return null
  const strength = clamp01(since / NUDGE_RAMP_MS)

  // Which half of the demonstration, and how far through it. `keep` first: the
  // affirmative gesture is the one a child reaches for unprompted, so the loop
  // starts by confirming the instinct rather than by contradicting it.
  const t = (since % CYCLE_MS) / CYCLE_MS
  const half = t < 0.5 ? t * 2 : (t - 0.5) * 2
  const call: Call = t < 0.5 ? "keep" : "toss"

  // Travel for the first two thirds, then hold and fade. A ghost that vanished at
  // the top of its arc would read as a glitch rather than as a throw.
  const drift = easeInOut(clamp01(half / 0.66))
  const alpha = strength * (input.reduced ? 0 : Math.sin(Math.PI * clamp01(half)) ** 0.7)

  return { strength, call, drift, alpha }
}

/**
 * How bright a destination's mark is: at rest, under a finger heading for it, and
 * while the ghost is demonstrating it.
 *
 * At rest it is deliberately faint — present, legible on a still frame, and never
 * competing with the statement, which is the only thing on the street a child has
 * to read under any kind of clock.
 */
export const MARK_REST = 0.2

export function markGlow(
  mine: boolean,
  pull: number,
  hint: Hint | null,
  hintCall: boolean,
): number {
  const pulling = mine ? clamp01(pull) : 0
  const taught = hint !== null && hintCall ? hint.strength : 0
  return clamp01(MARK_REST + pulling * 0.8 + taught * 0.45)
}
