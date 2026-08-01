/**
 * One place for every tuned number. Field units: the playfield is always 100
 * wide; its height follows the container aspect, clamped so neither a phone nor
 * an ultrawide desktop gets an unplayable shape.
 */

export const HALF_W = 50;
export const MIN_HALF_H = 55;
export const MAX_HALF_H = 95;

// --- player -----------------------------------------------------------------
export const PLAYER = {
  /** the lethal dot — deliberately tiny and always drawn, danmaku-style */
  hit: 1.15,
  /** magnet reach for chaff and charge bullets (never for seal orbs) */
  absorb: 5.0,
  /** how hard the ship chases the pointer; half-life in seconds */
  chaseHalfLife: 0.055,
  /** keyboard accel / max speed in units per second */
  accel: 620,
  maxSpeed: 96,
  friction: 0.0006,
  fireEvery: 0.085,
  shotSpeed: 132,
  shotDamage: 1,
  /** shooting an enemy of the opposite polarity does this much extra */
  oppositeBonus: 2,
  shields: 3,
  invuln: 1.7,
  flipCooldown: 0.06,
  /** a flip inside this window that saves you from a bullet is a CLUTCH */
  clutchWindow: 0.16,
  clutchRadius: 4.2,
} as const;

// --- the core band ----------------------------------------------------------
export const CORE = {
  capBase: 20,
  capStep: 4,
  capMax: 60,
  /** the gauge starts warning here */
  warnAt: 0.74,
  ventStun: 0.5,
  dartSpeed: 118,
  dartDamage: 2,
  dartTurn: 7.5,
  dartLife: 2.6,
} as const;

// --- bullets ----------------------------------------------------------------
/**
 * Bullet kinds. A frozen object rather than a `const enum` so the game layer is
 * importable by `node --experimental-strip-types`, which refuses an enum — and
 * an untestable game layer is precisely where this pack's blank orbs and
 * corrupted reports lived.
 */
export const BK = {
  Chaff: 0,
  Charge: 1,
  Orb: 2,
  Shot: 3,
  Dart: 4,
  Lance: 5,
} as const;
export type BK = (typeof BK)[keyof typeof BK];

export const BULLET = {
  chaffR: 1.9,
  chargeR: 3.1,
  orbR: 5.4,
  shotR: 1.0,
  dartR: 1.35,
  lanceR: 2.5,
} as const;

/**
 * How wide a Seal Bearer scatters its four orbs, in playfield units.
 *
 * The lane a numeral is drawn in is a quarter of this, and it is the ONLY thing
 * that limits how long an answer POLARITY can print — not the atlas, which is a
 * resolution, and not the texture size, which the cell already sits under. Four
 * labels `BULLET.orbR * 1.35 * LABEL_ASPECT` wide have to fit here without
 * touching, and `core/labels.test.ts` asserts they do.
 *
 * It was `(HALF_W - 12) * 2`. The extra four units are what a ten-character
 * answer costs, and they are free: the outermost orb sits at three-eighths of
 * this from the centre — 31.5 rather than 28.5 — so its numeral's far edge lands
 * at 40 of the 50 units the field has, and the weave clamp at `HALF_W - r` is
 * nowhere near it.
 */
export const ORB_SPREAD = (HALF_W - 8) * 2;

/**
 * The lane geometry that keeps two answers from sitting on top of each other.
 *
 * The founder's screenshot is three orbs BUNCHED, each inside the others'
 * additive halos, and the reason was not the weave: it was that an orb never
 * reached the lane it was aimed at. `askQuestion` gave it `vx = (tx - e.x) *
 * 0.55` and `stepOrb` then decayed that velocity with a 0.4s half-life, so the
 * orb travelled `0.55 * 0.4 / ln 2 ≈ 0.317` of the way to `tx` and stopped.
 * Three orbs aimed at −28, 0 and +28 arrived at −8.9, 0 and +8.9 — nine units
 * apart, wearing numerals nineteen units wide.
 *
 * So the lane is a POSITION the orb eases to, and the weave happens about it:
 *
 *   - `ORB_LANE_EASE` is the half-life of that ease, and it is 0.1s because the
 *     arithmetic says so: adjacent lanes are 21 units apart at four orbs and a
 *     numeral is 19.4 wide, so the row is only clear of itself once the ease is
 *     92.2% of the way home — 3.68 half-lives. At 0.1s that is 0.37s, and
 *     `seal.test.ts` holds it under half a second. A numeral is read on the way
 *     down as well as at rest.
 *   - `ORB_SWAY` is how far the row drifts either side, and it is driven by the
 *     WORLD clock rather than each orb's own phase, so all of them sway
 *     together like a curtain and the distance between two lanes is exactly the
 *     lane width whatever the sway is doing. The weave is not sanded down to
 *     buy the separation — it is 5.5 units, the same amplitude as the vertical
 *     bob it plays against, and the separation is bought by the phase instead.
 *
 * The cap on `ORB_SWAY` is the field edge: the outermost lane of four sits at
 * `ORB_SPREAD * 3/8 = 31.5`, its numeral reaches 9.7 further at the widest, and
 * the field ends at 50 — so anything up to 8.8 keeps the whole row on the
 * glass. `core/labels.test.ts` holds both bounds.
 */
