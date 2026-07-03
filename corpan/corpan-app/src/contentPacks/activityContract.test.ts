// Tests for the Journey activity contract's two frozen runtime exports:
// the itemRefKey/parseItemRef helper pair (R2) and the ACTIVITY_TYPES
// registry (R4). Run with the repo's native runner (no extra deps):
// `npm test` → node --experimental-strip-types --test 'src/**/*.test.ts'
//
// activityContract.ts is import-free ON PURPOSE, so unlike catalog.ts tests
// it needs no esbuild bundling — the strip-types loader imports it directly.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  itemRefKey,
  parseItemRef,
  ACTIVITY_TYPES,
  type ItemRef,
} from "./activityContract.ts"

// --- itemRefKey / parseItemRef (R2) -----------------------------------------

// One serialized example per kind, straight from the normative table (§1.2).
const TABLE: Array<[ItemRef, string]> = [
  [{ kind: "phrase", source: "base", id: "18422" }, "phrase:base:18422"],
  [{ kind: "word", source: "es", id: "aunque" }, "word:es:aunque"],
  [{ kind: "char", source: "hanzipan", id: "愛" }, "char:hanzipan:愛"],
  [
    { kind: "segment", source: "book_biomes_tropical_rainforest", id: "ch05-088" },
    "segment:book_biomes_tropical_rainforest:ch05-088",
  ],
  [
    { kind: "grammarNode", source: "journey_en", id: "en.gn.present-simple-3sg" },
    "grammarNode:journey_en:en.gn.present-simple-3sg",
  ],
  [{ kind: "phoneme", source: "journey_en", id: "iː-ɪ" }, "phoneme:journey_en:iː-ɪ"],
  [{ kind: "concept", source: "imagepan", id: "obj_bicycle" }, "concept:imagepan:obj_bicycle"],
]

test("itemRefKey serializes every kind per the normative table", () => {
  for (const [ref, expected] of TABLE) {
    assert.equal(itemRefKey(ref), expected)
  }
})

test("parseItemRef round-trips every table row byte-identically", () => {
  for (const [ref, serialized] of TABLE) {
    const parsed = parseItemRef(serialized)
    assert.deepEqual(parsed, ref)
    assert.equal(itemRefKey(parsed!), serialized)
  }
})

test("id MAY contain colons — parse splits on the first two colons only", () => {
  // A hypothetical id with colons must survive the round trip untouched.
  const ref: ItemRef = { kind: "segment", source: "book_x", id: "ch01:001:tail" }
  const key = itemRefKey(ref)
  assert.equal(key, "segment:book_x:ch01:001:tail")
  assert.deepEqual(parseItemRef(key), ref)
})

test("parseItemRef returns null on malformed input (fewer than two colons)", () => {
  assert.equal(parseItemRef(""), null)
  assert.equal(parseItemRef("phrase"), null)
  assert.equal(parseItemRef("phrase:base"), null)
})

test("empty id parses (structural) — schema-level min(1) rejects it at the host boundary", () => {
  // parseItemRef is the structural inverse only; emptiness policing is Zod's.
  assert.deepEqual(parseItemRef("phrase:base:"), { kind: "phrase", source: "base", id: "" })
})

// --- ACTIVITY_TYPES (R4) -----------------------------------------------------

const EXPECTED_TYPES = [
  "choice_pick", "listen_pick", "listen_type", "cloze", "word_order",
  "match_pairs", "flip_recall", "speak_echo", "intro_echo", "grammar_note",
]

test("ACTIVITY_TYPES carries exactly the ten native feed-ux renderers", () => {
  assert.deepEqual(Object.keys(ACTIVITY_TYPES).sort(), [...EXPECTED_TYPES].sort())
})

test("every registry row is well-formed per-type metadata", () => {
  for (const [key, meta] of Object.entries(ACTIVITY_TYPES)) {
    // snake_case bare names, reserved for native renderers (never namespaced).
    assert.match(key, /^[a-z]+(_[a-z]+)*$/, `key ${key} must be snake_case`)
    assert.equal(meta.activityType, key, `row ${key} must self-name`)
    assert.ok([0, 1, 2].includes(meta.form), `row ${key} form must be 0|1|2`)
    assert.ok(
      ["input", "output", "language", "fluency"].includes(meta.strand),
      `row ${key} strand must be a Four Strands value`,
    )
    assert.equal(typeof meta.guessable, "boolean")
    assert.ok(Number.isFinite(meta.estSec) && meta.estSec > 0, `row ${key} estSec must be positive`)
    assert.ok(Array.isArray(meta.modelNeeds))
    for (const need of meta.modelNeeds) {
      assert.ok(["stt", "llm", "tts"].includes(need), `row ${key} modelNeeds entry ${need}`)
    }
  }
})

test("speak_echo is the only native type that needs a model (stt)", () => {
  assert.deepEqual(ACTIVITY_TYPES.speak_echo.modelNeeds, ["stt"])
  for (const [key, meta] of Object.entries(ACTIVITY_TYPES)) {
    if (key === "speak_echo") continue
    assert.deepEqual(meta.modelNeeds, [], `row ${key} must not need a model`)
  }
})
