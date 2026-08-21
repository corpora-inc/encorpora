import assert from "node:assert/strict"
import test from "node:test"

import { Rng } from "../core/rng.ts"
import {
  MIN_CELLS,
  SLAG_CELLS,
  SLAG_CLEARED_PER_HIT,
  SLAG_PER_MISS,
  aim,
  breakAtCut,
  breakable,
  buried,
  clampCut,
  createBoard,
  cutRange,
  openCells,
  pendingValue,
  reload,
  settle,
  shear,
  stoke,
} from "./board.ts"
import { breaksNeeded, coilOf, suffixValues, valueOf } from "./place.ts"

const SEED = 0x0c011960

test("a fresh board parks the shear on the last link", () => {
  const board = createBoard(coilOf(72), 96)
  assert.equal(board.cut, 8)
  assert.equal(pendingValue(board), 1)
  assert.equal(board.slag, 0)
})

test("the shear can always take at least one link and never a buried one", () => {
  const rng = new Rng(SEED ^ 0x77)
  for (let i = 0; i < 200; i++) {
    const board = createBoard(coilOf(rng.int(1, 99_999)), rng.int(8, 96))
    board.slag = rng.int(0, 12)
    const { min, max } = cutRange(board)
    assert.equal(min, buried(board))
    assert.ok(max >= min)
    assert.equal(clampCut(board, -100), min)
    assert.equal(clampCut(board, 10_000), max)
    aim(board, -100)
    assert.ok(board.cut >= buried(board))
    assert.ok(pendingValue(board) > 0 || board.links.length === 0)
  }
})

test("slag takes cells away and the coil is buried head-first", () => {
  const board = createBoard(coilOf(99_999), 40)
  assert.equal(board.links.length, 45)
  assert.equal(openCells(board), 40)
  assert.equal(buried(board), 5)
  board.slag = 4
  assert.equal(openCells(board), 40 - 4 * SLAG_CELLS)
  assert.equal(buried(board), 45 - 32)
})

test("however choked the lane gets, some of it stays walkable", () => {
  const board = createBoard(coilOf(72), 20)
  board.slag = 500
  assert.equal(openCells(board), MIN_CELLS)
  assert.ok(cutRange(board).max >= cutRange(board).min)
})

test("a buried link cannot be cracked open", () => {
  const board = createBoard(coilOf(99_999), 20)
  const b = buried(board)
  assert.ok(b > 0)
  assert.equal(breakable(board, b - 1), false)
  assert.equal(breakable(board, b), true)
})

test("cracking at the cut leaves the pending value untouched", () => {
  const rng = new Rng(SEED ^ 0x88)
  for (let i = 0; i < 200; i++) {
    const board = createBoard(coilOf(rng.int(100, 99_999)), 96)
    aim(board, rng.int(0, board.links.length - 1))
    const before = pendingValue(board)
    const grew = board.links.length
    if (!breakAtCut(board)) continue
    assert.equal(pendingValue(board), before)
    assert.equal(board.links.length, grew + 9)
  }
})

test("cracking a bead is refused and changes nothing", () => {
  const board = createBoard(coilOf(72), 96)
  aim(board, 8)
  const before = board.links.slice()
  assert.equal(breakAtCut(board), false)
  assert.deepEqual(board.links, before)
})

test("a shear is a partition: the two pieces add back up to the coil", () => {
  const rng = new Rng(SEED ^ 0x99)
  for (let i = 0; i < 300; i++) {
    const value = rng.int(1, 99_999)
    const board = createBoard(coilOf(value), 96)
    aim(board, rng.int(0, board.links.length - 1))
    const result = shear(board)
    assert.equal(result.severed + result.restValue, value)
    assert.equal(result.piece.length + result.rest.length, board.links.length)
    assert.ok(Number.isSafeInteger(result.severed))
    assert.ok(result.severed > 0)
  }
})

