// Concept-image REVEAL wiring (runtime.ts maybeConceptImage) — a WORD debut
// (intro_echo), listening reveal (listen_pick), or flip reveal (flip_recall)
// carries an optional `conceptImageSrc` when the imagepan pack is installed and
// the word maps to a concept picture, and stays plain text otherwise (ships
// inert). items[0] stays the WORD, so grading/mastery is unchanged. The picture
// is presentation only — this is NOT the picture-CHOICE conversion.

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import type { EngineCard } from "./engine/index.ts"

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
const { createResolver } = await import("./content/resolve.ts")
const { buildCourseDb, makeRuntimeFixtureDeps, FIXTURE_RUNTIME_CTX } = await import(
  "./__fixtures__/runtimeFixture.ts"
)
const { createJourneyRuntime } = await import("./runtime.ts")
const { useJourneyStore } = await import("../store/journey.ts")

function imagepanDb(): InstanceType<typeof DatabaseSync> {
  const db = new DatabaseSync(":memory:")
  db.exec(
    "CREATE TABLE concept (key TEXT PRIMARY KEY, word TEXT NOT NULL, sense_gloss TEXT, cefr TEXT, domain TEXT, file TEXT NOT NULL, distractors_json TEXT NOT NULL)",
  )
  const ins = db.prepare("INSERT INTO concept VALUES (?,?,?,?,?,?,?)")
  const sib = (k: string) => ({ key: k, word: k, file: `images/${k}.webp` })
  // coffee ships NO sibling pictures → a picture-OPTIONS grid can't be built, so
  // the debut stays the passive picture HERO (conceptImageSrc).
  ins.run("coffee", "coffee", "coffee", "A1", "drink", "images/coffee.webp", JSON.stringify([]))
  // tea ships sibling pictures → the debut becomes a HEAR→tap-the-picture card.
  ins.run("tea", "tea", "tea", "A1", "drink", "images/tea.webp", JSON.stringify([sib("coffee"), sib("milk")]))
  return db
}

async function makeRuntime(imagepanInstalled: boolean) {
  const harness = await makeEngine({ arcs: 1, unitsPerArc: 2, skillsPerUnit: 2, itemsPerSkill: 6 })
  // A course DB carrying a native word gloss so flip_recall keeps a native face
  // (else the translation guard reroutes it away from flip_recall).
  const courseDb = buildCourseDb(harness.graph)
  courseDb.prepare("INSERT INTO strings VALUES (?, ?, ?)").run("wg.coffee", "es", "el café")
  const base = makeRuntimeFixtureDeps(harness.graph, { db: courseDb })
  const idb = imagepanDb()
  const deps = {
    ...base,
    findInstalledPack: (id: string) =>
      id === "imagepan" ? imagepanInstalled : id === "base",
    queryPackDb: async (q: Parameters<typeof base.queryPackDb>[0]) => {
      if (q.packId === "imagepan") {
        const rows = idb.prepare(q.sql).all(...((q.params ?? []) as (string | number | null)[])) as Record<
          string,
          unknown
        >[]
        return { columns: rows[0] ? Object.keys(rows[0]) : [], rows }
      }
      return base.queryPackDb(q)
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
    quota: { note: () => {}, remaining: () => 999, limit: () => 999, locked: () => false },
    now: () => harness.clock.nowMs(),
  })
  return { runtime }
}

/** A raw native word card of any activity type, fed to prepareEngineCard. */
function wordCard(
  activityType: string,
  word: string,
  pool: "new" | "due" | "probe" = "new",
): EngineCard {
  return {
    spec: {
      specId: `${activityType}-${word}`,
      activityType,
      itemRefs: [{ kind: "word", source: "en", id: word }],
      targetLang: "en",
      nativeLang: "es",
      params: pool === "probe" ? { probe: true } : { intro: pool === "new" },
    },
    meta: {
      pool,
      strand: "language",
      form: 0,
      estSec: 12,
      provider: "native",
      celebration: "normal",
      coolDownCandidate: false,
    },
  }
}

beforeEach(() => {
  useJourneyStore.setState({ byCourse: {}, learningDays: [] })
})

test("intro_echo debut WITHOUT sibling pictures ⇒ passive picture HERO (conceptImageSrc)", async () => {
  const { runtime } = await makeRuntime(true)
  const card = await runtime.prepareEngineCard(wordCard("intro_echo", "coffee"))
  assert.ok(card && card.kind === "exercise")
  assert.equal(card.spec.activityType, "intro_echo")
  // No sibling pictures → no picture-OPTIONS grid → the hero image path.
  assert.equal(card.spec.params?.media, undefined)
  assert.equal(card.spec.params?.conceptImageSrc, "corpan-pack://localhost/imagepan/images/coffee.webp")
  // items[0] STAYS the word — grading/mastery unchanged.
  assert.deepEqual(card.prepared.items[0].ref, { kind: "word", source: "en", id: "coffee" })
})

test("intro_echo debut WITH sibling pictures ⇒ HEAR→tap-the-picture (media:'image')", async () => {
  const { runtime } = await makeRuntime(true)
  const card = await runtime.prepareEngineCard(wordCard("intro_echo", "tea"))
  assert.ok(card && card.kind === "exercise")
  // The debut KEEPS its unscored type — only the presentation becomes pictures.
  assert.equal(card.spec.activityType, "intro_echo")
  assert.equal(card.spec.params?.media, "image")
  assert.equal(card.spec.params?.answerImageSrc, "corpan-pack://localhost/imagepan/images/tea.webp")
  const ds = card.spec.params?.imageDistractors as unknown[]
  assert.ok(Array.isArray(ds) && ds.length >= 1)
  // Picture options carry their own tiles → no hero image, no text sampler.
  assert.equal(card.spec.params?.conceptImageSrc, undefined)
  assert.equal(card.prepared.distractors, null)
  // items[0] STAYS the word — grading/mastery unchanged.
  assert.deepEqual(card.prepared.items[0].ref, { kind: "word", source: "en", id: "tea" })
})

test("flip_recall word (with a native face) gets conceptImageSrc", async () => {
  const { runtime } = await makeRuntime(true)
  const card = await runtime.prepareEngineCard(wordCard("flip_recall", "coffee", "due"))
  assert.ok(card && card.kind === "exercise")
  assert.equal(card.spec.activityType, "flip_recall")
  assert.equal(card.spec.params?.conceptImageSrc, "corpan-pack://localhost/imagepan/images/coffee.webp")
})

test("no imagepan pack ⇒ no conceptImageSrc (wiring ships inert)", async () => {
  const { runtime } = await makeRuntime(false)
  const card = await runtime.prepareEngineCard(wordCard("intro_echo", "coffee"))
  assert.ok(card && card.kind === "exercise")
  assert.equal(card.spec.params?.conceptImageSrc, undefined)
})

test("a word with no matching concept stays plain (no conceptImageSrc)", async () => {
  const { runtime } = await makeRuntime(true)
  const card = await runtime.prepareEngineCard(wordCard("intro_echo", "xylophone"))
  assert.ok(card && card.kind === "exercise")
  assert.equal(card.spec.params?.conceptImageSrc, undefined)
})
