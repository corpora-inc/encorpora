// The hall's perspective. Pure arithmetic, no canvas — which is what lets the
// projection be tested rather than eyeballed.
//
// The lattice is a fan of beams running from a vanishing point on the horizon
// down to evenly spaced feet along the floor. An automaton's position is
// `(column, t)` with `t` at 0 on the horizon and 1 on the floor, and the map
// from `t` to the screen is a real perspective divide rather than a lerp: a
// thing far up the lattice barely moves, then rushes the last third. That
// acceleration is the whole reason the descent has tension.

import {
  exitRect,
  helpRect,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"

export type Geom = {
  w: number
  h: number
  /**
   * The safe rectangle. The hall is built inside THIS, not inside `w × h`.
   *
   * LATTICE RUNNER declares `viewport-fit=cover`, which opts the document into
   * the notch, the rounded corners and the home indicator. A canvas cannot claw
   * that back — `env()` is a CSS value and `fillText` knows nothing about it —
   * so the floor plate's beam labels, which are the divisors the whole game is
   * played by, were being carved into the strip under the home indicator, and
   * in landscape the outermost beam's foot sat behind the notch.
   */
  area: Rect
  columns: number
  vpX: number
  horizonY: number
  floorY: number
  margin: number
  /** Where the beam labels are carved. Inside the safe area, by construction. */
  labelY: number
  /** The score and resonance block, clear of the host's exit control. */
  hud: Rect
  /** The anchor lamps: the RIGHTMOST lamp's centre, and the row's metrics. */
  anchors: { right: number; y: number; r: number; gap: number }
}

/** How deep the hall is. Bigger = more foreshortening near the horizon. */
const DEPTH = 6

/**
 * The insets `area` was cut from. `safeRect` is exactly this subtraction, so
 * inverting it is lossless and the hall can ask the shared module where the
 * host's two corners are without inventing a second source of truth.
 */
function insetsOf(w: number, h: number, area: Rect): Insets {
  return {
    top: area.y,
    left: area.x,
    right: Math.max(0, w - area.x - area.w),
    bottom: Math.max(0, h - area.y - area.h),
  }
}

/**
 * @param area the safe rectangle, from `safeRect(w, h)`. REQUIRED — optional
 * would mean a caller that forgets it still compiles and quietly draws the
 * lattice under the notch, discoverable only on a device.
 */
export function makeGeom(w: number, h: number, columns: number, area: Rect): Geom {
  const aw = Math.max(120, area.w)
  const ah = Math.max(120, area.h)
  const floorY = area.y + ah * 0.845

  // The host paints two 44px corners over every pack: exit top-left,
  // how-to-play top-right. The beams, the sky and the sparks run under them
  // freely and should — that is what `cover` is for. The score and the anchor
  // lamps may not: a child reads the score, and the anchors ARE the lives.
  const insets = insetsOf(w, h, area)
  const exit = exitRect(insets)
  const help = helpRect(w, insets)

  const r = 6
  const gap = 18

  return {
    w,
    h,
    area,
    columns: Math.max(1, columns),
    vpX: area.x + aw * 0.5,
    horizonY: area.y + ah * 0.155,
    floorY,
    // Wide enough that the outermost beam's label is never clipped.
    margin: Math.max(26, Math.min(aw * 0.11, 74)),
    labelY: floorY + (area.y + ah - floorY) * 0.5,
    // The score sits at 20 and the resonance line at 42 relative to this
    // block's top, so the block is 56 tall at the type sizes this clamps to.
    hud: { x: area.x + 14, y: exit.y + exit.h + 8, w: 170, h: 56 },
    anchors: { right: help.x + help.w - 4, y: help.y + help.h + 8 + r, r, gap },
  }
}

/** Where a beam meets the floor. `col` may be fractional — a mid-slide body. */
export function columnX(g: Geom, col: number): number {
  if (g.columns <= 1) return g.vpX
  const span = Math.max(1, g.area.w - g.margin * 2)
  return g.area.x + g.margin + (col / (g.columns - 1)) * span
}

/** The box the anchor lamps occupy, for `total` of them. */
export function anchorsRect(g: Geom, total: number): Rect {
  const { right, y, r, gap } = g.anchors
  const left = right - Math.max(0, total - 1) * gap
  return { x: left - r, y: y - r, w: (right + r) - (left - r), h: r * 2 }
}

/**
 * Screen position and size factor for `(col, t)`.
 *
 * `scale` is 1 at the floor and about 1/7 at the horizon, and it is the same
 * number the hull, its glyph and its shadow are all sized by — so an automaton
 * never changes proportion as it comes down, only size.
 */
export function project(g: Geom, col: number, t: number): { x: number; y: number; scale: number } {
  const clamped = Math.max(0, Math.min(1, t))
  const s = 1 / (1 + (1 - clamped) * DEPTH)
  const s0 = 1 / (1 + DEPTH)
  const p = (s - s0) / (1 - s0)
  return {
    x: g.vpX + (columnX(g, col) - g.vpX) * p,
    y: g.horizonY + (g.floorY - g.horizonY) * p,
    scale: s,
  }
}

/**
 * The column nearest a screen x at floor level — how a tap on the lower band
 * chooses a beam.
 */
export function columnAt(g: Geom, x: number): number {
  if (g.columns <= 1) return 0
  const span = Math.max(1, g.area.w - g.margin * 2)
  const raw = ((x - g.area.x - g.margin) / span) * (g.columns - 1)
  return Math.max(0, Math.min(g.columns - 1, Math.round(raw)))
}

/**
 * The hall the game actually runs at, for a viewport of `w` x `h`.
 *
 * The one entry point production uses, so a test that calls this is asserting
 * the lattice a child gets rather than a pure function fed hand-picked
 * arguments. `safeRect` reads zeros where there is nothing to measure, so in
 * node and on a device without insets this is the plain full-screen hall.
 */
export function geomForViewport(w: number, h: number, columns: number): Geom {
  return makeGeom(w, h, columns, safeRect(w, h))
}
