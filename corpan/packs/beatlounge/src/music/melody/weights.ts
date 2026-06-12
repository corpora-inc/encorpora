/**
 * beatlounge — the MELODY probability banks: metric-onset profiles + degree-
 * transition tables. Hand-tuned but generic music-theory weights (no song data);
 * these are the "specialized weights" that make endless generation feel musical.
 *
 * METRIC profiles answer WHEN: per-sixteenth onset weight within a 4/4 bar.
 * Position 0 is the downbeat. The rule the founder set: downbeats high, the
 * pre-downbeat 32nd ~0 — i.e. the &-of-4 / last sixteenth is suppressed so the
 * bar lands cleanly. Beats 1 & 3 (pos 0, 8) are strongest, then 2 & 4 (4, 12),
 * then the &s (even positions), then the weak 'e'/'a' sixteenths.
 *
 * TRANSITION tables answer WHICH next scale step, given the current degree class
 * (0 = tonic … 6 = leading tone, for a diatonic 7-set). Stepwise motion is
 * favored; chord tones (0/2/4) pull as resolutions; the leading tone (6) pulls
 * hard to the tonic. Rows need not be normalized — consumers normalize at use.
 */

import type { MetricProfile, TransitionTable } from "./types"

const BAR16 = 16

// =================================================================== metric
/**
 * Four-on-the-floor: the canonical pop/rock weighting. Beats strong, &s medium,
 * weak sixteenths light, the final sixteenth (pre-downbeat 32nd zone) near zero.
 */
const FOUR_ON_FLOOR: number[] = [
  1.0, 0.08, 0.34, 0.12, // beat 1 . e . a
  0.74, 0.08, 0.3, 0.12, // beat 2
  0.92, 0.08, 0.34, 0.12, // beat 3
  0.68, 0.1, 0.28, 0.02, // beat 4 — last sixteenth suppressed
]

/** Backbeat-leaning: emphasizes the &s and beats 2 & 4 (a snappier feel). */
const BACKBEAT: number[] = [
  0.9, 0.1, 0.46, 0.14,
  0.82, 0.12, 0.44, 0.16,
  0.86, 0.1, 0.46, 0.14,
  0.8, 0.14, 0.4, 0.03,
]

/** Ballad / sparse: strong downbeats only, very light elsewhere (long notes). */
const BALLAD: number[] = [
  1.0, 0.02, 0.16, 0.04,
  0.5, 0.02, 0.14, 0.04,
  0.84, 0.02, 0.16, 0.04,
  0.46, 0.03, 0.12, 0.01,
]

/** Busy sixteenths: an even, driving run with the downbeat still leading. */
const SIXTEENTHS: number[] = [
  1.0, 0.5, 0.64, 0.5,
  0.78, 0.5, 0.6, 0.5,
  0.9, 0.5, 0.64, 0.5,
  0.74, 0.5, 0.58, 0.18,
]

/** Syncopated: pushes onto the &-of-1 and &-of-3, anticipating the beat. */
const SYNCOPATED: number[] = [
  0.86, 0.12, 0.72, 0.2,
  0.5, 0.14, 0.66, 0.22,
  0.8, 0.12, 0.74, 0.2,
  0.48, 0.16, 0.6, 0.04,
]

/** Offbeat / upstroke: the eighth-note &s sing nearly as hard as the beats (a
 *  reggae/ska-leaning lilt) while the downbeat still leads. */
const OFFBEAT: number[] = [
  1.0, 0.1, 0.82, 0.12,
  0.84, 0.1, 0.8, 0.12,
  0.86, 0.1, 0.82, 0.12,
  0.82, 0.12, 0.74, 0.04,
]

/** Driving / motoric: all four beats pulse nearly equal over steady &s — a
 *  house/krautrock engine that never lets up (fuller than four-on-floor). */
const DRIVING: number[] = [
  1.0, 0.12, 0.5, 0.14,
  0.9, 0.12, 0.48, 0.14,
  0.92, 0.12, 0.5, 0.14,
  0.88, 0.14, 0.46, 0.05,
]

