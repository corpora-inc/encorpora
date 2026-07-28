// The design entry names one sound out loud: **the block hum pitch is the log
// of the number.** So it is checked as a law rather than as a table of
// frequencies — the frequencies are taste, the law is the design.

import assert from "node:assert/strict"
import { test } from "node:test"

import { crowdPool } from "../game/factor.ts"
import {
  BOUNCE_HZ,
  HUM_ROOT,
  HUM_SEMITONES_PER_DOUBLING,
  REWARD_HZ,
  RINGOFF_HZ,
  fellHz,
  humHz,
  humSemitones,
} from "./tone.ts"

test("a bigger mob hums lower, strictly, at every size", () => {
  for (let n = 1; n < 64; n++) {
    assert.ok(humHz(n + 1) < humHz(n), `${n + 1} did not hum below ${n}`)
  }
})

test("the pitch is the log of the number: every doubling is the same interval", () => {
  // This is the whole claim. Halving a mob sounds like the same move whether it
  // was twenty-four going to twelve or four going to two, so the child hears
  // "smaller by the same amount" and not merely "different".
  const step = 12 * Math.log2(humHz(1) / humHz(2))
  assert.ok(Math.abs(step - HUM_SEMITONES_PER_DOUBLING) < 1e-9)
  for (let n = 1; n <= 40; n++) {
    const interval = 12 * Math.log2(humHz(n) / humHz(n * 2))
    assert.ok(
      Math.abs(interval - HUM_SEMITONES_PER_DOUBLING) < 1e-9,
      `${n} → ${n * 2} moved ${interval} semitones`,
    )
  }
  // And a quadrupling is exactly twice a doubling, which is what "log" means.
  for (let n = 1; n <= 20; n++) {
    const four = 12 * Math.log2(humHz(n) / humHz(n * 4))
    assert.ok(Math.abs(four - 2 * HUM_SEMITONES_PER_DOUBLING) < 1e-9)
  }
})

test("humSemitones is humHz said the other way round", () => {
  for (let n = 1; n <= 40; n++) {
    const fromHz = 12 * Math.log2(humHz(n) / HUM_ROOT)
    assert.ok(Math.abs(fromHz - humSemitones(n)) < 1e-9, `${n}`)
  }
  // `-0 === 0`, and a mob of one is the root by definition.
  assert.ok(humSemitones(1) === 0)
})

test("every mob the street can send hums somewhere audible", () => {
  for (const n of crowdPool()) {
    const hz = humHz(n)
    assert.ok(Number.isFinite(hz))
    assert.ok(hz > 60, `a mob of ${n} hums at ${hz} Hz, below a tablet speaker`)
    assert.ok(hz < 400, `a mob of ${n} hums at ${hz} Hz, up among the numerals`)
    assert.ok(fellHz(n) > hz, "a rank fell below its own drone")
  }
})

test("a degenerate size does not produce a degenerate pitch", () => {
  for (const n of [0, -3, 0.5, Number.NaN]) {
    const hz = humHz(n)
    assert.ok(Number.isFinite(hz) || Number.isNaN(n), `humHz(${n}) = ${hz}`)
  }
  assert.equal(humHz(0), HUM_ROOT)
  assert.equal(humHz(-9), HUM_ROOT)
})

test("a refusal does not sing the mob's number", () => {
  // A ring-off is the sound of a stud hitting something that does not give, and
  // it is the same sound whichever mob refused it. One that carried the number
  // would hand the child information for being wrong.
  assert.equal(typeof RINGOFF_HZ, "number")
  assert.ok(RINGOFF_HZ > 1000)
  for (const n of crowdPool()) {
    assert.notEqual(humHz(n), RINGOFF_HZ)
  }
  assert.ok(BOUNCE_HZ < humHz(24), "locked arms rang above the biggest mob")
})

test("the reward notes are a pentatonic and nothing is doubled", () => {
  assert.equal(new Set(REWARD_HZ).size, REWARD_HZ.length)
  for (let i = 1; i < REWARD_HZ.length; i++) {
    assert.ok((REWARD_HZ[i] as number) > (REWARD_HZ[i - 1] as number))
  }
})
