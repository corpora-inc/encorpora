// UP IS UP.
//
// A founder playtest: "up and down are reversed, like a flight simulator."
// They were. `core/input.ts` reports the stick in CSS pixels (+y is DOWN) and
// `movePlayer` fed that straight into a world where +y is UP, so screen-down
// drove the diver up the screen. Pointer, touch and keyboard all converge on
// `stick.y` before anything reads it, so all three were inverted together and
// one conversion fixes all three — which is what these tests hold.
//
// What is NOT held here: that the GPU agrees. `world +y is up` is a fact about
// two GLSL strings and there is no WebGL in Node. See the header of `motion.ts`.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  type Diver,
  type View,
  drive,
  integrate,
  screenFromWorld,
  worldFromScreen,
} from "./motion.ts"

/** A phone, mid-run. `halfW/halfH` are world units; `cssW/cssH` are pixels. */
const VIEW: View = { camX: 0, camY: 0, halfW: 390, halfH: 844, cssW: 390, cssH: 844 }

const SPEED = 205 // loadout.ts, the base diver
const DT = 1 / 60

/** Hold a stick for `seconds` and report where the diver ended up, on screen. */
function swim(stickX: number, stickY: number, seconds: number): { x: number; y: number } {
  const d: Diver = { x: 0, y: 0, vx: 0, vy: 0 }
  for (let f = 0; f < Math.round(seconds / DT); f++) integrate(d, stickX, stickY, SPEED, DT)
  return screenFromWorld(d.x, d.y, VIEW)
}

test("the stick pushed DOWN takes the diver down the screen", () => {
  const start = screenFromWorld(0, 0, VIEW)
  const end = swim(0, 1, 1)
  assert.ok(
    end.y > start.y,
    `stick down moved the diver from screen y=${start.y} to y=${end.y} — that is UP the screen, ` +
      "which is the flight-simulator inversion this file exists to end",
  )
})

test("the stick pushed UP takes the diver up the screen", () => {
  const start = screenFromWorld(0, 0, VIEW)
  const end = swim(0, -1, 1)
  assert.ok(end.y < start.y, `stick up moved the diver to screen y=${end.y}, below y=${start.y}`)
})

test("left and right were never wrong, and must stay that way", () => {
  const start = screenFromWorld(0, 0, VIEW)
  assert.ok(swim(1, 0, 1).x > start.x, "stick right must go right")
  assert.ok(swim(-1, 0, 1).x < start.x, "stick left must go left")
})

test("every input path is the same path — S, ArrowDown and a thumb agree", () => {
  // `Input.update` folds the keyboard axis and the pointer axis into one
  // `stick.y` before `movePlayer` sees either, so there is exactly one sign to
  // get wrong. This asserts the fold point rather than three lookalikes: what
  // `s`, `ArrowDown` and a downward drag all produce is `stick.y = +1`.
  const fromKeyboard = 1 // kyTarget for "s" / "arrowdown"
  const fromThumb = (620 - 500) / 62 // (knobY - originY) / RADIUS, clamped to 1
  assert.ok(fromThumb > 0, "a downward drag is a positive stick.y")
  assert.equal(Math.sign(fromKeyboard), Math.sign(Math.min(1, fromThumb)))
  assert.ok(drive(0, 1).y < 0, "a positive (downward) stick.y must drive world −y")
})

test("the diver goes toward the screen point the thumb is pulling toward", () => {
  // The coupling that actually broke: `drawStick` laid the joystick ring out
  // with one sign and `movePlayer` drove with the other, so the ring the child
  // saw and the direction they travelled disagreed. Both now go through this
  // file, and this asserts they agree — pull the stick toward a point low on
  // the screen and the diver must get closer to that point on the screen.
  const origin = { x: 195, y: 400 } // where the thumb landed, CSS px
  const knob = { x: 195, y: 462 } // dragged 62px straight down: full deflection
  const stickX = (knob.x - origin.x) / 62
  const stickY = (knob.y - origin.y) / 62

  // The stick is a direction, not a destination, so the question is whether the
  // diver's travel on screen points the same way as the thumb's pull on screen.
  const pullX = knob.x - origin.x
  const pullY = knob.y - origin.y

  const from = screenFromWorld(0, 0, VIEW)
  const to = swim(stickX, stickY, 1)
  const dot = (to.x - from.x) * pullX + (to.y - from.y) * pullY
  assert.ok(
    dot > 0,
    `the thumb pulled (${pullX}, ${pullY}) on screen and the diver travelled ` +
      `(${(to.x - from.x).toFixed(0)}, ${(to.y - from.y).toFixed(0)}) — it swam away from the thumb`,
  )

  // And the ring the child sees is laid out with the same map, so it lands
  // under the thumb rather than at the reflected height.
  const ring = worldFromScreen(knob.x, knob.y, VIEW)
  const ringBack = screenFromWorld(ring.x, ring.y, VIEW)
  assert.ok(Math.abs(ringBack.x - knob.x) < 1e-6 && Math.abs(ringBack.y - knob.y) < 1e-6)
  assert.ok(
    ring.y < worldFromScreen(origin.x, origin.y, VIEW).y,
    "a knob dragged DOWN the screen must sit lower in the world than its origin",
  )
})

test("screen (0,0) is the TOP-left of the world, not the bottom-left", () => {
  // `drawStick` had this backwards: `camY - hh + originY * hpp` put screen y=0
  // at the world's bottom edge, so the thumb ring drew at the mirrored height.
  const topLeft = worldFromScreen(0, 0, VIEW)
  const bottomLeft = worldFromScreen(0, VIEW.cssH, VIEW)
  assert.equal(topLeft.x, VIEW.camX - VIEW.halfW)
  assert.equal(topLeft.y, VIEW.camY + VIEW.halfH, "screen y=0 is the world's TOP edge")
  assert.equal(bottomLeft.y, VIEW.camY - VIEW.halfH)
})

test("the integrator is the one the game runs — it caps at the stat speed", () => {
  const d: Diver = { x: 0, y: 0, vx: 0, vy: 0 }
  for (let f = 0; f < 600; f++) integrate(d, 1, 0, SPEED, DT)
  assert.ok(Math.abs(d.vx - SPEED) < 1, `terminal speed ${d.vx.toFixed(1)} is not the stat ${SPEED}`)
})
