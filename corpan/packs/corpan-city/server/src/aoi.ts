/**
 * aoi — spatial Area-of-Interest (interest management) for the presence room.
 *
 * The plaza is small today (240×240), but the spine is a BIG city map. Sending
 * EVERY player's deltas to EVERY client is O(N²) bandwidth and doesn't scale: a
 * thousand players in a city should each only hear about the handful actually
 * near them. AOI partitions the world into a uniform grid of square CELLS and
 * only lets a client "see" players in its own cell + a ring of neighbor cells.
 *
 * This module is pure geometry/bookkeeping — no Colyseus types. PlazaRoom wires
 * it to per-client `StateView`s (the Colyseus 0.16 mechanism that filters which
 * schema instances each client actually receives). Keeping the math here makes
 * it unit-testable headless (see qa/mp-aoi.mjs) and trivial to reason about.
 *
 * Cells are indexed by integer (col, row) derived from world (x, z) via floor.
 * The cell SIZE is configurable and conceptually matches the city's chunk grid:
 * one AOI cell ≈ one street block, so "see your block + the adjacent blocks".
 */

export interface AoiConfig {
  /**
   * Edge length of one square cell, in world units. Default 60 → a 240-wide
   * plaza is a 4×4 grid; a city block. Bigger = fewer cells, broader interest.
   */
  cellSize: number
  /**
   * Chebyshev neighbor radius (in cells) included in a player's AOI. `1` =
   * own cell + the 8 surrounding cells (a 3×3 window). `2` = a 5×5 window.
   * The window must be at least as wide as the client's view distance so an
   * avatar is already in-view before it's close enough to matter visually.
   */
  radius: number
}

export const DEFAULT_AOI: AoiConfig = { cellSize: 60, radius: 1 }

/** Stable string key for a cell coordinate (col,row) — used as a Map key. */
export type CellKey = string

export const cellKey = (col: number, row: number): CellKey => `${col}:${row}`

/**
 * Spatial hash grid: tracks which entities (by id) occupy each cell, and answers
 * "who is within my AOI window?" in O(occupants-in-window), not O(all-entities).
 *
 * Entities are identified by an opaque string id (the Colyseus sessionId). The
 * grid is unbounded in principle (negative coords are fine) — only occupied
 * cells consume memory, so an empty city costs nothing.
 */
export class AoiGrid {
  readonly cellSize: number
  readonly radius: number

  /** cellKey → set of entity ids currently in that cell. */
  private readonly cells = new Map<CellKey, Set<string>>()
  /** entity id → its current (col,row), so we can move/remove in O(1). */
  private readonly located = new Map<string, { col: number; row: number }>()

  constructor(config: Partial<AoiConfig> = {}) {
    this.cellSize = config.cellSize ?? DEFAULT_AOI.cellSize
    this.radius = config.radius ?? DEFAULT_AOI.radius
    if (this.cellSize <= 0) throw new Error("AOI cellSize must be > 0")
    if (this.radius < 0 || !Number.isInteger(this.radius))
      throw new Error("AOI radius must be a non-negative integer")
  }

  /** World (x, z) → cell column. */
  colOf(x: number): number {
    return Math.floor(x / this.cellSize)
  }
  /** World (x, z) → cell row. */
  rowOf(z: number): number {
    return Math.floor(z / this.cellSize)
  }

  /** The cell an entity is currently tracked in, or null if not tracked. */
  cellOf(id: string): { col: number; row: number } | null {
    return this.located.get(id) ?? null
  }

  /**
   * Place/move an entity at world (x, z). Returns whether its CELL changed
   * (the only event that can alter AOI membership — intra-cell moves don't).
   */
  set(id: string, x: number, z: number): { changed: boolean; col: number; row: number } {
    const col = this.colOf(x)
    const row = this.rowOf(z)
    const prev = this.located.get(id)
    if (prev && prev.col === col && prev.row === row) {
      return { changed: false, col, row }
    }
    if (prev) this.cellBucket(prev.col, prev.row, false)?.delete(id)
    this.cellBucket(col, row, true)!.add(id)
    this.located.set(id, { col, row })
    return { changed: true, col, row }
  }

  /** Stop tracking an entity (on leave). Safe to call for unknown ids. */
  remove(id: string): void {
    const prev = this.located.get(id)
    if (!prev) return
    const bucket = this.cellBucket(prev.col, prev.row, false)
    bucket?.delete(id)
    if (bucket && bucket.size === 0) this.cells.delete(cellKey(prev.col, prev.row))
    this.located.delete(id)
  }

  /**
   * Ids of every entity within `radius` cells of cell (col,row), INCLUDING any
   * entity in that center cell. The querying entity is included if it occupies
   * one of those cells — callers filter themselves out as needed.
   */
  queryWindow(col: number, row: number): Set<string> {
    const out = new Set<string>()
    for (let c = col - this.radius; c <= col + this.radius; c++) {
      for (let r = row - this.radius; r <= row + this.radius; r++) {
        const bucket = this.cells.get(cellKey(c, r))
        if (!bucket) continue
        for (const id of bucket) out.add(id)
      }
    }
    return out
  }

  /** Window around an entity's CURRENT cell. Empty set if untracked. */
  queryAround(id: string): Set<string> {
    const at = this.located.get(id)
    if (!at) return new Set()
    return this.queryWindow(at.col, at.row)
  }

  /**
   * Whether two cells are within AOI range of each other (Chebyshev ≤ radius).
   * Mutual by construction → "a sees b" ⇔ "b sees a", so memberships stay
   * symmetric and there are no one-sided ghosts.
   */
  inRange(a: { col: number; row: number }, b: { col: number; row: number }): boolean {
    return Math.abs(a.col - b.col) <= this.radius && Math.abs(a.row - b.row) <= this.radius
  }

  private cellBucket(col: number, row: number, create: boolean): Set<string> | undefined {
    const key = cellKey(col, row)
    let bucket = this.cells.get(key)
    if (!bucket && create) {
      bucket = new Set()
      this.cells.set(key, bucket)
    }
    return bucket
  }
}
