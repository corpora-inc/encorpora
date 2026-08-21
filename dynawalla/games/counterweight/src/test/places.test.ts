// The rack is a number system. These are the properties that make it one.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyAll,
  applyStrike,
  FACES,
  PILLAR_COOLDOWN_MS,
  PLACES,
  planStrikes,
  strikesFor,
  strikeValue,
} from "../game/places.ts"
import { Rng } from "../core/rng.ts"

test("the rack is four places and eight faces", () => {
  assert.deepEqual([...PLACES], [1000, 100, 10, 1])
  assert.equal(FACES.length, 8)
  for (const place of PLACES) {
    assert.equal(FACES.filter((f) => f.place === place && f.dir === 1).length, 1)
    assert.equal(FACES.filter((f) => f.place === place && f.dir === -1).length, 1)
  }
  assert.ok(PILLAR_COOLDOWN_MS > 0 && PILLAR_COOLDOWN_MS < 200)
})

test("a plan lands on its delta exactly, over the whole reachable range", () => {
  const rng = new Rng(0x9c07)
  for (let i = 0; i < 4000; i++) {
    const delta = rng.int(-9999, 9999)
    const plan = planStrikes(delta)
    assert.equal(applyAll(0, plan), delta, `plan for ${delta} did not land on it`)
    for (const strike of plan) {
      assert.ok(Number.isInteger(strikeValue(strike)))
    }
  }
})

test("the plan is balanced: no low place is ever struck more than five times", () => {
  // This is the discovery the game is built around — eight is ten less two, not
  // eight ones. If a plan ever asked for six blows on one of the low pillars, the
  // shorter path through the pillar above it was there and was not taken.
  const rng = new Rng(0x22b1)
  for (let i = 0; i < 4000; i++) {
    const plan = planStrikes(rng.int(-9999, 9999))
    for (const place of [1, 10, 100] as const) {
      assert.ok(
        plan.filter((s) => s.place === place).length <= 5,
        `${place}s pillar was struck more than five times`,
      )
    }
  }
})

test("the plan is never longer than counting up in ones and tens would be", () => {
  const rng = new Rng(0x4d33)
  for (let i = 0; i < 2000; i++) {
    const delta = rng.int(-9999, 9999)
    const naive =
      Math.abs(Math.trunc(delta / 1000)) +
      Math.abs(Math.trunc((delta % 1000) / 100)) +
      Math.abs(Math.trunc((delta % 100) / 10)) +
      Math.abs(delta % 10)
    assert.ok(strikesFor(delta) <= naive, `${delta}: ${strikesFor(delta)} > ${naive}`)
  }
})

test("nothing at all is nothing to strike", () => {
  assert.deepEqual(planStrikes(0), [])
})

test("a plan is ordered heaviest first", () => {
  const plan = planStrikes(1234)
  const order = plan.map((s) => PLACES.indexOf(s.place))
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
})

test("a strike moves the pan by exactly its place, and back again", () => {
  for (const face of FACES) {
    const up = applyStrike(500, face)
    assert.equal(up, 500 + face.place * face.dir)
    assert.equal(applyStrike(up, { place: face.place, dir: face.dir === 1 ? -1 : 1 }), 500)
  }
})

test("a plan refuses a delta that is not a whole number of units", () => {
  assert.throws(() => planStrikes(3.5), /integer/)
})
