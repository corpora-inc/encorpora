/**
 * The world: every pool, every counter, one object.
 *
 * Pools are allocated once at their configured ceiling and never grow. A husk,
 * a bullet and a particle are plain mutable records with an `active` flag —
 * there is no allocation and no garbage in a steady-state frame, which is the
 * difference between a solid 60 and a stutter every few seconds on a mid-range
 * tablet.
 */

import type { Host, Question } from "../contract.ts";
import type { AudioEngine } from "../audio/audio.ts";
import type { Camera } from "../core/camera.ts";
import type { Juice } from "../core/juice.ts";
import type { LineBatch } from "../render/draw.ts";
import type { Rng } from "../math/rng.ts";
import { MAX_BULLETS, MAX_HUSKS, MAX_PARTICLES } from "../core/config.ts";
import type { HudLayout } from "./hudLayout.ts";

/*
 * The three enumerations below are `as const` objects with a companion type
 * rather than `const enum`s.
 *
 * `const enum` needs a compiler to erase it, and this package's tests run under
 * Node's strip-only TypeScript, which refuses one outright — so a `const enum`
 * anywhere in the import graph makes the game itself untestable in process.
 * `game.ts` is exactly that import graph, and the opening of this game is the
 * thing most worth a test. The values are unchanged and every `Mode.Dying`
 * still reads the same at every call site.
 *
 * **What is lost, honestly.** A `const enum` is nominal; these are structural,
 * so `Mode` and `Phase` are both `0|1|2|3|4|5` to the checker and it would no
 * longer object to `world.phase = Mode.Dying`. No call site crosses them today.
 * They are also not `Object.freeze`d — `as const` is a compile-time promise, so
 * `Mode.Dying = 9` is a type error and not a runtime one.
 */

export const Mode = {
  Entering: 0,
  Formation: 1,
  Hostile: 2,
  Dying: 3,
  Orbit: 4,
  /** Attract mode only: sinks on its own, hurts nobody. */
  Drift: 5,
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

export type Husk = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  lane: number;
  row: number;
  label: string;
  guilty: boolean;
  hostile: boolean;
  hp: number;
  hitFlash: number;
  spin: number;
  spinV: number;
  tilt: number;
  tiltV: number;
  squash: number;
  age: number;
  mode: Mode;
  dieT: number;
  /** 1 = the numeral is hidden inside a closed shell. */
  shroud: number;
  fireCd: number;
  wob: number;
  orbit: number;
  orbitR: number;
  radius: number;
};

export type Bullet = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vy: number;
  vx: number;
  /** Enemy bolts travel down and hurt the ship. */
  enemy: boolean;
  age: number;
  prevY: number;
};

export const PKind = {
  Spark: 0,
  Shard: 1,
  Ember: 2,
} as const;
export type PKind = (typeof PKind)[keyof typeof PKind];

export type Particle = {
  active: boolean;
  kind: PKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
  rot: number;
  rotV: number;
  gravity: number;
};

export type Ring = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  r: number;
  rv: number;
  life: number;
  max: number;
  color: string;
  width: number;
};

export type Ship = {
  x: number;
  targetX: number;
  vx: number;
  fireCd: number;
  recoil: number;
  bank: number;
  invuln: number;
  alive: boolean;
  muzzle: number;
  /**
   * 0 while crossing the field, 1 once the ship has come to rest.
   *
   * It no longer gates anything. It used to BE the trigger — the gun fired by
   * itself from a standstill — and that is the whole reason a child who had
   * just opened the game was answering questions they had not chosen to answer.
   * What survives is the readout: the sight brightens and the brackets close as
   * the ship settles, so "my aim is steady" is still a shape on the glass.
   */
  settled: number;
};

