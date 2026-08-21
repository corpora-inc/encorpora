// The shape the renderer reads. Kept in its own module so `draw.ts` and
// `forge.ts` share it without importing each other.

import type { Question } from "../contract.ts"
import type { Micro } from "../core/bigmath.ts"
import type { Economy } from "../core/economy.ts"
import type { Juice } from "../render/juice.ts"
import type { Particles } from "../render/particles.ts"
import type { Layout } from "./layout.ts"
import type { MarkRound } from "./marks.ts"

export type Mode = "play" | "seal" | "mark" | "quench" | "haul"

export type Slug = {
  label: string
  correct: boolean
  /** 0 at rest; 1 immediately after being struck. */
  hit: number
  /** 1 while collapsing after a wrong pick. */
  fade: number
  bob: number
}

export type FloatText = {
  x: number
  y: number
  vy: number
  life: number
  max: number
  text: string
  color: string
  size: number
}

export type Flyer = {
  x: number
  y: number
  x0: number
  y0: number
  x1: number
  y1: number
  t: number
  dur: number
  color: string
  size: number
}

export type Game = {
  layout: Layout
  economy: Economy
  juice: Juice
  particles: Particles
  mode: Mode

  /** Seconds of wall clock since mount — animation only, never economy. */
  clock: number
  reduced: boolean
  pointerFine: boolean

  // --- the anvil -----------------------------------------------------------
  q: Question
  slugs: Slug[]
  /** -1 when awaiting an answer, else the clock time of the strike. */
  struckAt: number
  struckIndex: number
  lastCorrect: boolean
  askedAt: number
  combo: number
  bestCombo: number
  hammer: number
  billetIn: number
  shatter: number

  // --- readout -------------------------------------------------------------
  oom: number
  stamp: number
  stampText: string
  /** Smoothed for the bar only; the digits themselves are never interpolated. */
  heatBar: number
  rateGhost: number

  // --- chain ---------------------------------------------------------------
  revealed: number
  rowIn: number[]
  rowPulse: number[]
  /** 0..1 while a station is held down; drives the repeat rate and its bar. */
  buyHeld: number
  heldRow: number

  // --- overlays ------------------------------------------------------------
  sealTier: number
  sealT: number
  mark: MarkRound | null
  /**
   * A mark is OWED, not yet cut. Queued behind the milestone punch so the two
   * big moments do not collide — and the round itself is built at the instant
   * the card opens rather than here, because the player keeps buying and the
   * stations keep producing during the wait, and a card cut a second early
   * prints a C the player no longer has.
   */
  pendingMark: boolean
  pendingMarkIn: number
  markT: number
  markPicked: number
  markGood: boolean
  quenchT: number
  quenchPhase: "confirm" | "steam" | "reignite"
  quenchGain: bigint
  /** Cached: `carbonFor` is an isqrt of a very large integer. Never per frame. */
  quenchReady: boolean
  quenchPreview: bigint
  haul: Micro
  haulSeconds: number
  haulDone: boolean

  // --- ephemera ------------------------------------------------------------
  floats: FloatText[]
  flyers: Flyer[]
  audioOn: boolean
  fps: number
  showFps: boolean
}
