import assert from "node:assert/strict"
import { test } from "node:test"

import { applyFlinch, applyOutcome, crowdOf, expectedCalls, newRun, SHOTS } from "./run.ts"

test("a run starts loaded and empty", () => {
  const run = newRun()
  assert.equal(run.shots, SHOTS)
  assert.equal(run.calls, 0)
  assert.equal(run.over, false)
})

test("a correct call adds to the tally and costs nothing", () => {
  let run = newRun()
  run = applyOutcome(run, "hit")
  run = applyOutcome(run, "bow")
  assert.equal(run.calls, 2)
  assert.equal(run.shots, SHOTS)
})

test("a miss spends a shot and never takes back a call", () => {
  let run = applyOutcome(applyOutcome(newRun(), "hit"), "hit")
  run = applyOutcome(run, "wild")
  assert.equal(run.calls, 2, "the tally only ever rises")
  assert.equal(run.shots, SHOTS - 1)
  assert.equal(run.wild, 1)
})

test("three misses clear the street, in any mixture", () => {
  for (const kinds of [
    ["wild", "wild", "wild"],
    ["slow", "slow", "slow"],
    ["wild", "slow", "wild"],
  ] as const) {
    let run = newRun()
    for (const kind of kinds) run = applyOutcome(run, kind)
    assert.equal(run.over, true, kinds.join("/"))
    assert.equal(run.shots, 0)
  }
})

test("a finished run absorbs anything else that arrives", () => {
  let run = newRun()
  for (const kind of ["wild", "wild", "wild"] as const) run = applyOutcome(run, kind)
  const frozen = applyOutcome(applyFlinch(run), "hit")
  assert.deepEqual(frozen, run)
})

test("a flinch is counted and costs nothing", () => {
  const run = applyFlinch(applyFlinch(newRun()))
  assert.equal(run.flinches, 2)
  assert.equal(run.shots, SHOTS)
  assert.equal(run.calls, 0)
})

test("the crowd is the tally, capped, and never smaller than it was", () => {
  let run = newRun()
  let last = 0
  for (let i = 0; i < 40; i++) {
    run = applyOutcome(run, "hit")
    const crowd = crowdOf(run)
    assert.ok(crowd >= last)
    last = crowd
  }
  assert.equal(crowdOf(run), 14)
})

test("half right is a three-call run — the whole design in one number", () => {
  // Drawing at everything is right exactly half the time, and half is not a
  // grade here: it is a length. There is no arrangement of three calls that
  // looks like doing well.
  assert.equal(expectedCalls(0.5), 3)
  assert.equal(expectedCalls(0.75), 9)
  assert.ok(Math.abs(expectedCalls(0.9) - 27) < 1e-9)
  assert.equal(expectedCalls(1), Number.POSITIVE_INFINITY)
  assert.equal(expectedCalls(0), 0)
})

test("run length climbs faster than accuracy does", () => {
  // The gap between a masher and a careful player is not ten percent. It is
  // nine times the run.
  let previous = -1
  for (const p of [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) {
    const calls = expectedCalls(p)
    assert.ok(calls > previous, `${String(p)}`)
    previous = calls
  }
  assert.ok(expectedCalls(0.9) / expectedCalls(0.5) >= 9)
})
