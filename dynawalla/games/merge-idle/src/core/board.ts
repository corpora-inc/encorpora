/**
 * The reef shelf: a pure grid model. No canvas, no DOM, no time.
 *
 * Everything that decides *what happened* lives here so it can be tested
 * without a browser. Everything that decides *what it looks like* lives in
 * render/ and fx/ and may never write back into this file's state.
 */

import { canSplit, decompose, onLadder, rank } from './ladder.ts'
import type { Rng } from './rng.ts'

export type Polyp = {
  readonly id: number
  value: number
  /** index into `cells` */
  cell: number
  /** seconds since it appeared — drives the breathing wobble, render only */
  age: number
  /** 0..1 pop-in easing, render only */
  born: number
  /** render-only squash impulse, decays */
  squash: number
  /** phase offset so a board of polyps never pulses in lockstep */
  phase: number
}

export type Board = {
  cols: number
  rows: number
  /** row-major, length cols*rows */
  cells: Array<Polyp | null>
  nextId: number
}

export function makeBoard(cols: number, rows: number): Board {
  return { cols, rows, cells: new Array(cols * rows).fill(null), nextId: 1 }
}

export function idx(b: Board, cx: number, cy: number): number {
  return cy * b.cols + cx
}

export function coords(b: Board, i: number): { cx: number; cy: number } {
  return { cx: i % b.cols, cy: Math.floor(i / b.cols) }
}

export function inBounds(b: Board, cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < b.cols && cy < b.rows
}

export function at(b: Board, i: number): Polyp | null {
  return b.cells[i] ?? null
}

export function emptyCells(b: Board): number[] {
  const out: number[] = []
  for (let i = 0; i < b.cells.length; i++) if (!b.cells[i]) out.push(i)
  return out
}

export function polyps(b: Board): Polyp[] {
  const out: Polyp[] = []
  for (const c of b.cells) if (c) out.push(c)
  return out
}

export function countOf(b: Board, value: number): number {
  let n = 0
  for (const c of b.cells) if (c && c.value === value) n++
  return n
}

/** Place a new polyp in a specific empty cell. Returns null if occupied. */
export function place(b: Board, cell: number, value: number, phase = 0): Polyp | null {
  if (cell < 0 || cell >= b.cells.length) return null
  if (b.cells[cell]) return null
  if (!onLadder(value)) return null
  const p: Polyp = { id: b.nextId++, value, cell, age: 0, born: 0, squash: 0, phase }
  b.cells[cell] = p
  return p
}

/**
 * Spawn into a free cell. Prefers a cell ADJACENT to a matching value so the
 * board keeps offering merges instead of scattering — the single biggest
 * difference between a merge board that feels generous and one that feels mean.
 */
export function spawn(b: Board, value: number, rng: Rng): Polyp | null {
  const free = emptyCells(b)
  if (free.length === 0) return null
  const adjacentToMatch: number[] = []
  for (const cell of free) {
    const { cx, cy } = coords(b, cell)
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx
      const ny = cy + dy
      if (!inBounds(b, nx, ny)) continue
      const n = b.cells[idx(b, nx, ny)]
      if (n && n.value === value) {
        adjacentToMatch.push(cell)
        break
      }
    }
  }
  const pool = adjacentToMatch.length > 0 && rng.chance(3, 4) ? adjacentToMatch : free
  return place(b, rng.pick(pool), value, rng.int(0, 999) / 1000)
}

const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/** Move a polyp to an empty cell. Returns false if illegal. */
export function move(b: Board, from: number, to: number): boolean {
  const p = b.cells[from]
  if (!p || from === to) return false
  if (to < 0 || to >= b.cells.length) return false
  if (b.cells[to]) return false
  b.cells[from] = null
  b.cells[to] = p
  p.cell = to
  return true
}

export type MergeResult = { merged: Polyp; from: number; value: number; rank: number }

/**
 * Merge `from` onto `to`. Legal only when both hold the SAME value — and then
 * the result is their sum, which is exactly double. This is the whole game.
 *
 * The surviving polyp sits in `to` (where the finger let go), which is what
 * makes a chain of merges feel like it follows your hand.
 */
