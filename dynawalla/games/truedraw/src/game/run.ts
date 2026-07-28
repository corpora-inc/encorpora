// The run, and why half right is a failure.
//
// This is the module the whole design rests on. A GO/NO-GO task has a hard 50%
// ceiling for anyone who ignores the statement and just draws — that is not a
// flaw to be patched, it is the measurement. The job here is to make sure that
// ceiling *reads* as failure to a seven-year-old, and there is exactly one
// honest way to do it: **never show an accuracy at all.**
//
// A child shown "50%" reads a passing grade. A child shown a tally of three
// reads what it is.
//
// So the run has no score and no percentage. It has a **length**: how many calls
// you made before three shots went dark. And the length of a run is violently
// non-linear in how carefully you play, because misses are a budget rather than
// a subtraction:
//
//     expected calls = shots × p / (1 − p)
//
//        p = 0.50  (draw at everything)  →   3 calls
//        p = 0.75                        →   9 calls
//        p = 0.90                        →  27 calls
//        p = 0.97                        →  97 calls
//        p = 1.00                        →  no end
//
// A masher's whole run is three calls long. There is no arrangement of three
// that looks like doing well, no number on the slate to misread, and nothing to
// argue with: the street empties before a crowd ever gathers. The same is true
// of the other degenerate strategy — never drawing is also exactly half, and
// also three calls.
//
// Nothing here ever *subtracts*. A miss spends a shot; it does not take back a
// call you made. Construction never regresses (`P-04`) — the pull is "my run was
// getting long", never "my score is at risk".

import type { Outcome } from "./response.ts"
import { isCorrect } from "./response.ts"

/** Misses a run survives. Three, as in the original. */
export const SHOTS = 3

/** Witnesses that can stand in the haze. Past this the crowd is a crowd. */
export const CROWD_MAX = 14

export type Run = {
  /** Shots left. At zero the street clears. */
  readonly shots: number
  /** Correct calls made. This is the tally, and it is the only one. */
  readonly calls: number
  /** Drew at a false slate. */
  readonly wild: number
  /** Let a true slate stand. */
  readonly slow: number
  /** Pressed before the slate lit. Ignored, and counted anyway. */
  readonly flinches: number
  readonly over: boolean
}

export function newRun(): Run {
  return { shots: SHOTS, calls: 0, wild: 0, slow: 0, flinches: 0, over: false }
}

export function applyOutcome(run: Run, outcome: Outcome): Run {
  if (run.over) return run
  if (isCorrect(outcome)) {
    return { ...run, calls: run.calls + 1 }
  }
  const shots = run.shots - 1
  return {
    ...run,
    shots,
    wild: run.wild + (outcome === "wild" ? 1 : 0),
    slow: run.slow + (outcome === "slow" ? 1 : 0),
    over: shots <= 0,
  }
}

/** A press before the slate lit. It costs nothing and is never hidden. */
export function applyFlinch(run: Run): Run {
  if (run.over) return run
  return { ...run, flinches: run.flinches + 1 }
}

/** Witnesses currently standing. One per call, and it never goes back down. */
export function crowdOf(run: Run): number {
  return Math.min(CROWD_MAX, run.calls)
}

/**
 * Expected calls in a run at per-round accuracy `p`. Negative binomial: the
 * number of successes before the `shots`-th failure.
 *
 * Exported because it is the design claim, and a claim in a comment is not
 * checked. `run.test.ts` asserts the 0.5 case is 3 and that a simulated masher
 * lands on it.
 */
export function expectedCalls(p: number, shots: number = SHOTS): number {
  if (p >= 1) return Number.POSITIVE_INFINITY
  if (p <= 0) return 0
  return (shots * p) / (1 - p)
}
