// Renderability guards for the multi-token exercises. A one-word phrase
// ("Fire!", "Jam") must NEVER produce a degenerate card — a bare "____" cloze
// (issue #2) or a 1-tile "reorder" (issue #3). These pure predicates are the
// renderers' last line of defense; Cloze/WordOrder degrade to a reveal when
// they return false.

import { test } from "node:test"
import assert from "node:assert/strict"
import { canOrder, hasClozeContext, orderTokens } from "./tokenGuards.ts"

test("canOrder needs ≥2 tokens (1-tile reorder is degenerate)", () => {
  assert.equal(canOrder(0), false)
  assert.equal(canOrder(1), false)
  assert.equal(canOrder(2), true)
  assert.equal(canOrder(5), true)
})

test("hasClozeContext needs ≥2 tokens (a lone blank has no context)", () => {
  assert.equal(hasClozeContext(0), false)
  assert.equal(hasClozeContext(1), false)
  assert.equal(hasClozeContext(2), true)
})

test("orderTokens: a single word yields 1 token ⇒ not orderable / no context", () => {
  const jam = orderTokens("Jam!", "en") // punctuation is not a word token
  assert.equal(jam.length, 1)
  assert.equal(jam[0].toLowerCase(), "jam")
  assert.equal(canOrder(jam.length), false)
  assert.equal(hasClozeContext(jam.length), false)
})

test("orderTokens: a real sentence yields ≥2 tokens ⇒ orderable + has context", () => {
  const toks = orderTokens("I have four books", "en")
  assert.deepEqual(toks, ["I", "have", "four", "books"])
  assert.equal(canOrder(toks.length), true)
  assert.equal(hasClozeContext(toks.length), true)
})
