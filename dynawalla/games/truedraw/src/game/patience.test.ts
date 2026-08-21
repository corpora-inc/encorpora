// A child who is right but not fast must not lose a shot for it.
//
// `EXPERIENCE_DESIGN.md`: "T=0→C COMPREHENSION — not budgeted. The child's time.
// Measured, never limited." The measurements it was made from are the cadence
// table, and this file plays whole runs against them.
//
// The bots here do not act at "40% of whatever window they are given" — a bot
// like that can never be timed out and so can never see a window that is too
// short. They take the number of milliseconds the *repo* says the item costs,
// and then the run reports what the game did about it.
//
// The failure this catches is the one the audit found: the window was capped at 3.6 s,
// running out of time on a TRUE slate settled as a hold, and a hold was a miss — so a
// child working at the documented p50 lost a shot on every true slate, and the bag
// deals true slates in exact halves. Half their shots gone by arithmetic, regardless
// of what they knew.
//
// Two things have changed under it and neither weakens it. Running out of time is now a
// LAPSE, which spends no shot — so the worst case is milder. But the window is still
// the item's p90 and a child at p50 must still LAND THE CALL, because a lapse earns no
// coins and a child who can do the sum should be paid for it. So the assertion is the
// same one: at every rung, a deliberate child answers every slate.

import assert from "node:assert/strict"
import { test } from "node:test"

import { createStubHost } from "../stub/host.ts"
import { perfect, playRun } from "../test/harness.ts"
import { COIN_BASE } from "./bag.ts"
import { comprehensionLoad, comprehensionP50Ms, comprehensionP90Ms, operandWidth } from "./cadence.ts"
import type { Statement } from "./statement.ts"

/** Every rung of the stub ladder: two-digit at the bottom, four at the top. */
const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7]

const p50 = (s: Statement): number => comprehensionP50Ms(comprehensionLoad(operandWidth(s.text)))
const p90 = (s: Statement): number => comprehensionP90Ms(comprehensionLoad(operandWidth(s.text)))

/** The window this game shipped with, inlined so the contrast is on one input. */
function shippedWindow(text: string): number {
  let d = 0
  for (const ch of text) if (ch >= "0" && ch <= "9") d++
  return Math.max(1750, Math.min(3600, 1300 + 215 * d))
}

test("a child working at the documented p50 is never timed out, at any rung", () => {
  for (const level of LEVELS) {
    const result = playRun(createStubHost({ seed: 900 + level, level }), 400 + level, perfect, {
      limit: 60,
      thinkMs: p50,
    })
    const timedOut = result.outcomes.filter((o) => o === "lapse").length
    assert.equal(
      timedOut,
      0,
      `level ${String(level)}: ${String(timedOut)} of ${String(result.outcomes.length)} calls were lost to the clock`,
    )
    assert.equal(result.run.shots, 3, `level ${String(level)}: shots spent by a child who was right`)
    assert.ok(result.run.bag > 0, `level ${String(level)}: a correct deliberate child earned nothing`)
  }
})

test("even the slowest tenth of the class lands the call", () => {
  // p90 minus one frame. The window is p90, so this is the last child the table
  // says exists — and they get their call in.
  for (const level of LEVELS) {
    const result = playRun(createStubHost({ seed: 1900 + level, level }), 1400 + level, perfect, {
      limit: 40,
      thinkMs: (s) => p90(s) - 40,
    })
    const timedOut = result.outcomes.filter((o) => o === "lapse").length
    assert.equal(timedOut, 0, `level ${String(level)}: the slowest tenth lost ${String(timedOut)} calls`)
  }
})

test("under the shipped window that same child lost a shot on every true slate", () => {
  // The defect, played rather than argued. This asserts what the OLD function
  // did, so it stays true after the fix and documents the size of the hole: a
  // perfect player, working at the repo's own p50, could not finish a single
  // statement inside the window they were given.
  let unreachable = 0
  let total = 0
  for (const level of LEVELS) {
    const host = createStubHost({ seed: 2900 + level, level })
    const result = playRun(host, 2400 + level, perfect, { limit: 40, thinkMs: p50 })
    for (const s of result.statements) {
      total++
      if (shippedWindow(s.text) < p50(s)) unreachable++
    }
  }
  assert.ok(total > 200, `only ${String(total)} statements sampled`)
  assert.equal(
    unreachable,
    total,
    `${String(unreachable)} of ${String(total)} statements were unanswerable at the documented p50`,
  )
})

test("a run at p50 is long, which is the whole point of the format", () => {
  // `run.ts`: expected calls = shots × p / (1 − p). A player who is right every
  // time is never stopped — and now they are not stopped by the clock either.
  const result = playRun(createStubHost({ seed: 77, level: 5 }), 78, perfect, {
    limit: 120,
    thinkMs: p50,
  })
  assert.equal(result.run.over, false)
  assert.ok(result.run.calls >= 120, `only ${String(result.run.calls)} calls`)
})

test("a deliberate child is paid the full base on every single call", () => {
  // The standing rule: measure and reward, never punish. A child working at their own
  // class's p50 collects no speed bonus and every coin of the base, at every rung.
  for (const level of LEVELS) {
    const result = playRun(createStubHost({ seed: 3900 + level, level }), 3400 + level, perfect, {
      limit: 30,
      thinkMs: p50,
    })
    const calls = result.outcomes.filter((o) => o === "bank" || o === "spot").length
    assert.ok(calls > 20, `level ${String(level)}: only ${String(calls)} calls`)
    assert.equal(
      result.run.bag,
      calls * COIN_BASE,
      `level ${String(level)}: a p50 child was paid ${String(result.run.bag)} for ${String(calls)} calls`,
    )
  }
})

test("a lapse never costs a deliberate child anything", () => {
  // Even the child who cannot finish inside p90 — the tenth the table says exists —
  // pays nothing for it. No shot, no coin, and nothing reported.
  const result = playRun(createStubHost({ seed: 4900, level: 7 }), 4400, perfect, {
    limit: 12,
    thinkMs: (s) => s.windowMs * 3,
  })
  assert.ok(result.outcomes.length > 8, `only ${String(result.outcomes.length)} rounds`)
  assert.ok(result.outcomes.every((o) => o === "lapse"))
  assert.equal(result.run.shots, 3, "a shot was spent on a child who was still thinking")
  assert.equal(result.run.bag, 0)
  assert.equal(result.run.over, false)
})
