// Tests for the long-press word tokenizer + lookup-key normalizer.
// Run with the repo's native runner: `npm test` →
//   node --experimental-strip-types --test src/**/*.test.ts
//
// `wordTokens.ts` has no path-aliased imports, so the bare strip-types loader
// resolves it directly.

import { test } from "node:test"
import assert from "node:assert/strict"

import { tokenizePhrase, lookupKeyFor } from "./wordTokens.ts"

test("tokenizePhrase preserves the original text verbatim", () => {
  const phrase = "The dog's running, fast!"
  const tokens = tokenizePhrase(phrase, "en")
  assert.equal(tokens.map((t) => t.text).join(""), phrase)
})

test("tokenizePhrase marks words vs separators", () => {
  const tokens = tokenizePhrase("Hello, world!", "en")
  const words = tokens.filter((t) => t.isWord).map((t) => t.text)
  // Punctuation and spaces are NOT words.
  assert.deepEqual(words, ["Hello", "world"])
  // The comma + space + bang survive as non-word tokens.
  assert.ok(tokens.some((t) => !t.isWord && t.text.includes(",")))
  assert.ok(tokens.some((t) => !t.isWord && t.text.includes("!")))
})

test("tokenizePhrase handles leading/trailing punctuation", () => {
  const tokens = tokenizePhrase("¡Vamos! (rápido)", "es")
  assert.equal(tokens.map((t) => t.text).join(""), "¡Vamos! (rápido)")
  const words = tokens.filter((t) => t.isWord).map((t) => t.text)
  assert.deepEqual(words, ["Vamos", "rápido"])
})

test("tokenizePhrase returns empty for empty input", () => {
  assert.deepEqual(tokenizePhrase("", "en"), [])
  assert.deepEqual(tokenizePhrase("   ", "en").filter((t) => t.isWord), [])
})

test("tokenizePhrase does not break on a punctuation-only phrase", () => {
  const tokens = tokenizePhrase("...", "en")
  assert.equal(tokens.map((t) => t.text).join(""), "...")
  assert.equal(tokens.filter((t) => t.isWord).length, 0)
})

test("lookupKeyFor lowercases and strips surrounding punctuation", () => {
  assert.equal(lookupKeyFor("Running"), "running")
  assert.equal(lookupKeyFor("(word)"), "word")
  assert.equal(lookupKeyFor("“Hello,”"), "hello")
  assert.equal(lookupKeyFor("WORD!"), "word")
})

test("lookupKeyFor drops English possessive/contraction tails", () => {
  assert.equal(lookupKeyFor("dog's"), "dog")
  assert.equal(lookupKeyFor("dog’s"), "dog")
  assert.equal(lookupKeyFor("they're"), "they")
})

test("lookupKeyFor keeps internal hyphens/apostrophes inside a word", () => {
  // We only strip a trailing contraction tail, not mid-word marks.
  assert.equal(lookupKeyFor("self-aware"), "self-aware")
})

test("lookupKeyFor never reduces a word to empty via tail-stripping", () => {
  // A bare possessive/contraction fragment must not collapse to "" (which
  // would silently suppress the popover). The de-tail only applies when a
  // base survives; otherwise we keep the trimmed form.
  assert.equal(lookupKeyFor("'s"), "s")
  assert.equal(lookupKeyFor("'d"), "d")
})

test("lookupKeyFor does not strip a tail without an apostrophe", () => {
  // "red" must stay "red" — the tail rule requires an apostrophe before s/re/d…
  assert.equal(lookupKeyFor("red"), "red")
  assert.equal(lookupKeyFor("moved"), "moved")
})
