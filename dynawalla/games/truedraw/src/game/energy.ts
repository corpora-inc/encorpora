// The reaction budget, as a number a test can compare.
//
// `EXPERIENCE_DESIGN.md` sets one invariant on feedback and it is not a matter of
// taste: **being wrong must never be more interesting than being right.** Written
// as `energy(SLIP) < energy(SEAT)`, where energy is the product of how long a
// reaction runs, how many things move, and how loud it is.
//
// ── what the founder's playtest changed, and what it did not ────────────────
//
// It used to be stated harder than the invariant needs: a wrong verdict made NO
// sound and put NO mark on the slate, so its energy was exactly zero. That kept
// the invariant trivially and it also meant the most teachable second in the game
// showed the child nothing. A miss now COMPLETES THE SUM in the accent and says
// one quiet rising figure over it — `render/flourish.ts` and `audio/audio.ts`.
//
// The invariant is unchanged and is now doing real work rather than none:
//
//   energy(dud)  = 900 × 3 × 0.045 = 121.5
//   energy(bank) = 500 × 3 × 0.20  = 300
//   energy(spot) = 940 × 4 × 0.24  = 902.4
//
// and in the reduced branch, where the celebrations are shorter and the miss hold
// deliberately is not, 121.5 against 180 and 499.2. Being wrong stays the least
// interesting thing that can happen to a child in this game, by construction,
// checked against the real numbers rather than against this comment.
//
// The caller still does not bow for a miss, nothing flashes red — there is no red
// in the palette — and NOTHING BUZZES: see `HAPTIC`.

import { VOICES } from "../audio/audio.ts"
import type { Outcome } from "./response.ts"
import { TIMING, TIMING_REDUCED, type Timing } from "./round.ts"

/** How many things on screen move during each verdict. Counted, not guessed. */
export const MOVERS: Record<Outcome, number> = {
  // The stamp, the numerals seating, and the slate going down into the bag.
  bank: 3,
  // The caller bowing, the wrong numeral rolling over into the right one, and the
  // slate flying away. The biggest moment in the game.
  spot: 4,
  // The sum completing itself, the slate going down, and the coins coming back
  // out. Three — and the third one is the reveal, which is the point of the beat.
  // No caller, no strike, no flare, no colour but the accent.
  dud: 3,
  // The sum confirming itself, the slate going up, and the coins coming back out.
  burn: 3,
  // The slate sinks. One thing, and it is the same thing an empty street does.
  lapse: 1,
}

/**
 * The named haptic cue per outcome, or `null` for none.
 *
 * Both wrong verdicts are `null`, and that is not an oversight to be tidied up
 * later. A motor pulse on a wrong answer is a buzzer you can feel: it tells a
 * masher that *something* registered, which is exactly the acknowledgement the
 * design withholds. The bag emptying is the feedback and it is legible without a
 * buzz.
 *
 * Nothing fires when the statement is cut in either — a haptic at that moment
 * would let a child play the beat by feel without ever reading the slate.
 *
 * `lapse` is `null` too: buzzing at a child for still thinking is the single most
 * hostile thing this game could do.
 */
export const HAPTIC: Record<
  Outcome,
  "light" | "medium" | "heavy" | "success" | "failure" | null
> = {
  bank: "light",
  spot: "success",
  dud: null,
  burn: null,
  lapse: null,
}

export function energy(outcome: Outcome, timing: Timing = TIMING): number {
  const gain = VOICES[outcome]?.gain ?? 0
  return timing.verdict[outcome] * MOVERS[outcome] * gain
}

export const TIMINGS: readonly Timing[] = [TIMING, TIMING_REDUCED]
