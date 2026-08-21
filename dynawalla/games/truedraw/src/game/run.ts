// The run: a bag of coins, and three shots to fill it with.
//
// There are two quantities and they do different jobs.
//
// **The bag** is the score, and it is what the founder asked for: correct keeps
// build it, a wrong keep or a wrong toss diminishes it. Its arithmetic lives in
// `bag.ts` and the single property that matters is `COIN_WRONG > COIN_MAX` — a
// coin flip loses coins, so the bag cannot be grown by mashing.
//
// **The shots** are the run's length, and they are unchanged. Three wrong verdicts
// and the street clears. This is the older half of the design and it is kept
// because it is the part that is violently non-linear in care:
//
//     expected calls = shots × p / (1 − p)
//
//        p = 0.50  (swipe at random)  →   3 calls
//        p = 0.75                     →   9 calls
//        p = 0.90                     →  27 calls
//        p = 0.97                     →  97 calls
//        p = 1.00                     →  no end
//
// A guesser therefore loses twice over: their bag drifts down at 2 coins a round
// AND their run is three calls long, so there is no arrangement of it that looks
// like doing well. Belt and braces, deliberately — the bag is a number a child
// might argue with and the empty street is not.
//
// A LAPSE COSTS NEITHER. A window that closed untouched is not a verdict: no
// coins, no shot. It is the one thing in the game that is free, and it is free
// because a child who was still working the hundreds column has not made a
// mistake. What it costs is the window, which is the most wall-clock any single
// round can spend — so per minute of play, waiting is the worst thing available to
// anybody who can read at all.
//
// Nothing here ever takes back a CALL. The bag can fall; the tally of correct
// calls, and therefore the crowd, only ever rises.

import { addCoins } from "./bag.ts"
import { isCorrect, isMiss, type Outcome } from "./response.ts"

/** Wrong verdicts a run survives. Three, as in the original. */
export const SHOTS = 3

/** Witnesses that can stand in the haze. Past this the crowd is a crowd. */
export const CROWD_MAX = 14

export type Run = {
  /** Shots left. At zero the street clears. */
  readonly shots: number
  /** Correct calls made. Never goes down. */
  readonly calls: number
  /** Coins in the bag. This is the score. It can go down; it floors at zero. */
  readonly bag: number
  /** Kept a false claim — banked a counterfeit. */
  readonly dud: number
  /** Tossed a true claim — threw money away. */
  readonly burn: number
  /** Windows that closed untouched. Counted, and charged for nothing. */
  readonly lapses: number
  /** Touched the slate before the statement was cut in. Ignored, counted anyway. */
  readonly flinches: number
  readonly over: boolean
}

export function newRun(): Run {
  return { shots: SHOTS, calls: 0, bag: 0, dud: 0, burn: 0, lapses: 0, flinches: 0, over: false }
}

/**
 * Settle one outcome, worth `coins`.
 *
 * `coins` is passed in rather than computed here because it depends on the item's
 * p50 and on how quick the call was, and neither is a property of the run.
 * `bag.ts` owns the price list; this owns the ledger.
 */
export function applyOutcome(run: Run, outcome: Outcome, coins: number): Run {
  if (run.over) return run
  const bag = addCoins(run.bag, coins)
  if (outcome === "lapse") {
    // Not a verdict. Not a miss. Not priced.
    return { ...run, bag, lapses: run.lapses + 1 }
  }
  if (isCorrect(outcome)) {
    return { ...run, bag, calls: run.calls + 1 }
  }
  const shots = run.shots - (isMiss(outcome) ? 1 : 0)
  return {
    ...run,
    bag,
    shots,
    dud: run.dud + (outcome === "dud" ? 1 : 0),
    burn: run.burn + (outcome === "burn" ? 1 : 0),
    over: shots <= 0,
  }
}

/** Touched the slate before there was anything on it. Costs nothing, never hidden. */
export function applyFlinch(run: Run): Run {
  if (run.over) return run
  return { ...run, flinches: run.flinches + 1 }
}

/** Witnesses standing. One per correct call, and it never goes back down. */
export function crowdOf(run: Run): number {
  return Math.min(CROWD_MAX, run.calls)
}

/**
 * Expected calls in a run at per-round accuracy `p`. Negative binomial: the
 * number of successes before the `shots`-th failure.
 *
 * Exported because it is the design claim, and a claim in a comment is not
 * checked. `run.test.ts` asserts the 0.5 case is 3 and that a simulated guesser
 * lands on it.
 */
export function expectedCalls(p: number, shots: number = SHOTS): number {
  if (p >= 1) return Number.POSITIVE_INFINITY
  if (p <= 0) return 0
  return (shots * p) / (1 - p)
}
