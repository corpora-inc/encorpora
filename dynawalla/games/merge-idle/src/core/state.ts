/**
 * The shape of a running game. Kept in one place so the renderer can read it
 * without importing the orchestrator, and the orchestrator can be tested
 * without importing a canvas.
 *
 * ONE board, ONE target, ONE mouth. What used to be here and is not any more:
 * `vents[]`, `essence`, `shown`, `magnitude`, `correctRun`, `flow`, `ratePerSec`,
 * `upwells`, `overcharges`, `swell`, `swellMs` and the whole `TideGate` — a modal
 * with a prompt and four answer pills that was the second game on the same
 * screen. See `core/economy.ts` for the argument on each one.
 */

import type { Board } from './board.ts'
import type { Mouth } from './mouth.ts'
import type { Form } from './target.ts'

export type Tier = 'low' | 'mid' | 'ultra'

export type Rect = { x: number; y: number; w: number; h: number }

/**
 * The one number at the top, and everything about how it may be answered.
 *
 * `route` is a WITNESS, not a solution to be followed: it is the route that
 * existed when the target went up, kept so a test can assert reachability and so
 * the stocking knows what to emit. It is never shown to the child and the child is
 * never required to use it — any polyps that make the number are right.
 */
export type Target = {
  /** The number the child has to make. */
  readonly value: number
  readonly form: Form
  /** How many polyps the mouth will hold: 1..3 for a sum, exactly 2 otherwise. */
  readonly slots: number
  /** One way to make it, from the shelf as it stood when this went up. */
  readonly route: readonly number[]
  /**
   * The host item this target IS the answer to, or null.
   *
   * Null when the curriculum could not be talked into a number this board can
   * build (rare, and measured in `target.test.ts`). A null id means the child's
   * work is real but **nothing is reported** — an absence, which is honest,
   * rather than an attempt filed against an item they never saw.
   */
  readonly questionId: string | null
  /** The prompt the host authored, kept for the QA overlay only. */
  readonly hostPrompt: string
  /** `performance.now()` when it went up — the thinking time we report. */
  askedAt: number
  /** Render only: how long the target has been up, for the settle animation. */
  age: number
}

export type DragState = {
  active: boolean
  /** board cell being dragged, or -1 */
  cell: number
  /** index of the polyp in the MOUTH being dragged back out, or -1 */
  fedIdx: number
  /** the value under the finger, so the renderer never has to look it up */
  value: number
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
  /** true when the drop is over the mouth */
  overMouth: boolean
  /** true when overCell holds a matching value */
  wouldMerge: boolean
  startedAt: number
  moved: boolean
}

export type Toast = { text: string; life: number; max: number; danger: boolean }

export type State = {
  board: Board
  /** The live target. Null only in the single frame before the first ask. */
  target: Target | null
  mouth: Mouth

  /** Targets bloomed. The only progression number in the game. */
  depth: number
  /** How bright the water is, 0..1, derived from depth. */
  bloom: number
  /** The rung new polyps arrive on, derived from depth. */
  baseStep: number
  /** How many times the shelf has actually grown. */
  grows: number

  /** Values the reef still owes the shelf so the target stays buildable. */
  stock: number[]
  emitMs: number

  crowded: boolean
  toasts: Toast[]

  elapsed: number
  merges: number
  splits: number
  spills: number
  bestValue: number

  drag: DragState
  /** value the child tapped to highlight; -1 for none */
  pinged: number
  pingMs: number

  /** Render only: a decaying flash and shake on the mouth. */
  mouthFlash: number
  mouthShake: number
  /** Where the mouth is on the stage, in stage coordinates. */
  mouthRect: Rect

  tier: Tier
  reduceMotion: boolean
}

export function emptyDrag(): DragState {
  return {
    active: false,
    cell: -1,
    fedIdx: -1,
    value: 0,
    pointerId: -1,
    x: 0,
    y: 0,
    sx: 0,
    sy: 0,
    grabDx: 0,
    grabDy: 0,
    overCell: -1,
    overMouth: false,
    wouldMerge: false,
    startedAt: 0,
    moved: false,
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
