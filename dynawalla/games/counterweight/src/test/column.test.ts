// The Turk's pan draws a column, and the host hands over a string. This is the
// join, and its only hard rule is that the pan is never empty.

import assert from "node:assert/strict"
import { test } from "node:test"

import { splitPrompt } from "../game/column.ts"

test("a sum splits into two operands and a glyph", () => {
  assert.deepEqual(splitPrompt("473 + 168"), { top: "473", glyph: "+", bottom: "168" })
})

test("every minus a host might send comes out as one minus", () => {
  for (const glyph of ["-", "−", "–"]) {
    const column = splitPrompt(`5001 ${glyph} 2798`)
    assert.deepEqual(column, { top: "5001", glyph: "−", bottom: "2798" })
  }
})

test("grouped operands keep their grouping — the places must stay lined up", () => {
  assert.deepEqual(splitPrompt("4 003 − 87"), { top: "4 003", glyph: "−", bottom: "87" })
  assert.deepEqual(splitPrompt("4,003 − 87"), { top: "4,003", glyph: "−", bottom: "87" })
})

test("anything that is not a two-operand column comes back as nothing", () => {
  // And `scene.ts` then draws the prompt on one line rather than an empty pan.
  for (const prompt of ["", "473", "3 × 4 + 1", "what is 4 + 4?", "+ 168"]) {
    assert.equal(splitPrompt(prompt), null, `"${prompt}" was read as a column`)
  }
})

test("surrounding space is not part of an operand", () => {
  assert.deepEqual(splitPrompt("  27   +   15  "), { top: "27", glyph: "+", bottom: "15" })
})
