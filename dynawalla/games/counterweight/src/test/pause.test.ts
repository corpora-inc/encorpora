// **The pause trap.**
//
// The host can raise a sheet — a transition surface, a parent gate — over a pack
// that is still mounted and whose rAF is still running, and it sends `pause`
// rather than unmounting. This game calls `transition` every time a scale is
// cleared, so the sheet is not hypothetical: it is raised by the game's own
// success.
//
// Without the guards, the abandonment guard runs out behind that sheet and racks
// a lot the child never saw, while the steel quietly heals underneath. A reward
// that costs the child their round is the worst bug this game could have.
//
// Every assertion below fails if `Bout.pause` stops stopping the clock.

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Question } from "../contract.ts"
import { Bout, TIMING } from "../game/bout.ts"

function deal(answer: number): () => Question {
  let n = 0
  return () => ({
    id: `q${++n}`,
    prompt: `${answer - 40} + 40`,
    answer: String(answer),
    distractors: [],
    domain: "add",
    difficulty: 0.3,
  })
}

function opened(): Bout {
  const bout = new Bout(deal(500))
  bout.begin()
  bout.advance(TIMING.hangMs + 4)
  assert.equal(bout.phase, "press")
  return bout
}

test("the guard does not run behind the sheet", () => {
  const bout = opened()
  bout.pause()
  assert.equal(bout.paused, true)

  const before = bout.elapsedMs
  const idle = bout.idle
  // Far more than the whole guard, and then some.
  const events = bout.advance(120_000)

  assert.deepEqual(events, [], "something happened behind the sheet")
  assert.equal(bout.elapsedMs, before, "the clock ran behind the sheet")
  assert.equal(bout.idle, idle, "the guard ran down behind the sheet")
  assert.equal(bout.phase, "press", "the round ended behind the sheet")

  bout.resume()
  assert.equal(bout.paused, false)
  bout.advance(bout.guardMs + 10)
  assert.equal(bout.phase, "settle", "the guard did not restart on resume")
})

test("a lot cannot be racked behind the sheet", () => {
  // The bug, exactly: an unpaused guard runs out and takes away a round the child
  // never saw.
  const bout = opened()
  bout.pause()
  const run = bout.day.run
  const held = bout.day.held

  bout.advance(120_000)

  assert.equal(bout.day.run, run, "the day's run moved behind the sheet")
  assert.equal(bout.day.held, held)
  assert.equal(bout.docket, null, "a docket was written behind the sheet")
})

test("the brass does not move behind the sheet either", () => {
  // Nothing moves a pan on its own any more — the sag is gone — so this is a
  // regression fence rather than a live bug: if anything ever starts draining a
  // pan again, it must not do it where nobody can see it.
  const bout = opened()
  bout.strike({ place: 1, dir: 1 })
  const load = bout.load
  bout.pause()
  bout.advance(120_000)
  assert.equal(bout.load, load, "the pan moved behind the sheet")
})

test("the steel does not bleed behind the sheet", () => {
  // The other direction of the same unfairness: time behind a sheet must not
  // *help* either, or a pause becomes a way to reset a beam you nearly sheared.
  const bout = opened()
  for (let i = 0; i < 3; i++) {
    bout.strike({ place: 1, dir: 1 })
    bout.advance(120)
  }
  const strain = bout.strain.level
  assert.ok(strain > 0)
  bout.pause()
  bout.advance(120_000)
  assert.equal(bout.strain.level, strain, "the steel healed behind the sheet")
})

test("a tap on the sheet is a tap on the sheet — not a blow, not a stamp", () => {
  const bout = opened()
  const load = bout.load
  bout.pause()

  assert.deepEqual(bout.strike({ place: 100, dir: 1 }), [{ kind: "refused", reason: "phase" }])
  assert.equal(bout.load, load, "a blow landed through the sheet")
  assert.deepEqual(bout.stamp(), [{ kind: "refused", reason: "phase" }])
  assert.equal(bout.docket, null, "a docket was written through the sheet")
})

test("a sheet is not a way to buy the guard back either", () => {
  // The guard freezes, it does not refill. A sheet raised with two seconds of
  // silence left leaves two seconds of silence, not the whole guard — otherwise a
  // pack left face-down on a table would hold an item checked out for ever.
  const bout = opened()
  bout.advance(bout.guardMs - 2000)
  bout.pause()
  bout.advance(60_000)
  bout.resume()

  bout.advance(1900)
  assert.equal(bout.phase, "press", "the guard shrank while the sheet was up")
  bout.advance(200)
  assert.equal(bout.phase, "settle", "the guard grew while the sheet was up")
})
