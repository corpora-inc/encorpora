// THE DEFECT, PLAYED. "I still get `2+0=1` and have to wait until it times out."
//
// This file exists to hold one number, and it is the number the whole rework was
// commissioned by. Under one verb, a child who was certain in 300 milliseconds paid
// the ENTIRE window for every verdict they expressed by waiting — because waiting
// was how one of the two verdicts was expressed.
//
// The old machine is reconstructed here rather than described, so the size of the
// hole is a measurement and not a claim, and so the fix is compared against the
// thing it replaced instead of against a comment about it.

import assert from "node:assert/strict"
import { test } from "node:test"

import { createStubHost } from "../stub/host.ts"
import { perfect, playRun } from "../test/harness.ts"
import { comprehensionMsFor } from "./cadence.ts"
import { MAX_STEP_MS, Round, TIMING } from "./round.ts"
import type { Statement } from "./statement.ts"

/** A child who is certain, fast, on every slate. */
const CERTAIN_MS = 300

function statement(truth: boolean, windowMs: number): Statement {
  return {
    questionId: "q",
    expression: "47 + 25",
    claimed: truth ? "72" : "62",
    answer: "72",
    truth,
    text: `47 + 25 = ${truth ? "72" : "62"}`,
    windowMs,
    stillMs: 320,
    p50Ms: 6000,
  }
}

/**
 * THE OLD MACHINE, in eleven lines.
 *
 * One verb. A press meant "true". Saying "false" was letting the window run out, so
 * the cost of a false verdict was, unavoidably and by construction, `windowMs`.
 * There was no other way to say it.
 */
function oldVerdictCostMs(truth: boolean, windowMs: number, certainAtMs: number): number {
  return truth ? certainAtMs : windowMs
}

test("under one verb, a certain child paid the whole window on half of all slates", () => {
  // The two-digit regrouping class. `cadence.ts` gives it a p90 of 14 s, which is the
  // window — correctly, because a window is the child's time. What was wrong was
  // having to SPEND it to say one of the two things.
  const window = comprehensionMsFor("47 + 25 = 62")
  assert.equal(window, 14000)
  assert.equal(oldVerdictCostMs(true, window, CERTAIN_MS), CERTAIN_MS)
  assert.equal(
    oldVerdictCostMs(false, window, CERTAIN_MS),
    14000,
    "the old machine did not make a certain child wait",
  )
  // Forty-six times the thinking, spent on nothing, on half of every run.
  assert.ok(oldVerdictCostMs(false, window, CERTAIN_MS) / CERTAIN_MS > 45)
})

test("NOW: a certain child pays what they thought, whichever verdict it is", () => {
  const window = comprehensionMsFor("753 + 577 = 1330")
  assert.ok(window >= 14000, `the window shrank to ${String(window)}ms — #657 must not be undone`)
  for (const [truth, call] of [
    [true, "keep"],
    [false, "toss"],
  ] as const) {
    const round = new Round(() => statement(truth, window), TIMING)
    round.tap()
    round.advance(TIMING.raise + 320)
    assert.equal(round.phase, "call")
    round.advance(CERTAIN_MS)
    const events = round.verdict(call)
    const settled = events.find((e) => e.kind === "settled")
    assert.ok(settled?.kind === "settled")
    assert.ok(
      settled.reactionMs <= CERTAIN_MS + 40,
      `${call} cost ${String(settled.reactionMs)}ms of a ${String(window)}ms window`,
    )
    // ...and for the verdict that used to be expressed by waiting, it is a fortieth
    // of what it used to cost. Asserted only on that half of the pair: the `|| truth`
    // escape hatch this line used to carry made the other half tautological, which is
    // worse than not asserting it.
    if (!truth) {
      assert.ok(
        settled.reactionMs * 40 < oldVerdictCostMs(truth, window, CERTAIN_MS),
        `a toss costs ${String(settled.reactionMs)}ms against the old ${String(oldVerdictCostMs(truth, window, CERTAIN_MS))}ms`,
      )
    }
  }
})

test("a fast perfect run gets MANY more slates per unit of wall clock than the old one", () => {
  // The founder's actual experience, as throughput. A certain child playing the new
  // machine spends `CERTAIN_MS` per round; the old one spent `CERTAIN_MS` on true
  // slates and the whole window on false ones, and the bag deals those in halves.
  const result = playRun(createStubHost({ seed: 31, level: 4 }), 32, perfect, {
    limit: 60,
    thinkMs: () => CERTAIN_MS,
  })
  const settled = result.events.filter((e) => e.kind === "settled")
  assert.ok(settled.length > 40, `only ${String(settled.length)} rounds`)

  let now = 0
  let then = 0
  for (const e of settled) {
    if (e.kind !== "settled") continue
    now += e.reactionMs
    then += oldVerdictCostMs(e.statement.truth, e.statement.windowMs, CERTAIN_MS)
  }
  assert.ok(
    then / now > 10,
    `the wait is only ${(then / now).toFixed(1)}x shorter (${String(then)}ms → ${String(now)}ms)`,
  )
  // And not one of those rounds is a lapse: a certain child never runs out of time.
  assert.equal(result.outcomes.filter((o) => o === "lapse").length, 0)
})

