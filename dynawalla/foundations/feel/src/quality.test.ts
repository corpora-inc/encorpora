import { test } from "node:test"
import assert from "node:assert/strict"
import { QUALITY, QualityGovernor, detectTier } from "./quality.ts"

test("boot detection is pessimistic — the minimum signal wins", () => {
  assert.equal(detectTier({ deviceMemoryGb: 8, cores: 8 }), "high")
  assert.equal(detectTier({ deviceMemoryGb: 8, cores: 4 }), "medium", "4 cores caps it")
  assert.equal(detectTier({ deviceMemoryGb: 2, cores: 8 }), "low", "2 GB caps it")
  assert.equal(detectTier({}), "high", "no signals is not evidence of a bad device")
})

test("a big panel on a modest chip is caught", () => {
  // The case that quietly kills mid-range tablets: looks fine on paper, is
  // filling six megapixels a frame.
  assert.equal(detectTier({ cores: 6, devicePixels: 6_000_000 }), "medium")
  assert.equal(detectTier({ cores: 8, devicePixels: 6_000_000 }), "high")
})

test("the governor does not demote on a single stutter", () => {
  const g = new QualityGovernor("high")
  for (let i = 0; i < 60; i++) g.update(16.6, false)
  g.update(48, false) // one dropped frame
  for (let i = 0; i < 60; i++) g.update(16.6, false)
  assert.equal(g.settings.tier, "high")
  assert.equal(g.demotions, 0)
})

test("the governor demotes on sustained overrun", () => {
  const g = new QualityGovernor("ultra")
  for (let i = 0; i < 400; i++) g.update(33, false)
  assert.ok(g.demotions >= 1, "never demoted despite 30 fps for 13 seconds")
  assert.notEqual(g.settings.tier, "ultra")
})

test("a clamped stall frame is not counted against the renderer", () => {
  // A tab switch or a notification must not demote the whole app.
  const g = new QualityGovernor("high")
  for (let i = 0; i < 400; i++) g.update(50, true)
  assert.equal(g.demotions, 0)
})

test("the governor promotes only with sustained headroom, and settles", () => {
  const g = new QualityGovernor("low")
  for (let i = 0; i < 4000; i++) g.update(8, false)
  assert.ok(g.promotions >= 1)
  // And then it must stop moving rather than oscillate.
  const settledAt = g.settings.tier
  const before = g.demotions + g.promotions
  for (let i = 0; i < 600; i++) g.update(8, false)
  const moved = g.demotions + g.promotions - before
  assert.ok(moved <= 1, `oscillated ${String(moved)} times after settling at ${settledAt}`)
})

test("the ceiling is respected", () => {
  const g = new QualityGovernor("low", { ceiling: "medium" })
  for (let i = 0; i < 8000; i++) g.update(6, false)
  assert.equal(g.settings.tier, "medium")
})

test("every tier draws every effect — none of them is a feature switch", () => {
  for (const t of ["low", "medium", "high", "ultra"] as const) {
    const q = QUALITY[t]
    assert.ok(q.particleScale > 0, `${t} has no particles at all`)
    assert.ok(q.motionScale > 0, `${t} has no motion at all`)
    assert.ok(q.maxPixelRatio >= 1)
  }
})

test("quality is monotonic across the ladder", () => {
  const l = [QUALITY.low, QUALITY.medium, QUALITY.high, QUALITY.ultra]
  for (let i = 1; i < l.length; i++) {
    assert.ok(l[i]!.maxPixelRatio >= l[i - 1]!.maxPixelRatio)
    assert.ok(l[i]!.particleScale >= l[i - 1]!.particleScale)
    assert.ok(l[i]!.tweenCapacity >= l[i - 1]!.tweenCapacity)
  }
})
