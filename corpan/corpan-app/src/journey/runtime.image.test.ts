// Runtime picture-routing tests (runtime.ts × imageMode.ts × resolve.ts): the
// image variants slot into EXISTING scheduling (listen_pick / choice_pick /
// match_pairs / cloze) with NO engine change — the runtime resolves imagepan
// concept art and rewrites the card's PRESENTATION only (the graded item is
// unchanged). Everything degrades to text when imagepan is absent.
//
// Driven at the prepareEngineCard seam (like the speak/cloze guard tests) with
// a real engine + real resolver over an in-memory course DB seeded with WORD
// items (so the text sampler has siblings) + an imagepan concept table.

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import type { EngineCard } from "./engine/index.ts"
import type { PackDbResult } from "./content/resolve.ts"

if (typeof globalThis.localStorage === "undefined") {
  const bag = new Map<string, string>()
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => void bag.set(k, String(v)),
    removeItem: (k: string) => void bag.delete(k),
    clear: () => bag.clear(),
    key: () => null,
    length: 0,
  }
}

const { makeEngine } = await import("./engine/__fixtures__/harness.ts")
const { createResolver, SQL } = await import("./content/resolve.ts")
const { buildCourseDb, makeRuntimeFixtureDeps, FIXTURE_RUNTIME_CTX } = await import(
  "./__fixtures__/runtimeFixture.ts"
)
const { createJourneyRuntime } = await import("./runtime.ts")
const { useJourneyStore } = await import("../store/journey.ts")

// A tiny imagepan-shaped concept table (mirrors demo/wiring.ts DEMO_IMAGEPAN).
const IMG = (k: string) => `corpan-pack://localhost/imagepan/images/${k}.webp`
const concept = (key: string, sibs: string[], gloss?: string) => ({
  key,
  word: key,
  sense_gloss: gloss ?? key,
  cefr: "A1",
  file: `images/${key}.webp`,
  distractors_json: JSON.stringify(sibs.map((s) => ({ key: s, word: s, file: `images/${s}.webp` }))),
})
const CONCEPTS: Record<string, ReturnType<typeof concept>> = {
  coffee: concept("coffee", ["tea", "milk"]),
  tea: concept("tea", ["coffee", "milk"]),
  milk: concept("milk", ["coffee", "tea"]),
  bravo: concept("bravo", ["coffee"]), // "bravo" appears in every fixture phrase
  lonely: concept("lonely", []), // has a picture but NO sibling pictures
}

const IMAGE_WORDS = ["coffee", "tea", "milk", "water", "beer", "bravo", "lonely"]

function countingQuota() {
  return { note: () => {}, remaining: () => 999, limit: () => 999, locked: () => false }
}

/** Build a runtime whose course DB carries WORD items (so the choice sampler has
 *  siblings) and whose deps optionally expose imagepan + the concept table. */
