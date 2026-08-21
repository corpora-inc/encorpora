import assert from "node:assert/strict"
import { test } from "node:test"

import { createStubHost } from "../stub/host.ts"
import { alwaysKeep, alwaysWait, perfect, playRun } from "../test/harness.ts"
import { isCorrect } from "./response.ts"
import { exitOf, Round, TIMING, TIMING_REDUCED } from "./round.ts"
import type { Statement } from "./statement.ts"

function fixed(truth: boolean, windowMs = 2000, stillMs = 320): () => Statement {
  return () => ({
    questionId: "q",
    expression: "47 + 25",
    claimed: truth ? "72" : "62",
    answer: "72",
    truth,
    text: `47 + 25 = ${truth ? "72" : "62"}`,
    windowMs,
    stillMs,
    p50Ms: 6000,
  })
}

/** Wind a fresh round forward to the open window. */
function atCall(deal: () => Statement, timing = TIMING): Round {
  const round = new Round(deal, timing)
  round.tap()
  round.advance(timing.raise + 320)
  return round
}

test("a run is idle until the first tap, and the first tap is the start", () => {
  const round = new Round(fixed(true))
  assert.equal(round.phase, "idle")
  round.advance(5000)
  assert.equal(round.phase, "idle", "nothing happens on its own")
  const events = round.tap()
  assert.equal(events[0]?.kind, "begin")
  assert.equal(round.phase, "raise")
})

test("the phases run raise, still, call — and the statement is cut in at the call", () => {
  const round = new Round(fixed(true))
  round.tap()
  assert.equal(round.phase, "raise")
  round.advance(TIMING.raise)
  assert.equal(round.phase, "still")
  const events = round.advance(320)
  assert.equal(round.phase, "call")
  assert.equal(events.filter((e) => e.kind === "cue").length, 1)
})

test("a flick before the statement is cut in is a flinch: counted, and ignored", () => {
  const round = new Round(fixed(false))
  round.tap()
  assert.deepEqual(round.verdict("keep"), [], "a verdict landed on a blank slate")
  const events = round.tap()
  assert.equal(events[0]?.kind, "flinch")
  assert.equal(round.run.flinches, 1)
  assert.equal(round.run.shots, 3)
  assert.equal(round.phase, "raise", "the round is not advanced by a flinch")
})

test("BOTH verdicts settle at once — nothing makes a child wait for a call they made", () => {
  // THE fix. Under one verb, only the "true" verdict ended the round; saying a sum
  // was wrong meant sitting through the whole window, every time. Now either flick
  // ends it in the same beat.
  for (const [truth, call, expected] of [
    [true, "keep", "bank"],
    [false, "toss", "spot"],
    [false, "keep", "dud"],
    [true, "toss", "burn"],
  ] as const) {
    const round = atCall(fixed(truth, 14000))
    round.advance(300)
    const events = round.verdict(call)
    const settled = events.find((e) => e.kind === "settled")
    assert.equal(settled?.kind === "settled" && settled.outcome, expected)
    assert.equal(round.phase, "verdict", `${expected} did not stop the clock`)
    assert.ok(
      settled?.kind === "settled" && settled.reactionMs <= 340,
      `${expected} reported ${String(settled?.kind === "settled" ? settled.reactionMs : -1)}ms against a 14000ms window`,
    )
  }
})

test("one flick per round — the second is ignored", () => {
  const round = atCall(fixed(true))
  round.advance(100)
  round.verdict("keep")
  assert.deepEqual(round.verdict("toss"), [], "a second flick answered the same slate")
  assert.equal(round.run.shots, 3)
})

test("the window closing untouched is a LAPSE, not a wrong answer", () => {
  const round = atCall(fixed(true, 2000))
  const events = round.advance(2000)
  const settled = events.find((e) => e.kind === "settled")
  assert.equal(settled?.kind === "settled" && settled.outcome, "lapse")
  assert.equal(round.run.shots, 3, "a lapse spent a shot")
  assert.equal(round.run.bag, 0)
  assert.equal(round.run.lapses, 1)
  // And it reports the whole window as its reaction — the only honest thing to say
  // about a window nobody touched — which is never sent to the ladder.
  assert.equal(settled?.kind === "settled" && settled.reactionMs, 2000)
})

test("a lapse on a FALSE slate is also just a lapse", () => {
  // Under one verb this was the correct answer, and a child had to wait for it. It is
  // now nothing at all, and a child who knows the answer says so in 300ms instead.
  const round = atCall(fixed(false, 2000))
  const events = round.advance(2000)
  const settled = events.find((e) => e.kind === "settled")
  assert.equal(settled?.kind === "settled" && settled.outcome, "lapse")
  assert.equal(round.run.calls, 0, "a lapse was credited as a correct call")
})