export function tryMerge(b: Board, from: number, to: number): MergeResult | null {
  if (from === to) return null
  const a = b.cells[from]
  const t = b.cells[to]
  if (!a || !t) return null
  if (a.value !== t.value) return null
  const sum = a.value + t.value
  if (!onLadder(sum)) return null // top of the ladder: refuse rather than corrupt
  b.cells[from] = null
  t.value = sum
  t.squash = 1
  t.age = 0
  return { merged: t, from, value: sum, rank: rank(sum) }
}

export type SplitResult = { kept: Polyp; made: Polyp; value: number }

/**
 * SPLIT — a polyp halves into two of itself. The merge run backwards.
 *
 * Legal only when the value is not a seed (3 does not halve; 12 halves into two
 * 6s) and only when there is a free cell to put the second half in. Both
 * refusals are honest arithmetic a child meets with their hands rather than a
 * rule they have to be told, and neither costs them anything.
 *
 * This is what makes an exact target reachable when the shelf is one odd polyp
 * short: `23 = 16 + 7` needs a 7, and a shelf holding a 14 has one.
 */
export function trySplit(b: Board, cell: number, rng: Rng): SplitResult | null {
  const p = b.cells[cell]
  if (!p) return null
  if (!canSplit(p.value)) return null
  const free = emptyCells(b)
  if (free.length === 0) return null
  // Prefer a neighbouring cell, so the two halves land side by side and the
  // merge back up is one drag away.
  const { cx, cy } = coords(b, cell)
  const near: number[] = []
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = cx + dx
    const ny = cy + dy
    if (!inBounds(b, nx, ny)) continue
    const j = idx(b, nx, ny)
    if (!b.cells[j]) near.push(j)
  }
  const half = p.value / 2
  const into = near.length > 0 ? rng.pick(near) : rng.pick(free)
  p.value = half
  p.squash = 1
  p.age = 0
  const made = place(b, into, half, rng.int(0, 999) / 1000)
  if (!made) return null
  made.born = 0
  return { kept: p, made, value: half }
}

/** Does any legal merge exist anywhere on the board? (Adjacency is not required.) */
export function hasLegalMerge(b: Board): boolean {
  const seen = new Set<number>()
  for (const c of b.cells) {
    if (!c) continue
    if (seen.has(c.value)) return true
    seen.add(c.value)
  }
  return false
}

/** The board is crowded when it is full AND nothing on it can merge. */
export function isCrowded(b: Board): boolean {
  for (const c of b.cells) if (!c) return false
  return !hasLegalMerge(b)
}

/** Remove a polyp; returns the value that left the shelf, or 0. */
export function cull(b: Board, cell: number): number {
  const p = b.cells[cell]
  if (!p) return 0
  b.cells[cell] = null
  return p.value
}

/**
 * CLEAR — wipe the shelf. Every polyp, no exceptions.
 *
 * ## Why this takes everything, and why the two cleverer versions did not work
 *
 * The manual promises the child *"You can never get stuck. CLEAR always works."*
 * Two shipped attempts at making that true both failed, in opposite directions:
 *
 *   * `purgeLowest` cleared one value class, which on a shelf of forty distinct
 *     numbers is ONE polyp. The reef put something back into the hole and the
 *     founder was exactly where he started — *"only one goes away and a FREAKING
 *     44 comes out .. so, now I just have a full board and it's stuck"*.
 *   * `purgeUpTo` climbed the values until there was room. It made room, and it
 *     made it out of the wrong polyps: smallest first takes the 1, 3, 5 and 7 —
 *     the only values a small target can be answered with — and leaves the
 *     accumulated giants standing. *"'clear' tends to just take out the good
 *     (small) numbers instead of the enormous retarded numbers."*
 *
 * Both were reasoning about *room*. Room was never the scarce thing; USEFUL
 * polyps were. So CLEAR stops choosing. It takes the lot, the reef re-seeds (see
 * `Engine.dissolve`), and the promise becomes trivially true rather than argued —
 * there is no shelf from which pressing it fails to help, because there is no
 * shelf afterwards.
 *
 * `gained` is the total value that left, which the floaters print so the child
 * can see the size of what they spent.
 */
