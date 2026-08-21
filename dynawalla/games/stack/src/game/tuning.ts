/**
 * Every number that decides how MONUMENT feels, in one file.
 *
 * The whole game is a tug-of-war over ONE readable variable: the width of the
 * tower. Nothing is hidden. A player can always see how close to death they
 * are, because the tower is literally thin.
 */

import { SECOND_GRADE_FLOW, revealMs } from "../../../../packs/shared/game-pacing/index.ts";

export const T = {
  /** A slab is 1.0 × SLAB_H × 1.0 at full width. */
  SLAB_H: 0.42,
  START_W: 1.0,
  /** Skill can build a tower fatter than it started. */
  MAX_W: 1.22,
  /** Below this the monument is a needle and it goes over. */
  DEATH_W: 0.155,

  /** Half-width of the "perfect" window, in world units, at floor 0. */
  PERFECT_TOL0: 0.062,
  /** …and asymptotically, deep in a run. */
  PERFECT_TOL1: 0.03,
  TOL_FLOORS: 60,

  /** Perfect placement widens the current axis by this, plus a combo bonus. */
  GROW_BASE: 0.028,
  GROW_PER_COMBO: 0.011,
  GROW_MAX: 0.085,

  /** A correct value dropped badly: classic Stack decay (overlap only). */
  /** A wrong value: the overlap survives, then the slab shears again. */
  WRONG_SHEAR: 0.76,
  /** A complete miss: the slab explodes, the tower takes a hard bite, lives on. */
  MISS_KEEP: 0.62,

  /** Sweep travels this far past the tower edge on each side. */
  SWEEP_MARGIN: 0.72,
  SWEEP_SPEED0: 1.78, // world units / second
  SWEEP_SPEED_PER_FLOOR: 0.021,
  SWEEP_SPEED_MAX: 4.6,
  /** Held at each turnaround so the new value can be read. */
  HOLD_MS0: 185,
  HOLD_MS1: 85,
  HOLD_FLOORS: 55,

  /**
   * True values in a row that count as fluency, for the marinate beat.
   *
   * MONUMENT's `intensity`: a child who has just read eight sums correctly and
   * slipped on the ninth is at the top, and everybody else is at the calm end.
   * See `revealDwell`.
   */
  REVEAL_STREAK: 8,
  /**
   * The shortest the completed sum may be held, in seconds.
   *
   * `revealMs` goes to zero at the ceiling, and zero would take the sum down in
   * the same frame the stone cracked. Gavel's `MIN_REVEAL_MS` for the same
   * reason: the floor is the length of the beat, not a lesson.
   */
  REVEAL_MIN: 0.9,

  /** Faces the sliding block cycles through: answer + (n-1) mal-rule values. */
  SLOTS_MIN: 2,
  SLOTS_MAX: 4,
  SLOTS_FLOOR_STEP: 14, // +1 slot every N floors

  /** Fall from this height above the top slab. */
  DROP_H: 3.4,
  GRAVITY: 46,

  /** Tower sway. Perfects calm it; mistakes whip it. */
  SWAY_START_FLOOR: 12,
  SWAY_PER_FLOOR: 0.00085,
  SWAY_MAX: 0.075,
  SWAY_HZ_A: 0.31,
  SWAY_HZ_B: 0.47,
  SWAY_SHOCK_WRONG: 1.15,
  SWAY_SHOCK_MISS: 1.9,
  SWAY_CALM_PERFECT: 0.55, // multiplier applied to excitement
  SWAY_DECAY: 0.72, // per second

  /** A new stratum every N floors — a big moment often enough to chase. */
  STRATUM_FLOORS: 8,

  /** Difficulty handed to the host, 1..10. */
  DIFF_FLOORS_PER_STEP: 7,

  /** Feel. */
  HITSTOP_PLACE_MS: 38,
  HITSTOP_PERFECT_MS: 72,
  HITSTOP_WRONG_MS: 115,
  HITSTOP_MISS_MS: 150,
  HITSTOP_STRATUM_MS: 90,

  TRAUMA_PLACE: 0.24,
  TRAUMA_PERFECT: 0.34,
  TRAUMA_WRONG: 0.72,
  TRAUMA_MISS: 0.92,
  TRAUMA_COLLAPSE: 1.0,
  TRAUMA_DECAY: 1.75, // per second

  /** Camera. */
  CAM_SPRING: 118,
  CAM_DAMP: 19,
  CAM_KICK_PLACE: 0.13,
  CAM_KICK_WRONG: 0.42,

  /** Squash on landing, released by a spring. */
  SQUASH_PLACE: 0.74,
  SQUASH_PERFECT: 0.6,
  SQUASH_SPRING: 260,
  SQUASH_DAMP: 15,

  /** Hard flash-rate limits — children's product. */
  FLASH_MAX_ALPHA: 0.24,
  FLASH_MIN_GAP_MS: 260,
  FLASH_FADE_MS: 130,

  /** Revive ("shore it up") — math where an F2P game would show an ad. */
  REVIVE_WIDTH_FACTOR: 0.72,
} as const;

