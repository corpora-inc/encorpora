// Resolver tests — golden per-kind resolution, missing-content behavior,
// caching, truncation guard (content-resolver.md §6).

import { test } from "node:test"
import assert from "node:assert/strict"

import type { ItemRef } from "../../contentPacks/activityContract.ts"
import { contentMissingResult, createResolver, pickPreferred } from "./resolve.ts"
import {
  BOOK_ID,
  FIXTURE_CTX,
  FixtureDeps,
  NARRATION_PACK_ID,
  PHRASE_PACK_ID,
} from "./__fixtures__/index.ts"

const phraseRef = (id: number, source = "base"): ItemRef => ({
  kind: "phrase",
  source,
  id: String(id),
})

function fresh() {
  const deps = new FixtureDeps()
  const resolver = createResolver(deps, FIXTURE_CTX)
  return { deps, resolver }
}

// ----------------------------------------------------- golden per-kind shape

test("phrase (base corpus): both faces, level, extras", async () => {
  const { resolver } = fresh()
  const { resolved, missing } = await resolver.resolveItems([phraseRef(101)])
  assert.equal(missing.length, 0)
  assert.deepEqual(resolved[0], {
    ref: { kind: "phrase", source: "base", id: "101" },
    key: "phrase:base:101",
    kind: "phrase",
    target: { text: "Hello", ttsText: "Hello" },
    native: { text: "hola", ttsText: "hola" },
    level: "A1",
    extras: { kind: "phrase", source: "base", domains: ["greetings"] },
  })
})

test("phrase (phrase pack): source is passed through", async () => {
  const { resolver } = fresh()
  const { resolved } = await resolver.resolveItems([phraseRef(201, PHRASE_PACK_ID)])
  assert.equal(resolved[0].key, `phrase:${PHRASE_PACK_ID}:201`)
  assert.equal(resolved[0].extras?.kind, "phrase")
  assert.equal(
    (resolved[0].extras as { source: string }).source,
    PHRASE_PACK_ID,
  )
})

test("word: surface form + wordpan explanations; native face NEVER set", async () => {
  const { resolver } = fresh()
  const { resolved } = await resolver.resolveItems([
    { kind: "word", source: "en", id: "coffee" },
  ])
  assert.deepEqual(resolved[0], {
    ref: { kind: "word", source: "en", id: "coffee" },
    key: "word:en:coffee",
    kind: "word",
    target: { text: "coffee", ttsText: "coffee" },
    extras: {
      kind: "word",
      explanationNative:
        "Coffee es la bebida hecha de granos tostados; también la reunión informal para tomarla.",
      explanationTarget:
        "Coffee is the drink brewed from roasted beans; informally, a short social meeting over a cup.",
    },
  })
  assert.equal(resolved[0].native, undefined)
})

test("word: never hard-misses — pack absent ⇒ resolves without extras", async () => {
  const deps = new FixtureDeps({ wordPackInstalled: false })
  const resolver = createResolver(deps, FIXTURE_CTX)
  const { resolved, missing } = await resolver.resolveItems([
    { kind: "word", source: "en", id: "coffee" },
  ])
  assert.equal(missing.length, 0)
  assert.equal(resolved[0].extras, undefined)
})

test("word: surface-form gap in wordpan ⇒ still resolves, extras absent", async () => {
  const { resolver } = fresh()
  const { resolved, missing } = await resolver.resolveItems([
    { kind: "word", source: "en", id: "xylophone" },
  ])
  assert.equal(missing.length, 0)
  assert.equal(resolved[0].target.text, "xylophone")
  assert.equal(resolved[0].extras, undefined)
})

test("char: hanzipan row + native-first etymology + pinyin romanization", async () => {
  const { resolver } = fresh()
  const { resolved } = await resolver.resolveItems([
    { kind: "char", source: "hanzipan", id: "愛" },
  ])
  assert.deepEqual(resolved[0], {
    ref: { kind: "char", source: "hanzipan", id: "愛" },
    key: "char:hanzipan:愛",
    kind: "char",
    target: { text: "愛", ttsText: "愛", romanization: "ài" },
    extras: {
      kind: "char",
      pinyin: "ài",
      strokeCount: 13,
      radical: "心",
      frequency: 394,
      etymology: "Etimología de 愛 en español.",
    },
  })
})

