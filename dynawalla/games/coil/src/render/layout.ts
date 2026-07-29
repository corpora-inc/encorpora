// Where everything is. Pure geometry, no canvas, no state — so the lane's
// capacity, which is a *rule* (it is what slag takes away), is computed by a
// function a test can call.
//
// The lane is a serpentine: rows walked alternately left-to-right and
// right-to-left, which is the shape a centipede descends a screen in and the
// shape that fits the most links into a rectangle without ever crossing itself.
//
// **The lane holds ninety-six cells.** That is the coil the game is named for:
// a full lane is nine tens and six ones of brass, and every lump of slag takes
// two of them away for good until an exact cut smashes it.
//
// **The room is not the viewport.** Every game here declares `viewport-fit=cover`,
// so the canvas reaches under the notch and the home indicator, and the host
// floats two 44px controls over the top corners — exit on the left, how-to-play
// on the right. The alley's stone may bleed anywhere it likes; the carved
// problem, the levers and the links a child taps may not. Both facts arrive
// here as geometry: the safe rect as `area`, the two corners as an inset on the
// recess.

import {
  HOST_CONTROL,
  HOST_MARGIN,
  type Insets,
  safeInsets,
  safeRect,
} from "../../../../packs/shared/game-chrome/index.ts"

/** The lane's ceiling, whatever the viewport offers. The title, literally. */
export const LANE_CELLS = 96

/** Sixteen to a row, so six rows are the whole ninety-six. */
const LANE_COLS = 16

export type Rect = { x: number; y: number; w: number; h: number }

export type Lane = Rect & {
  rows: number
  cols: number
  /** Distance between two link centres along a row. */
  pitch: number
  rowPitch: number
  /** Radius the largest link is drawn at. */
  unit: number
  capacity: number
}

