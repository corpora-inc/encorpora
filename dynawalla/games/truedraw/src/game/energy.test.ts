import assert from "node:assert/strict"
import { test } from "node:test"

import { VOICES } from "../audio/audio.ts"
import { energy, HAPTIC, MOVERS, TIMINGS } from "./energy.ts"
import { TIMING, TIMING_REDUCED } from "./round.ts"

test("a wrong draw has no reaction at all — no motion, no sound, no motor", () => {
  for (const timing of TIMINGS) {
    assert.equal(energy("wild", timing), 0)
  }
  assert.equal(MOVERS.wild, 0)
  assert.equal(VOICES.wild, undefined, "there is no wild voice and there must not be one")
  assert.equal(HAPTIC.wild, null, "a motor pulse is a buzzer you can feel")
})

test("being wrong is never more interesting than being right", () => {
  // energy(SLIP) < energy(SEAT), from EXPERIENCE_DESIGN.md, checked against the
  // real durations and gains rather than against a comment about them.
  for (const timing of TIMINGS) {
    assert.ok(energy("slow", timing) < energy("hit", timing))
    assert.ok(energy("wild", timing) < energy("hit", timing))
  }
})

test("the correct hold is the biggest moment in the game", () => {
  for (const timing of TIMINGS) {
    assert.ok(energy("bow", timing) > energy("hit", timing))
    assert.ok(energy("bow", timing) > energy("slow", timing))
  }
})

test("reduced motion is a branch, not a deletion", () => {
  for (const kind of ["hit", "bow", "slow"] as const) {
    assert.ok(TIMING_REDUCED.verdict[kind] > 0, kind)
    assert.ok(TIMING_REDUCED.verdict[kind] < TIMING.verdict[kind], kind)
  }
  // The one that cannot shrink: there is no motion in being ignored to reduce.
  assert.equal(TIMING_REDUCED.verdict.wild, TIMING.verdict.wild)
})

test("nothing sounds at the cue", () => {
  // A haptic or a distinct tone at the go signal would let a child play the
  // flash by feel and never read the slate. The cue is a light change.
  assert.equal(Object.values(HAPTIC).filter((h) => h !== null).length, 3)
})
