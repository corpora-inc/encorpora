export const GRID = {
  leftX: -2,
  rightX: 2,
  topY: 2,
  midY: -0,
  bottomY: -2,
  z: 0.18,
} as const

export const SECTOR = {
  width: Math.abs(GRID.rightX - GRID.leftX) * 0.95,
  height: Math.abs(GRID.topY - GRID.midY) * 1.05,
} as const

export const ROAD = {
  width: 8.8,
  length: 90,
  segments: 50,
  speed: 20,
  curveAmount: 2,
  y: -3.0,
  zOffset: -10.0,
} as const

export const MOVE_SPEED = 25
export const PHRASE_START_Z = ROAD.length + ROAD.zOffset
export const PHRASE_END_Z = -12
export const PHRASE_HIT_Z = GRID.z
export const PHRASE_HIT_WINDOW = 0.25
export const LANE_ROWS = [GRID.topY, GRID.midY, GRID.bottomY] as const
export const LANE_COLS = [GRID.leftX, GRID.rightX] as const
