// Image-mode planner tests (imageMode.ts) — the pure, renderer-free seam that
// routes an already-scheduled recognition card (listen_pick / choice_pick) to a
// PICTURE variant when imagery is available (research/images.md — imagepan).
// Deterministic in specId; a DIAL (share), not a hard gate.

import { test } from "node:test"
import assert from "node:assert/strict"

import { planImageMode, type ConceptImagery } from "./imageMode.ts"

const src = (k: string) => `corpan-pack://localhost/imagepan/images/${k}.webp`

const CONCEPT: ConceptImagery = {
  imageSrc: src("coffee"),
  senseGloss: "coffee",
  distractors: [
    { key: "tea", word: "tea", imageSrc: src("tea") },
    { key: "milk", word: "milk", imageSrc: src("milk") },
  ],
}

const CONCEPT_NO_SIBS: ConceptImagery = { imageSrc: src("coffee"), senseGloss: "coffee", distractors: [] }

/** Scan many specIds and bucket the variants a card resolves to. */
function scan(input: Omit<Parameters<typeof planImageMode>[0], "specId">, n = 200) {
  const buckets: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const plan = planImageMode({ ...input, specId: `spec-${i}` })
    const k = plan ? plan.variant : "text"
    buckets[k] = (buckets[k] ?? 0) + 1
  }
  return buckets
}

test("no concept ⇒ always text (graceful degrade — imagepan absent)", () => {
  const b = scan({ activityType: "listen_pick", pool: "due", isProbe: false, concept: null })
  assert.deepEqual(b, { text: 200 })
})

test("a probe is never a picture card (placement stays clean)", () => {
  const b = scan({ activityType: "choice_pick", pool: "new", isProbe: true, concept: CONCEPT })
  assert.deepEqual(b, { text: 200 })
})

test("listen_pick → HEAR→picture (flagship) a strong share; rest stay text", () => {
  const b = scan({ activityType: "listen_pick", pool: "due", isProbe: false, concept: CONCEPT })
  assert.ok((b.listen_image ?? 0) > 0, "some listen cards become pictures")
  assert.ok((b.text ?? 0) > 0, "some listen cards stay text (a dial, not a gate)")
  assert.equal(Object.keys(b).sort().join(","), "listen_image,text")
  // ~70% share
  assert.ok(b.listen_image > b.text, "picture comprehension dominates the listen slot")
})

test("listen_pick with NO sibling pictures ⇒ text (options need ≥2 tiles)", () => {
  const b = scan({ activityType: "listen_pick", pool: "due", isProbe: false, concept: CONCEPT_NO_SIBS })
  assert.deepEqual(b, { text: 200 })
})

test("listen_image carries image-option params + suppresses the text sampler", () => {
  // find a specId that fires
  let plan = null
  for (let i = 0; i < 50 && !plan; i++) {
    const p = planImageMode({ activityType: "listen_pick", pool: "due", isProbe: false, specId: `s-${i}`, concept: CONCEPT })
    if (p) plan = p
  }
  assert.ok(plan, "a listen card resolves to a picture within 50 specIds")
  assert.equal(plan!.variant, "listen_image")
  assert.equal(plan!.optionsAreImages, true)
  assert.equal(plan!.params.media, "image")
  assert.equal(plan!.params.answerImageSrc, src("coffee"))
  assert.deepEqual(plan!.params.imageDistractors, CONCEPT.distractors)
  assert.equal(plan!.params.direction, "targetOnly")
})

test("choice_pick first-exposure splits picture-OPTIONS and picture-PROMPT; rest text", () => {
  const b = scan({ activityType: "choice_pick", pool: "new", isProbe: false, concept: CONCEPT })
  assert.ok((b.choice_image ?? 0) > 0, "some become word→picture")
  assert.ok((b.image_word ?? 0) > 0, "some become picture→word")
  assert.ok((b.text ?? 0) > 0, "some stay text")
})

test("choice_pick only upgrades at FIRST exposure (pool=new); reviews stay text", () => {
  const b = scan({ activityType: "choice_pick", pool: "due", isProbe: false, concept: CONCEPT })
  assert.deepEqual(b, { text: 200 })
})

test("choice_pick with NO sibling pictures ⇒ only the picture-PROMPT form (image→word)", () => {
  const b = scan({ activityType: "choice_pick", pool: "new", isProbe: false, concept: CONCEPT_NO_SIBS })
  assert.equal(b.choice_image ?? 0, 0, "never picture-OPTIONS without siblings")
  assert.ok((b.image_word ?? 0) > 0, "the picture-PROMPT form needs no siblings")
})

test("image_word carries a picture PROMPT, keeps the text sampler, direction toTarget", () => {
  let plan = null
  for (let i = 0; i < 100 && !plan; i++) {
    const p = planImageMode({ activityType: "choice_pick", pool: "new", isProbe: false, specId: `c-${i}`, concept: CONCEPT_NO_SIBS })
    if (p?.variant === "image_word") plan = p
  }
  assert.ok(plan, "a picture-prompt card resolves within 100 specIds")
  assert.equal(plan!.optionsAreImages, false, "options stay WORDS → sampler runs")
  assert.equal(plan!.params.imagePrompt, true)
  assert.equal(plan!.params.promptImageSrc, src("coffee"))
  assert.equal(plan!.params.direction, "toTarget")
})

test("deterministic per specId (stable card identity across re-maps)", () => {
  const a = planImageMode({ activityType: "listen_pick", pool: "due", isProbe: false, specId: "same", concept: CONCEPT })
  const b = planImageMode({ activityType: "listen_pick", pool: "due", isProbe: false, specId: "same", concept: CONCEPT })
  assert.deepEqual(a, b)
})

test("other activity types are never picture-routed by the planner", () => {
  for (const at of ["cloze", "word_order", "match_pairs", "flip_recall", "speak_echo"]) {
    const plan = planImageMode({ activityType: at, pool: "new", isProbe: false, specId: "x", concept: CONCEPT })
    assert.equal(plan, null, `${at} is not planner-routed`)
  }
})

test("intro_echo → HEAR→tap-the-picture EVERY time siblings exist (no share gate, unlike listen)", () => {
  const b = scan({ activityType: "intro_echo", pool: "new", isProbe: false, concept: CONCEPT })
  // The debut always upgrades when imagery allows — no text bucket.
  assert.deepEqual(b, { intro_image: 200 })
})

test("intro_echo with NO sibling pictures ⇒ null (degrades to hero/text; options need ≥2 tiles)", () => {
  const b = scan({ activityType: "intro_echo", pool: "new", isProbe: false, concept: CONCEPT_NO_SIBS })
  assert.deepEqual(b, { text: 200 })
})

test("intro_echo probe never becomes a picture card", () => {
  const b = scan({ activityType: "intro_echo", pool: "new", isProbe: true, concept: CONCEPT })
  assert.deepEqual(b, { text: 200 })
})

test("intro_image carries image-option params + suppresses the text sampler", () => {
  const plan = planImageMode({
    activityType: "intro_echo",
    pool: "new",
    isProbe: false,
    specId: "intro-1",
    concept: CONCEPT,
  })
  assert.ok(plan)
  assert.equal(plan!.variant, "intro_image")
  assert.equal(plan!.optionsAreImages, true)
  assert.equal(plan!.params.media, "image")
  assert.equal(plan!.params.answerImageSrc, src("coffee"))
  assert.deepEqual(plan!.params.imageDistractors, CONCEPT.distractors)
  assert.equal(plan!.params.direction, "targetOnly")
})
