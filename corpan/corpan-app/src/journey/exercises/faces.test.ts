// Face-resolution tests (contract #2/#3): the translation renderers never
// present identical prompt/answer LANGUAGE, and a missing native face degrades
// to a listening form instead of target-vs-target nonsense (the EN→EN bug).

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  choiceAnswerText,
  choicePickFaces,
  flipFaces,
  matchColumns,
} from "./faces.ts"
import { normalizeAnswer } from "../content/normalize.ts"
import type { ResolvedItem } from "../content/resolve.ts"

const item = (id: string, target: string, native?: string): ResolvedItem => ({
  ref: { kind: "word", source: "es", id },
  key: `word:es:${id}`,
  kind: "word",
  target: { text: target, ttsText: target },
  native: native ? { text: native, ttsText: native } : undefined,
})

/* -------------------------------------------------------------- choice_pick */

test("choicePickFaces toNative: target prompt, native options — different langs", () => {
  const f = choicePickFaces(item("gato", "gato", "cat"), "toNative", "es", "en")
  assert.equal(f.promptMode, "text")
  assert.equal(f.promptText, "gato")
  assert.equal(f.promptLang, "es")
  assert.equal(f.optionFace, "native")
  assert.equal(f.optionLang, "en")
  assert.notEqual(f.promptLang, f.optionLang)
  assert.equal(choiceAnswerText(item("gato", "gato", "cat"), f), "cat")
})

test("choicePickFaces toTarget: native prompt, target options — different langs", () => {
  const f = choicePickFaces(item("gato", "gato", "cat"), "toTarget", "es", "en")
  assert.equal(f.promptMode, "text")
  assert.equal(f.promptText, "cat")
  assert.equal(f.promptLang, "en")
  assert.equal(f.optionFace, "target")
  assert.equal(f.optionLang, "es")
  assert.notEqual(f.promptLang, f.optionLang)
  assert.equal(choiceAnswerText(item("gato", "gato", "cat"), f), "gato")
})

test("choicePickFaces: a TEXT prompt is NEVER the same language as its options", () => {
  for (const dir of ["toNative", "toTarget", "targetOnly"] as const) {
    // with native present
    const a = choicePickFaces(item("x", "gato", "cat"), dir, "es", "en")
    if (a.promptMode === "text") assert.notEqual(a.promptLang, a.optionLang, `${dir} w/native`)
    // native MISSING (guard failure) must not yield same-language text
    const b = choicePickFaces(item("x", "gato"), dir, "es", "en")
    if (b.promptMode === "text") assert.notEqual(b.promptLang, b.optionLang, `${dir} no-native`)
  }
})

test("choicePickFaces: missing native degrades to a listening form (audio prompt)", () => {
  const f = choicePickFaces(item("gato", "gato"), "toTarget", "es", "en")
  assert.equal(f.promptMode, "audio")
  assert.equal(f.optionLang, "es")
})

test("choicePickFaces: targetOnly is a listening form", () => {
  const f = choicePickFaces(item("gato", "gato", "cat"), "targetOnly", "es", "en")
  assert.equal(f.promptMode, "audio")
})

test("choicePickFaces: a resolved native face still shows when spec omits nativeLang", () => {
  // Regression: a card can carry a native gloss with nativeLang undefined —
  // the face must still render (keyed on the face, not the lang hint).
  const f = choicePickFaces(item("gato", "gato", "cat"), "toNative", "es", undefined)
  assert.equal(f.promptMode, "text")
  assert.equal(f.optionFace, "native")
  assert.equal(choiceAnswerText(item("gato", "gato", "cat"), f), "cat")
})

test("choicePickFaces: a same-language 'native' degrades to listening (defense)", () => {
  const f = choicePickFaces(item("gato", "gato", "gato"), "toNative", "en", "en")
  assert.equal(f.promptMode, "audio")
})

/* -------------------------------------------------------------- match_pairs */

test("matchColumns text-text: left target, right native — different languages", () => {
  const items = [item("a", "gato", "cat"), item("b", "perro", "dog"), item("c", "casa", "house")]
  const c = matchColumns(items, "text-text", "seed", "es", "en")
  assert.equal(c.leftLang, "es")
  assert.equal(c.rightLang, "en")
  assert.notEqual(c.leftLang, c.rightLang)
  assert.deepEqual([...c.left.map((s) => s.label)].sort(), ["casa", "gato", "perro"])
  assert.deepEqual([...c.right.map((s) => s.label)].sort(), ["cat", "dog", "house"])
  // the RIGHT column never carries a target-language string (the EN→EN bug)
  for (const s of c.right) assert.ok(!["gato", "perro", "casa"].includes(s.label))
})

test("matchColumns text-text: items missing a native face are dropped, not doubled", () => {
  const items = [item("a", "gato", "cat"), item("b", "perro") /* no native */]
  const c = matchColumns(items, "text-text", "seed", "es", "en")
  assert.deepEqual(c.usableKeys, ["word:es:a"])
  assert.equal(c.right.length, 1)
  assert.equal(c.right[0].label, "cat")
})

test("matchColumns: caps at 6 pairs", () => {
  const items = Array.from({ length: 9 }, (_, i) => item(`i${i}`, `t${i}`, `n${i}`))
  const c = matchColumns(items, "text-text", "seed", "es", "en")
  assert.equal(c.usableKeys.length, 6)
})

test("matchColumns text-audio: both sides target (audio vs text is not a translation)", () => {
  const items = [item("a", "gato", "cat"), item("b", "perro", "dog")]
  const c = matchColumns(items, "text-audio", "seed", "es", "en")
  assert.equal(c.leftLang, "es")
  assert.equal(c.rightLang, "es")
  assert.ok(c.left.every((s) => s.audio === true))
})

