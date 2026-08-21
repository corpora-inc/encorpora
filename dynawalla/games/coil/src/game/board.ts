// The lane, and the only thing in this game that punishes you.
//
// There is no timer, no lamp and no buzzer. Hesitating costs nothing; aiming
// costs nothing; cracking a link open and changing your mind costs nothing that
// a correct cut will not undo. What a thoughtless cut costs is **space**, and
// space is the thing the coil needs to exist:
//
//   * A cut that is not exact drops its piece on the floor as **slag**. Slag
//     sits in the lane and each lump occupies cells the coil can no longer use.
//   * A coil longer than the cells left over is **buried** at the mouth,
//     head-first. A buried link cannot be broken, and the biggest places are at
//     the head — so a choked lane takes away exactly the links you borrow from.
//   * An exact cut clears two lumps: the severed piece smashes them on its way
//     to the wall. Play well and the lane clears itself faster than it fouls.
//
// Breaking a link is what makes this bite. Every break makes the coil nine
// links longer, so a child who cracks everything open buries their own coil.
// The efficient strategy is to crack only at the boundary and only when the
// take actually overshoots — which is why the jaws are the only place a link
// can be cracked, and why the lane, not a message, is what teaches it.
//
// The escape is the **furnace**: melt every lump, at the cost of feeding the
// current coil to it. Always available, costs no answer, reports nothing. A
// choked board is never a dead end, it is a decision.

import { breakAt, canBreak, suffixValue, valueOf } from "./place.ts"

/** Cells one lump of slag takes out of the lane. */
export const SLAG_CELLS = 2

/** Lumps a wrong cut leaves behind, and lumps an exact cut smashes. */
export const SLAG_PER_MISS = 1
export const SLAG_CLEARED_PER_HIT = 2

/** However choked the lane gets, this many cells stay walkable. */
export const MIN_CELLS = 6

export type Board = {
  /** Place exponents, head first. */
  links: number[]
  /** The joint the shear is parked at: `links[cut..]` is what comes off. */
  cut: number
  slag: number
  /** Cells the lane geometry offers when nothing is in the way. */
  capacity: number
}

export function createBoard(links: number[], capacity: number): Board {
  const board: Board = { links, cut: Math.max(0, links.length - 1), slag: 0, capacity }
  board.cut = clampCut(board, board.cut)
  return board
}

/** Cells the coil may occupy right now. */
export function openCells(board: Board): number {
  return Math.max(MIN_CELLS, board.capacity - board.slag * SLAG_CELLS)
}

/**
 * How many links are stuck in the mouth. Head-first, because the head is where
 * the coil enters and because burying the tail would make the game unplayable
 * rather than harder — the tail is what you shear.
 */
export function buried(board: Board): number {
  return Math.max(0, board.links.length - openCells(board))
}

/** The joints the shear can reach. At least one link always comes off. */
export function cutRange(board: Board): { min: number; max: number } {
  const min = buried(board)
  const max = Math.max(min, board.links.length - 1)
  return { min, max }
}

export function clampCut(board: Board, cut: number): number {
  const { min, max } = cutRange(board)
  return Math.max(min, Math.min(max, cut))
}

/** Park the shear at a joint. Free, unlimited, and never reported. */
export function aim(board: Board, cut: number): void {
  board.cut = clampCut(board, cut)
}

/** The value that would come off if the lever were pulled now. */
export function pendingValue(board: Board): number {
  return suffixValue(board.links, board.cut)
}

/** A link the child may crack open: reachable, and worth more than one. */
export function breakable(board: Board, index: number): boolean {
  return index >= buried(board) && canBreak(board.links, index)
}

/**
 * Crack the link the shear is parked at.
 *
 * Parked at, and not anywhere: the borrow that matters is the one at the
 * boundary between what you are taking and what you are keeping, and making
 * that the only breakable link is what stops the game from becoming a bag of
 * blocks. The cut index does not move, and `pendingValue` is unchanged by
 * construction — a break gives you finer resolution, never a different amount.
 */
export function breakAtCut(board: Board): boolean {
  if (!breakable(board, board.cut)) return false
  board.links = breakAt(board.links, board.cut)
  board.cut = clampCut(board, board.cut)
  return true
}

export type Shear = {
  /** The links that came off, and what they are worth. */
  readonly piece: number[]
  readonly severed: number
  /** What stayed on the lane. */
  readonly rest: number[]
  readonly restValue: number
}

/** Close the shear. The board is not mutated; `settle` decides what happens. */
export function shear(board: Board): Shear {
  const cut = clampCut(board, board.cut)
  const piece = board.links.slice(cut)
  const rest = board.links.slice(0, cut)
  return { piece, severed: valueOf(piece), rest, restValue: valueOf(rest) }
}

/** Apply the consequence of a cut to the lane. Slag never goes below zero. */
export function settle(board: Board, exact: boolean): void {
  board.slag = exact
    ? Math.max(0, board.slag - SLAG_CLEARED_PER_HIT)
    : board.slag + SLAG_PER_MISS
}

/** Melt everything in the lane. The caller feeds the coil to the furnace. */
export function stoke(board: Board): void {
  board.slag = 0
}

/** A fresh coil enters. The lane keeps its slag; that is the whole point. */
export function reload(board: Board, links: number[]): void {
  board.links = links
  board.cut = clampCut(board, links.length - 1)
}