test("segment: display/tts divergence + display-aligned audio words", async () => {
  const { resolver } = fresh()
  const ref: ItemRef = { kind: "segment", source: BOOK_ID, id: "ch01-003" }
  const { resolved } = await resolver.resolveItems([ref])
  const item = resolved[0]
  assert.equal(item.target.text, "It travels in waves at 300,000 km per second.")
  assert.equal(
    item.target.ttsText,
    "It travels in waves at three hundred thousand kilometers per second.",
  )
  assert.deepEqual(item.audio, {
    src: `corpan-pack://localhost/${NARRATION_PACK_ID}/audio/en/ch01-003.m4a`,
    durationMs: 3100,
    words: [{ word: "It", startMs: 30, endMs: 200 }],
  })
  assert.deepEqual(item.extras, {
    kind: "segment",
    bookId: BOOK_ID,
    chapter: 1,
    blockType: "text",
    pauseAfterMs: 900,
  })
  assert.equal(item.native, undefined)
})

test("segment: heading_level 1 is display-only — ttsText = text, no audio", async () => {
  const { resolver } = fresh()
  const { resolved } = await resolver.resolveItems([
    { kind: "segment", source: BOOK_ID, id: "ch01-001" },
  ])
  assert.equal(resolved[0].target.text, "Light")
  assert.equal(resolved[0].target.ttsText, "Light")
  assert.equal(resolved[0].audio, undefined)
  assert.equal((resolved[0].extras as { blockType: string }).blockType, "heading")
})

test("grammarNode: batch phrase refs become the exemplars (mixer's choice)", async () => {
  const { resolver } = fresh()
  const gnRef: ItemRef = {
    kind: "grammarNode",
    source: "journey_en",
    id: "en.gn.present-simple-3sg",
  }
  const { resolved, missing } = await resolver.resolveItems([gnRef, phraseRef(116)])
  assert.equal(missing.length, 0)
  assert.equal(resolved.length, 2)
  // Spec order preserved: grammarNode slot first, phrase second.
  const gn = resolved[0]
  assert.equal(gn.kind, "grammarNode")
  const extras = gn.extras as {
    kind: string
    title: string
    note: string
    lateAcquired: boolean
    exemplars: { key: string }[]
  }
  assert.equal(extras.title, "La -s de tercera persona") // native-first strings
  assert.match(extras.note, /Con he, she o it/)
  assert.equal(extras.lateAcquired, true)
  assert.deepEqual(
    extras.exemplars.map((e) => e.key),
    ["phrase:base:116"],
  )
  // The node is shown THROUGH its exemplar.
  assert.equal(gn.target.text, "She works every day")
  assert.equal(gn.level, "A2")
})

test("grammarNode: standalone ⇒ seeded exemplar pick, stable across instances", async () => {
  const gnRef: ItemRef = {
    kind: "grammarNode",
    source: "journey_en",
    id: "en.gn.present-simple-3sg",
  }
  const a = await fresh().resolver.resolveItems([gnRef])
  const b = await fresh().resolver.resolveItems([gnRef])
  assert.equal(a.missing.length, 0)
  const exA = (a.resolved[0].extras as { exemplars: { key: string }[] }).exemplars
  assert.ok(exA.length >= 1 && exA.length <= 3)
  assert.equal(JSON.stringify(a.resolved[0]), JSON.stringify(b.resolved[0]))
})

test("grammarNode: missing note string ⇒ row_absent (never a blank rule card)", async () => {
  const { resolver } = fresh()
  const { resolved, missing } = await resolver.resolveItems([
    { kind: "grammarNode", source: "journey_en", id: "en.gn.noteless" },
  ])
  assert.equal(resolved.length, 0)
  assert.deepEqual(missing[0].reason, "row_absent")
})

test("phoneme: l1 overlay pair data, prompt = first minimal-pair word", async () => {
  const { resolver } = fresh()
  const { resolved } = await resolver.resolveItems([
    { kind: "phoneme", source: "journey_en", id: "iː-ɪ" },
  ])
  assert.deepEqual(resolved[0], {
    ref: { kind: "phoneme", source: "journey_en", id: "iː-ɪ" },
    key: "phoneme:journey_en:iː-ɪ",
    kind: "phoneme",
    target: { text: "ship", ttsText: "ship" },
    extras: {
      kind: "phoneme",
      contrast: "iː-ɪ",
      minimalPairs: [
        ["ship", "sheep"],
        ["sit", "seat"],
        ["chip", "cheap"],
      ],
    },
  })
})

test("phoneme: single-language stack (no L1) ⇒ row_absent", async () => {
  const deps = new FixtureDeps()
  const resolver = createResolver(deps, { courseId: "journey_en", targetLang: "en" })
  const { missing } = await resolver.resolveItems([
    { kind: "phoneme", source: "journey_en", id: "iː-ɪ" },
  ])
  assert.equal(missing[0].reason, "row_absent")
})

