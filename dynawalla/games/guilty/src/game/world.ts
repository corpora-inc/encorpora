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

export const enum Mode {
  Entering = 0,
  Formation = 1,
  Hostile = 2,
  Dying = 3,
  Orbit = 4,
  /** Attract mode only: sinks on its own, hurts nobody. */
  Drift = 5,
}

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

export const enum PKind {
  Spark = 0,
  Shard = 1,
  Ember = 2,
}

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
   * The gun only fires from a standstill. That is the rule that makes a
   * fixed-position shooter with auto-fire *fair*: crossing the field to reach
   * the guilty number can never cost you an innocent, because you are not
   * shooting while you cross. It also gives the loop its rhythm — dash, settle,
   * fire — and it is taught entirely by the nose lighting up.
   */
  settled: number;
};

export const enum Phase {
  Title = 0,
  Wave = 1,
  Clear = 2,
  Breach = 3,
  SecondWind = 4,
  Over = 5,
}

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
  askedAt: number;
  firstWrong: string | null;
  resolved: boolean;
  perfectWave: boolean;
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
