// **The pause trap.**
//
// The host can raise a sheet — a transition surface, a parent gate — over a pack
// that is still mounted and whose rAF is still running, and it sends `pause`
// rather than unmounting. This game calls `transition` every time a Turk goes
// over, so the sheet is not hypothetical: it is raised by the game's own success.
//
// Without the guards, the press window opens and closes behind that sheet, the
// whistle seats the beam wherever it stood, and the child is marked wrong — and
// loses ground — for a column they were never shown. A reward that costs the
// match is the worst bug this game could have.
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

test("the clock does not run behind the sheet", () => {
  const bout = opened()
  bout.pause()
  assert.equal(bout.paused, true)

  const before = bout.elapsedMs
  // Far more than the whole window, and then some.
  const events = bout.advance(120_000)

  assert.deepEqual(events, [], "something happened behind the sheet")
  assert.equal(bout.elapsedMs, before, "the clock ran behind the sheet")
  assert.equal(bout.phase, "press", "the window closed behind the sheet")

  bout.resume()
  assert.equal(bout.paused, false)
  bout.advance(TIMING.pressMs + 10)
  assert.equal(bout.phase, "settle", "the clock did not restart on resume")
})

test("a round cannot be lost behind the sheet", () => {
  // The bug, exactly: an unpaused window closes, the whistle seats a beam the
  // child never saw, and the arm goes the wrong way for it.
  const bout = opened()
  bout.pause()
  const arm = bout.match.arm
  const held = bout.match.held

  bout.advance(120_000)

  assert.equal(bout.match.arm, arm, "ground was taken behind the sheet")
  assert.equal(bout.match.held, held)
  assert.equal(bout.seat, null, "the beam was judged behind the sheet")
})

test("the pan does not settle behind the sheet either", () => {
  // The sag is a clock too, and a slow one. Left running behind a sheet it turns
  // a correct load into a wrong one without a single frame the child saw.
  const bout = opened()
  const load = bout.load
  bout.pause()
  bout.advance(120_000)
  assert.equal(bout.load, load, "the pan sagged behind the sheet")
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

test("a tap on the sheet is a tap on the sheet — not a blow, not a seat", () => {
  const bout = opened()
  const load = bout.load
  bout.pause()

  assert.deepEqual(bout.strike({ place: 100, dir: 1 }), [{ kind: "refused", reason: "phase" }])
  assert.equal(bout.load, load, "a blow landed through the sheet")
  assert.deepEqual(bout.seatNow(), [{ kind: "refused", reason: "phase" }])
  assert.equal(bout.seat, null, "the beam was seated through the sheet")
})

test("resuming does not hand back a window that has already gone", () => {
  // A sheet raised with two seconds left leaves two seconds, not thirteen.
  const bout = opened()
  bout.advance(TIMING.pressMs - 2000)
  bout.pause()
  bout.advance(60_000)
  bout.resume()

  bout.advance(1900)
  assert.equal(bout.phase, "press", "the window grew while the sheet was up")
  bout.advance(200)
  assert.equal(bout.phase, "settle", "the window did not close when it should have")
})