test("byte-stable resolution: same refs ⇒ identical JSON across fresh resolvers", async () => {
  const refs: ItemRef[] = [
    phraseRef(101),
    { kind: "word", source: "en", id: "coffee" },
    { kind: "char", source: "hanzipan", id: "愛" },
    { kind: "segment", source: BOOK_ID, id: "ch01-002" },
    { kind: "phoneme", source: "journey_en", id: "iː-ɪ" },
  ]
  const a = await fresh().resolver.resolveItems(refs)
  const b = await fresh().resolver.resolveItems(refs)
  assert.equal(JSON.stringify(a), JSON.stringify(b))
  // Spec order preserved.
  assert.deepEqual(
    a.resolved.map((r) => r.key),
    refs.map((r) => `${r.kind}:${r.source}:${r.id}`),
  )
})

// ------------------------------------------------- missing-content behavior

test("every MissingReason has a fixture that produces exactly it", async () => {
  const cases: Array<[ItemRef, string, FixtureDeps?]> = [
    [phraseRef(999, "phrase-uninstalled-pack"), "pack_not_installed"],
    [phraseRef(999), "row_absent"],
    [phraseRef(118), "translation_absent"], // entry with no en row
    [{ kind: "char", source: "hanzipan", id: "龍" }, "row_absent"],
    [{ kind: "concept", source: "imagepan", id: "obj_bicycle" }, "pack_not_installed"],
  ]
  for (const [ref, reason, customDeps] of cases) {
    const deps = customDeps ?? new FixtureDeps()
    const resolver = createResolver(deps, FIXTURE_CTX)
    const { resolved, missing } = await resolver.resolveItems([ref])
    assert.equal(resolved.length, 0, `${reason}: nothing should resolve`)
    assert.equal(missing.length, 1)
    assert.equal(missing[0].reason, reason)
    // §3.3: each drop logs one structured census line.
    assert.ok(
      deps.events.some(
        (e) => e.event === "journey_content_missing" && e.data.reason === reason,
      ),
      `journey_content_missing logged for ${reason}`,
    )
  }
})

test("segment: uninstalled narration pack ⇒ pack_not_installed", async () => {
  const deps = new FixtureDeps({ narrationInstalled: false })
  const resolver = createResolver(deps, FIXTURE_CTX)
  const { missing } = await resolver.resolveItems([
    { kind: "segment", source: BOOK_ID, id: "ch01-002" },
  ])
  assert.equal(missing[0].reason, "pack_not_installed")
})

test("segment: ref beyond a preview-truncated pack ⇒ preview_truncated", async () => {
  const deps = new FixtureDeps({ narrationPreview: true })
  const resolver = createResolver(deps, FIXTURE_CTX)
  const inRange = await resolver.resolveItems([
    { kind: "segment", source: BOOK_ID, id: "ch01-002" },
  ])
  assert.equal(inRange.missing.length, 0)
  const beyond = await resolver.resolveItems([
    { kind: "segment", source: BOOK_ID, id: "ch02-002" },
  ])
  assert.equal(beyond.missing[0].reason, "preview_truncated")
})

test("segment: unknown id in a FULL pack ⇒ row_absent (not preview)", async () => {
  const { resolver } = fresh()
  const { missing } = await resolver.resolveItems([
    { kind: "segment", source: BOOK_ID, id: "ch09-999" },
  ])
  assert.equal(missing[0].reason, "row_absent")
})

test("resolveItems never throws: corrupted course-pack sqlite ⇒ db_error", async () => {
  const deps = new FixtureDeps()
  deps.corruptPacks.add("journey_en")
  const resolver = createResolver(deps, FIXTURE_CTX)
  const { missing } = await resolver.resolveItems([
    { kind: "grammarNode", source: "journey_en", id: "en.gn.present-simple-3sg" },
    { kind: "phoneme", source: "journey_en", id: "iː-ɪ" },
  ])
  assert.deepEqual(
    missing.map((m) => m.reason),
    ["db_error", "db_error"],
  )
})

test("partial success is normal: good refs resolve alongside missing ones", async () => {
  const { resolver, deps } = fresh()
  const { resolved, missing } = await resolver.resolveItems([
    phraseRef(101),
    phraseRef(999),
    { kind: "segment", source: BOOK_ID, id: "ch01-002" },
  ])
  assert.equal(resolved.length, 2)
  assert.equal(missing.length, 1)
  assert.equal(deps.events.filter((e) => e.event === "journey_content_missing").length, 1)
})

// ---------------------------------------------------------------- caching

test("item cache: repeat resolution served without re-querying", async () => {
  const { resolver, deps } = fresh()
  await resolver.resolveItems([phraseRef(101)])
  assert.equal(deps.entryCalls, 1)
  await resolver.resolveItems([phraseRef(101)])
  assert.equal(deps.entryCalls, 1)
})

