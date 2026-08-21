import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "./rng.ts"

test("the same seed is the same stream", () => {
  const a = new Rng(12345)
  const b = new Rng(12345)
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next())
})

test("different seeds diverge", () => {
  const a = new Rng(1)
  const b = new Rng(2)
  let same = 0
  for (let i = 0; i < 50; i++) if (a.next() === b.next()) same++
  assert.equal(same, 0)
})

test("values stay in [0, 1), on a 2^32 grid", () => {
  const rng = new Rng(7)
  for (let i = 0; i < 5000; i++) {
    const v = rng.next()
    assert.ok(v >= 0 && v < 1, `produced ${v}`)
    // The divisor is 2^32 and not 2^32 - 1, which is the difference between a
    // half-open range and one that can return exactly 1.0 about once every four
    // billion draws. That is untestable by sampling and trivially checkable
    // structurally: every value has to land on the 2^-32 grid.
    assert.equal((v * 4294967296) % 1, 0, `${v} is not on the 2^-32 grid`)
  }
})

test("a negative or fractional seed is still a stream", () => {
  // A soundscape's seed arrives over the wire. It is validated, but "validated"
  // means finite, not "a non-negative integer" — and an engine that coerced a
  // negative seed differently would give two devices different music from the
  // same soundscape, which is a bug nobody would ever reproduce.
  for (const seed of [-1, -(2 ** 31), 3.7, 0]) {
    const rng = new Rng(seed)
    const v = rng.next()
    assert.ok(Number.isFinite(v) && v >= 0 && v < 1, `seed ${seed} produced ${v}`)
    assert.equal(new Rng(seed).next(), v)
  }
})

test("an index is inside the array it is for", () => {
  const rng = new Rng(9)
  for (let i = 0; i < 2000; i++) {
    const n = rng.int(38)
    assert.ok(Number.isInteger(n) && n >= 0 && n < 38, `produced ${n}`)
  }
  // The degenerate cases, which reach this from `MODES[rng.int(MODES.length)]`
  // if the corpus ever ends up empty. Anything but 0 is an out-of-bounds read.
  assert.equal(rng.int(0), 0)
  assert.equal(rng.int(-5), 0)
  assert.equal(rng.int(Number.NaN), 0)
  assert.equal(rng.int(1), 0)
})

test("a weighted pick follows the weights", () => {
  const rng = new Rng(3)
  const counts = [0, 0, 0]
  for (let i = 0; i < 30000; i++) counts[rng.weighted([0.7, 0.2, 0.1])]!++
  assert.ok(Math.abs((counts[0] ?? 0) / 30000 - 0.7) < 0.02, `got ${counts[0]}`)
  assert.ok(Math.abs((counts[1] ?? 0) / 30000 - 0.2) < 0.02, `got ${counts[1]}`)
  assert.ok(Math.abs((counts[2] ?? 0) / 30000 - 0.1) < 0.02, `got ${counts[2]}`)
})

test("a zero weight is never picked", () => {
  // The interval weights go to zero at the ends of the tension range, and a
  // "calm" soundscape that still threw in the occasional fourth would be the
  // dial not working.
  const rng = new Rng(4)
  for (let i = 0; i < 5000; i++) assert.notEqual(rng.weighted([1, 0, 1]), 1)
})

test("weights that are all zero, or negative, do not read past the end", () => {
  const rng = new Rng(5)
  assert.equal(rng.weighted([]), 0)
  assert.equal(rng.weighted([0, 0, 0]), 0)
  // A negative weight is a bug upstream; treating it as ZERO — rather than
  // letting it shrink the total — is the only reading that cannot return an
  // index outside the array. Summed naively these weights total -8, the
  // "no total" branch fires, and every draw collapses onto index 0.
  const picked = new Set<number>()
  for (let i = 0; i < 500; i++) picked.add(rng.weighted([-10, 1, 1]))
  assert.deepEqual([...picked].sort(), [1, 2], "a negative weight was allowed to shrink the total")
})