export function purgeAll(b: Board): { gained: number; cells: number[] } {
  const cells: number[] = []
  let gained = 0
  for (let i = 0; i < b.cells.length; i++) {
    const c = b.cells[i]
    if (!c) continue
    gained += c.value
    cells.push(i)
    b.cells[i] = null
  }
  return { gained, cells }
}

/**
 * THE UNDERTOW — carry the `n` biggest polyps off the shelf.
 *
 * Fired on a BLOOM, which is the maths moment: answer the number and the reef
 * takes back what the answer was built beside. It is the turnover the founder
 * asked for — *"when you get one right it shuffles and smashes and clears"* — and
 * it is also the mechanism that stops the junk in the first place, because the
 * only way a polyp gets big is that a child merged it, and the reef never hands
 * one out (`EMIT_STEP` is 0). Take from the TOP and a shelf cannot silently
 * accumulate a wall of numbers no small target can use.
 */
export function purgeTop(b: Board, n: number): { gained: number; cells: number[] } {
  if (n <= 0) return { gained: 0, cells: [] }
  const ranked = polyps(b)
    .slice()
    .sort((a, z) => z.value - a.value || a.cell - z.cell)
    .slice(0, n)
  const cells: number[] = []
  let gained = 0
  for (const p of ranked) {
    gained += p.value
    cells.push(p.cell)
    b.cells[p.cell] = null
  }
  cells.sort((a, z) => a - z)
  return { gained, cells }
}

/**
 * Re-scatter every polyp into a fresh cell. Pure churn: nothing is created,
 * destroyed or changed in value, and the bag the target is answered out of is
 * bit-for-bit the same one. It exists so a bloom visibly *moves* the reef.
 */
export function shuffleCells(b: Board, rng: Rng): void {
  const live = polyps(b)
  if (live.length < 2) return
  const slots = rng.shuffle(live.map((p) => p.cell))
  b.cells = new Array(b.cols * b.rows).fill(null)
  for (let i = 0; i < live.length; i++) {
    const p = live[i] as Polyp
    const cell = slots[i] as number
    p.cell = cell
    p.squash = 1
    b.cells[cell] = p
  }
}

/**
 * Grow the shelf, keeping every polyp at the same (cx, cy). New space is added
 * on the right and the bottom, which is where the eye expects a reef to spread.
 */
export function grow(b: Board, cols: number, rows: number): void {
  if (cols <= b.cols && rows <= b.rows) return
  const nextCols = Math.max(cols, b.cols)
  const nextRows = Math.max(rows, b.rows)
  const next: Array<Polyp | null> = new Array(nextCols * nextRows).fill(null)
  for (let i = 0; i < b.cells.length; i++) {
    const p = b.cells[i]
    if (!p) continue
    const cx = i % b.cols
    const cy = Math.floor(i / b.cols)
    const j = cy * nextCols + cx
    next[j] = p
    p.cell = j
  }
  b.cols = nextCols
  b.rows = nextRows
  b.cells = next
}

/** Total board value — the "reef mass" the idle trickle is computed from. */
export function reefMass(b: Board): number {
  let m = 0
  for (const c of b.cells) if (c) m += c.value
  return m
}

/** Highest value on the board, 0 when empty. Drives difficulty selection. */
export function peakValue(b: Board): number {
  let hi = 0
  for (const c of b.cells) if (c && c.value > hi) hi = c.value
  return hi
}

/** Every distinct value currently on the shelf, ascending. */
export function distinctValues(b: Board): number[] {
  const set = new Set<number>()
  for (const c of b.cells) if (c) set.add(c.value)
  return [...set].sort((a, z) => a - z)
}

/** The cell holding a polyp with this value, or -1. Used by the assay hint. */
export function findValue(b: Board, value: number): number {
  for (let i = 0; i < b.cells.length; i++) {
    const c = b.cells[i]
    if (c && c.value === value) return i
  }
  return -1
}

/** Debug/QA helper: is every value on the board a legal ladder value? */
export function invariant(b: Board): boolean {
  for (let i = 0; i < b.cells.length; i++) {
    const c = b.cells[i]
    if (!c) continue
    if (c.cell !== i) return false
    if (!decompose(c.value)) return false
  }
  return true
}