test("NEITHER verdict now costs more than the other — the asymmetry is gone", () => {
  // The deeper defect. It was not that waiting was slow; it was that ONE OF THE TWO
  // VERDICTS HAD NO TIMESTAMP, so the ladder could not read half of a child's calls.
  // Symmetry here is what makes the speed signal usable.
  const window = 14000
  const costs: Record<string, number> = {}
  for (const [truth, call] of [
    [true, "keep"],
    [false, "toss"],
    [false, "keep"],
    [true, "toss"],
  ] as const) {
    const round = new Round(() => statement(truth, window), TIMING)
    round.tap()
    round.advance(TIMING.raise + 320)
    round.advance(1234)
    const settled = round.verdict(call).find((e) => e.kind === "settled")
    assert.ok(settled?.kind === "settled")
    costs[settled.outcome] = settled.reactionMs
  }
  const values = Object.values(costs)
  assert.equal(values.length, 4, `only ${String(values.length)} distinct outcomes reached a verdict`)
  for (const v of values) {
    assert.ok(
      Math.abs(v - 1234) <= 40,
      `one verdict reported ${String(v)}ms where the others reported ~1234ms: ${JSON.stringify(costs)}`,
    )
  }
})

// ---------------------------------------------------------------------------
// WHAT THE LATENCY MEASURES. Three anchors are wrong and one is right, and two
// sibling packs shipped the wrong ones.
// ---------------------------------------------------------------------------

test("a frame a slow phone actually produces is charged to the child", () => {
  // `MAX_STEP_MS` was 120, which is below a real frame on a device dropping to 5 fps —
  // so `elapsed` accrued 120ms for every 200ms the child actually spent, every reaction
  // time on a slow phone was under-reported by about 40%, and the child collected a
  // systematic speed bonus and a faster ladder climb for owning a worse device. Now
  // that the reaction time drives both the bag and the difficulty, that is a bias and
  // not a rounding error.
  assert.ok(
    MAX_STEP_MS >= 250,
    `MAX_STEP_MS is ${String(MAX_STEP_MS)}ms, which clamps frames a running app produces`,
  )
  // Jank is charged; suspension is not. A round driven in 200ms lumps reports the real
  // elapsed time.
  const round = new Round(() => statement(true, 14000), TIMING)
  round.tap()
  round.advance(TIMING.raise + 320)
  for (let i = 0; i < 10; i++) round.advance(Math.min(MAX_STEP_MS, 200))
  const settled = round.verdict("keep").find((e) => e.kind === "settled")
  assert.ok(settled?.kind === "settled")
  assert.equal(settled.reactionMs, 2000, "a janky two seconds was not charged in full")
})

test("the clock starts when the statement becomes ANSWERABLE, not when the slate is drawn", () => {
  // The slate rises and stands blank for ~320 ms before the statement is cut in. Not
  // one millisecond of that is charged to the child — and, just as importantly, the
  // statement is not legible during it, so no free thinking time is subtracted out of
  // the measurement either. `statement.stillFor` is where that is enforced.
  const window = 8000
  const round = new Round(() => statement(true, window), TIMING)
  round.tap()
  // The whole of raise and still, plus a long pause on top.
  round.advance(TIMING.raise)
  round.advance(320)
  assert.equal(round.phase, "call")
  round.advance(500)
  const settled = round.verdict("keep").find((e) => e.kind === "settled")
  assert.ok(settled?.kind === "settled")
  assert.equal(
    settled.reactionMs,
    500,
    "the lead-in was charged to the child, or the window opened before the statement did",
  )
})

test("a paused stretch is not charged either", () => {
  // The host puts a sheet over the frame. Whatever the child was doing, they were not
  // reading a slate, and a reaction time with a parent gate inside it is a fiction.
  const round = new Round(() => statement(true, 8000), TIMING)
  round.tap()
  round.advance(TIMING.raise + 320)
  round.advance(200)
  round.pause()
  round.advance(30_000)
  round.resume()
  round.advance(100)
  const settled = round.verdict("keep").find((e) => e.kind === "settled")
  assert.ok(settled?.kind === "settled")
  assert.equal(settled.reactionMs, 300, "the sheet was charged to the child")
})

test("holding a finger still does not buy a speed bonus", () => {
  // The exploit a `pointerdown`-anchored clock would have: rest a thumb on the slate
  // the instant it lights, think for six seconds, then flick. The commit is what is
  // timed, so this reports six seconds.
  const round = new Round(() => statement(true, 14000), TIMING)
  round.tap()
  round.advance(TIMING.raise + 320)
  round.advance(6000)
  const settled = round.verdict("keep").find((e) => e.kind === "settled")
  assert.ok(settled?.kind === "settled")
  assert.equal(settled.reactionMs, 6000)
  assert.equal(settled.quickness, 0, "a six-second call was paid a speed bonus")
})
