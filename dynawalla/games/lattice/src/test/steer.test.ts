// WHAT A THUMB MEANS.
//
// The other half of "the ship moves around too wildly". Both virtual sticks used
// to divide the thumb's offset by 64 and hand the result straight to `setMove`,
// which gave a resting thumb's tremor full authority and put full thrust a
// centimetre from where the thumb landed. See `game/steer.ts`.

import assert from "node:assert/strict"
import { test } from "node:test"

import { CURVE, DEAD_ZONE, STICK_RANGE, shapeStick } from "../game/steer.ts"

const size = (dx: number, dy: number, range = STICK_RANGE): number => {
  const s = shapeStick(dx, dy, range)
  return Math.hypot(s.x, s.y)
}

test("a thumb resting on glass moves nothing at all", () => {
  // The tremor. A pixel or two of it used to be full-authority thrust in whatever
  // direction the tremor happened to go.
  for (const wobble of [0, 0.5, 1, 2, 3, 4, 5, 6]) {
    assert.equal(size(wobble, 0), 0, `${wobble}px of tremor moved the ship`)
    assert.equal(size(0, -wobble), 0)
    assert.equal(size(wobble * 0.7, wobble * 0.7), 0)
  }
  // And the dead zone stops somewhere: this is a dead zone, not a dead stick.
  assert.ok(size(STICK_RANGE * (DEAD_ZONE + 0.05), 0) > 0, "the stick past the dead zone is dead")
  assert.ok(DEAD_ZONE > 0.02 && DEAD_ZONE < 0.25, `a dead zone of ${DEAD_ZONE} is not a dead zone`)
})

test("most of the stick's travel is the slow, accurate part", () => {
  // The linear ramp put half thrust 32px out, so the part of the stick a child
  // lines up on a mote with was about a centimetre wide and shared with
  // everything else. The curve gives half deflection well under half authority.
  const half = size(STICK_RANGE / 2, 0)
  assert.ok(half > 0.05, `half deflection is ${half.toFixed(3)} — the stick is dead`)
  assert.ok(half < 0.4, `half deflection is ${half.toFixed(3)} authority, which is still a ramp`)
  assert.ok(CURVE > 1.2, `a curve of ${CURVE} is a straight line`)
  // Monotone the whole way: a stick that is not monotone is a stick that fights.
  let last = -1
  for (let px = 0; px <= STICK_RANGE * 1.5; px += 1) {
    const now = size(px, 0)
    assert.ok(now >= last - 1e-12, `authority fell from ${last} to ${now} at ${px}px`)
    last = now
  }
})

test("full deflection is full authority and never more", () => {
  assert.ok(Math.abs(size(STICK_RANGE, 0) - 1) < 1e-9, `full deflection is ${size(STICK_RANGE, 0)}`)
  // Past the edge of the stick the thumb has run out of stick, not out of screen.
  for (const px of [STICK_RANGE, 100, 400, 4000]) {
    assert.ok(size(px, 0) <= 1 + 1e-9, `${px}px gave ${size(px, 0)} authority`)
  }
  assert.ok(Math.abs(size(4000, 0) - 1) < 1e-9)
})

test("the curve bends the magnitude and never the direction", () => {
  // A stick that bends the direction is a stick that lies about where the child
  // pointed, and on a twin-stick arena that is unplayable rather than imprecise.
  for (const [dx, dy] of [
    [30, 40],
    [-70, 10],
    [5, -300],
    [1, 1],
    [-22, -22],
  ] as const) {
    const shaped = shapeStick(dx, dy)
    const m = Math.hypot(shaped.x, shaped.y)
    if (m === 0) continue
    const wantAngle = Math.atan2(dy, dx)
    const gotAngle = Math.atan2(shaped.y, shaped.x)
    assert.ok(
      Math.abs(wantAngle - gotAngle) < 1e-9,
      `(${dx},${dy}) came out pointing ${gotAngle} instead of ${wantAngle}`,
    )
  }
})

test("nothing that is not a number comes out of the stick", () => {
  // The arena guards this from its own side too, and both guards are needed: one
  // NaN in the move vector puts the ship's position beyond recovery.
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.deepEqual(shapeStick(bad, 0), { x: 0, y: 0 })
    assert.deepEqual(shapeStick(0, bad), { x: 0, y: 0 })
    assert.deepEqual(shapeStick(10, 10, bad), { x: 0, y: 0 })
  }
  assert.deepEqual(shapeStick(10, 10, 0), { x: 0, y: 0 }, "a zero-range stick divided by zero")
  assert.deepEqual(shapeStick(10, 10, -5), { x: 0, y: 0 })
})
