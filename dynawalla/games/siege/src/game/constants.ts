/**
 * Balance and palette. Everything a designer would want to tune lives here.
 *
 * Money, damage, armour and health are INTEGERS everywhere. Positions, speeds
 * and timers are floats — they are physics, not answers.
 */

/** Virtual board is a square; the view fit-contains it, so every device sees the same fight. */
export const BOARD = 1000;
export const GRID = 9;
export const CELL = BOARD / GRID;

export const CORE_MAX_HP = 20;

// -- palette: hot forge against cold obsidian --------------------------------
export const C = {
  void: "#0a0608",
  basalt: "#181114",
  basaltHi: "#241a1e",
  crack: "#4a2a20",
  crustDark: "#2a1210",
  lava0: "#ff4d12",
  lava1: "#ff9a2e",
  lava2: "#ffd06a",
  whiteHot: "#fff2d2",
  ember: "#ff8a2b",
  gold: "#ffcf5c",
  steel: "#c8b8a8",
  // enemies are cold on purpose — you never mistake theirs for yours
  obsidian: "#1d2430",
  obsidianHi: "#39465c",
  rime: "#8fb4d8",
  shield: "#6fe3ff",
  danger: "#ff3d2e",
  text: "#f6e9d8",
  dim: "#9b8878",
} as const;

// -- towers ------------------------------------------------------------------
export type TowerKind = "bolt" | "mortar" | "chain";

export type TowerSpec = {
  kind: TowerKind;
  name: string;
  cost: number;
  /** level-1 values; every level above is derived, so the curve is one number */
  dmg: number;
  rate: number; // shots per second
  range: number;
  splash?: number; // mortar only
  links?: number; // chain only
  blurb: string;
};

export const TOWERS: Record<TowerKind, TowerSpec> = {
  bolt: {
    kind: "bolt",
    name: "BOLT",
    cost: 22,
    dmg: 7,
    rate: 2.2,
    range: 215,
    blurb: "fast · single",
  },
  mortar: {
    kind: "mortar",
    name: "MORTAR",
    cost: 55,
    dmg: 26,
    rate: 0.62,
    range: 330,
    splash: 92,
    blurb: "slow · splash",
  },
  chain: {
    kind: "chain",
    name: "CHAIN",
    cost: 95,
    dmg: 18,
    rate: 1.05,
    range: 252,
    links: 3,
    blurb: "arcs · many",
  },
};

/**
 * Five levels, and each one has to be paid for with an answer. Twenty pads times
 * four upgrades is eighty problems the player *wants* to solve — which is the
 * whole trick: the maths is the thing standing between them and a bigger gun.
 */
export const MAX_LEVEL = 4;

const DMG_GROWTH = 1.85;
const RATE_GROWTH = 0.14;
const RANGE_GROWTH = 0.05;
const COST_GROWTH = 2.15;

export const towerDamage = (kind: TowerKind, level: number): number =>
  Math.round(TOWERS[kind].dmg * Math.pow(DMG_GROWTH, level));

export const towerRate = (kind: TowerKind, level: number): number =>
  TOWERS[kind].rate * (1 + RATE_GROWTH * level);

export const towerRange = (kind: TowerKind, level: number): number =>
  TOWERS[kind].range * (1 + RANGE_GROWTH * level);

export const towerSplash = (kind: TowerKind, level: number): number =>
  (TOWERS[kind].splash ?? 0) * (1 + 0.07 * level);

export const towerLinks = (kind: TowerKind, level: number): number =>
  TOWERS[kind].links ? (TOWERS[kind].links as number) + Math.floor(level / 2) : 1;

/** integer ember cost of the next level, or null at the top */
export const towerUpgradeCost = (kind: TowerKind, level: number): number | null =>
  level >= MAX_LEVEL ? null : Math.round(TOWERS[kind].cost * 1.9 * Math.pow(COST_GROWTH, level));

/** each link past the first deals this fraction, floored, never below 1 */
export const CHAIN_FALLOFF = 0.6;

// -- enemies -----------------------------------------------------------------
export type EnemyKind = "shard" | "runner" | "brute" | "splitter" | "warden" | "boss";

export type EnemySpec = {
  kind: EnemyKind;
  hp: number;
  speed: number; // board units per second
  armor: number; // flat reduction per hit, damage never below 1
  bounty: number; // embers
  radius: number;
  leak: number; // core damage on reaching the forge
  /** shielded: single-target fire is heavily blunted, splash and arcs are not */
  warded?: boolean;
  splits?: number;
};

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  shard: { kind: "shard", hp: 10, speed: 108, armor: 0, bounty: 2, radius: 21, leak: 1 },
  runner: { kind: "runner", hp: 7, speed: 208, armor: 0, bounty: 2, radius: 17, leak: 1 },
  brute: { kind: "brute", hp: 34, speed: 74, armor: 6, bounty: 5, radius: 32, leak: 2 },
  splitter: {
    kind: "splitter",
    hp: 22,
    speed: 96,
    armor: 1,
    bounty: 3,
    radius: 27,
    leak: 1,
    splits: 2,
  },
  warden: {
    kind: "warden",
    hp: 28,
    speed: 88,
    armor: 3,
    bounty: 6,
    radius: 27,
    leak: 2,
    warded: true,
  },
  boss: { kind: "boss", hp: 300, speed: 62, armor: 10, bounty: 60, radius: 62, leak: 8 },
};

/** damage a single-target shot lands on a warded enemy, as a percentage */
export const WARD_REDUCTION_PCT = 20;

// -- economy -----------------------------------------------------------------
export const START_EMBERS = 50;
/** embers for a correct answer: base + difficulty bonus, both integers */
export const EMBER_BASE = 6;
export const EMBER_DIFF_BONUS = 16;
/** the anvil stays dark this long after a wrong answer */
export const QUENCH_SECONDS = 1.15;
/** each correct answer adds this much overcharge, in percent */
export const OVERCHARGE_PER_ANSWER = 9;
export const OVERCHARGE_MAX = 100;
/** seconds you get to answer the overcharge problem */
export const OVERCHARGE_WINDOW = 7;
/** how far back along the path the shockwave throws survivors */
export const OVERCHARGE_KNOCKBACK = 150;
export const OVERCHARGE_STUN = 1.4;

// -- pacing ------------------------------------------------------------------
export const INTERMISSION = 7;
/** embers per unused intermission second when you call the wave early */
export const EARLY_CALL_BONUS = 4;

// -- juice dials (all in ms unless noted) ------------------------------------
export const JUICE = {
  hitstopMortar: 38,
  hitstopBigKill: 70,
  hitstopBoss: 95,
  hitstopOvercharge: 150,
  hitstopBreach: 60,
  traumaMortar: 0.15,
  traumaKill: 0.05,
  traumaBigKill: 0.24,
  traumaBoss: 0.62,
  traumaOvercharge: 1.0,
  traumaBreach: 0.4,
  punchKill: 0.018,
  punchBoss: 0.06,
  punchOvercharge: 0.09,
  slowmoOvercharge: 0.16,
  towerRecoil: 0.19, // scale added on fire
  towerRecoilMs: 120,
} as const;

/** hard particle ceiling; the pool never grows past it */
export const MAX_PARTICLES = 1100;
export const MAX_POPUPS = 90;
