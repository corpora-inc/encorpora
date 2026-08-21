// Picture-choice tile builder (imageChoice.ts) — the pure, renderer-free seam
// for the media:'image' branch of ChoicePick (research/images.md — imagepan).

import { test } from "node:test"
import assert from "node:assert/strict"

import { buildImageTiles, IMAGE_ANSWER_TILE_ID } from "./imageChoice.ts"

const src = (k: string) => `corpan-pack://localhost/imagepan/images/${k}.webp`

const PARAMS = {
  media: "image",
  answerImageSrc: src("coffee"),
  answerAlt: "coffee",
  imageDistractors: [
    { key: "tea", word: "tea", imageSrc: src("tea") },
    { key: "milk", word: "milk", imageSrc: src("milk") },
  ],
}

test("buildImageTiles: answer picture appears exactly once, among distractors", () => {
  const tiles = buildImageTiles(PARAMS, "card-1")
  assert.equal(tiles.length, 3)
  const answers = tiles.filter((t) => t.id === IMAGE_ANSWER_TILE_ID)
  assert.equal(answers.length, 1)
  assert.equal(answers[0].imageSrc, src("coffee"))
  for (const t of tiles) assert.ok(t.imageSrc.startsWith("corpan-pack://"), "every tile has a picture")
})

test("buildImageTiles: deterministic per cardId (stable answer slot)", () => {
  const a = buildImageTiles(PARAMS, "card-XYZ").map((t) => t.id)
  const b = buildImageTiles(PARAMS, "card-XYZ").map((t) => t.id)
  assert.deepEqual(a, b)
})

test("buildImageTiles: caps at a 2×2 grid (≤ 4 tiles)", () => {
  const many = {
    ...PARAMS,
    imageDistractors: [
      ...PARAMS.imageDistractors,
      { key: "water", word: "water", imageSrc: src("water") },
      { key: "beer", word: "beer", imageSrc: src("beer") },
    ],
  }
  assert.equal(buildImageTiles(many, "c").length, 4) // 3 distractors + answer
})

test("buildImageTiles: no answer src ⇒ [] (mis-emitted, render nothing)", () => {
  assert.deepEqual(buildImageTiles({ imageDistractors: PARAMS.imageDistractors }, "c"), [])
})

test("buildImageTiles: zero distractor pictures ⇒ [] (needs ≥2 options, §3.3 floor)", () => {
  assert.deepEqual(buildImageTiles({ answerImageSrc: src("coffee"), imageDistractors: [] }, "c"), [])
})

test("buildImageTiles: distractors without a picture are skipped", () => {
  const tiles = buildImageTiles(
    { answerImageSrc: src("coffee"), imageDistractors: [{ key: "x", word: "x" }, PARAMS.imageDistractors[0]] },
    "c",
  )
  assert.equal(tiles.length, 2) // answer + the one good distractor
})

test("buildImageTiles: distractor alt falls back to key when word absent", () => {
  const tiles = buildImageTiles(
    { answerImageSrc: src("coffee"), imageDistractors: [{ key: "tea", imageSrc: src("tea") }] },
    "c",
  )
  const d = tiles.find((t) => t.id !== IMAGE_ANSWER_TILE_ID)!
  assert.equal(d.alt, "tea")
})
