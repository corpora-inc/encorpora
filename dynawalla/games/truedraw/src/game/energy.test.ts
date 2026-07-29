import assert from "node:assert/strict"
import { test } from "node:test"

import { VOICES } from "../audio/audio.ts"
import { energy, HAPTIC, MOVERS, TIMINGS } from "./energy.ts"
import { OUTCOMES } from "./response.ts"
import { TIMING, TIMING_REDUCED } from "./round.ts"

test("a wrong verdict has no reaction at all — in either direction", () => {
  // The bag losing coins is the ledger telling the truth, not a reaction to the
  // child. Nothing sounds, nothing buzzes, nothing flashes, the caller does not move.
  for (const timing of TIMINGS) {
    assert.equal(energy("dud", timing), 0)
    assert.equal(energy("burn", timing), 0)
  }
  assert.equal(VOICES.dud, undefined, "there is no dud voice and there must not be one")
  assert.equal(VOICES.burn, undefined, "there is no burn voice and there must not be one")
  assert.equal(HAPTIC.dud, null, "a motor pulse is a buzzer you can feel")
  assert.equal(HAPTIC.burn, null)
})

test("a lapse is the quietest thing in the game, because it is not a failure", () => {
  // A tone or a buzz at the end of a window a child was still thinking through is a
  // buzzer aimed at slowness, which is the one thing this product will not do.
  for (const timing of TIMINGS) assert.equal(energy("lapse", timing), 0)
  assert.equal(VOICES.lapse, undefined)
  assert.equal(HAPTIC.lapse, null)
})

test("being wrong is never more interesting than being right", () => {
  // energy(SLIP) < energy(SEAT), from EXPERIENCE_DESIGN.md, checked against the real
  // durations and gains rather than against a comment about them.
  for (const timing of TIMINGS) {
    for (const wrong of ["dud", "burn", "lapse"] as const) {
      assert.ok(energy(wrong, timing) < energy("bank", timing), wrong)
      assert.ok(energy(wrong, timing) < energy("spot", timing), wrong)
    }
  }
})

test("spotting a counterfeit is the biggest moment in the game", () => {
  for (const timing of TIMINGS) {
    assert.ok(energy("spot", timing) > energy("bank", timing))
  }
  assert.ok(MOVERS.spot > MOVERS.bank)
})

test("reduced motion is a branch, not a deletion", () => {
  for (const kind of ["bank", "spot"] as const) {
    assert.ok(TIMING_REDUCED.verdict[kind] > 0, kind)
    assert.ok(TIMING_REDUCED.verdict[kind] < TIMING.verdict[kind], kind)
  }
  // The ones that cannot shrink: there is no motion in a silent loss to reduce.
  assert.equal(TIMING_REDUCED.verdict.dud, TIMING.verdict.dud)
  assert.equal(TIMING_REDUCED.verdict.burn, TIMING.verdict.burn)
})

test("only the two correct verdicts buzz, and nothing buzzes at the cue", () => {
  // A haptic when the statement is cut in would let a child play the beat by feel and
  // never read the slate.
  const buzzing = OUTCOMES.filter((o) => HAPTIC[o] !== null)
  assert.deepEqual(buzzing, ["bank", "spot"], `${buzzing.join(",")} buzz`)
})

test("every outcome has a mover count and a duration — no table is left short", () => {
  for (const outcome of OUTCOMES) {
    assert.equal(typeof MOVERS[outcome], "number", outcome)
    for (const timing of TIMINGS) {
      assert.ok(timing.verdict[outcome] > 0, `${outcome} has no beat`)
    }
  }
})
