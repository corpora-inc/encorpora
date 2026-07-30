// What this game ASKS FOR next.
//
// ── the defect ───────────────────────────────────────────────────────────────
//
//   > "It stays on way too easy way too long to be fun for more advanced people.
//   > `1+0=0` (False) is fine to start but I don't want to see that 3 times out of
//   > the first 20 and see the same easy stuff for dozens of rounds. It should
//   > advance up and down in skill level more quickly, especially based on speed."
//
// The reason it stayed easy was not subtle. `dealer.ts` called `host.next()` with
// **no argument at all**. This pack never asked for a difficulty in its life, so
// it got the front of the prefetch pool forever, at whatever rung the pool was
// stocked at. Nothing here was adaptive; nothing here was even trying to be.
//
// This module is that request, and only that. It does not select questions, does
// not know what a skill is, and does not model the child — a separate change to
// the host is making its ladder serve a distribution rather than a single rung and
// calibrate faster, and duplicating that here would give a child two controllers
// fighting. What lives here is one number and how this game moves it.
//
// ── SPEED IS THE SIGNAL, and it could not be before ─────────────────────────
//
// The founder's own observation is the design:
//
//   > "If we have a gesture for True and a gesture for False, we can measure both
//   > ways and decide to go to harder problems."
//
// With one verb, one of the two verdicts had no moment in it, so half of every
// child's calls carried either no latency or a full-window timestamp that meant
// "the clock ran out", not "they were sure". A ladder cannot be driven on
// half a signal. With two gestures every call has an honest reaction time, so the
// step up is a FUNCTION of it: fast and right moves nearly four times as far as
// slow and right.
//
// ── the numbers ──────────────────────────────────────────────────────────────
//
// Positions are on the SDK's 0..1 fraction scale.
//
//   UP_MAX  0.075   a correct call at or under 35% of the item's p50
//   UP_MIN  0.020   a correct call at or past its p50 — still up, just slower
//   DOWN    0.110   any wrong verdict, at any speed
//
// Ten fast correct calls from the start position is `0.2 + 10 × 0.075 = 0.95`, so
// the founder's "10 correct in a row fast" walks the child from near the bottom of
// the ladder to near the top of it — which is what he asked for, stated as the
// number it is. Ten correct-but-deliberate calls is `0.2 + 0.2 = 0.4`, a real move
// and a much gentler one.
//
// `DOWN > UP_MAX` on purpose: one wrong verdict undoes roughly a call and a half of
// fast progress. Falling faster than you climb is what keeps a child who has been
// pushed too high from staying there, and the SDK's `flush` exists precisely so a
// fall lands in two questions rather than thirty-three.
//
// A `lapse` moves the ladder by exactly nothing. A child who ran out of time has
// told us nothing about what they know, and `skip`'s own contract says the same.
//
// ── CEILING = 0.995, which is not a rounding artefact ───────────────────────
//
// `game-host`'s `toUnit` reads a value below 1 as a fraction and a value at or
// above 1 as a 1..10 ladder INDEX. That makes exactly one number ambiguous — `1` —
// and it is resolved as the ladder's BOTTOM, because five of the six games that
// speak the index scale send `1` on their opening question. So a game speaking
// fractions that ever sends exactly `1.0` does not ask for the hardest content in
// the product; it asks for the easiest, silently, at the moment the child has
// earned the opposite. This game never sends it.

import { isCorrect, type Outcome } from "./response.ts"

/** Where a run starts. Low, because a child who is quick leaves it in seconds. */
export const START = 0.2

/** A correct call at or past the item's own p50. Still a step up. */
export const UP_MIN = 0.02

/** A correct call at or under `QUICK_FLOOR` of the item's p50. */
export const UP_MAX = 0.075

/** Any wrong verdict. Bigger than `UP_MAX`: you fall faster than you climb. */
export const DOWN = 0.11

/** The top this game will ever ask for. See the note above — never 1.0. */
export const CEILING = 0.995

export const FLOOR = 0

/**
 * How far one settled outcome moves the request.
 *
 * `quickness` is `cadence.quicknessOf` — 0..1, the share of the item's p50 the
 * child did not use. It scales the step UP and is ignored on the way down: a
 * wrong answer given fast is not more wrong than a wrong answer given slowly, and
 * pricing it that way would punish a child for being decisive.
 */
export function stepFor(outcome: Outcome, quickness: number): number {
  if (outcome === "lapse") return 0
  if (!isCorrect(outcome)) return -DOWN
  const credit = Number.isFinite(quickness) ? Math.max(0, Math.min(1, quickness)) : 0
  return UP_MIN + (UP_MAX - UP_MIN) * credit
}

/** The one number, and the only thing that moves it. */
export class Ladder {
  private at: number

  constructor(start: number = START) {
    this.at = clamp(start)
  }

  /** What to ask the host for. Always a legal fraction, never exactly 1. */
  get difficulty(): number {
    return this.at
  }

  settle(outcome: Outcome, quickness: number): number {
    this.at = clamp(this.at + stepFor(outcome, quickness))
    return this.at
  }

  /** A new run starts where the last one left off; the child did not get worse. */
  reset(): void {
    // Deliberately NOT back to START. A child who reached rung eight and then ran
    // out of shots is a child who can do rung eight; handing them `1 + 0 = 1`
    // again because a run ended is the exact complaint this module answers. What a
    // finished run costs is the run, not the standing.
  }
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return START
  return Math.max(FLOOR, Math.min(CEILING, value))
}
