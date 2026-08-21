import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { BLOCK, TruthBag } from "./schedule.ts"

test("every whole block is exactly half true", () => {
  const bag = new TruthBag(new Rng(7))
  for (let block = 0; block < 200; block++) {
    let trues = 0
    for (let i = 0; i < BLOCK; i++) if (bag.take()) trues++
    assert.equal(trues, BLOCK / 2, `block ${String(block)}`)
  }
})

test("the imbalance over any prefix stays inside one block", () => {
  const bag = new TruthBag(new Rng(31337))
  let trues = 0
  let falses = 0
  for (let i = 0; i < 4000; i++) {
    if (bag.take()) trues++
    else falses++
    assert.ok(
      Math.abs(trues - falses) <= BLOCK,
      `after ${String(i + 1)}: ${String(trues)} true, ${String(falses)} false`,
    )
  }
})

test("a child never sees more than three of the same call in a row", () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const bag = new TruthBag(new Rng(seed))
    let value = bag.take()
    let length = 1
    for (let i = 1; i < 4000; i++) {
      const next = bag.take()
      if (next === value) length++
      else {
        value = next
        length = 1
      }
      assert.ok(length <= 3, `seed ${String(seed)} produced a run of ${String(length)}`)
    }
  }
})

test("an unspendable lie goes back into the bag rather than biasing the run", () => {
  const bag = new TruthBag(new Rng(5))
  const first = bag.take()
  bag.give(first)
  assert.equal(bag.take(), first, "the returned value is dealt again")
})

test("a debt that can never be spent is written off rather than hoarded", () => {
  const bag = new TruthBag(new Rng(11))
  // A stream of items that could only be told truthfully. Without the cap this
  // queue would grow without bound and then dump every stored `false` at once.
  for (let i = 0; i < 500; i++) {
    bag.take()
    bag.give(false)
  }
  let trues = 0
  for (let i = 0; i < 400; i++) if (bag.take()) trues++
  assert.ok(trues >= 150 && trues <= 250, `${String(trues)} true out of 400 after the write-off`)
})
