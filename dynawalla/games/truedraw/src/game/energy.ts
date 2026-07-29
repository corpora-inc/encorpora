// The reaction budget, as a number a test can compare.
//
// `EXPERIENCE_DESIGN.md` sets one invariant on feedback and it is not a matter of
// taste: **being wrong must never be more interesting than being right.** Written
// as `energy(SLIP) < energy(SEAT)`, where energy is the product of how long a
// reaction runs, how many things move, and how loud it is.
//
// This game still states it stronger, and the bag did not weaken it. A wrong
// verdict now has a consequence — coins leave — but a consequence is not a
// reaction: nothing sounds, nothing buzzes, no colour flashes, the caller does not
// move and the slate is not marked. The coins draining is the ledger telling the
// truth, and it is the ONLY thing that happens.
//
// So `gain` is zero for `dud` and for `burn`, and therefore their energy is
// exactly zero in both timing branches, with no dial to creep upward later.

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
  // The slate goes down and the coins come back out. Two, and no more: no mark,
  // no colour, no caller.
  dud: 2,
  // The slate goes up and the coins come back out.
  burn: 2,
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
