import assert from "node:assert/strict"
import { test } from "node:test"

import { createStubHost } from "../stub/host.ts"
import { alwaysDraw, alwaysHold, perfect, playRun } from "../test/harness.ts"
import { isCorrect } from "./response.ts"
import { Round, TIMING, TIMING_REDUCED } from "./round.ts"
import type { Statement } from "./statement.ts"

function fixed(truth: boolean, windowMs = 2000, stillMs = 800): () => Statement {
  return () => ({
    questionId: "q",
    expression: "47 + 25",
    claimed: truth ? "72" : "62",
    answer: "72",
    truth,
    text: `47 + 25 = ${truth ? "72" : "62"}`,
    windowMs,
    stillMs,
  })
}

test("a run is idle until the first tap, and the first tap is the start", () => {
  const round = new Round(fixed(true))
  assert.equal(round.phase, "idle")
  round.advance(5000)
  assert.equal(round.phase, "idle", "nothing happens on its own")
  const events = round.press()
  assert.equal(events[0]?.kind, "begin")
  assert.equal(round.phase, "raise")
})

test("the phases run raise, still, call — and the cue is the only signal", () => {
  const round = new Round(fixed(true))
  round.press()
  assert.equal(round.phase, "raise")
  round.advance(TIMING.raise)
  assert.equal(round.phase, "still")
  const events = round.advance(800)
  assert.equal(round.phase, "call")
  assert.equal(events.filter((e) => e.kind === "cue").length, 1)
})

test("a press before the slate lights is a flinch: counted, and ignored", () => {
  const round = new Round(fixed(false))
  round.press()
  const events = round.press()
  assert.equal(events[0]?.kind, "flinch")
  assert.equal(round.run.flinches, 1)
  assert.equal(round.run.shots, 3)
  assert.equal(round.phase, "raise", "the round is not advanced by a flinch")
})

test("drawing at a true slate settles at once — the only thing that hurries the game", () => {
  const round = new Round(fixed(true))
  round.press()
  round.advance(TIMING.raise + 800)
  assert.equal(round.phase, "call")
  round.advance(200)
  const events = round.press()
  const settled = events.find((e) => e.kind === "settled")
  assert.equal(settled?.kind === "settled" && settled.outcome, "hit")
  assert.equal(round.phase, "verdict")
  assert.ok(settled?.kind === "settled" && settled.reactionMs <= 220)
})

test("drawing at a false slate buys no time at all", () => {
  // The press is spent, the world does not react, and the window still runs to
  // the last millisecond. Mashing gets the slowest possible game.
  const round = new Round(fixed(false, 2000))
  round.press()
  round.advance(TIMING.raise + 800)
  assert.equal(round.phase, "call")
  round.advance(100)
  assert.deepEqual(round.press(), [], "nothing happens")
  assert.equal(round.phase, "call", "and the clock does not move on")
  round.advance(400)
  assert.equal(round.phase, "call")
  const events = round.advance(1600)
  const settled = events.find((e) => e.kind === "settled")
  assert.equal(settled?.kind === "settled" && settled.outcome, "wild")
  assert.equal(round.run.shots, 2)
})

test("letting a false slate stand is the bow", () => {
  const round = new Round(fixed(false, 2000))
  round.press()
  round.advance(TIMING.raise + 800)
  const events = round.advance(2000)
  const settled = events.find((e) => e.kind === "settled")
  assert.equal(settled?.kind === "settled" && settled.outcome, "bow")
  assert.equal(round.run.calls, 1)
  assert.equal(round.run.shots, 3)
})

test("letting a true slate stand costs a shot", () => {
  const round = new Round(fixed(true, 2000))
  round.press()
  round.advance(TIMING.raise + 800)
  const events = round.advance(2000)
  const settled = events.find((e) => e.kind === "settled")
  assert.equal(settled?.kind === "settled" && settled.outcome, "slow")
  assert.equal(round.run.shots, 2)
})

test("a long frame gap is spent phase by phase, never skipped", () => {
  // A backgrounded tab hands back one enormous delta. The machine must not owe
  // the child a round it never played.
  const round = new Round(fixed(false, 2000))
  round.press()
  const events = round.advance(20_000)
  assert.ok(events.some((e) => e.kind === "cue"))
  assert.ok(events.some((e) => e.kind === "settled"))
})

test("three misses end the run and the street stays cleared", () => {
  const host = createStubHost({ seed: 5 })
  const result = playRun(host, 11, alwaysHold, { limit: 200 })
  assert.equal(result.finished, true)
  assert.equal(result.run.over, true)
  assert.equal(result.run.shots, 0)
  assert.equal(result.events.filter((e) => e.kind === "over").length, 1)
  assert.equal(result.run.calls, result.outcomes.filter(isCorrect).length)
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
  const a = playRun(host, 21, alwaysDraw, { timing: TIMING })
  const b = playRun(createStubHost({ seed: 7 }), 21, alwaysDraw, { timing: TIMING_REDUCED })
  // Same seed, same questions, same truth schedule, same calls: the motion
  // preference is a rendering branch and touches no rule.
  assert.deepEqual(a.outcomes, b.outcomes)
  assert.equal(a.run.calls, b.run.calls)
  assert.deepEqual(
    a.statements.map((s) => s.text),
    b.statements.map((s) => s.text),
  )
})

// ---------------------------------------------------------------------------
// The sheet. The host can put something over the frame — a transition, a parent
// gate — and sends `pause` with the pack still mounted and its rAF still
// running. This game calls transition every tenth call, so it is not a corner.
// ---------------------------------------------------------------------------

test("a paused round does not run its clock behind the sheet", () => {
  const round = new Round(fixed(true))
  round.press()
  round.advance(TIMING.raise)
  assert.equal(round.phase, "still")

  round.pause()
  assert.equal(round.paused, true)
  // Far more than enough to cross `still` and the whole draw window.
  round.advance(60_000)
  assert.equal(round.phase, "still", "the clock ran behind the sheet")

  round.resume()
  assert.equal(round.paused, false)
  round.advance(800)
  assert.equal(round.phase, "call", "the clock did not restart on resume")
})

test("a true slate cannot cost a shot while the sheet is up", () => {
  // The bug this guards, exactly: an unpaused draw window opens and closes
  // behind the sheet, settles as a hold, and a *true* statement takes one of
  // the child's three shots for a slate they were never shown. A reward that
  // costs a life is the worst outcome this game has.
  const round = new Round(fixed(true))
  round.press()
  round.advance(TIMING.raise)
  round.pause()
  const before = round.run.shots

  round.advance(60_000)

  assert.equal(round.run.shots, before, "a shot was spent behind the sheet")
  assert.equal(round.phase, "still", "the round advanced while paused")
})

test("a tap on the sheet is a tap on the sheet — not a draw, not a flinch", () => {
  const round = new Round(fixed(false))
  round.press()
  round.advance(TIMING.raise)
  round.pause()
  const flinches = round.run.flinches
  const events = round.press()
  assert.equal(events.length, 0, "a press was handled while paused")
  assert.equal(round.run.flinches, flinches, "a paused press was counted as a flinch")
})