export const METRIC_PROFILES: readonly MetricProfile[] = Object.freeze(
  (
    [
      ["four-on-floor", FOUR_ON_FLOOR, ["pop", "rock", "straight"]],
      ["backbeat", BACKBEAT, ["pop", "snappy"]],
      ["ballad", BALLAD, ["sparse", "slow", "long-notes"]],
      ["sixteenths", SIXTEENTHS, ["busy", "driving", "run"]],
      ["syncopated", SYNCOPATED, ["syncopation", "anticipation"]],
      ["offbeat", OFFBEAT, ["reggae", "ska", "upbeat", "lilt"]],
      ["driving", DRIVING, ["motoric", "house", "krautrock", "pulse"]],
    ] as const
  ).map(([name, weights, tags]) =>
    Object.freeze({
      id: `metric:${name}`,
      barSixteenths: BAR16,
      weights: Object.freeze([...weights]) as unknown as number[],
      tags: Object.freeze([...tags]) as unknown as string[],
    })
  )
)

// =============================================================== transitions
/**
 * Stepwise (conjunct): the default singer's line — mostly neighbor motion, a
 * gentle pull home. Rows index the CURRENT degree class 0..6; columns the next.
 */
// prettier-ignore
const STEPWISE: number[][] = [
  //         to:  0     1     2     3     4     5     6
  /* 0 */        [0.18, 0.34, 0.16, 0.06, 0.14, 0.06, 0.06],
  /* 1 */        [0.36, 0.10, 0.34, 0.08, 0.06, 0.04, 0.02],
  /* 2 */        [0.18, 0.30, 0.10, 0.26, 0.10, 0.04, 0.02],
  /* 3 */        [0.08, 0.10, 0.30, 0.10, 0.30, 0.08, 0.04],
  /* 4 */        [0.22, 0.06, 0.12, 0.28, 0.10, 0.16, 0.06],
  /* 5 */        [0.10, 0.06, 0.06, 0.10, 0.34, 0.10, 0.24],
  /* 6 */        [0.52, 0.04, 0.04, 0.04, 0.12, 0.18, 0.06],
]

/**
 * Arpeggiac (disjunct): leans on chord tones 0/2/4, leaps freely between them,
 * passing tones lighter. A hornlike / triadic line.
 */
// prettier-ignore
const ARPEGGIAC: number[][] = [
  /* 0 */        [0.10, 0.08, 0.30, 0.06, 0.30, 0.06, 0.10],
  /* 1 */        [0.30, 0.06, 0.34, 0.04, 0.18, 0.04, 0.04],
  /* 2 */        [0.26, 0.08, 0.10, 0.10, 0.30, 0.08, 0.08],
  /* 3 */        [0.16, 0.06, 0.30, 0.06, 0.30, 0.06, 0.06],
  /* 4 */        [0.30, 0.04, 0.26, 0.06, 0.10, 0.10, 0.14],
  /* 5 */        [0.16, 0.04, 0.20, 0.06, 0.34, 0.06, 0.14],
  /* 6 */        [0.40, 0.04, 0.16, 0.04, 0.22, 0.08, 0.06],
]

/**
 * Pentatonic-pull: suppresses the 4th (deg 3) and 7th (deg 6) so a 7-note scale
 * sings its pentatonic core — the safest, most universal melodic feel.
 */
// prettier-ignore
const PENTATONIC: number[][] = [
  /* 0 */        [0.16, 0.34, 0.20, 0.02, 0.20, 0.06, 0.02],
  /* 1 */        [0.34, 0.12, 0.34, 0.02, 0.12, 0.04, 0.02],
  /* 2 */        [0.24, 0.30, 0.10, 0.02, 0.26, 0.06, 0.02],
  /* 3 */        [0.20, 0.20, 0.24, 0.02, 0.24, 0.08, 0.02],
  /* 4 */        [0.26, 0.10, 0.28, 0.02, 0.10, 0.22, 0.02],
  /* 5 */        [0.20, 0.06, 0.14, 0.02, 0.40, 0.10, 0.08],
  /* 6 */        [0.46, 0.04, 0.16, 0.02, 0.22, 0.08, 0.02],
]

