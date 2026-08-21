// Combo-reactive spring tests (PREMIUM_SCROLL §3.1): momentum eases in and
// saturates; stiffness lifts from the calm baseline but stays bounded; reduced
// motion collapses to a cross-fade with no travel.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  cardTransition,
  comboMomentum,
  comboStiffness,
  isComboMilestone,
  settleWeight,
} from "./cardTransition.ts"

test("no momentum below combo 2 (calm baseline)", () => {
  assert.equal(comboMomentum(0), 0)
  assert.equal(comboMomentum(1), 0)
  assert.equal(comboStiffness(1), 320)
})

test("momentum rises with combo and saturates at 1", () => {
  const a = comboMomentum(3)
  const b = comboMomentum(6)
  const c = comboMomentum(12)
  assert.ok(a > 0 && a < b && b < c)
  assert.ok(c <= 1)
  // past saturation adds nothing
  assert.equal(comboMomentum(40), comboMomentum(12))
})

test("early combos matter most (ease-out shape)", () => {
  // gain from 2→5 exceeds gain from 9→12
  const early = comboMomentum(5) - comboMomentum(2)
  const late = comboMomentum(12) - comboMomentum(9)
  assert.ok(early > late)
})

test("stiffness lift is bounded (never runaway)", () => {
  assert.equal(comboStiffness(0), 320)
  assert.ok(comboStiffness(40) <= 320 + 120)
  assert.equal(comboStiffness(40), comboStiffness(12))
})

test("reduced motion is a cross-fade, not a spring", () => {
  const t = cardTransition(10, true)
  assert.equal(t.type, "tween")
  const w = settleWeight(10, true)
  assert.deepEqual(w.scale, [1]) // no pulse
})

test("full motion is a combo-scaled spring", () => {
  const calm = cardTransition(1, false) as { stiffness: number }
  const hot = cardTransition(12, false) as { stiffness: number }
  assert.equal(calm.stiffness, 320)
  assert.ok(hot.stiffness > calm.stiffness)
})

test("gauge milestones fire on 5 / 10 / 25 and every 25 after (not others)", () => {
  for (const c of [5, 10, 25, 50, 75]) {
    assert.equal(isComboMilestone(c), true, `combo ${c} should be a milestone`)
  }
  for (const c of [2, 3, 4, 6, 9, 11, 24, 26, 40]) {
    assert.equal(isComboMilestone(c), false, `combo ${c} should not be a milestone`)
  }
})

test("settle weight is a small heavy pulse, firmer at high combo", () => {
  const calm = settleWeight(1, false)
  const hot = settleWeight(12, false)
  assert.equal(calm.scale[0], 1)
  assert.equal(calm.scale[2], 1)
  assert.ok(calm.scale[1] > 1 && calm.scale[1] < 1.03) // small, not a bounce
  assert.ok(hot.scale[1] > calm.scale[1]) // firmer when hot
})
