/**
 * What a shot MEANS — separated from where it goes, and tested on its own.
 *
 * `game.ts` states the law at the top of `pending`: a keep standing in the way is
 * scenery, because "anything else would punish correct arithmetic, which is the one
 * thing this game may never do." The wind used to do exactly that. From wave 3 the
 * landing was `dial + wind` while the aim caret, the numeral and the whole promise
 * of the game stood on `dial`, so a child who worked out 47 + 25 = 72 and dialled 72
 * watched her shot land somewhere else and was told she was wrong — and, worse, the
 * metre the wind chose was the string sent to the curriculum as her answer.
 *
 * Two rules now hold this together, and both are tested:
 *
 *   1. **The dial is the landing metre.** The crew aims upwind by exactly the
 *      crosswind, so the boulder is launched off-target and blown onto the number.
 *      The arc still visibly bends — the wind is real, it is drawn, it is on the
 *      chip — it simply no longer decides whether a child knows her sums.
 *   2. **The child's answer is the number on the dial.** Not the metre struck, not
 *      the value of whichever keep happened to be nearest, not a landing the wind
 *      moved. What she named is what is reported.
 */

import { solve, type Solved } from './ballistics.ts'
import type { Rng } from '../core/rng.ts'

/** Every wind `rollWind` can produce for a cap — the roll never yields 0. */
export function windValues(cap: number): number[] {
  const out: number[] = []
  for (let v = -cap; v <= cap; v++) if (v !== 0) out.push(v)
  return out
}

/** A crosswind for the wave. Never 0: a wind chip reading 0 lies about the mechanic. */
export function rollWind(cap: number, rng: Rng): number {
  if (!cap) return 0
  let v = 0
  while (v === 0) v = rng.int(-cap, cap)
  return v
}

/**
 * The shot that comes down on the metre the child dialled.
 *
 * `solve` lands at `power + wind`, so the power asked for is `dial − wind`: the
 * machine is laid off into the wind and the wind carries the boulder home. Both
 * terms are integers, so the landing is the dial exactly — not 71.98.
 */
export function aimShot(dialM: number, angleDeg: number, wind: number, h: number): Solved {
  // Never laid off past the launch point. A target nearer than the wind's push
  // would ask for a backwards throw, so the offset stops at 1 m of power and the
  // modelled bend gives instead — the LANDING is exact either way, which is the
  // part a child is marked on. Only reachable by dialling below the whole field.
  const power = Math.max(1, dialM - wind)
  return solve(power, angleDeg, dialM - power, h)
}

/**
 * Why the boulder stopped. `ram` is the one that is not an answer to anything: a
 * child who knocks the siege engine off her walls has said nothing about 47 + 25.
 */
export type ShotKind = 'tower' | 'ground' | 'wall' | 'ram'

export type ShotFacts = {
  /** the metre the child named */
  dial: number
  /** the metre the boulder came down on — must equal the dial */
  landing: number
  /** what the loaded boulder asked for */
  answer: number
  kind: ShotKind
}

export type Verdict = {
  /** false when this shot was not an attempt at the question at all */
  report: boolean
  /**
   * Right answer, and a shot that was an answer. A boulder the ram swallowed on
   * its way out is neither right nor wrong: it never reached a keep, so there is
   * nothing to celebrate and nothing to hold against her.
   */
  correct: boolean
  /** the string the host is given, and the only thing the curriculum judges */
  answered: string
}

export function verdictFor(f: ShotFacts): Verdict {
  if (f.landing !== f.dial) {
    // Unreachable while `aimShot` is what fires the boulder. If it ever happens,
    // something has put a term between the dial and the ground again, and a child
    // is about to be marked on it — so it is loud, and the dial still wins.
    console.error(
      `[trebuchet] the boulder landed at ${f.landing} but the dial said ${f.dial}; reporting the dial`,
    )
  }
  const answersTheQuestion = f.kind !== 'ram'
  return {
    report: answersTheQuestion,
    correct: answersTheQuestion && f.dial === f.answer,
    answered: String(f.dial),
  }
}