/**
 * Descending (gravity): a falling line — each degree leans toward the step BELOW,
 * resolving downward (the leading tone still snaps up). A natural cadential drift.
 */
// prettier-ignore
const DESCENDING: number[][] = [
  //         to:  0     1     2     3     4     5     6
  /* 0 */        [0.16, 0.08, 0.08, 0.06, 0.12, 0.10, 0.40],
  /* 1 */        [0.50, 0.10, 0.12, 0.06, 0.08, 0.08, 0.06],
  /* 2 */        [0.18, 0.46, 0.10, 0.06, 0.10, 0.06, 0.04],
  /* 3 */        [0.10, 0.16, 0.44, 0.08, 0.10, 0.08, 0.04],
  /* 4 */        [0.20, 0.08, 0.14, 0.40, 0.08, 0.06, 0.04],
  /* 5 */        [0.12, 0.06, 0.08, 0.12, 0.46, 0.08, 0.08],
  /* 6 */        [0.14, 0.06, 0.06, 0.08, 0.12, 0.46, 0.08],
]

/**
 * Drone (modal / raga): the line orbits the tonic (0) and the fifth (4), forever
 * pulled back to them — a tonal-centre, sruti-box feel. Stays in register.
 */
// prettier-ignore
const DRONE: number[][] = [
  /* 0 */        [0.18, 0.18, 0.10, 0.04, 0.30, 0.06, 0.14],
  /* 1 */        [0.42, 0.12, 0.18, 0.04, 0.18, 0.04, 0.02],
  /* 2 */        [0.30, 0.22, 0.10, 0.06, 0.24, 0.06, 0.02],
  /* 3 */        [0.22, 0.08, 0.22, 0.08, 0.30, 0.06, 0.04],
  /* 4 */        [0.34, 0.10, 0.14, 0.04, 0.18, 0.10, 0.10],
  /* 5 */        [0.18, 0.06, 0.10, 0.06, 0.42, 0.10, 0.08],
  /* 6 */        [0.46, 0.04, 0.06, 0.04, 0.26, 0.08, 0.06],
]

/**
 * Wide (leaps / call): bold disjunct motion — big jumps between chord tones and
 * across the octave (high octaveBias). A hornlike, declamatory contour.
 */
// prettier-ignore
const WIDE: number[][] = [
  /* 0 */        [0.08, 0.06, 0.20, 0.06, 0.34, 0.06, 0.20],
  /* 1 */        [0.24, 0.06, 0.10, 0.06, 0.30, 0.08, 0.16],
  /* 2 */        [0.30, 0.06, 0.08, 0.06, 0.26, 0.06, 0.18],
  /* 3 */        [0.22, 0.06, 0.24, 0.06, 0.10, 0.10, 0.22],
  /* 4 */        [0.34, 0.08, 0.22, 0.06, 0.08, 0.06, 0.16],
  /* 5 */        [0.20, 0.10, 0.18, 0.08, 0.30, 0.06, 0.08],
  /* 6 */        [0.34, 0.08, 0.18, 0.06, 0.22, 0.08, 0.04],
]

export const TRANSITION_TABLES: readonly TransitionTable[] = Object.freeze(
  (
    [
      ["stepwise", STEPWISE, 0.1, ["conjunct", "singer", "smooth"]],
      ["arpeggiac", ARPEGGIAC, 0.18, ["disjunct", "triadic", "leaps"]],
      ["pentatonic", PENTATONIC, 0.12, ["pentatonic", "safe", "universal"]],
      ["descending", DESCENDING, 0.2, ["gravity", "falling", "cadential"]],
      ["drone", DRONE, 0.06, ["modal", "raga", "tonic-pull"]],
      ["wide", WIDE, 0.22, ["leaps", "disjunct", "call"]],
    ] as const
  ).map(([name, weights, octaveBias, tags]) =>
    Object.freeze({
      id: `transition:${name}`,
      scaleSize: 7,
      weights: Object.freeze(weights.map((r) => Object.freeze([...r]))) as unknown as number[][],
      octaveBias,
      tags: Object.freeze([...tags]) as unknown as string[],
    })
  )
)
