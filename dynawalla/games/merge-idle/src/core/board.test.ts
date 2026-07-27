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
  lowestValue,
  makeBoard,
  move,
  peakValue,
  place,
  polyps,
  purgeLowest,
  reefMass,
  spawn,
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
  const top = 7 * 2 ** 17
  place(b, 0, top)
  place(b, 1, top)
  assert.equal(tryMerge(b, 0, 1), null)
  assert.ok(invariant(b))
})

test('off-ladder values can never be placed', () => {
  const b = makeBoard(2, 2)
  assert.equal(place(b, 0, 11), null)
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

test('purge dissolves exactly the lowest rung and pays out its whole value', () => {
  const b = makeBoard(3, 1)
  place(b, 0, 3)
  place(b, 1, 3)
  place(b, 2, 24)
  const { gained, cells } = purgeLowest(b)
  assert.equal(gained, 6)
  assert.deepEqual(cells, [0, 1])
  assert.equal(polyps(b).length, 1)
  assert.equal(lowestValue(b), 24)
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
