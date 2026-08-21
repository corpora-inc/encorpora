/**
 * Simulation state and the event vocabulary the juice layer listens to.
 *
 * The sim knows nothing about pixels, canvases, sound or haptics. It runs in
 * virtual units (the playfield is always 1000 wide) and emits events; `mount.ts`
 * turns those into shake, shards, sound and buzz. That split is what lets the
 * physics be unit-tested headlessly and the juice be tuned without fear.
 */
import type { Remix } from "./remix.ts";
import type { Rule } from "./rules.ts";
import type { Tile, Wave } from "./wall.ts";

export const VW = 1000;

export type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Scalar speed the ball is normalised back to after every deflection. */
  speed: number;
  alive: boolean;
  /** Resting on the paddle, waiting for a launch. */
  held: boolean;
  /** Ring buffer of past positions for the comet trail. */
  trail: Float32Array;
  trailN: number;
  /** Cosmetic squash: unit normal of the last impact + a 0..1 amount. */
  sqx: number;
  sqy: number;
  squash: number;
};

export type Bolt = { x: number; y: number; vy: number; alive: boolean; age: number };

export type PowerKind = "wide" | "laser" | "multi" | "slow";

export type Powers = {
  wide: number; // seconds remaining
  slow: number;
  laserShots: number;
};

export type ForgeShard = {
  text: string;
  correct: boolean;
  power: PowerKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 idle, 1 chosen-right, -1 chosen-wrong, 2 dimmed by someone else winning. */
  state: number;
  pop: number;
};

export type Forge = {
  open: boolean;
  /** Real seconds the beat has been open. */
  age: number;
  questionId: string;
  prompt: string;
  shards: ForgeShard[];
  /** >0 while the resolution animation plays before the beat closes. */
  resolving: number;
  /**
   * The reveal is up and waiting for a hand. Set only on a miss, and while it
   * is set nothing — no timer, no next frame, no `FORGE_TIMEOUT` — may close
   * the beat. See `chooseShard`.
   */
  held: boolean;
  /** `age` before which even the child's own input may not dismiss the reveal. */
  settleAt: number;
  outcome: "none" | "right" | "wrong";
};

export type Phase = "serve" | "play" | "fever" | "gameover";

export type SimEvent =
  | { t: "paddle"; x: number; y: number; offset: number }
  | { t: "wallbounce"; x: number; y: number; nx: number; ny: number }
  | { t: "masonry"; x: number; y: number; tile: Tile }
  | { t: "erode"; x: number; y: number; tile: Tile }
  | { t: "crack"; x: number; y: number; tile: Tile }
  | {
      t: "break";
      x: number;
      y: number;
      tile: Tile;
      combo: number;
      chain: number;
      value: number;
      /** The ball burned through instead of bouncing (see `MOLTEN_AT`). */
      pierce: boolean;
    }
  | { t: "star"; x: number; y: number }
  | { t: "molten"; x: number; y: number }
  | { t: "lost"; x: number }
  | { t: "clear"; waveIndex: number }
  | { t: "chargefull" }
  | { t: "power"; kind: PowerKind }
  | { t: "laser"; x: number; y: number }
  | { t: "gameover" }
  | { t: "danger" }
  /** A pane has been scheduled to fall back into an empty cell. */
  | { t: "reglaze"; x: number; y: number; tile: Tile }
  /** A stone tile has caught light and become a target. */
  | { t: "kindle"; x: number; y: number; tile: Tile }
  /** The window has taken a new swing. */
  | { t: "turn" };

export type Sim = {
  /** Virtual playfield height; width is always `VW`. */
  vh: number;

  seed: number;
  wave: Wave;
  rule: Rule;

  balls: Ball[];
  bolts: Bolt[];

  paddleX: number;
  paddleY: number;
  paddleW: number;
  paddleH: number;
  paddleVX: number;
  paddleSquash: number;
  /** Aim angle in radians while serving; -PI/2 is straight up. */
  aim: number;
  aimDir: number;

  /** Wall origin (top-left of cell 0,0) and cell size, in virtual units. */
  wallX: number;
  wallY: number;
  /**
   * Horizontal drift of the whole window, in virtual units.
   *
   * The twin of `descent`, and like it a property of the wall rather than of
   * any tile: one number added to every column's x. Bounded by
   * `MAX_SWAY_CELLS`, which is chosen so the swung wall still fits inside the
   * playfield with the tracery on.
   */
  sway: number;
  cellW: number;
  cellH: number;
  /** Grid lookup: row * cols + col -> tile index, or -1. */
  grid: Int32Array;

  beads: number;
  score: number;
  combo: number;
  comboTimer: number;
  best: number;
  cleared: number;
  broken: number;
  masonryHits: number;

  charge: number;
  chargeMax: number;
  powers: Powers;

  forge: Forge | null;

  /** The live-remix scheduler for the wave currently on screen. */
  remix: Remix;

  phase: Phase;
  /** Counts down during the fever/clear celebration. */
  feverT: number;
  /** Seconds since a guilty tile last broke — drives the anti-stall descent. */
  stall: number;
  descent: number;
  waveTime: number;
  runTime: number;
};
