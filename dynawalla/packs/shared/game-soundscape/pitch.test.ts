import assert from "node:assert/strict"
import { test } from "node:test"

import { CENTS_PER_OCTAVE, centsBetween, centsToRatio, foldIntoRange, hz } from "./pitch.ts"

test("an octave is a doubling and a fifth is 702 cents", () => {
  assert.ok(Math.abs(centsToRatio(CENTS_PER_OCTAVE) - 2) < 1e-12)
  assert.ok(Math.abs(centsToRatio(0) - 1) < 1e-12)
  // 3/2 is 701.955 cents. A tempered fifth at 702 is within a twentieth of a
  // cent of it, which nobody can hear and every drone in this module relies on.
  assert.ok(Math.abs(centsToRatio(702) - 1.5) < 0.0006)
})

test("cents and hertz round-trip", () => {
  const root = 130.81
  for (const cents of [0, 150, 350, 498, 702, 1200, -1200]) {
    const f = hz(root, cents)
    assert.ok(Math.abs(centsBetween(root, f) - cents) < 1e-9, `${cents} did not round-trip`)
  }
})

test("a bad root or a bad interval never produces NaN", () => {
  // A NaN frequency is an oscillator that throws on start, which is a game with
  // no sound and no explanation. Every entry point has to be total.
  assert.equal(hz(Number.NaN, 700), 0)
  assert.equal(hz(0, 700), 0)
  assert.equal(hz(-10, 700), 0)
  assert.equal(hz(130, Number.NaN), 130)
  assert.equal(centsBetween(0, 100), 0)
  assert.equal(centsBetween(100, Number.NaN), 0)
})

test("folding keeps the pitch class and lands inside the range", () => {
  const lo = 130
  const hi = 1100
  // Deliberately NOT powers of two times the bounds: clamping 65 to 130 is also
  // exactly one octave, so a test built on those values passes against a fold
  // that is really a clamp — which is the bug that would flatten the top of
  // every melody into a held note.
  for (const value of [70, 45, 2100, 3300, 819]) {
    const out = foldIntoRange(value, lo, hi)
    assert.ok(out >= lo && out <= hi, `${value} folded to ${out}, outside [${lo}, ${hi}]`)
    // Same pitch class: the ratio to the original is a whole number of octaves.
    const octaves = Math.log2(out / value)
    assert.ok(Math.abs(octaves - Math.round(octaves)) < 1e-9, `${value} -> ${out} is not an octave`)
  }
})

test("folding a value already in range leaves it alone", () => {
  assert.equal(foldIntoRange(440, 130, 1100), 440)
})

test("folding a range narrower than an octave clamps instead of looping", () => {
  // A range under 2:1 has pitches with no octave inside it at all. Looping
  // would never terminate; clamping is the honest degradation.
  assert.equal(foldIntoRange(2000, 400, 500), 500)
  assert.equal(foldIntoRange(100, 400, 500), 400)
  assert.equal(foldIntoRange(Number.NaN, 130, 1100), 130)
})
