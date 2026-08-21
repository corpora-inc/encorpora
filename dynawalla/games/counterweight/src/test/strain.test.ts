// The strain model, on its own. `mash.test.ts` proves what it does to a player;
// this proves the mechanism underneath is exact, frame-rate independent and
// shaped the way the design says it is.

import assert from "node:assert/strict"
import { test } from "node:test"

import { BASE_STRAIN, impulseFor, RESONANCE_MS, Strain } from "../game/strain.ts"

test("a blow on a still beam is the cheapest blow there is", () => {
  assert.equal(impulseFor(RESONANCE_MS), BASE_STRAIN)
  assert.equal(impulseFor(RESONANCE_MS + 5000), BASE_STRAIN)
  assert.equal(impulseFor(Number.POSITIVE_INFINITY), BASE_STRAIN)
})

test("the cost rises the sooner a blow lands on the last one", () => {
  let previous = Number.POSITIVE_INFINITY
  for (let gap = 0; gap <= RESONANCE_MS; gap += 10) {
    const cost = impulseFor(gap)
    assert.ok(Number.isInteger(cost), `impulse at ${gap} ms was not a whole number`)
    assert.ok(cost <= previous, `cost went up as the gap grew, at ${gap} ms`)
    previous = cost
  }
  // A blow straight on top of the last one costs several times a patient one.
  assert.ok(impulseFor(0) >= BASE_STRAIN * 5)
})

test("strain is whole units and never negative", () => {
  const strain = new Strain({ shearAt: 34 })
  strain.strike()
  for (let i = 0; i < 400; i++) {
    strain.advance(7)
    assert.ok(Number.isInteger(strain.level))
    assert.ok(strain.level >= 0)
  }
  assert.equal(strain.level, 0)
})

test("the bleed does not depend on how fast the frames come", () => {
  const coarse = new Strain({ shearAt: 34 })
  const fine = new Strain({ shearAt: 34 })
  coarse.strike()
  fine.strike()
  for (let i = 0; i < 30; i++) coarse.advance(100)
  for (let i = 0; i < 750; i++) fine.advance(4)
  assert.equal(coarse.level, fine.level)
})

test("a mash shears the steel in well under a second", () => {
  const strain = new Strain({ shearAt: 34 })
  let ms = 0
  while (!strain.isSheared && ms < 5000) {
    strain.strike()
    strain.advance(56)
    ms += 56
  }
  assert.ok(strain.isSheared, "a mash never sheared the beam")
  assert.ok(ms < 600, `a mash took ${ms} ms to shear; it has to be quicker than luck`)
})

test("a player who strikes deliberately never gets near the limit", () => {
  // Twenty-five blows — a worst-case four-digit plan — a little over a quarter of
  // a second apart. This has to be comfortable, or the game punishes the child
  // who did the arithmetic.
  const strain = new Strain({ shearAt: 24 })
  let peak = 0
  for (let i = 0; i < 25; i++) {
    strain.strike()
    peak = Math.max(peak, strain.level)
    strain.advance(280)
  }
  assert.equal(strain.isSheared, false, "a deliberate plan sheared the beam")
  assert.ok(peak < 24 * 0.8, `deliberate play peaked at ${peak} of 24`)
})

test("a fresh round is fresh steel", () => {
  // Every round gets its own beam — `Bout.hang` cuts one, because the shear
  // limit tightens from Turk to Turk. Nothing carries over from the last round's
  // mistake.
  const spent = new Strain({ shearAt: 10 })
  while (!spent.isSheared) spent.strike()
  const fresh = new Strain({ shearAt: 10 })
  assert.equal(fresh.isSheared, false)
  assert.equal(fresh.level, 0)
  assert.equal(fresh.strike(), BASE_STRAIN)
})