export const Phase = {
  Title: 0,
  Wave: 1,
  Clear: 2,
  Breach: 3,
  SecondWind: 4,
  Over: 5,
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export type Boss = {
  active: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stage: number;
  flash: number;
  spin: number;
  shield: number;
  volleyCd: number;
  dying: number;
};

export type World = {
  host: Host;
  audio: AudioEngine;
  cam: Camera;
  juice: Juice;
  batch: LineBatch;
  rng: Rng;
  reduced: boolean;

  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
  /**
   * Where the readable things go, recomputed on every resize and on every
   * change of the safe-area insets. See `hudLayout.ts` — a canvas cannot read
   * `env()`, so this is the only thing that knows about the notch.
   */
  hud: HudLayout;

  husks: Husk[];
  bullets: Bullet[];
  particles: Particle[];
  rings: Ring[];
  ship: Ship;
  boss: Boss;

  motes: Float32Array;
  moteCount: number;

  phase: Phase;
  phaseT: number;
  time: number;

  wave: number;
  lives: number;
  score: number;
  displayScore: number;
  combo: number;
  bestCombo: number;
  best: number;
  focus: number;
  focusT: number;

  question: Question | null;
  /** Wall time the question was asked. Drives its entrance animation ONLY. */
  askedAt: number;

  /**
   * The only clock a child's answer is ever measured against.
   *
   * It advances when — and only when — the player could actually be acting on
   * the question in front of them: the run is in a wave, the trench is armed,
   * and no correction is being held. So the seconds spent looking at a
   * motionless opening, and the seconds spent reading a completed sum, are
   * billed to nobody.
   *
   * `world.time` cannot do this job: it drives every animation in the game and
   * has to keep running through both. Measuring latency on it made a child who
   * read carefully for thirty seconds and then answered in two look, to the
   * host's ladder and to this game's own speed bonus, like the slowest answer
   * in the session — which is the exact inversion of "speed is REWARDED, never
   * enforced".
   */
  answerClock: number;
  /** `answerClock` when the current question was asked. */
  answeredFrom: number;
  firstWrong: string | null;
  resolved: boolean;
  perfectWave: boolean;

  /**
   * False from the moment a run begins until the player's FIRST shot.
   *
   * While it is false the formation hangs where it was born and the trench
   * costs nothing at all. "The first time you jump in, you don't know what is
   * going on" — so the opening state of this game is *looking*, and the child
   * decides when it turns into playing. It is set by firing and by nothing
   * else, so a child who never touches the glass is never scored, never
   * hurried, and never wrong.
   */
  armed: boolean;

  /**
   * The completed sum, standing still, with no deadline on it.
   *
   * Raised on a miss and on a shell that crossed the line, never on a clean
   * answer — there is nothing to marinate on in a sum you just got right.
   * While it is up NOTHING in the trench advances: no descent, no swing, no
   * bullets, no collisions, no phase timer. It is taken down by the child's own
   * hand and by nothing else, which is `revealPlan`'s `holdMs: Infinity`.
   */
  revealPrompt: string | null;
  revealAnswer: string | null;
  /** Seconds left before the child's own input may take the reveal down. */
  revealSettle: number;
  /** Seconds the reveal has been up. Drives its fade-in only. */
  revealAge: number;

  /** One-shot: has this run already explained Deep Focus? */
  taughtFocus: boolean;
  /** Formation descent, world units per second. */
  descent: number;
  swingAmp: number;
  swingFreq: number;
  swingPhase: number;
  /** Current lateral offset of the whole formation. */
  swingPhaseX: number;
  formationY: number;
  usedSecondWind: boolean;

  /** Set by the game loop so entities can shoot without importing it. */
  fireBolt: (x: number, y: number) => void;
  /** Walks the pentatonic ladder so a thousand shots never sound the same. */
  shotStep: number;

  banner: string;
  bannerSub: string;
  bannerT: number;
  /** 0..1 — how close the nearest husk is to the gate. Drives the gate flare. */
  gateDanger: number;

  /** Rolling render statistics, surfaced to the QA overlay. */
  fpsSamples: number[];
  frameMs: number;
  quality: number;
  showStats: boolean;
  paused: boolean;
  /** True once a touch pointer has been seen — only changes prompt wording. */
  touch: boolean;
};

const husk = (): Husk => ({
  active: false,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  lane: 0,
  row: 0,
  label: "",
  guilty: false,
  hostile: false,
  hp: 1,
  hitFlash: 0,
  spin: 0,
  spinV: 0,
  tilt: 0,
  tiltV: 0,
  squash: 0,
  age: 0,
  mode: Mode.Entering,
  dieT: 0,
  shroud: 0,
  fireCd: 0,
  wob: 0,
  orbit: 0,
  orbitR: 0,
  radius: 13.5,
});

const bullet = (): Bullet => ({
  active: false,
  x: 0,
  y: 0,
  z: 0,
  vy: 0,
  vx: 0,
  enemy: false,
  age: 0,
  prevY: 0,
});

const particle = (): Particle => ({
  active: false,
  kind: PKind.Spark,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 0,
  max: 1,
  size: 1,
  color: "#fff",
  drag: 1,
  rot: 0,
  rotV: 0,
  gravity: 0,
});

const ring = (): Ring => ({
  active: false,
  x: 0,
  y: 0,
  z: 0,
  r: 0,
  rv: 0,
  life: 0,
  max: 1,
  color: "#fff",
  width: 2,
});

export function makePools(): Pick<World, "husks" | "bullets" | "particles" | "rings"> {
  return {
    husks: Array.from({ length: MAX_HUSKS }, husk),
    bullets: Array.from({ length: MAX_BULLETS }, bullet),
    particles: Array.from({ length: MAX_PARTICLES }, particle),
    rings: Array.from({ length: 24 }, ring),
  };
}

export function freeHusk(world: World): Husk | null {
  for (const h of world.husks) if (!h.active) return h;
  return null;
}

export function freeBullet(world: World): Bullet | null {
  for (const b of world.bullets) if (!b.active) return b;
  return null;
}
