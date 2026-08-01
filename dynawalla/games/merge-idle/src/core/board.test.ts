import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  at,
  cull,
  distinctValues,
  emptyCells,
  grow,
  hasLegalMerge,
  invariant,
  isCrowded,
  makeBoard,
  move,
  peakValue,
  place,
  polyps,
  purgeAll,
  purgeTop,
  reefMass,
  shuffleCells,
  spawn,
  trySplit,
  tryMerge,
} from './board.ts'
import { makeRng } from './rng.ts'

test('a merge is the sum of two equal values and leaves one polyp behind', () => {
  const b = makeBoard(3, 3)
  place(b, 0, 48)
  place(b, 4, 48)
  const r = tryMerge(b, 0, 4)
  assert.ok(r)
  assert.equal(r.value, 96)
  assert.equal(at(b, 0), null)
  assert.equal(at(b, 4)?.value, 96)
  assert.equal(polyps(b).length, 1)
})

test('the survivor sits where the finger let go, not where it came from', () => {
  const b = makeBoard(3, 3)
  place(b, 8, 5)
  place(b, 2, 5)
  tryMerge(b, 8, 2)
  assert.equal(at(b, 2)?.value, 10)
  assert.equal(at(b, 8), null)
})

test('unequal values never merge, at any distance', () => {
  const b = makeBoard(3, 3)
  place(b, 0, 3)
  place(b, 1, 6)
  assert.equal(tryMerge(b, 0, 1), null)
  assert.equal(polyps(b).length, 2)
})

test('a merge past the top of the ladder is refused rather than corrupting a value', () => {
  const b = makeBoard(2, 2)
  const top = 15 * 2 ** 17
  place(b, 0, top)
  place(b, 1, top)
  assert.equal(tryMerge(b, 0, 1), null)
  assert.ok(invariant(b))
})

test('off-ladder values can never be placed', () => {
  const b = makeBoard(2, 2)
  // 11 and 15 ARE polyp values now — the ladder went from four seeds to eight,
  // see `core/ladder.ts`. 17 is the first integer that is not.
  assert.equal(place(b, 0, 17), null)
  assert.equal(place(b, 0, 34), null)
  assert.equal(place(b, 0, 0), null)
  assert.equal(place(b, 0, -8), null)
  assert.equal(polyps(b).length, 0)
})

test('move only lands on an empty cell and keeps cell indices honest', () => {
  const b = makeBoard(3, 3)
  place(b, 0, 1)
  place(b, 1, 2)
  assert.equal(move(b, 0, 1), false)
  assert.equal(move(b, 0, 5), true)
  assert.equal(at(b, 5)?.cell, 5)
  assert.ok(invariant(b))
})

test('spawn prefers a cell next to a matching value so the shelf keeps offering merges', () => {
  const rng = makeRng(11)
  let adjacent = 0
  for (let trial = 0; trial < 200; trial++) {
    const b = makeBoard(5, 5)
    place(b, 12, 8) // dead centre
    const p = spawn(b, 8, rng)
    assert.ok(p)
    const dx = Math.abs((p.cell % 5) - 2)
    const dy = Math.abs(Math.floor(p.cell / 5) - 2)
    if (dx + dy === 1) adjacent++
  }
  // 3-in-4 by design; allow slack so the test is not brittle about the exact rate
  assert.ok(adjacent > 120, `expected mostly-adjacent spawns, got ${adjacent}/200`)
})

test('spawn returns null on a full shelf instead of dropping a polyp on the floor', () => {
  const b = makeBoard(2, 2)
  const rng = makeRng(3)
  for (let i = 0; i < 4; i++) assert.ok(spawn(b, 1, rng))
  assert.equal(spawn(b, 1, rng), null)
  assert.equal(emptyCells(b).length, 0)
})

test('crowded means full AND no pair anywhere — a full shelf with a pair is not crowded', () => {
  const b = makeBoard(2, 2)
  place(b, 0, 1)
  place(b, 1, 3)
  place(b, 2, 5)
  place(b, 3, 7)
  assert.equal(hasLegalMerge(b), false)
  assert.equal(isCrowded(b), true)

  const c = makeBoard(2, 2)
  place(c, 0, 1)
  place(c, 1, 1)
  place(c, 2, 5)
  place(c, 3, 7)
  assert.equal(hasLegalMerge(c), true)
  assert.equal(isCrowded(c), false)
})

test('an empty or partly empty shelf is never crowded', () => {
  const b = makeBoard(2, 2)
  assert.equal(isCrowded(b), false)
  place(b, 0, 1)
  assert.equal(isCrowded(b), false)
})

test('CLEAR takes every polyp and pays out the whole shelf', () => {
  const b = makeBoard(3, 1)
  place(b, 0, 3)
  place(b, 1, 3)
  place(b, 2, 24)
  const { gained, cells } = purgeAll(b)
  assert.equal(gained, 30)
  assert.deepEqual(cells, [0, 1, 2])
  assert.equal(polyps(b).length, 0, 'nothing may survive CLEAR')
  assert.equal(emptyCells(b).length, 3)
})

test('the undertow takes the biggest polyps and nothing else', () => {
  const b = makeBoard(5, 1)
  place(b, 0, 3)
  place(b, 1, 96)
  place(b, 2, 5)
  place(b, 3, 48)
  place(b, 4, 1)
  const { gained, cells } = purgeTop(b, 2)
  assert.equal(gained, 144, '96 + 48 is what the undertow carried off')
  assert.deepEqual(cells, [1, 3])
  assert.deepEqual(
    polyps(b)
      .map((p) => p.value)
      .sort((a, z) => a - z),
    [1, 3, 5],
    'the small useful polyps are exactly what stays',
  )
})