export const ORB_LANE_EASE = 0.1;
export const ORB_SWAY = 5.5;
export const ORB_SWAY_RATE = 1.0;

// --- enemies ----------------------------------------------------------------
/** Enemy kinds. Same shape and the same reason as `BK`. */
export const EK = {
  Mote: 0,
  Weaver: 1,
  Spinner: 2,
  Battery: 3,
  Lancer: 4,
  Bearer: 5,
  Warden: 6,
} as const;
export type EK = (typeof EK)[keyof typeof EK];

export type EnemySpec = {
  hp: number;
  r: number;
  score: number;
  /** contact damage to the player */
  ram: boolean;
};

export const ENEMY: Record<number, EnemySpec> = {
  [EK.Mote]: { hp: 2, r: 3.0, score: 40, ram: false },
  [EK.Weaver]: { hp: 5, r: 3.6, score: 90, ram: false },
  [EK.Spinner]: { hp: 8, r: 4.4, score: 150, ram: false },
  [EK.Battery]: { hp: 16, r: 5.6, score: 280, ram: false },
  [EK.Lancer]: { hp: 4, r: 3.2, score: 120, ram: true },
  [EK.Bearer]: { hp: 64, r: 9.5, score: 900, ram: false },
  [EK.Warden]: { hp: 210, r: 14, score: 3200, ram: false },
};

// --- pacing -----------------------------------------------------------------
export const PACE = {
  // There is no seconds-per-stratum. A stratum is a seal the child broke — see
  // `stratumOf` in sim.ts — because the clock is not something a child earns.
  firstBearer: 14,
  bearerEvery: 34,
  bearerEveryMin: 26,
  /** every Nth bearer is a Warden instead */
  wardenEvery: 3,
  spawnBase: 0.62,
  spawnPerLvl: 0.135,
  spawnMax: 3.3,
  speedPerLvl: 0.042,
  speedMax: 0.62,
} as const;

// --- palette (linear-ish sRGB triples, additive) ----------------------------
export const COL = {
  posCore: [1.0, 0.83, 0.34] as const,
  posEdge: [1.0, 0.45, 0.08] as const,
  posHot: [1.0, 0.97, 0.86] as const,
  negCore: [0.28, 0.88, 1.0] as const,
  negEdge: [0.42, 0.3, 1.0] as const,
  negHot: [0.83, 0.95, 1.0] as const,
  neutral: [0.75, 0.78, 0.86] as const,
  bad: [1.0, 0.24, 0.35] as const,
  gold: [1.0, 0.88, 0.5] as const,
} as const;

export const polColor = (p: number): readonly [number, number, number] =>
  p > 0 ? COL.posCore : p < 0 ? COL.negCore : COL.neutral;
export const polEdge = (p: number): readonly [number, number, number] =>
  p > 0 ? COL.posEdge : p < 0 ? COL.negEdge : COL.neutral;
export const polHot = (p: number): readonly [number, number, number] =>
  p > 0 ? COL.posHot : p < 0 ? COL.negHot : COL.neutral;

// --- scoring ----------------------------------------------------------------
export const SCORE = {
  absorb: 12,
  clutch: 400,
  sealCorrect: 1500,
  bearerKill: 2400,
  wardenLockExact: 6000,
  wardenLockNear: 1400,
} as const;
