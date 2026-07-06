import { test } from "node:test"
import assert from "node:assert/strict"

import { clozeContext } from "./clozeContext.ts"

test("clozeContext: null when no contextPhrase", () => {
  assert.equal(clozeContext({}, "en"), null)
  assert.equal(clozeContext(undefined, "en"), null)
  assert.equal(clozeContext({ contextWord: "coffee" }, "en"), null)
})

test("clozeContext: blanks the word inside the phrase", () => {
  const c = clozeContext(
    { contextPhrase: "One coffee, please", contextWord: "coffee", contextNative: "un café, por favor" },
    "en",
  )
  assert.ok(c)
  assert.deepEqual(c!.words, ["One", "coffee", "please"])
  assert.equal(c!.blankIndex, 1)
  assert.equal(c!.blankWord, "coffee")
  assert.equal(c!.native, "un café, por favor")
})

test("clozeContext: case-insensitive match, keeps the surface form", () => {
  const c = clozeContext({ contextPhrase: "Coffee is ready", contextWord: "coffee" }, "en")
  assert.equal(c!.blankIndex, 0)
  assert.equal(c!.blankWord, "Coffee") // surface form preserved for display
})

test("clozeContext: word absent from phrase ⇒ null (degrade, never blank)", () => {
  assert.equal(clozeContext({ contextPhrase: "Two tickets", contextWord: "coffee" }, "en"), null)
})

test("clozeContext: no native provided ⇒ native undefined", () => {
  const c = clozeContext({ contextPhrase: "One coffee, please", contextWord: "coffee" }, "en")
  assert.equal(c!.native, undefined)
})
