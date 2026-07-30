/**
 * What a shot MEANS — separated from where it goes, and tested on its own.
 *
 * `game.ts` states the law at the top of `pending`: a keep standing in the way is
 * scenery, because "anything else would punish correct arithmetic, which is the one
 * thing this game may never do."
 *
 * ## The wind, and the two ways of getting it wrong
 *
 * **The original defect (fixed in #654).** The crosswind was a hidden term added
 * after the child committed: `landing = dial + wind`, while the aim caret, the
 * numeral and the whole promise of the game stood on `dial`. Nothing on the screen
 * told her the wind was going to move her boulder and nothing let her account for
 * it, so a child who worked out `47 + 25 = 72` and dialled 72 was scored wrong with
 * probability `1 − 1/cap` — 8/9 by wave 16 — and the metre the wind chose was sent
 * to the curriculum as her answer.
 *
 * **The fix that made the wind pointless (#654).** `aimShot` laid the machine off
 * into the crosswind, launching at `dial − wind`, so the boulder came down on the
 * metre she named whatever the wind did. Correct, and it left the wind decorative:
 * the arc bent, the chip read a number, and ignoring it was optimal. Measured over
 * 2,460 shots across waves 1–20, the wind moved the landing metre 0 times, changed
 * the verdict 0 times and changed the report 0 times — while a child who *did*
 * reason about it and aimed off herself was scored WRONG in 480 of 492 cases. The
 * game punished exactly the child who was thinking.
 *
 * ## What holds now
 *
 * The crew does not do the subtraction any more. The child does, and she is told
 * everything she needs to do it before she commits to anything:
 *
 *   1. **The wind is exact, stated, and fixed before the shot.** An integer number
 *      of metres, on the chip, rolled when the question appears and never touched
 *      again — not at release, not in flight, not at impact. So the metre the
 *      boulder will come down on is `dial + wind`, and she can work that out to the
 *      metre before she presses anything. There is nothing left in this game that a
 *      child could not have accounted for.
 *   2. **Her answer to the sum is `dial + wind`** — the metre she is claiming the
 *      keep stands at. That number, and not the dial, is what reaches the
 *      curriculum, because the dial is now deliberately a different number from her
 *      answer. It is computed from her own two inputs by integer addition, never
 *      read back off the physics; the landing is checked against it and a
 *      disagreement is logged loudly, with her claim still winning.
 *   3. **Below `WIND_FROM_D` there is no wind at all**, the cap is 0, and every
 *      formula above collapses to `claim = dial`. The beginner's game is the game
 *      it always was.
 */

import { solve, type Solved } from './ballistics.ts'
import type { Rng } from '../core/rng.ts'

/** Every wind `rollWind` can produce for a cap — the roll never yields 0. */
export function windValues(cap: number): number[] {
  const out: number[] = []
  for (let v = -cap; v <= cap; v++) if (v !== 0) out.push(v)
  return out
}

/** A crosswind for the shot. Never 0: a wind chip reading 0 lies about the mechanic. */
export function rollWind(cap: number, rng: Rng): number {
  if (!cap) return 0
  let v = 0
  while (v === 0) v = rng.int(-cap, cap)
  return v
}

/**
 * The shot the machine actually throws.
 *
 * `dialM` is the range wound onto the dial — where the boulder would land in still
 * air — and the wind carries it `wind` metres further on top of that. Both terms
 * are integers, so the landing metre is `dial + wind` exactly, not 71.98.
 *
 * There is no compensation in here any more. The physical shot is unchanged from
 * the one #654 fired: a child who wants to hit metre `A` in a wind of `w` dials
 * `A − w`, and this launches at power `A − w` — the same power the old `aimShot`
 * computed for her behind her back. The only thing that moved is which number she
 * turns and who does the subtraction.
 */
export function shotFor(dialM: number, angleDeg: number, wind: number, h: number): Solved {
  return solve(dialM, angleDeg, wind, h)
}

/**
 * Why the boulder stopped. `ram` is the one that is not an answer to anything: a
 * child who knocks the siege engine off her walls has said nothing about 47 + 25.
 */
export type ShotKind = 'tower' | 'ground' | 'wall' | 'ram'

export type ShotFacts = {
  /** the range wound onto the dial */
  dial: number
  /** the wind she was shown, frozen when she committed */
  wind: number
  /** the metre the boulder came down on — must equal `dial + wind` */
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
  /** the metre she named as the answer: `dial + wind` */
  claim: number
}

/**
 * The metre the child is claiming the keep stands at.
 *
 * Her answer to the sum, in one integer addition over the two numbers she had in
 * front of her: the dial she set and the wind she was shown. Nothing from the
 * simulation is in here, which is the point — the last time this game read the
 * ground to find out what a child had said, it reported the metre the wind chose.
 */
export const claimOf = (dial: number, wind: number): number => dial + wind

export function verdictFor(f: ShotFacts): Verdict {
  const claim = claimOf(f.dial, f.wind)
  if (f.landing !== claim) {
    // Unreachable while `shotFor` is what throws the boulder: `solve` returns
    // `R + wind` and this adds the same two integers. If it ever happens,
    // something has put a term between her arithmetic and the ground again, and a
    // child is about to be marked on it — so it is loud, and her claim still wins.
    console.error(
      `[trebuchet] the boulder landed at ${f.landing} but the dial said ${f.dial} in a wind of ` +
        `${f.wind}, which is ${claim}; reporting ${claim}`,
    )
  }
  const answersTheQuestion = f.kind !== 'ram'
  return {
    report: answersTheQuestion,
    correct: answersTheQuestion && claim === f.answer,
    answered: String(claim),
    claim,
  }
}