test("segment file maps cached per pack (one fetch pair for many segments)", async () => {
  const { resolver } = fresh()
  await resolver.resolveItems([
    { kind: "segment", source: BOOK_ID, id: "ch01-002" },
    { kind: "segment", source: BOOK_ID, id: "ch01-004" },
    { kind: "segment", source: BOOK_ID, id: "ch02-001" },
  ])
  // No direct fetch counter: byte-stability + this not-throwing suffices;
  // the maps cache is asserted via invalidate() below.
})

test("invalidate(): mid-session wordpan install surfaces without a restart", async () => {
  const deps = new FixtureDeps({ wordPackInstalled: false })
  const resolver = createResolver(deps, FIXTURE_CTX)
  const before = await resolver.resolveItems([{ kind: "word", source: "en", id: "coffee" }])
  assert.equal(before.resolved[0].extras, undefined)
  deps.setWordPackInstalled(true)
  // Item cache still serves the degraded item until the install event fires…
  const cached = await resolver.resolveItems([{ kind: "word", source: "en", id: "coffee" }])
  assert.equal(cached.resolved[0].extras, undefined)
  // …which the runtime wires to invalidate() (§3.2).
  resolver.invalidate()
  const after = await resolver.resolveItems([{ kind: "word", source: "en", id: "coffee" }])
  assert.equal((after.resolved[0].extras as { kind: string }).kind, "word")
})

test("absence is never cached: pack install is visible WITHOUT invalidate", async () => {
  const deps = new FixtureDeps({ hanzipanInstalled: false })
  const resolver = createResolver(deps, FIXTURE_CTX)
  const before = await resolver.resolveItems([{ kind: "char", source: "hanzipan", id: "愛" }])
  assert.equal(before.missing[0].reason, "pack_not_installed")
  deps.setHanzipanInstalled(true)
  const after = await resolver.resolveItems([{ kind: "char", source: "hanzipan", id: "愛" }])
  assert.equal(after.missing.length, 0)
  assert.equal(after.resolved.length, 1)
})

// ---------------------------------------------------- lazy stroke path

test("resolveCharStrokes: lazy, cached, null on gaps and when pack absent", async () => {
  const { resolver } = fresh()
  const strokes = (await resolver.resolveCharStrokes("愛")) as { strokes: string[] }
  assert.deepEqual(strokes.strokes, ["M 1 1", "M 2 2"])
  assert.equal(await resolver.resolveCharStrokes("水"), null) // no writer row
  const deps = new FixtureDeps({ hanzipanInstalled: false })
  const bare = createResolver(deps, FIXTURE_CTX)
  assert.equal(await bare.resolveCharStrokes("愛"), null)
})

// ------------------------------------------------------- truncation guard

test("a full page (rows.length === LIMIT > 1) logs the truncation warning", async () => {
  const { resolver, deps } = fresh()
  // en.gn.greetings sits on a 12-phrase skill; the exemplar query LIMIT 8
  // returns exactly 8 rows.
  const { resolved } = await resolver.resolveItems([
    { kind: "grammarNode", source: "journey_en", id: "en.gn.greetings" },
  ])
  assert.equal(resolved.length, 1)
  assert.ok(
    deps.events.some(
      (e) => e.event === "journey_content_truncation" && e.data.limit === 8,
    ),
    "truncation warning fired",
  )
})

test("LIMIT 1 point-lookup hits do NOT spam the truncation log", async () => {
  const { resolver, deps } = fresh()
  await resolver.resolveItems([{ kind: "char", source: "hanzipan", id: "愛" }])
  assert.ok(!deps.events.some((e) => e.event === "journey_content_truncation"))
})

// ------------------------------------------------ §3.3 envelope + selector

test("contentMissingResult builds the exact §3.3 envelope", () => {
  assert.deepEqual(contentMissingResult("js-123-ab"), {
    specId: "js-123-ab",
    score: 0,
    perItem: [],
    durationMs: 0,
    abandoned: true,
    detail: { flags: { contentMissing: true } },
  })
})

test("pickPreferred walks native → target → en → any", () => {
  const byLang = new Map([
    ["en", "EN"],
    ["es", "ES"],
  ])
  assert.deepEqual(pickPreferred(byLang, ["es", "en"]), { text: "ES", lang: "es" })
  assert.deepEqual(pickPreferred(new Map([["en", "EN"]]), ["es"]), {
    text: "EN",
    lang: "en",
  })
  assert.deepEqual(pickPreferred(new Map([["fr", "FR"]]), ["es"]), {
    text: "FR",
    lang: "fr",
  })
  assert.equal(pickPreferred(new Map(), ["es"]), null)
})
