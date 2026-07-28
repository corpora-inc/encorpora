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

/** The lane's ceiling, whatever the viewport offers. The title, literally. */
export const LANE_CELLS = 96

/** Sixteen to a row, so six rows are the whole ninety-six. */
export const LANE_COLS = 16

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
  wall: Rect
  lane: Lane
  levers: Rect
  shear: Rect
  furnace: Rect
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function layout(w: number, h: number): Layout {
  const compact = Math.min(w, h) < 560
  const pad = clamp(Math.min(w, h) * 0.035, 10, 26)

  const wallH = clamp(h * (compact ? 0.26 : 0.28), 118, 240)
  const leverH = clamp(h * 0.13, 70, 118)

  const wall: Rect = { x: pad, y: pad, w: w - pad * 2, h: wallH }
  const levers: Rect = { x: pad, y: h - leverH - pad, w: w - pad * 2, h: leverH }

  const laneY = wall.y + wall.h + pad * 0.9
  const laneH = Math.max(80, levers.y - pad * 0.9 - laneY)
  const laneW = w - pad * 2

  // Sixteen cells to a row, six rows: ninety-six, which is the coil the game is
  // named for and exactly the lane it gets. Capping the columns rather than
  // filling the width is what makes the serpentine serpentine — a desktop lane
  // thirty cells wide would draw one long straight line and never turn.
  const pitch = clamp(Math.min(laneW / LANE_COLS, laneH / 6.2), 15, 44)
  const cols = Math.max(6, Math.min(LANE_COLS, Math.floor(laneW / pitch)))
  const rowPitch = clamp(laneH / 6, pitch * 1.15, pitch * 1.9)
  const rows = Math.max(2, Math.min(7, Math.floor(laneH / rowPitch)))

  const lane: Lane = {
    x: pad,
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

  return { w, h, compact, wall, lane, levers, shear, furnace }
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
