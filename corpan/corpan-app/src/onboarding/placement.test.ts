// Tests for `derivePlacement` — the merge that folds the old
// `journeyPlacementOffer` screen into the `calibrateLearn` answer.
// Run with: `npm test` (node --experimental-strip-types --test).

import { test } from "node:test"
import assert from "node:assert/strict"

const { derivePlacement } = await import("./placement.ts")

test("A0-only (calibrateLearn 'never') → zero-beginner (start at unit 1)", () => {
  assert.equal(derivePlacement(["A0"]), "zero-beginner")
})

test("a little (A0,A1,A2) → probe", () => {
  assert.equal(derivePlacement(["A0", "A1", "A2"]), "probe")
})

test("advanced (A1..B2) → probe", () => {
  assert.equal(derivePlacement(["A1", "A2", "B1", "B2"]), "probe")
})

test("undefined / empty → probe (safe default; surface can place them)", () => {
  assert.equal(derivePlacement(undefined), "probe")
  assert.equal(derivePlacement([]), "probe")
})

test("A0 plus anything else → probe (not a total beginner)", () => {
  assert.equal(derivePlacement(["A0", "A1"]), "probe")
})
