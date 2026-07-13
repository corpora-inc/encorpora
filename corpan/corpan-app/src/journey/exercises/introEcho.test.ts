// IntroEcho decision-logic tests (introEcho.ts) — the pure seam behind the
// interactive WORD-DEBUT card. The node --test harness cannot import the .tsx
// renderer, so every branch the renderer takes (mode precedence, native-text
// tile building, the gentle reveal skin) is proven here as pure TS — the same
// convention as imageChoice.test.ts / glyphs.ts.

import { test } from "node:test"
import assert from "node:assert/strict"

import { IMAGE_ANSWER_TILE_ID } from "./imageChoice.ts"
import { GLYPH_ANSWER_TILE_ID } from "./glyphs.ts"
import {
  buildIntroTextTiles,
  INTRO_ANSWER_TILE_ID,
  introEchoMode,
  introTileState,
} from "./introEcho.ts"

const src = (k: string) => `corpan-pack://localhost/imagepan/images/${k}.webp`

const IMAGE_PARAMS = {
  media: "image",
  answerImageSrc: src("coffee"),
  imageDistractors: [
    { key: "tea", word: "tea", imageSrc: src("tea") },
    { key: "milk", word: "milk", imageSrc: src("milk") },
  ],
}
const GLYPH_PARAMS = { media: "glyph", answerGlyph: "3", glyphDistractors: ["2", "4"] }

// ------------------------------------------------------------- mode precedence

test("mode: picture options win when media:'image' builds ≥2 tiles", () => {
  assert.equal(introEchoMode(IMAGE_PARAMS, 3, "c1"), "image")
})

test("mode: numeral glyph wins when media:'glyph' builds tiles", () => {
  assert.equal(introEchoMode(GLYPH_PARAMS, 3, "c1"), "glyph")
})

test("mode: native-gloss text tiles when distractors exist and no media", () => {
  assert.equal(introEchoMode(undefined, 3, "c1"), "text")
  assert.equal(introEchoMode({ conceptImageSrc: src("coffee") }, 2, "c1"), "text")
})

test("mode: passive show-and-tell when nothing tappable is available", () => {
  assert.equal(introEchoMode(undefined, 0, "c1"), "passive")
  assert.equal(introEchoMode({ conceptImageSrc: src("coffee") }, 0, "c1"), "passive")
})

test("mode degrades gracefully when a tile builder comes up empty (thin payload)", () => {
  // media:'image' but ZERO distractor pictures ⇒ buildImageTiles returns [] ⇒
  // fall through to text (has distractors) — never a broken 1-tile grid.
  const thinImage = { media: "image", answerImageSrc: src("coffee"), imageDistractors: [] }
  assert.equal(introEchoMode(thinImage, 3, "c1"), "text")
  // …and to passive when there are no text distractors either.
  assert.equal(introEchoMode(thinImage, 0, "c1"), "passive")
  // media:'glyph' with no distractor glyphs ⇒ [] ⇒ falls through likewise.
  assert.equal(introEchoMode({ media: "glyph", answerGlyph: "3", glyphDistractors: [] }, 0, "c1"), "passive")
})

// ------------------------------------------------------- native-text tiles

test("buildIntroTextTiles: answer native gloss inserted among distractor glosses", () => {
  const tiles = buildIntroTextTiles("el café", ["el té", "la leche"], "card-x")
  assert.equal(tiles.length, 3)
  const answer = tiles.find((t) => t.id === INTRO_ANSWER_TILE_ID)
  assert.ok(answer, "the answer tile is present")
  assert.equal(answer!.text, "el café")
  assert.deepEqual(
    tiles.filter((t) => t.id !== INTRO_ANSWER_TILE_ID).map((t) => t.text).sort(),
    ["el té", "la leche"],
  )
})

test("buildIntroTextTiles is deterministic per cardId (stable layout)", () => {
  const a = buildIntroTextTiles("el café", ["el té", "la leche"], "same-card")
  const b = buildIntroTextTiles("el café", ["el té", "la leche"], "same-card")
  assert.deepEqual(a, b)
  const c = buildIntroTextTiles("el café", ["el té", "la leche"], "other-card")
  // Different seed → (very likely) a different slot; at minimum still valid.
  assert.equal(c.length, 3)
})

test("buildIntroTextTiles with no distractors is a single answer tile (renderer degrades)", () => {
  const tiles = buildIntroTextTiles("el café", [], "card-x")
  assert.deepEqual(tiles, [{ id: INTRO_ANSWER_TILE_ID, text: "el café" }])
})

// ------------------------------------------------- the gentle reveal skin

test("no tile is adorned before the reveal", () => {
  assert.equal(introTileState(false, INTRO_ANSWER_TILE_ID), null)
  assert.equal(introTileState(false, "d0"), null)
})

test("on reveal ONLY the answer tile greens — a wrong tap is NEVER reddened (penalty-free)", () => {
  // Answer tile lights up correct…
  assert.equal(introTileState(true, INTRO_ANSWER_TILE_ID), "correct")
  assert.equal(introTileState(true, IMAGE_ANSWER_TILE_ID), "correct") // shared id
  assert.equal(introTileState(true, GLYPH_ANSWER_TILE_ID), "correct") // shared id
  // …every other tile (including one the learner mis-tapped) stays neutral —
  // there is no "wrong"/"incorrect" state a debut can ever produce.
  for (const id of ["d0", "d1", "d2"]) {
    assert.equal(introTileState(true, id), null, `wrong tap ${id} is never reddened`)
  }
})

test("the answer tile id is shared across the picture / glyph / text builders", () => {
  // One outcome check works for all three tile modes.
  assert.equal(INTRO_ANSWER_TILE_ID, IMAGE_ANSWER_TILE_ID)
  assert.equal(INTRO_ANSWER_TILE_ID, GLYPH_ANSWER_TILE_ID)
})
