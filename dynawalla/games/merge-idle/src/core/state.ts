/**
 * The shape of a running game. Kept in one place so the renderer can read it
 * without importing the orchestrator, and the orchestrator can be tested
 * without importing a canvas.
 */

import type { Question } from '../contract.ts'
import type { Board } from './board.ts'
import type { Strain } from './ladder.ts'

export type Tier = 'low' | 'mid' | 'ultra'

export type Rect = { x: number; y: number; w: number; h: number }

export type Vent = {
  readonly id: number
  tier: number
  /** The live request. Null only in the single frame before the first draw. */
  q: Question | null
  /** The answer as an integer when it sits on the polyp ladder, else null. */
  answerValue: number | null
  /** Which ladder this vent seeds, so its own request is always buildable. */
  strain: Strain
  /** The rung this vent emits, always two doublings below what it is asking for. */
  emitValue: number
  /** performance.now() when the request went up — the latency we report. */
  askedAt: number
  /** Sigils shown when the answer is not a polyp value (shuffled, includes it). */
  chips: string[] | null
  /** ms until it emits again */
  emitMs: number
  /** timestamp until which it is cold after a choke */
  coldUntil: number
  /** timestamp after which the silhouette hint appears */
  hintAt: number
  /** render only */
  flash: number
  shake: number
  glow: number
  rect: Rect
}

export type DragState = {
  active: boolean
  /** board cell being dragged, or -1 when dragging a chip */
  cell: number
  /** chip index + vent id when dragging a sigil */
  chipVent: number
  chipIdx: number
  chipValue: number
  chipText: string
  pointerId: number
  x: number
  y: number
  /** smoothed position so the polyp trails the finger a little */
  sx: number
  sy: number
  grabDx: number
  grabDy: number
  /** cell the drop would land on, -1 for none */
  overCell: number
  /** vent the drop would feed, -1 for none */
  overVent: number
  /** true when overCell holds a matching value */
  wouldMerge: boolean
  startedAt: number
  moved: boolean
}

export type TideGate = {
  open: boolean
  /** 'offline' shows the away framing, 'swell' the in-session one */
  kind: 'offline' | 'swell'
  haul: number
  attempt: number
  q: Question | null
  askedAt: number
  /** index of the chip the child just got wrong, for the dim animation */
  wrongIdx: number
  chips: string[]
}

export type Toast = { text: string; life: number; max: number; danger: boolean }

export type State = {
  board: Board
  vents: Vent[]
  nextVentId: number

  essence: number
  /** integer shown; lerps up to `essence` so the counter always climbs */
  shown: number
  magnitude: number
  /** consecutive correct assays; drives the flow multiplier */
  correctRun: number
  flow: number

  ratePerSec: number
  baseStep: number
  bloom: number

  grows: number
  upwells: number
  overcharges: number

  crowded: boolean
  crowdedSince: number

  swellMs: number
  /** an uncollected swell drifting on screen, or null */
  swell: { x: number; y: number; vy: number; haul: number; life: number } | null

  tide: TideGate
  toasts: Toast[]

  elapsed: number
  assays: number
  merges: number
  bestValue: number

  drag: DragState
  /** value the child tapped to highlight; -1 for none */
  pinged: number
  pingMs: number

  tier: Tier
  reduceMotion: boolean
}

export function emptyDrag(): DragState {
  return {
    active: false,
    cell: -1,
    chipVent: -1,
    chipIdx: -1,
    chipValue: 0,
    chipText: '',
    pointerId: -1,
    x: 0,
    y: 0,
    sx: 0,
    sy: 0,
    grabDx: 0,
    grabDy: 0,
    overCell: -1,
    overVent: -1,
    wouldMerge: false,
    startedAt: 0,
    moved: false,
  }
}

export function emptyTide(): TideGate {
  return {
    open: false,
    kind: 'swell',
    haul: 0,
    attempt: 0,
    q: null,
    askedAt: 0,
    wrongIdx: -1,
    chips: [],
  }
}

/**
 * Quality tier. The mid-range tablet is the FLOOR, so `mid` is the default and
 * `low` only appears when the device tells us it is small. `ultra` is the
 * genuinely staggering one and is what a desktop or a modern iPad gets.
 */
export function detectTier(): Tier {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  const mem = (nav as unknown as { deviceMemory?: number })?.deviceMemory ?? 0
  const cores = nav?.hardwareConcurrency ?? 0
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const px = typeof window !== 'undefined' ? window.innerWidth * window.innerHeight * dpr * dpr : 0
  if ((mem > 0 && mem <= 2) || (cores > 0 && cores <= 4)) return 'low'
  if (cores >= 8 && px < 6_500_000) return 'ultra'
  if (mem >= 8) return 'ultra'
  return 'mid'
}

export type TierBudget = {
  particles: number
  snow: number
  bloomLayer: boolean
  blurPx: number
  burstScale: number
  caustics: boolean
  glowScale: number
}

export const BUDGET: Record<Tier, TierBudget> = {
  low: { particles: 240, snow: 26, bloomLayer: false, blurPx: 0, burstScale: 0.5, caustics: false, glowScale: 0.5 },
  mid: { particles: 700, snow: 60, bloomLayer: true, blurPx: 7, burstScale: 1, caustics: true, glowScale: 0.5 },
  ultra: { particles: 1500, snow: 130, bloomLayer: true, blurPx: 11, burstScale: 1.7, caustics: true, glowScale: 0.62 },
}