test("the slate leaves in the direction it was thrown", () => {
  assert.equal(exitOf("bank"), 1, "a kept slate must go down, into the bag")
  assert.equal(exitOf("dud"), 1, "a kept counterfeit goes down too — you kept it")
  assert.equal(exitOf("spot"), -1, "a thrown slate must go up")
  assert.equal(exitOf("burn"), -1)
  assert.equal(exitOf("lapse"), 1, "an untouched slate sinks")
})

test("a long frame gap is spent phase by phase, never skipped", () => {
  const round = new Round(fixed(false, 2000))
  round.tap()
  const events = round.advance(20_000)
  assert.ok(events.some((e) => e.kind === "cue"))
  assert.ok(events.some((e) => e.kind === "settled"))
})

test("three wrong verdicts end the run and the street stays cleared", () => {
  const host = createStubHost({ seed: 5 })
  const result = playRun(host, 11, alwaysKeep, { limit: 200 })
  assert.equal(result.finished, true)
  assert.equal(result.run.over, true)
  assert.equal(result.run.shots, 0)
  assert.equal(result.events.filter((e) => e.kind === "over").length, 1)
  assert.equal(result.run.calls, result.outcomes.filter(isCorrect).length)
})

test("a run of nothing but lapses never ends, and never earns", () => {
  const result = playRun(createStubHost({ seed: 8 }), 9, alwaysWait, { limit: 40 })
  assert.equal(result.finished, false, "waiting ended a run")
  assert.equal(result.run.shots, 3)
  assert.equal(result.run.bag, 0, `a waiter banked ${String(result.run.bag)} coins`)
  assert.ok(result.outcomes.every((o) => o === "lapse"))
})

test("a perfect player is never stopped", () => {
  const host = createStubHost({ seed: 6 })
  const result = playRun(host, 12, perfect, { limit: 150 })
  assert.equal(result.finished, false, "the cap ended it, not the game")
  assert.equal(result.run.shots, 3)
  assert.ok(result.run.calls >= 150)
})

test("reduced motion changes what is drawn, never what is timed", () => {
  const host = createStubHost({ seed: 7 })
  const a = playRun(host, 21, alwaysKeep, { timing: TIMING })
  const b = playRun(createStubHost({ seed: 7 }), 21, alwaysKeep, { timing: TIMING_REDUCED })
  assert.deepEqual(a.outcomes, b.outcomes)
  assert.equal(a.run.calls, b.run.calls)
  assert.equal(a.run.bag, b.run.bag)
  assert.deepEqual(
    a.statements.map((s) => s.text),
    b.statements.map((s) => s.text),
  )
})

// ---------------------------------------------------------------------------
// The sheet. The host can put something over the frame — a transition, a parent
// gate — and sends `pause` with the pack still mounted and its rAF still running.
// This game calls transition every tenth call, so it is not a corner.
// ---------------------------------------------------------------------------

test("a paused round does not run its clock behind the sheet", () => {
  const round = new Round(fixed(true))
  round.tap()
  round.advance(TIMING.raise)
  assert.equal(round.phase, "still")

  round.pause()
  assert.equal(round.paused, true)
  round.advance(60_000)
  assert.equal(round.phase, "still", "the clock ran behind the sheet")

  round.resume()
  assert.equal(round.paused, false)
  round.advance(320)
  assert.equal(round.phase, "call", "the clock did not restart on resume")
})

test("a slate cannot lapse while the sheet is up", () => {
  // The bug this guards: an unpaused window opens and closes behind the sheet and
  // the host is handed a `skip` for a question the child was never shown, burning it.
  const round = atCall(fixed(true))
  round.pause()
  round.advance(60_000)
  assert.equal(round.run.lapses, 0, "a question was skipped behind the sheet")
  assert.equal(round.phase, "call", "the round advanced while paused")
})

test("a flick on the sheet is a flick on the sheet — not a verdict, not a flinch", () => {
  const round = atCall(fixed(false))
  round.pause()
  const flinches = round.run.flinches
  assert.deepEqual(round.verdict("toss"), [], "a verdict was handled while paused")
  assert.deepEqual(round.tap(), [], "a tap was handled while paused")
  assert.equal(round.run.flinches, flinches, "a paused touch was counted as a flinch")
})

test("answerable is exactly when a flick means something", () => {
  const round = new Round(fixed(true))
  assert.equal(round.answerable, false, "an idle street is answerable")
  round.tap()
  assert.equal(round.answerable, false, "a blank slate is answerable")
  round.advance(TIMING.raise + 320)
  assert.equal(round.answerable, true)
  round.verdict("keep")
  assert.equal(round.answerable, false, "an answered slate is still answerable")
})
