import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { RIVETS, newShutter, rightRivet, strikeRivet } from "./shutter.ts"

const source = {
  id: "q-1",
  prompt: "47 + 25",
  answer: "72",
  // A dropped carry, a doubled carry, the wrong operation.
  distractors: ["62", "82", "22"],
}

test("a plate carries the answer and the host's wrong values, and no more", () => {
  const plate = newShutter(source, new Rng(1))
  assert.equal(plate.rivets.length, RIVETS)
  const texts = plate.rivets.map((r) => r.text).sort()
  assert.deepEqual(texts, ["22", "62", "72", "82"])
  assert.ok(plate.rivets.every((r) => !r.dead))
  assert.equal(plate.open, false)
  assert.equal(plate.reported, false)
})

test("a plate with fewer wrong values is short, not padded with invention", () => {
  // The game never makes up a wrong answer. A host that offered one distractor
  // gets a two-rivet plate, because a fabricated third would be a numeral no
  // child's procedure produces and elimination practice rather than arithmetic.
  const plate = newShutter({ ...source, distractors: ["62"] }, new Rng(2))
  assert.equal(plate.rivets.length, 2)
})

test("duplicates never take two rivets", () => {
  const plate = newShutter({ ...source, distractors: ["62", "62", "72", "82"] }, new Rng(3))
  const texts = plate.rivets.map((r) => r.text)
  assert.equal(new Set(texts).size, texts.length)
  assert.ok(texts.includes("72"))
})

test("the plate is shuffled, so the answer is not always in one place", () => {
  const places = new Set<number>()
  for (let seed = 1; seed <= 40; seed++) {
    places.add(rightRivet(newShutter(source, new Rng(seed))))
  }
  assert.ok(places.size >= 3, "the canonical rivet sat in the same place every time")
})

test("the right rivet opens the plate and reports what was struck", () => {
  const plate = newShutter(source, new Rng(4))
  const result = strikeRivet(plate, rightRivet(plate))
  assert.equal(result.opened, true)
  assert.equal(result.shutter.open, true)
  assert.deepEqual(result.report, { questionId: "q-1", answered: "72" })
})

test("a wrong rivet caves in, reports the mal-rule, and leaves the plate down", () => {
  const plate = newShutter(source, new Rng(5))
  const wrong = plate.rivets.findIndex((r) => r.text !== plate.answer)
  const wrongText = plate.rivets[wrong]?.text as string
  const result = strikeRivet(plate, wrong)
  assert.equal(result.opened, false)
  assert.equal(result.shutter.open, false)
  assert.equal(result.shutter.rivets[wrong]?.dead, true)
  // The value that crosses is the mal-rule output itself, so the misconception
  // routes to the scheduler with no extra wiring.
  assert.deepEqual(result.report, { questionId: "q-1", answered: wrongText })
})

test("a plate is reported exactly once, however many rivets are struck", () => {
  let plate = newShutter(source, new Rng(6))
  const right = rightRivet(plate)
  let reports = 0
  for (let i = 0; i < plate.rivets.length; i++) {
    if (i === right) continue
    const result = strikeRivet(plate, i)
    if (result.report) reports++
    plate = result.shutter
  }
  const opened = strikeRivet(plate, right)
  if (opened.report) reports++
  assert.equal(reports, 1, "one plate produced more than one report")
  assert.equal(opened.opened, true)
})

test("a hole is not an answer", () => {
  const plate = newShutter(source, new Rng(7))
  const wrong = plate.rivets.findIndex((r) => r.text !== plate.answer)
  const once = strikeRivet(plate, wrong)
  const twice = strikeRivet(once.shutter, wrong)
  assert.equal(twice.shutter, once.shutter, "a dead rivet changed the plate")
  assert.equal(twice.report, null)
})

test("an open plate takes no more strikes", () => {
  const plate = newShutter(source, new Rng(8))
  const open = strikeRivet(plate, rightRivet(plate)).shutter
  const after = strikeRivet(open, 0)
  assert.equal(after.shutter, open)
  assert.equal(after.report, null)
})

test("an index nobody could have struck is inert", () => {
  const plate = newShutter(source, new Rng(9))
  for (const index of [-1, 4, 99, Number.NaN]) {
    const result = strikeRivet(plate, index)
    assert.equal(result.shutter, plate)
    assert.equal(result.report, null)
  }
})