test('the undertow takes nothing when asked for nothing', () => {
  const b = makeBoard(2, 1)
  place(b, 0, 3)
  place(b, 1, 96)
  const { gained, cells } = purgeTop(b, 0)
  assert.equal(gained, 0)
  assert.equal(cells.length, 0)
  assert.equal(polyps(b).length, 2)
})

test('the shuffle moves polyps without creating, destroying or changing one', () => {
  const b = makeBoard(4, 3)
  const before = [1, 3, 5, 7, 9, 11, 13]
  for (let i = 0; i < before.length; i++) place(b, i, before[i] as number)
  shuffleCells(b, makeRng(20260728))
  assert.deepEqual(
    polyps(b)
      .map((p) => p.value)
      .sort((a, z) => a - z),
    [...before].sort((a, z) => a - z),
    'the shuffle is pure churn — the bag the target is answered from is unchanged',
  )
  assert.ok(invariant(b), 'every polyp still agrees with the cell it sits in')
  const after = polyps(b).map((p) => p.cell)
  assert.equal(new Set(after).size, after.length, 'no two polyps may share a cell')
  // Churn, not a no-op: with seven polyps a fixed-point permutation is possible
  // but this seed is not one, and a shuffle that never moved anything would be
  // no turnover at all.
  const moved = polyps(b).filter((p) => p.value !== before[p.cell]).length
  assert.ok(moved > 0, 'the shuffle must actually move something')
})

test('growing the shelf keeps every polyp at the same column and row', () => {
  const b = makeBoard(3, 3)
  place(b, 0, 1) // (0,0)
  place(b, 4, 3) // (1,1)
  place(b, 8, 5) // (2,2)
  grow(b, 5, 4)
  assert.equal(b.cols, 5)
  assert.equal(b.rows, 4)
  assert.equal(at(b, 0)?.value, 1)
  assert.equal(at(b, 1 * 5 + 1)?.value, 3)
  assert.equal(at(b, 2 * 5 + 2)?.value, 5)
  assert.ok(invariant(b))
})

test('grow never shrinks', () => {
  const b = makeBoard(6, 7)
  grow(b, 3, 3)
  assert.equal(b.cols, 6)
  assert.equal(b.rows, 7)
})

test('reef mass, peak and distinct values report what is actually there', () => {
  const b = makeBoard(3, 1)
  place(b, 0, 3)
  place(b, 1, 3)
  place(b, 2, 128)
  assert.equal(reefMass(b), 134)
  assert.equal(peakValue(b), 128)
  assert.deepEqual(distinctValues(b), [3, 128])
  assert.equal(cull(b, 2), 128)
  assert.equal(peakValue(b), 3)
})

test('a thousand random operations never break the board invariant', () => {
  const rng = makeRng(0xabcd)
  const b = makeBoard(5, 6)
  for (let i = 0; i < 1000; i++) {
    const roll = rng.int(0, 3)
    if (roll === 0) spawn(b, [1, 3, 5, 7][rng.int(0, 3)] ?? 1, rng)
    else if (roll === 1) {
      const ps = polyps(b)
      if (ps.length >= 2) {
        const a = rng.pick(ps)
        const z = rng.pick(ps)
        tryMerge(b, a.cell, z.cell)
      }
    } else if (roll === 2) {
      const free = emptyCells(b)
      const ps = polyps(b)
      if (free.length && ps.length) move(b, rng.pick(ps).cell, rng.pick(free))
    } else {
      const ps = polyps(b)
      if (ps.length) cull(b, rng.pick(ps).cell)
    }
    assert.ok(invariant(b), `invariant broke at op ${i}`)
  }
})

/* -------------------------------------------------------------------- split */

test('SPLIT halves a polyp into two of itself, and needs a free cell for the second', () => {
  const b = makeBoard(2, 1)
  place(b, 0, 16)
  const res = trySplit(b, 0, makeRng(3))
  assert.ok(res)
  assert.equal(res.value, 8)
  assert.deepEqual(
    polyps(b)
      .map((p) => p.value)
      .sort((x, y) => x - y),
    [8, 8],
  )
  assert.ok(invariant(b))
})

test('a seed polyp cannot be split — 3 does not halve, and that is arithmetic', () => {
  const b = makeBoard(3, 1)
  place(b, 0, 3)
  assert.equal(trySplit(b, 0, makeRng(3)), null)
  assert.deepEqual(polyps(b).map((p) => p.value), [3])
})

test('split refuses when the shelf is full rather than losing half a polyp', () => {
  const b = makeBoard(2, 1)
  place(b, 0, 16)
  place(b, 1, 5)
  assert.equal(trySplit(b, 0, makeRng(3)), null)
  assert.equal(at(b, 0)?.value, 16, 'the polyp must be left exactly as it was')
  assert.ok(invariant(b))
})

test('split then merge is the identity — the doubling fact, both ways', () => {
  const rng = makeRng(11)
  for (const v of [2, 6, 10, 14, 18, 22, 26, 30, 1024, 960]) {
    const b = makeBoard(3, 3)
    place(b, 0, v)
    const res = trySplit(b, 0, rng)
    assert.ok(res, `${v} should split`)
    const cells = polyps(b).map((p) => p.cell)
    assert.equal(cells.length, 2)
    const merged = tryMerge(b, cells[0] as number, cells[1] as number)
    assert.ok(merged)
    assert.equal(merged.value, v, `${v} split and merged should come back to ${v}`)
  }
})
