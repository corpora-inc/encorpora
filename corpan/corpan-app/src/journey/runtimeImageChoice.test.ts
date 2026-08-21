// Picture-choice EMISSION (runtime.ts maybeImageChoice) — a first-exposure
// word choice card becomes a media:'image' picture choice when the imagepan
// pack is installed, and stays a normal text card otherwise (ships inert).
// items[0] stays the WORD, so grading/mastery is unchanged (research/images.md).

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import type { EngineCard } from "./engine/index.ts"
import { cardRng } from "./content/rng.ts"

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
const { makeRuntimeFixtureDeps, FIXTURE_RUNTIME_CTX } = await import("./__fixtures__/runtimeFixture.ts")
const { createJourneyRuntime } = await import("./runtime.ts")
const { useJourneyStore } = await import("../store/journey.ts")

function imagepanDb(): InstanceType<typeof DatabaseSync> {
  const db = new DatabaseSync(":memory:")
  db.exec(
    "CREATE TABLE concept (key TEXT PRIMARY KEY, word TEXT NOT NULL, sense_gloss TEXT, cefr TEXT, domain TEXT, file TEXT NOT NULL, distractors_json TEXT NOT NULL)",
  )
  const ins = db.prepare("INSERT INTO concept VALUES (?,?,?,?,?,?,?)")
  const sib = (k: string) => ({ key: k, word: k, file: `images/${k}.webp` })
  ins.run("coffee", "coffee", "coffee", "A1", "drink", "images/coffee.webp", JSON.stringify([sib("tea"), sib("milk")]))
  ins.run("tea", "tea", "tea", "A1", "drink", "images/tea.webp", JSON.stringify([sib("coffee"), sib("milk")]))
  ins.run("milk", "milk", "milk", "A1", "drink", "images/milk.webp", JSON.stringify([sib("coffee"), sib("tea")]))
  return db
}

async function makeImgRuntime(imagepanInstalled: boolean) {
  const harness = await makeEngine({ arcs: 1, unitsPerArc: 2, skillsPerUnit: 2, itemsPerSkill: 6 })
  const base = makeRuntimeFixtureDeps(harness.graph)
  const idb = imagepanDb()
  const deps = {
    ...base,
    findInstalledPack: (id: string) => (id === "imagepan" ? imagepanInstalled : id === "base"),
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

/** A raw native word choice_pick EngineCard, fed directly to prepareEngineCard. */
function wordChoiceCard(specId: string, word: string, pool: "new" | "due" | "probe" = "new"): EngineCard {
  return {
    spec: {
      specId,
      activityType: "choice_pick",
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

/** A raw native intro_echo (WORD DEBUT) EngineCard, fed to prepareEngineCard. */
function wordIntroCard(specId: string, word: string): EngineCard {
  return {
    spec: {
      specId,
      activityType: "intro_echo",
      itemRefs: [{ kind: "word", source: "en", id: word }],
      targetLang: "en",
      nativeLang: "es",
      params: { intro: true },
    },
    meta: {
      pool: "new",
      strand: "language",
      form: 0,
      estSec: 12,
      provider: "native",
      celebration: "normal",
      coolDownCandidate: false,
      unscored: true,
    },
  }
}

/** A specId whose deterministic gate (`<id>:imgchoice` < 0.6) PASSES. */
function passingSpecId(): string {
  for (let i = 0; i < 500; i++) {
    const id = `img-${i}`
    if (cardRng(`${id}:imgchoice`)() < 0.6) return id
  }
  throw new Error("no passing specId found")
}

beforeEach(() => {
  useJourneyStore.setState({ byCourse: {}, learningDays: [] })
})

test("installed imagepan: a first-exposure word choice becomes a picture choice", async () => {
  const { runtime } = await makeImgRuntime(true)
  const card = await runtime.prepareEngineCard(wordChoiceCard(passingSpecId(), "coffee"))
  assert.ok(card && card.kind === "exercise")
  assert.equal(card.spec.activityType, "choice_pick")
  assert.equal(card.spec.params?.media, "image")
  assert.equal(card.spec.params?.answerImageSrc, "corpan-pack://localhost/imagepan/images/coffee.webp")
  const ds = card.spec.params?.imageDistractors as unknown[]
  assert.ok(Array.isArray(ds) && ds.length >= 1)
  // items[0] STAYS the word — grading/mastery unchanged.
  assert.deepEqual(card.prepared.items[0].ref, { kind: "word", source: "en", id: "coffee" })
  // No text distractor set was sampled for the picture card.
  assert.equal(card.prepared.distractors, null)
})

test("intro_echo DEBUT with sibling pictures ⇒ HEAR→tap-the-picture, type stays intro_echo (no share gate)", async () => {
  const { runtime } = await makeImgRuntime(true)
  // No passingSpecId needed — the debut always upgrades when siblings exist.
  const card = await runtime.prepareEngineCard(wordIntroCard("intro-coffee", "coffee"))
  assert.ok(card && card.kind === "exercise")
  // The unscored debut KEEPS its type — only the presentation becomes pictures.
  assert.equal(card.spec.activityType, "intro_echo")
  assert.equal(card.spec.params?.media, "image")
  assert.equal(card.spec.params?.answerImageSrc, "corpan-pack://localhost/imagepan/images/coffee.webp")
  const ds = card.spec.params?.imageDistractors as unknown[]
  assert.ok(Array.isArray(ds) && ds.length >= 1)
  // items[0] STAYS the word; picture options carry their own tiles (no sampler).
  assert.deepEqual(card.prepared.items[0].ref, { kind: "word", source: "en", id: "coffee" })
  assert.equal(card.prepared.distractors, null)
})

test("intro_echo DEBUT never drops on a thin pool (unscored → degrades, never content-missing)", async () => {
  const { runtime } = await makeImgRuntime(false) // no imagepan
  // 'xylophone' has no concept + (in this single-skill fixture) a thin gloss
  // pool; an intro_echo must still render — never a dropped card.
  const card = await runtime.prepareEngineCard(wordIntroCard("intro-xylophone", "xylophone"))
  assert.ok(card && card.kind === "exercise")
  assert.equal(card.spec.activityType, "intro_echo")
  assert.notEqual(card.spec.params?.media, "image")
})

test("no imagepan pack ⇒ never a picture choice (wiring ships inert)", async () => {
  const { runtime } = await makeImgRuntime(false)
  const card = await runtime.prepareEngineCard(wordChoiceCard(passingSpecId(), "coffee"))
  assert.ok(card && card.kind === "exercise")
  assert.notEqual(card.spec.params?.media, "image")
})

test("probe word cards never become picture choices", async () => {
  const { runtime } = await makeImgRuntime(true)
  const card = await runtime.prepareEngineCard(wordChoiceCard(passingSpecId(), "coffee", "probe"))
  assert.ok(card && card.kind === "exercise")
  assert.notEqual(card.spec.params?.media, "image")
})

test("a word with no matching concept stays a normal card", async () => {
  const { runtime } = await makeImgRuntime(true)
  // 'xylophone' is not in the imagepan fixture → concept row_absent → no upgrade.
  const card = await runtime.prepareEngineCard(wordChoiceCard(passingSpecId(), "xylophone"))
  assert.ok(card && card.kind === "exercise")
  assert.notEqual(card.spec.params?.media, "image")
})
