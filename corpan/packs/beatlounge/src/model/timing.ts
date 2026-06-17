/**
 * beatlounge — timing math (pure, no audio, fully testable)
 *
 * Canonical resolution: PPQ = 960 ticks per quarter note.
 *
 * Why 960: the minimum resolution that lands every grid we must address on
 * an integer tick is LCM(1,2,3,4,6,8,12,16,32) = 96 (covers 16th-triplets,
 * 32nds and all dotted values). We scale ×10 to 960 for humanize/automation
 * sub-tick headroom AND lossless MIDI round-trip (960 is the Logic/Cubase
 * export PPQ). Ticks are integers in JSON — the resolution costs nothing.
 *
 * The TICK is the canonical address. "Steps" are a *view* derived from a
 * track's grid; an event's tick never changes when its track's grid changes.
 */

export const PPQ = 960 as const
export const TICKS_PER_BAR_4_4 = PPQ * 4 // 3840
export const MAX_BEATS = 128
export const MAX_LOOP_TICKS = MAX_BEATS * PPQ // 122_880

export type Tick = number

/** Allowed grid denominators (note value = 1/denominator of a whole note). */
export type GridDenominator = 1 | 2 | 4 | 8 | 16 | 32 | 64

export interface Grid {
  /** 16 ⇒ a sixteenth-note grid. */
  denominator: GridDenominator
  /** ×2/3 — triplet feel. */
  triplet?: boolean
  /** ×3/2 — dotted. */
  dotted?: boolean
}

export interface TimeSignature {
  numerator: number
  denominator: number
}

/**
 * Ticks spanned by one cell of `grid`.
 *
 *   base = PPQ * 4 / denominator        (a 1/denominator note in ticks)
 *   triplet → ×2/3 ; dotted → ×3/2
 *
 * Examples (PPQ 960): 1/4 → 960, 1/8 → 480, 1/16 → 240, 1/16T → 160,
 * 1/16. (dotted) → 360, 1/32 → 120. All integers by construction.
 */
export const gridTicks = (grid: Grid): Tick => {
  let t = (PPQ * 4) / grid.denominator
  if (grid.triplet) t = (t * 2) / 3
  if (grid.dotted) t = (t * 3) / 2
  // Guaranteed integer for every legal Grid at PPQ=960; round defensively.
  return Math.round(t)
}

/** Absolute tick for step index `step` on `grid`, measured from tick 0. */
export const tickForStep = (step: number, grid: Grid): Tick => step * gridTicks(grid)

/** Inverse of tickForStep: nearest step index for an absolute tick. */
export const stepForTick = (tick: Tick, grid: Grid): number =>
  Math.round(tick / gridTicks(grid))

/** Quantize an arbitrary tick to the nearest cell of `grid`. */
export const quantizeTick = (tick: Tick, grid: Grid): Tick => {
  const g = gridTicks(grid)
  return Math.round(tick / g) * g
}

/** How many whole cells of `grid` fit in a loop of `loopTicks`. */
export const stepsInLoop = (loopTicks: Tick, grid: Grid): number =>
  Math.floor(loopTicks / gridTicks(grid))

/** Seconds per tick at a given tempo. */
export const secondsPerTick = (bpm: number): number => 60 / (bpm * PPQ)

/** Ticks per bar for a time signature (denominator = note value of a beat). */
export const ticksPerBar = (sig: TimeSignature): Tick =>
  Math.round((PPQ * 4 * sig.numerator) / sig.denominator)

/**
 * Swing offset applied to the "off" cells of a swing grid, in ticks.
 *
 * Swing delays every other cell of `swingGrid` by up to half a cell.
 * `amount` ∈ [0, 1] where 0 = straight, ~0.66 = heavy shuffle (we clamp the
 * musical max to 0.66 at the caller). Returned value is signed-positive ticks
 * to ADD to an off-cell's start. Applied at dispatch time — never stored.
 */
export const swingOffsetTicks = (
  stepIndexOnSwingGrid: number,
  amount: number,
  swingGrid: Grid
): Tick => {
  if (amount <= 0) return 0
  const isOff = stepIndexOnSwingGrid % 2 === 1
  if (!isOff) return 0
  const half = gridTicks(swingGrid) / 2
  return Math.round(amount * half)
}

/** Clamp a loop length to the legal range and to a whole tick. */
export const clampLoopTicks = (ticks: Tick): Tick =>
  Math.max(PPQ, Math.min(MAX_LOOP_TICKS, Math.round(ticks)))

/** Wrap an absolute tick into [0, loopTicks). */
export const wrapTick = (tick: Tick, loopTicks: Tick): Tick => {
  if (loopTicks <= 0) return 0
  const m = tick % loopTicks
  return m < 0 ? m + loopTicks : m
}
