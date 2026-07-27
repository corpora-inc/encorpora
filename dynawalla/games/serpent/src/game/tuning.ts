/**
 * Every number that decides how Serpent feels, in one file.
 *
 * The world is normalised: the arena starts at radius 1.0 and everything is
 * expressed as a fraction of it. One unit is multiplied by `scale` at draw time,
 * so the game plays identically on a 360px phone and a 27" monitor — the same
 * turn radius relative to the board, the same number of body lengths across.
 *
 * Times are seconds unless the name says ms.
 */

export const TUNE = {
  // ---- serpent -----------------------------------------------------------
  headRadius: 0.046,
  bodyRadius: 0.044,
  segmentSpacing: 0.018,
  pathResolution: 0.007,
  startSegments: 34,
  minSegments: 14,
  maxSegments: 150,
  /** Segments added per correct orb, and the rate the body actually catches up. */
  growPerCorrect: 5,
  shrinkPerWrong: 6,
  shrinkPerWall: 5,
  growRate: 34,

  baseSpeed: 0.42,
  speedPerDepth: 0.016,
  maxSpeed: 0.72,
  boostFactor: 1.85,
  boostDrain: 2.4,
  boostMinSegments: 16,

  turnRate: 5.1,
  boostTurnRate: 3.1,

  /** Body points nearer the head than this can never kill you. */
  neckSegments: 17,
  selfHitFactor: 0.55,

  // ---- arena -------------------------------------------------------------
  arenaStart: 1.0,
  arenaFloor: 0.62,
  arenaShrinkPerDepth: 0.03,
  arenaShrinkTime: 1.1,
  grazeBand: 0.075,
  grazeInterval: 0.22,

  // ---- orbs --------------------------------------------------------------
  orbRadius: 0.062,
  /**
   * You bite the *chamber*, not the halo. Measured: with the whole bell live,
   * a competent pilot swallowed 58 wrong orbs a minute against 17 right ones —
   * the field covered a quarter of the arena and could not be threaded. The
   * drawn creature stays big and readable; the mouthful is the dark middle,
   * which is exactly what the art already says.
   */
  orbCoreFactor: 0.62,
  headBiteFactor: 0.45,
  /**
   * The mouth is at the *front*. Biting from the head's centre meant brushing
   * an orb with your cheek ate it, so threading a dense field was impossible
   * and two thirds of everything swallowed was wrong. Offsetting the bite point
   * forward turns a side-swipe into a near miss, which is what it looks like.
   */
  biteOffset: 0.78,
  orbBaseCount: 10,
  orbPerDepth: 1,
  orbMaxCount: 20,
  goodBase: 3,
  goodMax: 5,
  orbDrift: 0.022,
  hunterFromDepth: 5,
  hunterChance: 0.22,
  hunterSpeed: 0.06,
  spawnClearance: 0.34,

  // ---- progression -------------------------------------------------------
  correctPerDepth: 9,
  comboMax: 9,
  shieldAtCombo: 6,

  // ---- juice (all measured; see README) -----------------------------------
  hitstopEatMs: 28,
  hitstopWrongMs: 110,
  hitstopWallMs: 95,
  hitstopShieldMs: 180,
  hitstopDeathMs: 260,

  traumaEat: 0.1,
  traumaWrong: 0.45,
  traumaWall: 0.55,
  traumaDepth: 0.25,
  traumaShield: 0.5,
  traumaDeath: 0.9,
  traumaDecay: 1.7,
  shakeMax: 0.055,

  punchEat: 0.035,
  punchWrong: 0.085,
  punchDepth: 0.05,
  punchDeath: 0.14,

  slowmoMutateTime: 0.9,
  slowmoMutateScale: 0.36,
  slowmoDeathTime: 1.25,
  slowmoDeathScale: 0.28,

  /** Photosensitivity: never more often than this, never brighter than this. */
  flashCooldown: 0.34,
  flashMaxAlpha: 0.22,

  particleCap: 900,
  particleCapReduced: 220,
  ringCap: 24,

  mutateTime: 0.9,
} as const;

export const COLORS = {
  deepTop: "#031a26",
  deepBottom: "#00070f",
  abyss: "#000308",
  serpent: "#4ff0d6",
  serpentDeep: "#0b5f74",
  serpentCore: "#d8fff8",
  lantern: "#9df6ff",
  good: "#ffd76a",
  goodDeep: "#c97b17",
  bad: "#c46bff",
  badDeep: "#4a1670",
  plankton: "#8fe9ff",
  rim: "#3fe4ff",
  rimHot: "#ff7a5c",
  ink: "#dff6ff",
} as const;

export const FONT_STACK = `ui-rounded, "SF Pro Rounded", "Avenir Next", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
