// Answer-normalization tests (content-resolver.md §4.3). The folding is
// deliberately aggressive: case/punctuation/diacritic-only variants of the
// answer are valid-alternate hazards, not distractors.

import { test } from "node:test"
import assert from "node:assert/strict"

import { normalizeAnswer, normalizedEquals } from "./normalize.ts"

test("case folds", () => {
  assert.ok(normalizedEquals("Hello", "hello", "en"))
})

test("diacritics fold (adiós ≡ adios)", () => {
  assert.ok(normalizedEquals("adiós", "adios", "es"))
  assert.ok(normalizedEquals("café", "cafe", "es"))
})

test("punctuation and symbols strip", () => {
  assert.equal(normalizeAnswer("¿Cómo estás?", "es"), "como estas")
  assert.ok(normalizedEquals("see you later!", "See you later", "en"))
  assert.equal(normalizeAnswer("it's", "en"), "it s")
})

test("NFKC compatibility fold", () => {
  assert.ok(normalizedEquals("ﬁve", "five", "en")) // ﬁ ligature
  assert.ok(normalizedEquals("Ｈｅｌｌｏ", "hello", "en")) // fullwidth
})

test("whitespace collapses and trims", () => {
  assert.equal(normalizeAnswer("  buenas   noches \n", "es"), "buenas noches")
})

test("locale-aware lowercase (Turkish dotted I)", () => {
  assert.equal(normalizeAnswer("İstanbul", "tr"), "istanbul")
})

test("empty and punctuation-only inputs normalize to empty", () => {
  assert.equal(normalizeAnswer("", "en"), "")
  assert.equal(normalizeAnswer("¿?!…", "es"), "")
})

test("distinct words stay distinct", () => {
  assert.ok(!normalizedEquals("hola", "buenas", "es"))
  assert.ok(!normalizedEquals("ship", "sheep", "en"))
})