test("an exact cut clears slag; a miss adds it, and slag never goes negative", () => {
  const board = createBoard(coilOf(72), 96)
  settle(board, false)
  assert.equal(board.slag, SLAG_PER_MISS)
  settle(board, false)
  assert.equal(board.slag, SLAG_PER_MISS * 2)
  settle(board, true)
  assert.equal(board.slag, 2 * SLAG_PER_MISS - SLAG_CLEARED_PER_HIT)
  settle(board, true)
  assert.equal(board.slag, 0)
  settle(board, true)
  assert.equal(board.slag, 0)
})

test("playing at half accuracy digs the lane out rather than choking it", () => {
  const board = createBoard(coilOf(72), 96)
  let worst = 0
  for (let i = 0; i < 40; i++) {
    settle(board, i % 2 === 0)
    worst = Math.max(worst, board.slag)
  }
  assert.equal(worst, 1, "the lane never gets ahead of the player")
  assert.ok(board.slag <= 1)
})

test("playing badly chokes the lane, which is the whole of the punishment", () => {
  const board = createBoard(coilOf(99_999), 96)
  assert.equal(buried(board), 0)
  for (let i = 0; i < 30; i++) settle(board, false)
  assert.equal(board.slag, 30 * SLAG_PER_MISS)
  assert.ok(buried(board) > 0, "the coil no longer fits on the floor it was given")
  // And it is undone by playing well, not by waiting.
  for (let i = 0; i < 15; i++) settle(board, true)
  assert.equal(board.slag, 0)
  assert.equal(buried(board), 0)
})

test("the furnace melts the lane, and reload keeps the slag", () => {
  const board = createBoard(coilOf(72), 96)
  board.slag = 7
  reload(board, coilOf(403))
  assert.equal(board.slag, 7, "a new coil does not clean the floor")
  assert.equal(valueOf(board.links), 403)
  stoke(board)
  assert.equal(board.slag, 0)
})

test("a choked board is a decision, never a dead end", () => {
  // Bury the coil badly enough that the tens are unreachable, then prove the
  // furnace is the way out: everything is reachable again afterwards.
  const board = createBoard(coilOf(87_654), 96)
  board.slag = 40
  assert.ok(buried(board) > 0)
  stoke(board)
  assert.equal(buried(board), 0)
  assert.equal(breakable(board, 0), true)
})

test("the demand is reachable by cracking only at the cut", () => {
  // The interaction only ever breaks the link the jaws are parked on, so the
  // greedy walk `breaksNeeded` counts has to be a strategy the child can
  // actually perform. This replays it through the board's own API.
  const rng = new Rng(SEED ^ 0xaa)
  for (let i = 0; i < 200; i++) {
    const whole = rng.int(10, 99_999)
    const demand = rng.int(1, whole)
    const board = createBoard(coilOf(whole), 4_096)
    let guard = 0
    for (;;) {
      const table = suffixValues(board.links)
      const exact = table.indexOf(demand)
      if (exact >= 0) {
        aim(board, exact)
        break
      }
      // Park where the take overshoots by the least, then crack.
      let at = board.links.length - 1
      for (let j = board.links.length - 1; j >= 0; j--) {
        if ((table[j] as number) > demand) {
          at = j
          break
        }
      }
      aim(board, at)
      assert.equal(breakAtCut(board), true, "the boundary link can always be cracked")
      guard++
      assert.ok(guard < 40, "the walk terminates")
    }
    assert.equal(pendingValue(board), demand)
    assert.ok(breaksNeeded(coilOf(whole), demand) >= 0)
    assert.equal(valueOf(board.links), whole)
  }
})

test("SLAG_CELLS is what makes the lane a rule and not a decoration", () => {
  const board = createBoard(coilOf(9), 30)
  const clean = openCells(board)
  board.slag = 3
  assert.equal(clean - openCells(board), 3 * SLAG_CELLS)
})
