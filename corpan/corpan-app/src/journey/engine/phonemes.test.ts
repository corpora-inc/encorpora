// engine.md §5.2/§5.4 — pronunciation-drill (phoneme + minimal-pair word)
// intake guard. Reproduces + fixes the CTO defect: a B1-PLACED learner was
// served A0 phoneme minimal-pair words (jam/ship/sheep/very/berry/yet) heavily,
// BEFORE communicative high-frequency vocab. The guard (a) classifies the
// minimal-pair WORDS as drills — not just kind==="phoneme" items — (b) suppresses
// ALL drills from a PLACED learner's intake, and (c) hard-caps drills per session.

import { test } from "node:test"
import assert from "node:assert/strict"

import { PHONEME_MAX_PER_SESSION } from "./constants.ts"
import { buildGraphIndex } from "./graph.ts"
import type { CourseGraph, EngineCard, ProbeResult } from "./types.ts"
import { makeFixtureGraph, nativeTemplates } from "./__fixtures__/fixtureGraph.ts"
import { answer, makeEngine } from "./__fixtures__/harness.ts"

/** The complaint words — minimal-pair drill WORDS (kind==="word"), not phonemes. */
const MINIMAL_PAIRS = ["jam", "ship", "sheep", "very", "berry", "yet"]

/** Inject a phonology skill into `unitIndex`: `nContrast` phoneme-kind contrast
 *  items + the minimal-pair WORD items, all under one skill (mirrors the real
 *  pack's en.skill.core-sounds). Adds phoneme+word templates and a `phonology`
 *  lesson recipe (l1-phoneme selector) on that unit — the authored phonics path. */
function withPhonology(graph: CourseGraph, unitIndex: number): CourseGraph {
  const unit = graph.units[unitIndex]
  const skillId = "skill-phon"
  const introBase = 9000
  const itemIds: string[] = []
  // phoneme-kind contrast drills
  const contrasts = ["b-v", "dʒ-j", "iː-ɪ", "ʃ-tʃ"]
  contrasts.forEach((c, i) => {
    const itemId = `phoneme:journey_en:${c}`
    graph.items[itemId] = {
      itemId, ref: { kind: "phoneme", source: "journey_en", id: c },
      skillIds: [skillId], b: -3.5, introOrder: introBase + i,
      importance: 1, probe: false, textLen: 3, kind: "phoneme",
    }
    itemIds.push(itemId)
  })
  // minimal-pair WORD drills (the CTO's jam/ship/sheep …) — SAME skill
  MINIMAL_PAIRS.forEach((w, i) => {
    const itemId = `word:en:${w}`
    graph.items[itemId] = {
      itemId, ref: { kind: "word", source: "en", id: w },
      skillIds: [skillId], b: -3.5, introOrder: introBase + 100 + i,
      importance: 1, probe: false, textLen: 4, kind: "word",
    }
    itemIds.push(itemId)
  })
  graph.skills[skillId] = { skillId, prereqs: [], itemIds, b: -3.5, unitId: unit.unitId }
  unit.skillIds.push(skillId)
  // renderable native templates for the new kinds
  graph.activityTemplates.push(...nativeTemplates("phoneme"), ...nativeTemplates("word"))
  // authored phonics lesson on this unit (l1-phoneme selector, like the real pack)
  graph.lessonRecipes.phonology = {
    recipeId: "phonology", estMinutes: 4,
    slots: [
      { slotType: "practice.minimal-pair", activityTypes: ["listen_pick"], itemSelector: "l1-phoneme", optional: false },
      { slotType: "produce.speak", activityTypes: ["choice_pick"], itemSelector: "l1-phoneme", optional: true },
    ],
  }
  graph.unitLessons[unit.unitId] = [
    { lessonIndex: 0, recipeId: "phonology" },
    { lessonIndex: 1, recipeId: "phonology" },
  ]
  return graph
}

function isDrill(graph: CourseGraph, itemId: string | undefined): boolean {
  if (!itemId) return false
  const it = graph.items[itemId]
  if (!it) return false
  return it.kind === "phoneme" || (it.kind === "word" && MINIMAL_PAIRS.includes(it.ref.id))
}

const refKey = (r: { kind: string; source: string; id: string }): string => `${r.kind}:${r.source}:${r.id}`

// ---------------------------------------------------------------------------

