// **"It starts way too hard."**
//
// The game used to ask the host for nothing at all, so the opening round of a
// session was whatever the scheduler had stocked. These cases hold the two rules
// that replaced that: the opening rung is the bottom one, and the rung moves on
// what the child *achieved*, in both directions.

import assert from "node:assert/strict"
import { test } from "node:test"

import { OPENING_RUNG, requestFor, rungFor, TOP_RUNG } from "../game/ladder.ts"
import { RUN } from "../game/bout.ts"
import { play, solver } from "./harness.ts"
import { createStubHost, toUnit } from "../stubHost.ts"

test("the first lot of a session is the easiest thing the product has", () => {
  // Nothing played yet, so there is nothing to justify anything harder.
  const opening = requestFor(null)
  assert.equal(opening.difficulty, OPENING_RUNG)
  assert.equal(opening.maxDifficulty, OPENING_RUNG)
  assert.equal(opening.domain, "add")
  // On the host's wire, rung 1 is position zero: the bottom of the ladder, not
  // the top. `toUnit`'s one ambiguous value, read the safe way.
  assert.equal(toUnit(opening.difficulty), 0)
  assert.equal(rungFor({ won: 0, sentBack: 0 }), OPENING_RUNG)
})

test("a bottom-rung request actually serves two-digit sums without regrouping", () => {
  // The request is only worth making if the other end honours it — and the stub
  // honours it the way `packs/shared/game-host` does, through `toUnit`.
  const host = createStubHost({ seed: 0x51ee, reducedMotion: true })
  const request = requestFor(null)
  for (let i = 0; i < 60; i++) {
    const q = host.next(request)
    const operands = (q.prompt.match(/\d+/g) ?? []).map(Number)
    for (const n of operands) {
      assert.ok(n < 100, `${q.prompt} is not a two-digit sum`)
    }
    assert.ok(Number(q.answer) < 100, `${q.prompt} carries into a third column`)
  }
})

test("the rung climbs on scales cleared and on nothing else", () => {
  // Achievement, not a clock. A scale costs five net good weights, so this counter
  // cannot move without the child having actually been right five more times
  // than they were wrong.
  assert.equal(rungFor({ won: 0, sentBack: 0 }), 1)
  assert.equal(rungFor({ won: 3, sentBack: 0 }), 4)
  assert.equal(rungFor({ won: 40, sentBack: 0 }), TOP_RUNG)
  assert.equal(RUN, 5, "a scale stopped costing five net good weights")
})

test("and it comes back down when a barrow goes back", () => {
  // The relief valve, and the reason `raiseFloor` is not called anywhere in this
  // pack: a permanent floor is exactly what would stop a struggling child ever
  // getting easier work again.
  assert.equal(rungFor({ won: 4, sentBack: 2 }), 3)
  assert.equal(rungFor({ won: 0, sentBack: 5 }), OPENING_RUNG, "the rung fell below the bottom")
  assert.equal(requestFor({ won: 2, sentBack: 1 }).maxDifficulty, 2)
})

test("the ceiling never lets the stream drift above what was earned", () => {
  for (const record of [
    { won: 0, sentBack: 0 },
    { won: 1, sentBack: 0 },
    { won: 6, sentBack: 2 },
    { won: 30, sentBack: 0 },
  ]) {
    const request = requestFor(record)
    assert.equal(request.maxDifficulty, request.difficulty)
  }
})

test("a played session walks the rung up one scale at a time, from the bottom", () => {
  // End to end, through the shipping `Bout`: a bot that does the arithmetic
  // starts on the easiest rung and earns each one after it.
  const run = play(solver(2400, 350), { seed: 3, seconds: 400 })
  assert.equal(run.rungs[0], OPENING_RUNG, "the session did not open on the bottom rung")
  assert.ok(run.won >= 6, `a solver only cleared ${run.won} scales`)
  assert.equal(Math.max(...run.rungs), Math.min(TOP_RUNG, 1 + run.won))
  // Monotone here only because this bot never sends a barrow back; what matters
  // is that it never jumps.
  for (let i = 1; i < run.rungs.length; i++) {
    const step = (run.rungs[i] as number) - (run.rungs[i - 1] as number)
    assert.ok(step >= 0 && step <= 1, `the rung jumped by ${step}`)
  }
})

test("a player who never gets anything right is never dragged up the ladder", () => {
  // The `horde` defect, which this pack must not grow: escalation on the wall
  // clock hands three-digit addition to a child who has missed every question
  // purely for still being in the room.
  const run = play(() => [], { seed: 3, seconds: 900 })
  assert.equal(run.won, 0)
  assert.ok(run.rungs.length > 8, `only ${run.rungs.length} lots came on`)
  assert.deepEqual(
    [...new Set(run.rungs)],
    [OPENING_RUNG],
    "fifteen minutes of not answering moved the ladder",
  )
})
