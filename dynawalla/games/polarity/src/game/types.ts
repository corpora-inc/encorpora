import type { Question } from "../contract.ts";
import type { BK, EK } from "./constants.ts";

/**
 * Every entity is a pooled, monomorphic plain object. Pools never shrink and
 * nothing is allocated during a frame — the free list hands back the same
 * objects for the whole session, so V8 keeps one hidden class per pool and the
 * GC has nothing to collect while the player is dodging.
 */

export type Bullet = {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** signed value. Its SIGN is its polarity; 0 is neutral and always absorbable. */
  v: number;
  r: number;
  kind: BK;
  /** 0 = hostile, 1 = the player's */
  owner: number;
  rot: number;
  spin: number;
  age: number;
  life: number;
  /**
   * 1 = print `v` on this bullet, 0 = no numeral.
   *
   * The VALUE, not a tile: which tile prints it is settled at draw time by
   * `LabelBook`, so there is no way to spawn a bullet whose numeral the atlas
   * has no room for and no way for one to come out blank.
   */
  labelled: number;
  /** >0 = homing strength (darts) */
  homing: number;
  /** currently being sucked into the ship: 0..1 */
  pull: number;
  /** seal serial this orb belongs to, 0 = not a seal orb */
  seal: number;
  /** for seal orbs only */
  correct: number;
  dmg: number;
  wob: number;
  grow: number;
};

export type Enemy = {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: EK;
  pol: number;
  hp: number;
  maxHp: number;
  r: number;
  age: number;
  fireT: number;
  phase: number;
  rot: number;
  spin: number;
  hitFlash: number;
  seed: number;
  /** entry/hover choreography target */
  ax: number;
  ay: number;
  /** boss only: the core value the lock demands */
  lockWant: number;
  lockState: number;
  /** boss/bearer only: which seal serial it owns */
  seal: number;
  dying: number;
};

export type Particle = {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  size2: number;
  r: number;
  g: number;
  b: number;
  a: number;
  rot: number;
  spin: number;
  drag: number;
  /** 0 dot · 1 shard · 2 ring · 3 spark-line */
  kind: number;
};

export type FloatText = {
  live: boolean;
  x: number;
  y: number;
  vy: number;
  age: number;
  life: number;
  /** the number to print */
  value: number;
  size: number;
  r: number;
  g: number;
  b: number;
};

export type SealState = "idle" | "asking" | "won" | "lost";

export type Seal = {
  serial: number;
  state: SealState;
  q: Question | null;
  askedAt: number;
  /** what the player flew into, for the report */
  answered: string;
};

export type RunStats = {
  score: number;
  best: number;
  depth: number;
  absorbs: number;
  clutches: number;
  bestChain: number;
  asked: number;
  right: number;
  releases: number;
  perfects: number;
  overloads: number;
};

export type Phase = "title" | "play" | "dying" | "revive" | "over";
