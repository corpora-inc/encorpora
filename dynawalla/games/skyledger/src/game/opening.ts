// THE OPENING — what a child who has never worked a ledger line walks into.
//
// The founder's report, verbatim, is the specification:
//
// > "sky ledger is pretty cool. but to start it needs to be Wayy slower. only
// > one problem to look at and maybe even a tutorial. only once the user has
// > proven they have the hang of it should we put more than one problem on the
// > board"
//
// ## What it opened with before
//
// Measured by driving the real `Game` against the stub host over sixty seeds,
// counting the ledger lines actually falling and readable — `state === "falling"
// && t > 0`, which is exactly what `mount.view` hands the renderer:
//
//   * **one** on the first frame, and then
//   * **two at 2.6 s, three at 5.2 s, four at 7.8 s**, every seed, because a
//     watch releases its whole set on a fixed 2.6-second gap and does not care
//     whether the child has finished the first one;
//   * **five inside the first minute**, because a watch of four that nobody
//     answered lands, and the next watch opens with five.
//
// A child who has never seen the astrolabe has, eight seconds in, four column
// sums in the air and one dial. That is the report.
//
// ## The ramp
//
// Six positions, indexed by **stars this child has ever marked correctly** —
// `game/seen.ts` remembers that across sittings, and `Game` keeps counting
// within one, so the board opens up during the sitting the child earns it in.
// It is a count of things they got RIGHT: not seconds elapsed, not watches
// survived, not a difficulty scalar. `LOGGED_AT` is the whole index.
//
//   0. **One ledger line.** One sum in the air at a time, falling at not much
//      over half the ordinary rate, with the child's own reading written into
//      the sum on the plate. The next star waits for the first to be gone.
//   1. Still one, a little quicker.
//   2. Two. The first time there is a choice of what to work.
//   3. Three.
//   4. Four, at the shipped descent. The written reading comes off.
//   5. and after: the game exactly as it shipped.
//
// Every quantity is **monotone in `step`** — `onBoard` non-decreasing, `fall`
// non-increasing, `reading` and the reveal non-increasing — and
// `opening.test.ts` asserts all four exhaustively rather than taking the table
// on trust. A child is never overtaken by their own progress.
//
// ## What this is NOT
//
// It is not a comprehension window and it does not add one. `fall` scales the
// descent SKY LEDGER has always had; nothing here reads a clock, a rate, a
// streak or an accuracy, and `openingAt` is a pure function of one integer that
// counts stars the child logged. The pacing audit's finding — seventeen games
// deriving the time-to-answer from the same constant that escalates the game —
// is why `fall` is a pure function of demonstrated competence and of nothing
// else: it does not move with the watch number, the chain, or the wall clock.

import { revealPlan, SECOND_GRADE_FLOW, type RevealPlan } from "../../../../packs/shared/game-pacing/index.ts"

/**
 * Steps that have a hand on them. `openingAt(5)` and everything above it is the
 * shipped game, so a test or a rig can say "a child who is past all this"
 * without knowing the table.
 */
export const CALM_STEPS = 5

export type Opening = {
  readonly step: number
  /**
   * The most ledger lines that may be in the air at once.
   *
   * `1` is the founder's one problem: a watch still holds four stars, but the
   * second waits until the first has bloomed, been shown or landed.
   * `Infinity` hands release back to the watch's own 2.6-second gap, which is
   * what the game has always done.
   */
  readonly onBoard: number
  /**
   * A multiplier on how long a star takes to reach the horizon. `1` is the
   * shipped descent.
   */
  readonly fall: number
  /**
   * Whether the sighted star's plate is written out as a whole sentence —
   * `247 + 225 = 74` — with the right-hand side being the child's OWN reading
   * off the astrolabe, live.
   *
   * This is the entire tutorial, and it is arithmetic rather than prose: it
   * says *what the two rings are for* by showing the number they are producing
   * standing where the answer goes. It reveals nothing — the value is the
   * child's, not the star's — and it adds no string to translate.
   */
  readonly reading: boolean
  /**
   * What `revealPlan` is asked about at this step. Climbs across the calm steps
   * and lands on 1 at the shipped game.
   *
   * The top calm value is 0.6 and that is not free choice: `revealShown` draws
   * its own line at 250 ms, which on `SECOND_GRADE_FLOW`'s numbers and the
   * `steep` curve `revealMs` reads them through falls at intensity ≈0.756. Every
   * calm step therefore sits above the line with room, and the shipped game sits
   * below it and shows nothing.
   */
  readonly intensity: number
}

const CALM: readonly Omit<Opening, "step">[] = [
  { onBoard: 1, fall: 1.7, reading: true, intensity: 0 },
  { onBoard: 1, fall: 1.5, reading: true, intensity: 0.15 },
  { onBoard: 2, fall: 1.3, reading: true, intensity: 0.3 },
  { onBoard: 3, fall: 1.15, reading: true, intensity: 0.45 },
  { onBoard: 4, fall: 1, reading: false, intensity: 0.6 },
]

const STEADY: Omit<Opening, "step"> = {
  onBoard: Number.POSITIVE_INFINITY,
  fall: 1,
  reading: false,
  intensity: 1,
}

/**
 * Stars logged at which each step begins.
 *
 * Achievement, not wall clock: a child who sits and watches four stars land
 * stays at step 0 forever, and a child who marks three correctly is at step 2
 * whether that took them thirty seconds or three sittings.
 */
export const LOGGED_AT: readonly number[] = [0, 1, 3, 6, 10, 15]

/** How many stars a child has to have logged before the ramp is behind them. */
export const LOGGED_PAST_CALM = LOGGED_AT[CALM_STEPS] as number

/** The step a child who has logged `logged` stars, ever, stands at. */
export function stepFor(logged: number): number {
  const n = Number.isFinite(logged) ? Math.max(0, Math.floor(logged)) : 0
  let step = 0
  for (let i = 0; i < LOGGED_AT.length; i++) {
    if (n >= (LOGGED_AT[i] as number)) step = i
  }
  return step
}

/** The opening at `step`. Pure, total, defined for every number. */
export function openingAt(step: number): Opening {
  const at = Number.isFinite(step) ? Math.max(0, Math.floor(step)) : 0
  const row = at < CALM.length ? (CALM[at] as Omit<Opening, "step">) : STEADY
  return { step: at, ...row }
}

/**
 * What to do with a sum this opening has just completed for the child.
 *
 * `holdMs` is `Infinity` at every calm step — nothing but the child's own hand
 * takes a reveal down — and `0` at the shipped game, where there is no reveal at
 * all. The decision is `packs/shared/game-pacing`'s, not this module's; all this
 * does is hand it the intensity.
 */
export function revealFor(opening: Opening): RevealPlan {
  return revealPlan(SECOND_GRADE_FLOW, opening.intensity)
}