export type Layout = {
  w: number
  h: number
  /** Small screens get a tighter wall and one fewer lane row. */
  compact: boolean
  /** The stone plate. Decorative, and free to run under the host's corners. */
  wall: Rect
  /**
   * The carved problem, with the lit demand. This is the whole instruction of
   * the game, so it is the one rect that is inset away from the host's two
   * corners — see `CORNER`.
   */
  recess: Rect
  /** The brick courses along the foot of the wall. */
  courses: Rect
  lane: Lane
  levers: Rect
  shear: Rect
  furnace: Rect
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * How far in from either edge of the safe area the host's corner controls
 * reach, plus two pixels so nothing is decided on a knife edge.
 *
 * Insetting horizontally rather than reserving a band is deliberate: a 67px
 * strip off the top is a twelfth of a 568px phone, and reserving one broke SKY
 * LEDGER's own layout outright. Between the two corners a 320px phone still
 * leaves 212px of centre strip, which costs the recess a little type size and
 * costs the alley no height at all.
 */
const CORNER = HOST_MARGIN + HOST_CONTROL + 2

/**
 * Where everything is, inside `area`.
 *
 * `area` is the safe rectangle — `safeRect` from `packs/shared/game-chrome` —
 * and it is REQUIRED, deliberately. Made optional, a caller that forgets it
 * still compiles and quietly carves the problem under the notch, discoverable
 * only on a device with one. Required, forgetting it does not build.
 *
 * The full-bleed stone behind all of this is drawn straight onto the canvas by
 * the scene and is not laid out here; it is what a child must read or touch
 * that lives inside `area`.
 */
export function layout(w: number, h: number, area: Rect): Layout {
  const compact = Math.min(area.w, area.h) < 560
  const pad = clamp(Math.min(area.w, area.h) * 0.035, 10, 26)

  const wallH = clamp(area.h * (compact ? 0.26 : 0.28), 118, 240)
  const leverH = clamp(area.h * 0.13, 70, 118)

  const wall: Rect = { x: area.x + pad, y: area.y + pad, w: area.w - pad * 2, h: wallH }
  const levers: Rect = {
    x: area.x + pad,
    y: area.y + area.h - leverH - pad,
    w: area.w - pad * 2,
    h: leverH,
  }

  // The recess sits high in the wall, which is exactly where the host's exit
  // and how-to-play controls are, so it is squeezed between them. Nothing else
  // in the alley reaches that high.
  const clearL = area.x + CORNER
  const clearR = area.x + area.w - CORNER
  const recessL = Math.max(wall.x + wall.w * 0.045, clearL)
  const recessR = Math.min(wall.x + wall.w * 0.955, clearR)
  const recess: Rect = {
    x: recessL,
    y: wall.y + wall.h * 0.12,
    w: Math.max(60, recessR - recessL),
    h: wall.h * 0.52,
  }

  // The courses are low enough in the wall to clear the corners on their own —
  // the test says so at every viewport rather than this comment.
  const courses: Rect = {
    x: wall.x + wall.w * 0.045,
    y: wall.y + wall.h * 0.72,
    w: wall.w * 0.91,
    h: wall.h * 0.2,
  }

  const laneY = wall.y + wall.h + pad * 0.9
  const laneH = Math.max(80, levers.y - pad * 0.9 - laneY)
  const laneW = area.w - pad * 2

  // Sixteen cells to a row, six rows: ninety-six, which is the coil the game is
  // named for and exactly the lane it gets. Capping the columns rather than
  // filling the width is what makes the serpentine serpentine — a desktop lane
  // thirty cells wide would draw one long straight line and never turn.
  const pitch = clamp(Math.min(laneW / LANE_COLS, laneH / 6.2), 15, 44)
  const cols = Math.max(6, Math.min(LANE_COLS, Math.floor(laneW / pitch)))
  const rowPitch = clamp(laneH / 6, pitch * 1.15, pitch * 1.9)
  const rows = Math.max(2, Math.min(7, Math.floor(laneH / rowPitch)))

  const lane: Lane = {
    x: area.x + pad,
    y: laneY,
    w: laneW,
    h: laneH,
    rows,
    cols,
    pitch,
    rowPitch,
    unit: pitch * 0.44,
    capacity: Math.min(LANE_CELLS, rows * cols),
  }

  const leverW = clamp(levers.w * 0.34, 108, 220)
  const shear: Rect = {
    x: levers.x + levers.w - leverW,
    y: levers.y,
    w: leverW,
    h: levers.h,
  }
  const furnace: Rect = {
    x: levers.x,
    y: levers.y,
    w: clamp(levers.w * 0.26, 84, 168),
    h: levers.h,
  }

  return { w, h, compact, wall, recess, courses, lane, levers, shear, furnace }
}

/**
 * The layout the RENDERER uses, and the only one it may use.
 *
 * The insets are read here, once, rather than by every caller — which is what
 * makes the clearance test worth having: it exercises this function, the same
 * path `Scene.resize` takes, so it fails both when the corner inset goes and
 * when the safe area stops being plumbed through.
 */
export function viewLayout(w: number, h: number, insets: Insets = safeInsets()): Layout {
  return layout(w, h, safeRect(w, h, insets))
}

/**
 * The centre of lane cell `i`, and which way the coil is travelling through it.
 *
 * Odd rows run right-to-left, so consecutive cells are always adjacent and the
 * chain never jumps. `dir` is what the renderer rotates a link by, and what
 * makes the turn at the end of a row read as a turn rather than a teleport.
 */
export function cellAt(lane: Lane, i: number): { x: number; y: number; dir: 1 | -1 } {
  const index = Math.max(0, i)
  const row = Math.min(lane.rows - 1, Math.floor(index / lane.cols))
  const raw = index - row * lane.cols
  const col = row % 2 === 0 ? raw : lane.cols - 1 - raw
  const spanW = lane.pitch * lane.cols
  const left = lane.x + (lane.w - spanW) / 2 + lane.pitch / 2
  const spanH = lane.rowPitch * lane.rows
  const top = lane.y + (lane.h - spanH) / 2 + lane.rowPitch / 2
  return {
    x: left + col * lane.pitch,
    y: top + row * lane.rowPitch,
    dir: row % 2 === 0 ? 1 : -1,
  }
}

/** The cell nearest a point, or `-1` when the point is not on the lane. */
export function cellNear(lane: Lane, px: number, py: number, count: number): number {
  let best = -1
  let bestD = (lane.pitch * 0.95) ** 2
  for (let i = 0; i < count; i++) {
    const c = cellAt(lane, i)
    const d = (c.x - px) ** 2 + (c.y - py) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

export function inside(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}