async function makeRuntime(opts: { imagepan?: boolean } = {}) {
  const harness = await makeEngine({ arcs: 1, unitsPerArc: 2, skillsPerUnit: 2, itemsPerSkill: 6 })
  const db = buildCourseDb(harness.graph)
  // Seed a shared word skill so choice_pick over a word finds word distractors.
  const insItem = db.prepare("INSERT INTO items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
  const insSkill = db.prepare("INSERT INTO item_skills VALUES (?, ?)")
  const insStr = db.prepare("INSERT INTO strings VALUES (?, ?, ?)")
  for (let i = 0; i < IMAGE_WORDS.length; i++) {
    const w = IMAGE_WORDS[i]
    const id = `word:en:${w}`
    insItem.run(id, "word", "en", w, "unit-00", 100 + i, 0, 1, 0, 0, null, w.length)
    insSkill.run(id, "wordskill")
    // A native gloss so a WORD choice card can stay choice_pick (not reroute).
    insStr.run(`wg.${w}`, "es", `es-${w}`)
  }

  const base = makeRuntimeFixtureDeps(harness.graph, { db })
  const origQuery = base.queryPackDb
  const origFind = base.findInstalledPack
  const deps = {
    ...base,
    findInstalledPack: (packId: string) =>
      (opts.imagepan && packId === "imagepan") || origFind(packId),
    queryPackDb: async (q: Parameters<typeof origQuery>[0]): Promise<PackDbResult> => {
      if (q.packId === "imagepan" && q.sql === SQL.conceptImage) {
        const c = CONCEPTS[String((q.params ?? [])[0])]
        return { columns: c ? Object.keys(c) : [], rows: c ? [c] : [] }
      }
      return origQuery(q)
    },
  }

  const resolver = createResolver(deps, FIXTURE_RUNTIME_CTX)
  const runtime = createJourneyRuntime({
    engine: harness.engine,
    resolver,
    resolverDeps: deps,
    ctx: FIXTURE_RUNTIME_CTX,
    graph: harness.graph,
    courseKey: "stack-1::journey_en",
    quota: countingQuota(),
    now: () => harness.clock.nowMs(),
  })
  const { needsPlacement } = await runtime.start("home_hero")
  if (needsPlacement) runtime.finishPlacement(runtime.startPlacement("zero-beginner").finalize())
  return { runtime, harness }
}

/** A native EngineCard of `activityType` over a WORD ref. */
function wordCard(
  activityType: string,
  word: string,
  specId: string,
  pool: "new" | "due" = "due",
): EngineCard {
  return {
    spec: {
      specId,
      activityType,
      itemRefs: [{ kind: "word", source: "en", id: word }],
      targetLang: "en",
      nativeLang: "es",
      ...(pool === "new" ? { params: { intro: false } } : {}),
    } as EngineCard["spec"],
    meta: {
      pool,
      strand: "input",
      form: 0,
      estSec: 15,
      provider: "native",
      celebration: "normal",
      coolDownCandidate: false,
    },
  }
}

/** A match_pairs EngineCard over several WORD refs. */
function matchCard(words: string[], specId: string): EngineCard {
  return {
    spec: {
      specId,
      activityType: "match_pairs",
      itemRefs: words.map((w) => ({ kind: "word" as const, source: "en", id: w })),
      targetLang: "en",
      nativeLang: "es",
    } as EngineCard["spec"],
    meta: {
      pool: "due",
      strand: "language",
      form: 0,
      estSec: 35,
      provider: "native",
      celebration: "normal",
      coolDownCandidate: false,
    },
  }
}

beforeEach(() => {
  useJourneyStore.setState({ byCourse: {}, learningDays: [] })
})

// -------------------------------------------------------------- flagship

test("FLAGSHIP listen_pick → HEAR→picture: media:image, sampler suppressed, ≥1 image distractor", async () => {
  const { runtime } = await makeRuntime({ imagepan: true })
  let sawImage = false
  for (let i = 0; i < 40 && !sawImage; i++) {
    const card = await runtime.prepareEngineCard(wordCard("listen_pick", "coffee", `lp-${i}`))
    assert.ok(card && card.kind === "exercise")
    if (card.spec.params?.media === "image") {
      sawImage = true
      assert.equal(card.spec.activityType, "listen_pick", "still scheduled as listen_pick")
      assert.equal(card.prepared.distractors, null, "picture options suppress the text sampler")
      const ds = card.spec.params?.imageDistractors as unknown[]
      assert.ok(Array.isArray(ds) && ds.length >= 1, "carries ≥1 sibling picture")
      assert.equal(card.spec.params?.answerImageSrc, IMG("coffee"))
      assert.equal(card.prepared.items[0].ref.id, "coffee", "graded item is UNCHANGED (the word)")
    }
  }
  assert.ok(sawImage, "a HEAR→picture card appears within 40 listen_pick reps")
})

test("graceful degrade: imagepan absent ⇒ listen_pick NEVER becomes a picture card", async () => {
  const { runtime } = await makeRuntime({ imagepan: false })
  for (let i = 0; i < 40; i++) {
    const card = await runtime.prepareEngineCard(wordCard("listen_pick", "coffee", `lp-off-${i}`))
    assert.ok(card && card.kind === "exercise")
    assert.notEqual(card.spec.params?.media, "image", "no pictures without imagepan")
  }
})

// ---------------------------------------------- choice_pick: two picture shapes

test("choice_pick first-exposure yields BOTH picture-options and picture-prompt cards", async () => {
  const { runtime } = await makeRuntime({ imagepan: true })
  let options = 0
  let prompt = 0
  for (let i = 0; i < 80; i++) {
    const card = await runtime.prepareEngineCard(wordCard("choice_pick", "coffee", `cp-${i}`, "new"))
    if (!card || card.kind !== "exercise") continue // image_word can drop only if no word sibling — but siblings exist
    const p = card.spec.params
    if (p?.media === "image" && p?.imagePrompt !== true) {
      options += 1
      assert.equal(card.prepared.distractors, null, "picture OPTIONS suppress the sampler")
      assert.equal(p?.answerImageSrc, IMG("coffee"))
    } else if (p?.imagePrompt === true) {
      prompt += 1
      assert.equal(p?.promptImageSrc, IMG("coffee"))
      assert.equal(p?.direction, "toTarget")
      assert.ok(card.prepared.distractors, "picture PROMPT keeps WORD options (sampler ran)")
      assert.ok(card.prepared.distractors!.distractors.length >= 1)
    }
  }
  assert.ok(options > 0, "some first-exposure choice cards become word→picture")
  assert.ok(prompt > 0, "some first-exposure choice cards become picture→word")
})

test("a concept with NO sibling pictures only ever becomes a picture PROMPT (never options)", async () => {
  const { runtime } = await makeRuntime({ imagepan: true })
  let prompt = 0
  for (let i = 0; i < 60; i++) {
    const card = await runtime.prepareEngineCard(wordCard("choice_pick", "lonely", `lonely-${i}`, "new"))
    if (!card || card.kind !== "exercise") continue
    assert.notEqual(
      card.spec.params?.media === "image" && card.spec.params?.imagePrompt !== true,
      true,
      "never picture-OPTIONS without siblings",
    )
    if (card.spec.params?.imagePrompt === true) prompt += 1
  }
  assert.ok(prompt > 0, "the picture-PROMPT form still fires with no siblings")
})

// -------------------------------------------------------- picture match-pairs

test("match_pairs over imaged words → axis:image + a picture per key", async () => {
  const { runtime } = await makeRuntime({ imagepan: true })
  const card = await runtime.prepareEngineCard(matchCard(["coffee", "tea", "milk"], "mp-img"))
  assert.ok(card && card.kind === "exercise")
  assert.equal(card.spec.activityType, "match_pairs")
  assert.equal(card.spec.params?.axis, "image", "pairs pictures ↔ words")
  const byKey = card.spec.params?.imageByKey as Record<string, string>
  assert.ok(byKey && Object.keys(byKey).length >= 2, "≥2 items carry a picture")
  assert.equal(byKey["word:en:coffee"], IMG("coffee"))
})

test("match_pairs with too few imaged words falls back to a text/audio axis", async () => {
  const { runtime } = await makeRuntime({ imagepan: true })
  // only "coffee" is imaged; "zzz1"/"zzz2" have no concept row → <2 pictures.
  const card = await runtime.prepareEngineCard(matchCard(["coffee", "zzz1", "zzz2"], "mp-few"))
  assert.ok(card && card.kind === "exercise")
  assert.notEqual(card.spec.params?.axis, "image", "no picture axis without ≥2 pictures")
})

test("match_pairs stays text/audio when imagepan is absent", async () => {
  const { runtime } = await makeRuntime({ imagepan: false })
  const card = await runtime.prepareEngineCard(matchCard(["coffee", "tea", "milk"], "mp-off"))
  assert.ok(card && card.kind === "exercise")
  assert.notEqual(card.spec.params?.axis, "image")
})

// -------------------------------------------------------------- picture cloze

test("picture cloze: a context-cloze over an imaged word carries the picture cue", async () => {
  const { runtime } = await makeRuntime({ imagepan: true })
  // "bravo" appears in every fixture phrase ("alpha bravo N"), so exampleFor
  // finds a real containing sentence → some graded reps convert to a context
  // cloze, and the blanked word's picture rides along as the cue.
  let sawCue = false
  for (let i = 0; i < 150 && !sawCue; i++) {
    const card = await runtime.prepareEngineCard(wordCard("choice_pick", "bravo", `clz-${i}`, "due"))
    if (!card || card.kind !== "exercise") continue
    if (card.spec.activityType === "cloze" && typeof card.spec.params?.cueImageSrc === "string") {
      sawCue = true
      assert.equal(card.spec.params?.cueImageSrc, IMG("bravo"))
      assert.equal(card.spec.params?.mode, "type", "picture cloze is a type-the-word context cloze")
    }
  }
  assert.ok(sawCue, "a picture-cued context cloze appears within 150 reps")
})

test("no picture cue when imagepan is absent (plain context cloze)", async () => {
  const { runtime } = await makeRuntime({ imagepan: false })
  for (let i = 0; i < 60; i++) {
    const card = await runtime.prepareEngineCard(wordCard("choice_pick", "bravo", `clz-off-${i}`, "due"))
    if (!card || card.kind !== "exercise") continue
    assert.equal(card.spec.params?.cueImageSrc, undefined, "no cue without imagepan")
  }
})
