// THE STATION.
//
// The sky is a hundred-square stood upright and a star's station is its
// answer's tens and ones. Everything in this file is exact integer arithmetic,
// because a station is a pair of digits and a digit that came out of a float is
// not a digit.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  MAX_ANSWER,
  RINGS,
  answerOf,
  detentsBetween,
  isUsable,
  namedSlips,
  orderOf,
  sameStation,
  stationOf,
  turn,
  valueAt,
} from "../game/station.ts"

test("a station is the answer's tens and ones, and the order is what is already ruled in", () => {
  assert.deepEqual(stationOf(72), { x: 2, y: 7 })
  assert.deepEqual(stationOf(472), { x: 2, y: 7 })
  assert.deepEqual(stationOf(8), { x: 8, y: 0 })
  assert.deepEqual(stationOf(0), { x: 0, y: 0 })
  assert.deepEqual(stationOf(9999), { x: 9, y: 9 })
  assert.deepEqual(stationOf(16505), { x: 5, y: 0 })

  assert.equal(orderOf(72), 0)
  assert.equal(orderOf(472), 4)
  assert.equal(orderOf(9999), 99)
  assert.equal(orderOf(16505), 165)
})

test("order and station reconstruct the answer exactly, for every whole number the sky holds", () => {
  // Exhaustive rather than sampled: this is the identity the whole game rests
  // on, and 0..19,998 covers everything the `add` domain can make — two
  // four-digit addends. The rest of the range is checked at the boundary.
  for (let v = 0; v <= 19_998; v++) {
    const rebuilt = valueAt(orderOf(v), stationOf(v))
    assert.equal(rebuilt, v, `${v} did not come back from its own station`)
    assert.ok(Number.isInteger(rebuilt))
  }
  for (const v of [99_999, 100_000, MAX_ANSWER]) {
    assert.equal(valueAt(orderOf(v), stationOf(v)), v)
  }
})

test("a named coordinate is worth the answer if and only if it IS the true station", () => {
  // The load-bearing claim. Under a star of order 4 whose answer is 472, the
  // pair (2, 7) is the answer and no other pair on the lattice is.
  const answer = 472
  const order = orderOf(answer)
  let hits = 0
  for (let y = 0; y < RINGS; y++) {
    for (let x = 0; x < RINGS; x++) {
      const asserted = valueAt(order, { x, y })
      const right = asserted === answer
      assert.equal(
        right,
        sameStation({ x, y }, stationOf(answer)),
        `(${x}, ${y}) disagreed with the truth about ${answer}`,
      )
      if (right) hits++
    }
  }
  assert.equal(hits, 1, "the lattice held more than one station worth the same answer")
})

test("a wrong pair asserts a wrong number, and it is a number the host can judge", () => {
  const answer = 472
  const order = orderOf(answer)
  // Dropping the carry out of the tens column: 462, not noise.
  assert.equal(valueAt(order, { x: 2, y: 6 }), 462)
  // Transposing the pair: a real slip, and a real number.
  assert.equal(valueAt(order, { x: 7, y: 2 }), 427)
  for (let y = 0; y < RINGS; y++) {
    for (let x = 0; x < RINGS; x++) {
      const v = valueAt(order, { x, y })
      assert.ok(Number.isInteger(v) && v >= 0, `(${x}, ${y}) asserted ${v}`)
    }
  }
})

test("the rings turn one detent at a time and wrap both ways", () => {
  let s = { x: 0, y: 0 }
  s = turn(s, "ones", 1)
  assert.deepEqual(s, { x: 1, y: 0 })
  s = turn(s, "ones", -1)
  s = turn(s, "ones", -1)
  assert.deepEqual(s, { x: 9, y: 0 }, "the ones ring did not wrap under zero")
  s = turn(s, "tens", -1)
  assert.deepEqual(s, { x: 9, y: 9 }, "the tens ring did not wrap under zero")
  s = turn(s, "tens", 1)
  assert.deepEqual(s, { x: 9, y: 0 }, "the tens ring did not wrap over nine")

  // A ring never moves the other one. The pair is two independent productions.
  for (let i = 0; i < 25; i++) s = turn(s, "ones", 1)
  assert.equal(s.y, 0)
})

test("detentsBetween is the shortest way round, on each ring", () => {
  assert.equal(detentsBetween({ x: 0, y: 0 }, { x: 0, y: 0 }), 0)
  assert.equal(detentsBetween({ x: 0, y: 0 }, { x: 1, y: 0 }), 1)
  assert.equal(detentsBetween({ x: 0, y: 0 }, { x: 9, y: 0 }), 1, "the ring did not wrap")
  assert.equal(detentsBetween({ x: 0, y: 0 }, { x: 5, y: 5 }), 10)
  assert.equal(detentsBetween({ x: 2, y: 7 }, { x: 7, y: 2 }), 10)
})

test("an answer this sky cannot hold is refused rather than bent", () => {
  assert.equal(answerOf({ answer: "72" }), 72)
  assert.equal(answerOf({ answer: " 472 " }), 472)
  assert.equal(answerOf({ answer: "0" }), 0)

  for (const bad of ["7.5", "-3", "1000000", "", "  ", "1/2", "seven", "12a", "1e3", "0x10"]) {
    assert.equal(answerOf({ answer: bad }), null, `"${bad}" was let onto the sky`)
    assert.equal(isUsable({ answer: bad }), false)
  }
})

test("named slips are the host's own mal-rule values, and nothing else", () => {
  const slips = namedSlips(["462", "427", "7.5", "-1", "1000000", "  "])
  assert.deepEqual([...slips].sort((a, b) => a - b), [427, 462])
  assert.equal(slips.has(462), true)
  assert.equal(slips.has(472), false, "the answer itself was called a slip")
  assert.equal(namedSlips([]).size, 0)
})
