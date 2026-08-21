// The fleet invariant, asserted where it was broken.
//
// **The comprehension window is monotone non-decreasing in item difficulty, and
// no item gets less than the child's own measured p90.**
//
// The window this game shipped with was `max(1750, min(3600, 1300 + 215d))`.
// Against `EXPERIENCE_DESIGN.md`'s cadence table that upper clamp inverted the
// ramp: it was more than a whole p50 for a single-digit fact and under a third
// of one for the `5,001 − 2,798` class, so the harder the item, the smaller the
// share of the child's need it received. The two tests at the bottom of this
// file print that table so a reviewer can read the ramp rather than trust it.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import {
  CADENCE,
  comprehensionLoad,
  comprehensionMsFor,
  comprehensionP50Ms,
  comprehensionP90Ms,
  operandWidth,
} from "./cadence.ts"
import { stillFor, windowFor } from "./statement.ts"

/** One statement per class, from the narrowest item this game serves to the widest. */
const LADDER = [
  { text: "7 + 8 = 15", label: "single-digit fact", class: CADENCE.fact },
  { text: "47 + 25 = 62", label: "two-digit regrouping", class: CADENCE.regroup },
  { text: "753 + 577 = 1330", label: "three-digit regrouping", class: null },
  { text: "5001 − 2798 = 2203", label: "the 5,001 − 2,798 class", class: CADENCE.wide },
] as const

test("the widest operand is what sets the class, not the total ink", () => {
  assert.equal(operandWidth("7 + 8 = 15"), 1, "the claimed 15 is compared, not computed")
  assert.equal(operandWidth("47 + 25 = 72"), 2)
  assert.equal(operandWidth("753 + 577 = 1330"), 3)
  assert.equal(operandWidth("5001 − 2798 = 2203"), 4)
  assert.equal(operandWidth("no digits at all"), 1, "an empty pool is the cheapest class")
})

test("the window is monotone non-decreasing in item difficulty", () => {
  // The whole defect in one assertion. A harder item may never get less time
  // than an easier one — not by a millisecond, at any width, ever.
  let previous = 0
  for (let width = 1; width <= 12; width++) {
    const ms = comprehensionP90Ms(comprehensionLoad(width))
    assert.ok(
      ms >= previous,
      `width ${String(width)} got ${String(ms)}ms after width ${String(width - 1)} got ${String(previous)}ms`,
    )
    previous = ms
  }
  assert.ok(previous >= CADENCE.wide.p90, `the widest item tops out at ${String(previous)}ms`)
})

test("the window is monotone non-decreasing across real statements", () => {
  let previous = 0
  for (const rung of LADDER) {
    const ms = windowFor(rung.text)
    assert.ok(ms >= previous, `${rung.label} got ${String(ms)}ms after ${String(previous)}ms`)
    previous = ms
  }
})

test("no item is capped below what the child measurably needs", () => {
  // p90, not p50. p50 is by definition the window half the class does not
  // finish inside, and in this game not finishing costs one of three shots.
  for (const rung of LADDER) {
    if (!rung.class) continue
    const ms = windowFor(rung.text)
    assert.ok(
      ms >= rung.class.p90,
      `${rung.label}: ${String(ms)}ms against a measured p90 of ${String(rung.class.p90)}ms`,
    )
    assert.ok(
      ms / rung.class.p50 >= 2,
      `${rung.label}: ${(ms / rung.class.p50).toFixed(2)}× p50 is not a comprehension window`,
    )
  }
})

test("there is no upper clamp left to invert the ramp", () => {
  // The specific shape of the old bug: a ceiling that bit before the difficulty
  // did, so the *share* of the child's need fell as the item got harder. The
  // share must never fall.
  let previousShare = 0
  for (const rung of LADDER) {
    if (!rung.class) continue
    const share = windowFor(rung.text) / rung.class.p90
    assert.ok(
      share >= previousShare - 1e-9,
      `${rung.label} received ${(share * 100).toFixed(0)}% of its p90 after the previous rung received ${(previousShare * 100).toFixed(0)}%`,
    )
    previousShare = share
  }
})

test("the total budget — stillness plus window — is monotone too", () => {
  // A child can read during the stillness; they cannot act. The window is what
  // has to carry the comprehension, so it is asserted on its own above, but the
  // sum must not go backwards either.
  const rng = new Rng(0x51ed)
  let previous = 0
  for (const rung of LADDER) {
    // Worst case of the jitter, so this is a floor and not a lucky draw.
    let lowest = Number.POSITIVE_INFINITY
    for (let i = 0; i < 300; i++) lowest = Math.min(lowest, stillFor(rung.text, rng))
    const budget = windowFor(rung.text) + lowest
    assert.ok(budget >= previous, `${rung.label}: ${String(budget)}ms after ${String(previous)}ms`)
    previous = budget
  }
})

test("the cadence table, before and after", () => {
  // Not an assertion of style — a printed ramp. The old function is inlined so
  // the two columns are read off the same input.
  const old = (text: string): number => {
    let d = 0
    for (const ch of text) if (ch >= "0" && ch <= "9") d++
    return Math.max(1750, Math.min(3600, 1300 + 215 * d))
  }
  const rows = LADDER.map((rung) => {
    const p50 = comprehensionP50Ms(comprehensionLoad(operandWidth(rung.text)))
    const p90 = comprehensionP90Ms(comprehensionLoad(operandWidth(rung.text)))
    return {
      item: rung.label,
      p50s: (p50 / 1000).toFixed(1),
      p90s: (p90 / 1000).toFixed(1),
      beforeS: (old(rung.text) / 1000).toFixed(2),
      beforePctOfP50: `${((old(rung.text) / p50) * 100).toFixed(0)}%`,
      afterS: (windowFor(rung.text) / 1000).toFixed(1),
      afterPctOfP50: `${((windowFor(rung.text) / p50) * 100).toFixed(0)}%`,
    }
  })
  console.table(rows)
  // The property the table exists to show: before, the share fell as the item
  // got harder. After, it does not.
  const beforeShares = LADDER.map((r) => old(r.text) / comprehensionP50Ms(comprehensionLoad(operandWidth(r.text))))
  assert.ok(
    (beforeShares.at(-1) as number) < (beforeShares[0] as number),
    "the old ramp was not inverted after all — re-derive this whole file",
  )
})

test("comprehensionMsFor is the one path everything else goes through", () => {
  for (const rung of LADDER) assert.equal(windowFor(rung.text), comprehensionMsFor(rung.text))
})
