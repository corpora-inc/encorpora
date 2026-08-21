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
  /**
   * The length at which running into your own body starts to END a run.
   *
   * A child who has just picked the game up turns the way they turn in every
   * other game they own, the head comes round into its own flank at 34 segments,
   * and the run is over before they have read the condition once. That is being
   * punished by a rule you have not been taught, and the founder filed it as
   * "if I turn around he eats himself ... too hard".
   *
   * So until the serpent has grown — three correct answers, `startSegments +
   * 3 × growPerCorrect` — a self-hit is a BUMP: the head is turned off its own
   * flank with a thud and a moment of grace, and the dive carries on. The latch
   * is one-way for the whole run (`world.selfHitArmed`), so coughing length back
   * up cannot buy the grace a second time and a player cannot hover under it.
   */
  selfHitArmsAt: 49,

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
  /**
   * The opening field, and how it grows.
   *
   * `orbBaseCount` was 10 and the count was then multiplied by the board's AREA,
   * so the first screen of a dive on a tall phone carried about twenty numbers.
   * The founder: "why are there so many choices when I first start ... too hard
   * and crowded and frustrating for the starting density."
   *
   * Five to open, and the field grows only with `depth` — which is nine CORRECT
   * answers each, so it is demonstrated competence and never elapsed time and
   * never the size of the screen. A child who is finding it hard is never handed
   * a denser board for having been there a while.
   */
  orbBaseCount: 5,
  orbPerDepth: 2,
  orbMaxCount: 24,
  /**
   * How much of the field is edible, and the floor and ceiling on it.
   *
   * A share rather than a schedule, so the opening's five orbs and a deep dive's
   * twenty-four read the same way: about a third of what you can see is food.
   */
  goodShare: 0.32,
  goodBase: 2,
  goodMax: 7,
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
  hitstopBumpMs: 90,
  hitstopWrongMs: 110,
  hitstopWallMs: 95,
  hitstopShieldMs: 180,
  hitstopDeathMs: 260,

  traumaEat: 0.1,
  traumaWrong: 0.45,
  traumaWall: 0.55,
  traumaBump: 0.34,
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
