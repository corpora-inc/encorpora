import { test } from "node:test"
import assert from "node:assert/strict"

import type { ResolvedExample, ResolvedItem } from "../content/resolve.ts"
import { wordEnrichment } from "./wordEnrichment.ts"

const word = (extras?: ResolvedItem["extras"]): ResolvedItem => ({
  ref: { kind: "word", source: "en", id: "coffee" },
  key: "word:en:coffee",
  kind: "word",
  target: { text: "coffee", ttsText: "coffee" },
  native: { text: "el café", ttsText: "el café" },
  ...(extras ? { extras } : {}),
})

const example: ResolvedExample = {
  word: "coffee",
  phrase: {
    ref: { kind: "phrase", source: "base", id: "111" },
    key: "phrase:base:111",
    kind: "phrase",
    target: { text: "One coffee, please", ttsText: "One coffee, please" },
    native: { text: "un café, por favor", ttsText: "un café, por favor" },
  },
}

const LANGS = { targetLang: "en", nativeLang: "es" }

test("wordEnrichment: null for non-word items", () => {
  const phrase: ResolvedItem = {
    ref: { kind: "phrase", source: "base", id: "1" },
    key: "phrase:base:1",
    kind: "phrase",
    target: { text: "Hello", ttsText: "Hello" },
  }
  assert.equal(wordEnrichment(phrase, example, LANGS), null)
})

test("wordEnrichment: null when neither example nor wordpan paragraph", () => {
  assert.equal(wordEnrichment(word(), null, LANGS), null)
})

test("wordEnrichment: example only (no wordpan) surfaces the in-context line", () => {
  const m = wordEnrichment(word(), example, LANGS)
  assert.ok(m)
  assert.equal(m!.example?.target, "One coffee, please")
  assert.equal(m!.example?.native, "un café, por favor")
  assert.equal(m!.example?.nativeLang, "es")
  assert.equal(m!.meaning, undefined)
})

test("wordEnrichment: wordpan native-first paragraph + native gloss headline", () => {
  const m = wordEnrichment(
    word({
      kind: "word",
      explanationNative: "Café tostado…",
      explanationTarget: "Roasted beans…",
    }),
    null,
    LANGS,
  )
  assert.equal(m!.meaning?.lang, "es")
  assert.equal(m!.meaning?.paragraph, "Café tostado…")
  assert.equal(m!.gloss, "el café")
})

test("wordEnrichment: no L1 ⇒ target-language paragraph is the learner's language", () => {
  const m = wordEnrichment(
    word({ kind: "word", explanationNative: "Café…", explanationTarget: "Roasted beans…" }),
    null,
    { targetLang: "en" },
  )
  assert.equal(m!.meaning?.lang, "en")
  assert.equal(m!.meaning?.paragraph, "Roasted beans…")
  // No native stack ⇒ no gloss headline.
  assert.equal(m!.gloss, undefined)
})

test("wordEnrichment: ES→EN with ONLY English etymology ⇒ null (never an English wall)", () => {
  // The device bug: a non-English native must not be shown the target etymology.
  const m = wordEnrichment(
    word({ kind: "word", explanationTarget: "from Old English an…" }),
    null,
    LANGS,
  )
  assert.equal(m, null)
})

test("wordEnrichment: region-tolerant — es-419 native still rejects the English paragraph", () => {
  const m = wordEnrichment(
    word({ kind: "word", explanationTarget: "from Old English an…" }),
    null,
    { targetLang: "en", nativeLang: "es-419" },
  )
  assert.equal(m, null)
})

test("wordEnrichment: both example and meaning present together", () => {
  const m = wordEnrichment(
    word({ kind: "word", explanationNative: "Café…" }),
    example,
    LANGS,
  )
  assert.ok(m!.example)
  assert.ok(m!.meaning)
})
