// The ribbon line, and the reveal that was garbled for every blank statement.
//
// `dw.alg.equality.missing-addend` is an active row and has been shipping since
// 0.3.5, so the host serves `47 + □ = 68` today. The ribbon decided whether to
// append ` = answer` by asking `!prompt.includes("?")` — a proxy for "no relation
// on this card yet" written when a blank was spelled `?`. The host writes `□`
// (U+25A1, pinned in `items.ts`), so the test passed and the line read:
//
//     47 + □ = 68 = 68
//
// Two equals signs, the box still empty, and the answer printed as though it were
// the total. `resonance-miss` uses this same line as THE REVEAL — the beat that
// finishes the sum for a child who has just missed one — so the garbling landed on
// the one frame that was supposed to teach something.

import { test } from "node:test"
import assert from "node:assert/strict"

import { RIBBON_CHARS, statesAnswer } from "./ribbon.ts"

test("a plain prompt gets the relation appended", () => {
  assert.equal(statesAnswer("12 + 5", "17"), "12 + 5 = 17")
})

test("a blank statement is COMPLETED IN PLACE, not answered beside itself", () => {
  // The founder's principle for a miss is to finish the sum in front of the child.
  // `47 + 21 = 68` is a sum they can read; `21` on its own is a number with nothing
  // attached to it, and `47 + □ = 68 = 21` is neither.
  assert.equal(statesAnswer("47 + □ = 68", "21"), "47 + 21 = 68")
  // Whatever the answer's width, and wherever the box sits.
  assert.equal(statesAnswer("□ × 15 = 165", "11"), "11 × 15 = 165")
  assert.equal(statesAnswer("□ − 47 = 68", "115"), "115 − 47 = 68")
})

test("the two tolerated legacy blank glyphs behave the same as the box", () => {
  assert.equal(statesAnswer("47 + ? = 68", "21"), "47 + 21 = 68")
  assert.equal(statesAnswer("47 + _ = 68", "21"), "47 + 21 = 68")
})

test("no line ever carries two equals signs", () => {
  for (const [prompt, answer] of [
    ["12 + 5", "17"],
    ["47 + □ = 68", "21"],
    ["□ × 15 = 165", "11"],
    ["47 + ? = 68", "21"],
    ["3/4 + 1/4 = □", "1"],
  ] as const) {
    const line = statesAnswer(prompt, answer)
    const equals = [...line].filter((c) => c === "=").length
    assert.ok(equals <= 1, `"${prompt}" -> "${line}" has ${String(equals)} equals signs`)
    assert.ok(!/[□?_]/u.test(line), `"${prompt}" -> "${line}" still shows an empty blank`)
  }
})

test("a prompt too wide for the ribbon falls back to the bare answer", () => {
  const wide = "48826 × 82726 + 918273645 − 512"
  assert.ok(wide.length > RIBBON_CHARS, `fixture is ${String(wide.length)} chars, not over the cap`)
  assert.equal(statesAnswer(wide, "7"), "7")
  // And the cap is measured against the prompt, so a wide blank statement also
  // falls back rather than being filled into a line that cannot be drawn.
  const wideBlank = "48826 × 82726 + □ = 918273645"
  assert.ok(wideBlank.length > RIBBON_CHARS)
  assert.equal(statesAnswer(wideBlank, "7"), "7")
})
