// The beam is the game's only instrument. These are the two things it must be:
// **stable**, so it never flies off the screen, and **saturating**, so it cannot
// be used as a substitute for the arithmetic.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Beam, MAX_TILT, restAngle, SETTLE_OMEGA, TUNING, TUNING_REDUCED } from "../sim/beam.ts"

test("the beam reads finely near level and says nothing at all far from it", () => {
  // One notch ahead has to be visibly different from dead level: that difference
  // is the whole reward for landing it exactly.
  assert.ok(restAngle(1) - restAngle(0) > 0.1)
  assert.ok(restAngle(0) - restAngle(-1) > 0.1)

  // And by the time you are a hundred out, so is a thousand. There is no
  // magnitude information past the stop, so no amount of watching gets you to a
  // three-digit number.
  assert.ok(Math.abs(restAngle(120) - restAngle(9000)) < 0.001)
  assert.ok(Math.abs(restAngle(120)) > MAX_TILT * 0.99)
})

test("the reading is monotone in the margin", () => {
  let previous = -Infinity
  for (let m = -60; m <= 60; m++) {
    const a = restAngle(m)
    assert.ok(a >= previous, `the beam went the wrong way at margin ${m}`)
    previous = a
  }
})

test("the beam settles, and a blow makes it stop being readable", () => {
  const beam = new Beam(TUNING)
  beam.settleTo(1)
  assert.equal(beam.settled, true)
  beam.hit(9, 1)
  assert.equal(beam.settled, false, "a blow left the beam readable")

  let ms = 0
  while (!beam.settled && ms < 4000) {
    beam.advance(16)
    ms += 16
  }
  assert.ok(beam.settled, "the beam never came to rest")
  // The cost of a probe. Long enough that hunting is slower than thinking, short
  // enough that a player who has done the arithmetic is not kept waiting.
  assert.ok(ms > 120 && ms < 900, `a blow took ${ms} ms to settle`)
})

test("a stiff spring stays stable even when the frame takes an age", () => {
  const beam = new Beam(TUNING)
  beam.settleTo(0)
  beam.aim(40)
  for (let i = 0; i < 200; i++) {
    beam.advance(120)
    assert.ok(Number.isFinite(beam.angle), "the beam went to infinity")
    assert.ok(Math.abs(beam.angle) < MAX_TILT * 3, `the beam flew off at ${beam.angle}`)
  }
  assert.ok(Math.abs(beam.angle - restAngle(40)) < 0.01)
})

test("the reduced-motion beam travels to the same reading without ringing", () => {
  const calm = new Beam(TUNING_REDUCED)
  calm.settleTo(-6)
  calm.aim(6)
  let overshoot = 0
  for (let i = 0; i < 400; i++) {
    calm.advance(8)
    overshoot = Math.max(overshoot, calm.angle - restAngle(6))
  }
  assert.ok(overshoot < 1e-6, `the calm beam overshot by ${overshoot}`)
  assert.ok(Math.abs(calm.angle - restAngle(6)) < 0.001, "the calm beam never arrived")
  // Same reading, same destination — a branch, not a degradation.
  const loud = new Beam(TUNING)
  loud.settleTo(6)
  assert.ok(Math.abs(loud.angle - calm.angle) < 0.001)
})

test("a blow under reduced motion does not set the beam ringing", () => {
  const calm = new Beam(TUNING_REDUCED)
  calm.settleTo(0)
  calm.hit(12, 1)
  assert.ok(Math.abs(calm.velocity) < SETTLE_OMEGA)
})
