// Haptic-gate tests (PREMIUM_SCROLL §3.2): the four-layer gate must pass
// entirely before any buzz — reduced-motion + minimal-intensity + the enabled
// flag each veto independently. Pure logic, no vibration surface needed.

import { test } from "node:test"
import assert from "node:assert/strict"
import { shouldFireHaptic, type HapticGate } from "./haptics.ts"

const on: HapticGate = { enabled: true, reducedMotion: false, intensity: "full" }

test("fires when enabled, motion allowed, intensity not minimal", () => {
  assert.equal(shouldFireHaptic(on), true)
  assert.equal(shouldFireHaptic({ ...on, intensity: "reduced" }), true)
})

test("the sound/haptic setting off vetoes everything", () => {
  assert.equal(shouldFireHaptic({ ...on, enabled: false }), false)
})

test("reduced-motion is first-class: no buzz", () => {
  assert.equal(shouldFireHaptic({ ...on, reducedMotion: true }), false)
})

test("minimal intensity silences haptics (feed is still + silent)", () => {
  assert.equal(shouldFireHaptic({ ...on, intensity: "minimal" }), false)
})

test("any single veto is enough", () => {
  assert.equal(
    shouldFireHaptic({ enabled: false, reducedMotion: true, intensity: "minimal" }),
    false,
  )
})