// --- defect: "Une las parejas" with a duplicate tile (issue #1) -----------
//
// A match board must NEVER show the same choice text twice — across EITHER
// column, and after the independent per-column shuffles. Two distinct items
// can collide on the target surface (a case/diacritic twin) or on the native
// gloss (two words that both gloss the same). The colliding item is dropped.

test("matchColumns text-text: never shows the same NATIVE gloss twice", () => {
  // "barco" and "bote" both gloss to "boat" — the right column would show
  // "boat" twice (the duplicate tile bug). One item must be dropped.
  const items = [item("a", "barco", "boat"), item("b", "bote", "boat"), item("c", "casa", "house")]
  const c = matchColumns(items, "text-text", "seed", "es", "en")
  const rights = c.right.map((s) => s.label)
  assert.equal(new Set(rights).size, rights.length, `dup right tile: ${rights.join(",")}`)
  const lefts = c.left.map((s) => s.label)
  assert.equal(new Set(lefts).size, lefts.length, `dup left tile: ${lefts.join(",")}`)
  assert.equal(c.usableKeys.length, 2) // "bote" (later dup) dropped
})

test("matchColumns text-text: never shows the same TARGET word twice (case twin)", () => {
  // "Hola" and "hola" fold to the same target surface — the left column would
  // show it twice. The later item is dropped.
  const items = [item("a", "Hola", "hi"), item("b", "hola", "hey"), item("c", "casa", "house")]
  const c = matchColumns(items, "text-text", "seed", "es", "en")
  const lefts = c.left.map((s) => normalizeAnswer(s.label, "es"))
  assert.equal(new Set(lefts).size, lefts.length, `dup left tile: ${lefts.join(",")}`)
  assert.equal(c.usableKeys.length, 2)
})

test("matchColumns: NO tile text repeats across a whole seeded board (property)", () => {
  // A pathological set with many colliding glosses. Whatever survives, every
  // rendered left label is unique AND every rendered right label is unique —
  // for many seeds (the columns shuffle independently).
  const items = [
    item("a", "barco", "boat"),
    item("b", "bote", "boat"), // native twin of a
    item("c", "gato", "cat"),
    item("d", "Gato", "kitty"), // target twin of c
    item("e", "perro", "dog"),
    item("f", "casa", "house"),
  ]
  for (let s = 0; s < 40; s++) {
    const c = matchColumns(items, "text-text", `board-${s}`, "es", "en")
    const lefts = c.left.map((x) => normalizeAnswer(x.label, "es"))
    const rights = c.right.map((x) => normalizeAnswer(x.label, "en"))
    assert.equal(new Set(lefts).size, lefts.length, `seed ${s}: dup left ${lefts.join(",")}`)
    assert.equal(new Set(rights).size, rights.length, `seed ${s}: dup right ${rights.join(",")}`)
    // usableKeys, left, right stay 1:1 (dedup never desyncs the columns).
    assert.equal(c.left.length, c.usableKeys.length)
    assert.equal(c.right.length, c.usableKeys.length)
  }
})

test("matchColumns text-audio: never shows the same target word twice on the right", () => {
  const items = [item("a", "gato", "cat"), item("b", "Gato", "kitty"), item("c", "perro", "dog")]
  const c = matchColumns(items, "text-audio", "seed", "es", "en")
  const rights = c.right.map((s) => normalizeAnswer(s.label, "es"))
  assert.equal(new Set(rights).size, rights.length, `dup right tile: ${rights.join(",")}`)
  assert.equal(c.usableKeys.length, 2)
})

/* -------------------------------------------------------------- flip_recall */

test("flipFaces default (toTarget): native prompt, target reveal (+audio)", () => {
  const f = flipFaces(item("gato", "gato", "cat"), "toTarget", "es", "en")
  assert.equal(f.promptText, "cat")
  assert.equal(f.promptLang, "en")
  assert.equal(f.revealText, "gato")
  assert.equal(f.revealLang, "es")
  assert.equal(f.revealIsTarget, true)
  assert.notEqual(f.promptLang, f.revealLang)
})

test("flipFaces toNative: target prompt, native reveal", () => {
  const f = flipFaces(item("gato", "gato", "cat"), "toNative", "es", "en")
  assert.equal(f.promptText, "gato")
  assert.equal(f.promptLang, "es")
  assert.equal(f.revealText, "cat")
  assert.equal(f.revealLang, "en")
  assert.equal(f.promptIsTarget, true)
  assert.notEqual(f.promptLang, f.revealLang)
})

test("flipFaces: prompt and reveal are never the same language when native exists", () => {
  for (const dir of ["toNative", "toTarget", "targetOnly"] as const) {
    const f = flipFaces(item("x", "gato", "cat"), dir, "es", "en")
    assert.notEqual(f.promptLang, f.revealLang, dir)
  }
})

test("flipFaces: missing native → target-only flashcard (reveal has audio)", () => {
  const f = flipFaces(item("gato", "gato"), "toTarget", "es", "en")
  assert.equal(f.revealIsTarget, true)
  assert.equal(f.promptLang, "es")
  assert.equal(f.revealLang, "es")
})

test("flipFaces + matchColumns: resolved native face survives an absent nativeLang", () => {
  const f = flipFaces(item("gato", "gato", "cat"), "toTarget", "es", undefined)
  assert.equal(f.revealIsTarget, true)
  assert.equal(f.promptText, "cat")
  assert.equal(f.revealText, "gato")
  const c = matchColumns(
    [item("a", "gato", "cat"), item("b", "perro", "dog")],
    "text-text",
    "seed",
    "es",
    undefined,
  )
  assert.equal(c.usableKeys.length, 2)
  assert.deepEqual([...c.right.map((s) => s.label)].sort(), ["cat", "dog"])
})
