// WHAT THE STREET DOES ABOUT IT — and the fact that it is never the same twice.
//
// The founder's playtest, verbatim: *"success/fail isn't cool and juicy, sort of
// lame... success and failure sounds need to be awesome and varied and so do the
// animations."*
//
// He is describing a pool of one. Every correct call played the same stamp and the
// same two notes; every spot played the same bow and the same three. The twentieth
// looked exactly like the first, which is the fastest way there is to teach a child
// that nothing they do matters.
//
// So each family is a POOL, and one is drawn per verdict from the run's seeded RNG.
//
// ── the two rules the pools obey ────────────────────────────────────────────
//
//   1. **The juice fires on the MATHS MOMENT.** Every celebration here is drawn
//      by a correct RETRIEVAL — a claim judged rightly — and by nothing else.
//      There is no flourish for a collision, a streak counter, a menu, or a
//      window opening. That is the whole reason it reinforces anything.
//
//   2. **A miss is not a punishment and is not a competing spectacle.** The three
//      miss variants are three ways of doing the same honest thing: COMPLETE THE
//      SUM in front of the child, in the accent, and hold it there long enough to
//      read. `games/stack` is the fleet's reference for this and it says it in one
//      line — "the equation simply COMPLETES ITSELF in the accent colour... the
//      truth, stated once, with no adjective attached to the child." Never red,
//      never the word WRONG, and never louder than a celebration:
//      `game/energy.ts` holds that against the real numbers.
//
// ── why the pick lives here and not in the renderer ─────────────────────────
//
// Because the sound and the picture must be ONE decision. A verdict draws a
// variant and a voice index together, once, at the moment it settles; `scene.ts`
// draws what it was handed and `audio.ts` plays what it was handed. Two
// independent picks would drift apart across a pause, a re-render or a reduced
// frame, and the child would get a bloom with a bank's chime under it.

import type { Rng } from "../core/rng.ts"
import { voiceCount } from "../audio/audio.ts"
import { isCorrect, isMiss, type Outcome } from "../game/response.ts"

/** How the street celebrates a correct call. */
export type CelebrationKind =
  /** Rings of brass leave the slate and open across the street. */
  | "ring"
  /** Spokes of cold light sweep out and fade — the slate was lit from behind. */
  | "rays"
  /** A handful of extra coins arcs on lofted paths, over the top of the bag. */
  | "shower"
  /** The lamps in the haze flare and motes rise off the crowd. */
  | "bloom"

/** How the slate completes the sum after a miss. */
export type MissKind =
  /** The wrong column rolls over into the right one, like a counter wheel. */
  | "settle"
  /** The claim dissolves and the true statement is re-cut in its place. */
  | "recut"
  /** The right value drops into the cell as the wrong one slides out below it. */
  | "drop"

export const CELEBRATIONS: readonly CelebrationKind[] = ["ring", "rays", "shower", "bloom"]
export const MISSES: readonly MissKind[] = ["settle", "recut", "drop"]

export type Flourish = {
  readonly outcome: Outcome
  readonly kind: CelebrationKind | MissKind
  /** Index into the outcome's voice pool in `audio.ts`. */
  readonly voice: number
  /** 0..1 of deterministic jitter, so one variant is not one frozen picture. */
  readonly spin: number
}

/**
 * The draw. One per settled verdict, and NEVER the same kind twice running.
 *
 * The no-repeat is the point rather than a polish item: a uniform draw from four
 * repeats immediately about a quarter of the time, and a child reads "it did the
 * same thing again" as "it did not notice". State is one field per family, which
 * is why this is a class and not a function.
 */
export class Flourishes {
  private readonly rng: Rng
  private lastCelebration: CelebrationKind | null = null
  private lastMiss: MissKind | null = null

  constructor(rng: Rng) {
    this.rng = rng
  }

  /**
   * What to draw and play for `outcome`, or null when the answer is nothing.
   *
   * `lapse` returns null and always will. A window that closed on a child who was
   * still working is not an event the street reacts to, in either direction.
   */
  next(outcome: Outcome): Flourish | null {
    const voices = voiceCount(outcome)
    if (voices === 0) return null
    const spin = this.rng.next()
    if (isCorrect(outcome)) {
      const kind = pickDifferent(CELEBRATIONS, this.lastCelebration, this.rng)
      this.lastCelebration = kind
      return { outcome, kind, voice: this.rng.int(0, voices - 1), spin }
    }
    if (!isMiss(outcome)) return null
    const kind = pickDifferent(MISSES, this.lastMiss, this.rng)
    this.lastMiss = kind
    return { outcome, kind, voice: this.rng.int(0, voices - 1), spin }
  }
}

/** Uniform over everything that is not `avoid`. Falls back if the pool is one deep. */
function pickDifferent<T>(pool: readonly T[], avoid: T | null, rng: Rng): T {
  const options = pool.filter((k) => k !== avoid)
  return rng.pick(options.length > 0 ? options : pool)
}

/**
 * What to draw for a verdict that arrived without a draw.
 *
 * It happens: a host pause across the settle, a resize that re-renders a held
 * frame, a `clear` phase re-entered after a resume. The alternative to a fallback
 * is a correct call that celebrates nothing, which is by a distance the worse
 * failure — the celebration IS the reinforcement, and a silent one teaches the
 * child that being right sometimes does not count.
 *
 * Fixed rather than drawn, because a fallback that consumed the RNG would make the
 * run's sequence depend on how many times the host happened to re-render.
 */
export function defaultFlourish(outcome: Outcome): Flourish | null {
  if (voiceCount(outcome) === 0) return null
  if (isCorrect(outcome)) {
    return { outcome, kind: outcome === "spot" ? "rays" : "ring", voice: 0, spin: 0.5 }
  }
  if (!isMiss(outcome)) return null
  return { outcome, kind: "settle", voice: 0, spin: 0.5 }
}
