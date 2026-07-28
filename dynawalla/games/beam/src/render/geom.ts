// The hall's perspective. Pure arithmetic, no canvas — which is what lets the
// projection be tested rather than eyeballed.
//
// The lattice is a fan of beams running from a vanishing point on the horizon
// down to evenly spaced feet along the floor. An automaton's position is
// `(column, t)` with `t` at 0 on the horizon and 1 on the floor, and the map
// from `t` to the screen is a real perspective divide rather than a lerp: a
// thing far up the lattice barely moves, then rushes the last third. That
// acceleration is the whole reason the descent has tension.

export type Geom = {
  w: number
  h: number
  columns: number
  vpX: number
  horizonY: number
  floorY: number
  margin: number
}

/** How deep the hall is. Bigger = more foreshortening near the horizon. */
const DEPTH = 6

export function makeGeom(w: number, h: number, columns: number): Geom {
  return {
    w,
    h,
    columns: Math.max(1, columns),
    vpX: w * 0.5,
    horizonY: h * 0.155,
    floorY: h * 0.845,
    // Wide enough that the outermost beam's label is never clipped.
    margin: Math.max(26, Math.min(w * 0.11, 74)),
  }
}

/** Where a beam meets the floor. `col` may be fractional — a mid-slide body. */
export function columnX(g: Geom, col: number): number {
  if (g.columns <= 1) return g.vpX
  const span = g.w - g.margin * 2
  return g.margin + (col / (g.columns - 1)) * span
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
  const span = g.w - g.margin * 2
  const raw = ((x - g.margin) / span) * (g.columns - 1)
  return Math.max(0, Math.min(g.columns - 1, Math.round(raw)))
}