test("classify: minimal-pair WORDS + phoneme items are drills; communicative words are not", () => {
  const graph = withPhonology(makeFixtureGraph({ withLessons: false }), 0)
  // add a plain communicative word that must NOT be classified as a drill
  graph.items["word:en:please"] = {
    itemId: "word:en:please", ref: { kind: "word", source: "en", id: "please" },
    skillIds: [graph.units[0].skillIds[0]], b: -3.5, introOrder: 8000,
    importance: 2, probe: false, textLen: 6, kind: "word",
  }
  graph.skills[graph.units[0].skillIds[0]].itemIds.push("word:en:please")
  const gidx = buildGraphIndex(graph)

  assert.ok(gidx.phonologySkills.has("skill-phon"), "phonology skill detected via its phoneme items")
  for (const w of MINIMAL_PAIRS) {
    assert.ok(gidx.phonemeDrillItems.has(`word:en:${w}`), `${w} classified as a drill`)
  }
  assert.ok(gidx.phonemeDrillItems.has("phoneme:journey_en:b-v"), "phoneme item is a drill")
  assert.ok(!gidx.phonemeDrillItems.has("word:en:please"), "communicative word is NOT a drill")
})

test("B1-PLACED learner: ZERO A0 phoneme/minimal-pair serves; communicative content leads", async () => {
  // Phonology lives in unit 0; an all-correct responder places ABOVE content,
  // so every skill (incl. phonology) is provisionally PLACED. The learner should
  // never be drilled on A0 pronunciation — the whole feed is communicative.
  const graph = withPhonology(makeFixtureGraph({ bMax: -1 }), 0)
  const h = await makeEngine({}, graph)
  h.engine.startSession()

  // place: answer every probe correct → above-content, all skills placed
  const controller = h.engine.startPlacement("probe")
  const transcript: ProbeResult[] = []
  for (;;) {
    const card = controller.next()
    if (!card) break
    const ref = card.spec.itemRefs[0]
    transcript.push({ itemId: refKey(ref), correct: true, latencyMs: 2000 })
    h.engine.applyResult(answer(card, { pass: true }))
  }
  const outcome = controller.finalize()
  assert.ok(outcome.unlockedSkills.includes("skill-phon"), "phonology skill provisionally placed")

  // run the feed native-only (fresh device, no models) for ~100 items
  const cons = { availableProviders: ["native"], modelsAvailable: [] as ("stt" | "llm" | "tts")[] }
  let drillServes = 0
  let commServes = 0
  let issued = 0
  for (let batch = 0; batch < 15 && issued < 100; batch++) {
    const cards: EngineCard[] = h.engine.nextFeedItems(10, cons)
    if (cards.length === 0) break
    for (const c of cards) {
      issued++
      for (const ref of c.spec.itemRefs) {
        if (isDrill(graph, refKey(ref) in graph.items ? refKey(ref) : undefined)) drillServes++
        else if (graph.items[refKey(ref)]?.kind === "phrase") commServes++
      }
      h.engine.applyResult(answer(c, { pass: true }))
    }
  }
  assert.equal(drillServes, 0, `B1-placed learner served ${drillServes} A0 phoneme/minimal-pair drills (want 0)`)
  assert.ok(commServes > 0, "communicative content leads the feed")
})

test("hard per-session cap: a beginner's phoneme-drill serves never exceed PHONEME_MAX_PER_SESSION", async () => {
  // Zero-beginner at the sounds unit: the authored phonology lesson (l1-phoneme)
  // teaches phonics, but NEVER more than the per-session ceiling — phonics can
  // no longer dominate a sitting ("jam 10× in 30 min").
  const graph = withPhonology(makeFixtureGraph({ bMax: -1 }), 0)
  const h = await makeEngine({}, graph)
  const start = h.engine.startSession()
  assert.ok(start.needsPlacement)
  h.engine.placeUser([]) // zero-beginner: no cards, position = unit 0

  const cons = { availableProviders: ["native"], modelsAvailable: [] as ("stt" | "llm" | "tts")[] }
  // Count FEATURED drill cards (the primary/spotlight item, itemRefs[0]) — the
  // felt "this card is a phonics drill" the cap governs. (Extra phonemes shown
  // as tiles inside a phoneme match-pairs grid are one card, not domination.)
  let featuredDrills = 0
  for (let batch = 0; batch < 40; batch++) {
    const cards: EngineCard[] = h.engine.nextFeedItems(10, cons)
    if (cards.length === 0) break
    for (const c of cards) {
      const primary = c.spec.itemRefs[0]
      if (primary && isDrill(graph, refKey(primary) in graph.items ? refKey(primary) : undefined)) featuredDrills++
      h.engine.applyResult(answer(c, { pass: true }))
    }
  }
  assert.ok(featuredDrills > 0, "phonics is still taught to a genuine beginner (not suppressed)")
  assert.ok(
    featuredDrills <= PHONEME_MAX_PER_SESSION,
    `featured ${featuredDrills} phoneme drills this session (cap ${PHONEME_MAX_PER_SESSION})`,
  )
})