/** Linear 0→1 ramp over `floors`, clamped. */
export function ramp(floor: number, floors: number): number {
  return Math.max(0, Math.min(1, floor / floors));
}

export function perfectTol(floor: number): number {
  return T.PERFECT_TOL0 + (T.PERFECT_TOL1 - T.PERFECT_TOL0) * ramp(floor, T.TOL_FLOORS);
}

/**
 * How fast the stone sweeps, in world units a second.
 *
 * **A function of the floor and of nothing else.** It used to take a second
 * argument, `dither`, which the sim raised every three sweeps a child spent
 * thinking — up to 1.90×, so half a minute of honest work nearly doubled the
 * speed of the target. That parameter is gone rather than defaulted, so nothing
 * can pass it again by accident; `sim.test.ts` holds the line.
 */
export function sweepSpeed(floor: number): number {
  return Math.min(T.SWEEP_SPEED_MAX, T.SWEEP_SPEED0 * (1 + floor * T.SWEEP_SPEED_PER_FLOOR));
}

/**
 * How long the completed sum is held on the plate, in seconds, given the run of
 * true values the child was **carrying into** the drop that ended it.
 *
 * Not this game's curve: `packs/shared/game-pacing`'s, the one ARENA and THE
 * GAVEL already spend — `revealCalmMs × (1 − intensity)²`, patient at the calm
 * end and skipped at the top, "because being held for it would be a punishment
 * for being good". Floored, so the top gets a brief beat rather than none at all.
 *
 * 4.2 s from a standing start, 2.4 s on a run of two, 0.9 s from five up. It used
 * to be 0.85 s flat, for every child, in every state.
 *
 * **Why the streak, and not the floor or the clock.** Both of the obvious signals
 * are tenure, and tenure is the wrong thing to spend patience on. THE SPLIT tried
 * its director's escalation heat and it reached half its range twenty-five
 * seconds into a run, so a child still struggling in minute five got the floor.
 * MONUMENT's height is better — a tower only rises on a stone that was set — but
 * it is still one-way: measured, eleven wrong drops in a row took the reveal from
 * 4.20 s to 2.21 s, which is patience being withdrawn from exactly the child who
 * needed it. A streak is not one-way. It is zero for anybody who has just made
 * two mistakes, whatever they have built, and it is only high for somebody who
 * has just answered several in a row — which is the one state where blowing past
 * the sum is a reward rather than a loss.
 */
export function revealDwell(streak: number): number {
  const intensity = ramp(streak, T.REVEAL_STREAK);
  return Math.max(T.REVEAL_MIN, revealMs(SECOND_GRADE_FLOW, intensity) / 1000);
}

export function holdMs(floor: number): number {
  return T.HOLD_MS0 + (T.HOLD_MS1 - T.HOLD_MS0) * ramp(floor, T.HOLD_FLOORS);
}

export function slotsFor(floor: number): number {
  return Math.min(T.SLOTS_MAX, T.SLOTS_MIN + Math.floor(floor / T.SLOTS_FLOOR_STEP));
}

export function difficultyFor(floor: number): number {
  return Math.max(1, Math.min(10, 1 + Math.floor(floor / T.DIFF_FLOORS_PER_STEP)));
}

export function swayAmp(floor: number, excitement: number): number {
  if (floor < T.SWAY_START_FLOOR) return 0;
  const base = Math.min(T.SWAY_MAX, (floor - T.SWAY_START_FLOOR) * T.SWAY_PER_FLOOR);
  return base * (1 + excitement);
}
