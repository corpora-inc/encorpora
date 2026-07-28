import assert from "node:assert/strict"
import test from "node:test"

import { REACTIONS, type Moment, type Tier, energy, tierFor } from "./reactions.ts"

test("being wrong is never the more interesting thing that happens", () => {
  assert.ok(energy("slip") < energy("seat"), "energy(SLIP) < energy(SEAT)")
  assert.ok(energy("seat") < energy("engage"))
  assert.ok(energy("engage") < energy("illuminate"))
})

test("every tier fits inside the budget it declares", () => {
  const ceilings: Record<Tier, number> = {
    slip: 260,
    seat: 200,
    engage: 450,
    illuminate: 1_800,
  }
  for (const [tier, ceiling] of Object.entries(ceilings) as [Tier, number][]) {
    assert.ok(REACTIONS[tier].budgetMs <= ceiling, tier)
    assert.ok(REACTIONS[tier].budgetMs > 0, tier)
  }
})

test("escalation is on difficulty and repair, never on run length", () => {
  // The whole input, spelled out. If a streak, a combo or a run counter is ever
  // added to `Moment`, this fails — which is the point.
  const moment: Moment = { exact: true, courseClosed: false, breaks: 0 }
  assert.deepEqual(Object.keys(moment).sort(), ["breaks", "courseClosed", "exact"])
  assert.equal(tierFor.length, 1)
})

test("the tier follows what the cut cost", () => {
  assert.equal(tierFor({ exact: false, courseClosed: false, breaks: 0 }), "slip")
  assert.equal(tierFor({ exact: false, courseClosed: false, breaks: 4 }), "slip")
  assert.equal(tierFor({ exact: true, courseClosed: false, breaks: 0 }), "seat")
  assert.equal(tierFor({ exact: true, courseClosed: false, breaks: 1 }), "engage")
  assert.equal(tierFor({ exact: true, courseClosed: true, breaks: 0 }), "illuminate")
})

test("a slip is quieter and shorter than a seat on every axis that matters", () => {
  assert.ok(REACTIONS.slip.peakGain < REACTIONS.seat.peakGain)
  assert.ok(REACTIONS.slip.animatedElements < REACTIONS.seat.animatedElements)
  assert.ok(REACTIONS.slip.particles < REACTIONS.seat.particles)
})
