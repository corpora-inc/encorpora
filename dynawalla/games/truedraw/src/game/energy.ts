// The reaction budget, as a number a test can compare.
//
// `EXPERIENCE_DESIGN.md` sets one invariant on feedback and it is not a matter
// of taste: **being wrong must never be more interesting than being right.**
// Written as `energy(SLIP) < energy(SEAT)`, where energy is the product of how
// long a reaction runs, how many things move, and how loud it is.
//
// This game states it stronger, because restraint is the whole design here: the
// wrong *draw* — the mash — has energy exactly zero. Nothing moves, nothing
// sounds, nothing lights. There is no dial to creep upward later, because there
// is no term in the product that is non-zero.

import { VOICES } from "../audio/audio.ts"
import type { Outcome } from "./response.ts"
import { TIMING, TIMING_REDUCED, type Timing } from "./round.ts"

/** How many things on screen move during each verdict. Counted, not guessed. */
export const MOVERS: Record<Outcome, number> = {
  // The strike mark, and the numerals seating into the recess.
  hit: 2,
  // The caller bowing, and the wrong numeral rolling over into the right one.
  bow: 2,
  // Nothing. The slate does not change, the caller does not move.
  wild: 0,
  // The caller draws. One thing.
  slow: 1,
}

/**
 * The named haptic cue per outcome, or `null` for none.
 *
 * `wild` is `null`, and that is not an oversight to be tidied up later. A motor
 * pulse on a wrong draw is a buzzer you can feel: it tells a masher that
 * *something* registered, which is exactly the acknowledgement the design
 * withholds. Nothing fires on the cue either — a haptic at the go signal would
 * let a child play the flash by feel without ever reading the slate.
 */
export const HAPTIC: Record<Outcome, "light" | "medium" | "heavy" | "success" | "failure" | null> = {
  hit: "light",
  bow: "success",
  wild: null,
  slow: "medium",
}

export function energy(outcome: Outcome, timing: Timing = TIMING): number {
  const gain = VOICES[outcome]?.gain ?? 0
  return timing.verdict[outcome] * MOVERS[outcome] * gain
}

export const TIMINGS: readonly Timing[] = [TIMING, TIMING_REDUCED]
