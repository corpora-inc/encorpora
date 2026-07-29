import assert from "node:assert/strict"
import { test } from "node:test"

import { COIN_WRONG, coinsFor } from "./bag.ts"
import { applyFlinch, applyOutcome, crowdOf, expectedCalls, newRun, SHOTS } from "./run.ts"

const settle = (run: ReturnType<typeof newRun>, kind: Parameters<typeof coinsFor>[0], q = 1) =>
  applyOutcome(run, kind, coinsFor(kind, q))

test("a run starts loaded, empty, and with an empty bag", () => {
  const run = newRun()
  assert.equal(run.shots, SHOTS)
  assert.equal(run.calls, 0)
  assert.equal(run.bag, 0)
  assert.equal(run.over, false)
})

test("a correct call fills the bag and costs nothing", () => {
  let run = newRun()
  run = settle(run, "bank")
  run = settle(run, "spot")
  assert.equal(run.calls, 2)
  assert.equal(run.shots, SHOTS)
  assert.equal(run.bag, coinsFor("bank", 1) * 2)
})

test("a wrong verdict spends a shot, empties coins, and never takes back a call", () => {
  let run = newRun()
  for (let i = 0; i < 4; i++) run = settle(run, "bank")
  const before = run.bag
  run = settle(run, "dud")
  assert.equal(run.calls, 4, "the tally only ever rises")
  assert.equal(run.shots, SHOTS - 1)
  assert.equal(run.dud, 1)
  assert.equal(run.bag, before - COIN_WRONG)
})

test("three wrong verdicts clear the street, in any mixture", () => {
  for (const kinds of [
    ["dud", "dud", "dud"],
    ["burn", "burn", "burn"],
    ["dud", "burn", "dud"],
  ] as const) {
    let run = newRun()
    for (const kind of kinds) run = settle(run, kind)
    assert.equal(run.over, true, kinds.join("/"))
    assert.equal(run.shots, 0)
  }
})

test("no number of lapses can end a run", () => {
  // A child who is thinking is not a child who is failing. Thirty windows closing
  // untouched costs three shots' worth of nothing.
  let run = newRun()
  for (let i = 0; i < 30; i++) run = settle(run, "lapse")
  assert.equal(run.over, false)
  assert.equal(run.shots, SHOTS)
  assert.equal(run.lapses, 30)
})

test("a finished run absorbs anything else that arrives", () => {
  let run = newRun()
  for (const kind of ["dud", "dud", "dud"] as const) run = settle(run, kind)
  const frozen = settle(applyFlinch(run), "bank")
  assert.deepEqual(frozen, run)
})

test("a flinch is counted and costs nothing", () => {
  const run = applyFlinch(applyFlinch(newRun()))
  assert.equal(run.flinches, 2)
  assert.equal(run.shots, SHOTS)
  assert.equal(run.calls, 0)
  assert.equal(run.bag, 0)
})

test("the crowd is the tally, capped, and never smaller than it was", () => {
  let run = newRun()
  let last = 0
  for (let i = 0; i < 40; i++) {
    run = settle(run, "bank")
    const crowd = crowdOf(run)
    assert.ok(crowd >= last)
    last = crowd
  }
  assert.equal(crowdOf(run), 14)
})

test("the bag never shows a debt, however badly it goes", () => {
  let run = newRun()
  run = settle(run, "bank")
  run = settle(run, "dud")
  assert.equal(run.bag, 0, `a bag of ${String(run.bag)} coins`)
  assert.ok(run.bag >= 0)
})

test("half right is a three-call run — the older half of the design, unchanged", () => {
  assert.equal(expectedCalls(0.5), 3)
  assert.equal(expectedCalls(0.75), 9)
  assert.ok(Math.abs(expectedCalls(0.9) - 27) < 1e-9)
  assert.equal(expectedCalls(1), Number.POSITIVE_INFINITY)
  assert.equal(expectedCalls(0), 0)
})

test("run length climbs faster than accuracy does", () => {
  let previous = -1
  for (const p of [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) {
    const calls = expectedCalls(p)
    assert.ok(calls > previous, `${String(p)}`)
    previous = calls
  }
  assert.ok(expectedCalls(0.9) / expectedCalls(0.5) >= 9)
})
