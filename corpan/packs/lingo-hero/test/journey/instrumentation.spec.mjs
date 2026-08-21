/**
 * Journey instrumentation unit test (activity-contract §6.1 / W9 exit gate).
 *
 * Drives the REAL journey modules (state + reporter + ContentManager pinning)
 * headless — a fixture journey mount: spec in, wave-resolved events through the
 * real event bus, terminal ActivityResult out — and asserts every emitted
 * payload passes the CONTRACT Zod schemas (bundled from the app module,
 * corpan-app/src/contentPacks/activitySchemas.ts, via esbuild — the same
 * pattern the app's own contract tests use).
 *
 * What it proves:
 *   (a) pinned content — ContentManager serves the spec's itemRefs as round
 *       targets IN ORDER via the journey WordSelector, with random top-up for
 *       distractors (answer-dedup contract untouched);
 *   (b) per-item reporting — each wave-resolved on a spec entry emits one
 *       ActivityItemResult through hostApi.journey.reportItem (schema-valid);
 *       waves on top-up (non-spec) entries are NOT reported;
 *   (c) terminal result — after params.rounds charts the run is complete and
 *       finish() reports exactly one schema-valid ActivityResult with the
 *       clean-catch score, presentation-ordered perItem, and run numbers;
 *   (d) rail fallback — without hostApi.journey the terminal result rides the
 *       corpan:activity-result CustomEvent with packId "lingo_hero";
 *   (e) Leitner retirement — under a journey run initLearning wires the
 *       reporter and does NOT touch localStorage (WordStatsStore retired).
 *
 * Run:  node test/journey/instrumentation.spec.mjs   (node >= 22)
 */

import { fileURLToPath } from "node:url"
import path from "node:path"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import os from "node:os"

const here = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.join(here, "..", "..")
const corpanRoot = path.join(packRoot, "..", "..")

let failures = 0
const fail = (m) => { console.error("FAIL:", m); failures++ }
const ok = (m) => console.log("OK", m)
const assert = (cond, m) => { if (cond) ok(m); else fail(m) }

// ---------------------------------------------------------------------------
// Bundle the real modules with esbuild (vite's own resolver/transpiler), then
// import them. Game.ts / styles are NOT pulled in — this is the instrumentation
// seam, not the canvas game.
// ---------------------------------------------------------------------------
const { build } = await import("esbuild")

async function bundle(entryText, resolveDir) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "lh-journey-test-"))
  try {
    const entry = path.join(dir, "entry.ts")
    writeFileSync(entry, entryText)
    const res = await build({
      entryPoints: [entry],
      bundle: true,
      format: "esm",
      write: false,
      platform: "node",
      absWorkingDir: resolveDir,
    })
    const code = res.outputFiles[0].text
    return await import(
      "data:text/javascript;base64," + Buffer.from(code).toString("base64")
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const srcDir = path.join(packRoot, "src").replace(/\\/g, "/")
const m = await bundle(
  `export { beginJourneyRun, getJourneyRun, endJourneyRun, JourneyRun, PACK_ID, JOURNEY_ACTIVITY_TYPE } from "${srcDir}/journey/state.ts"
export { initJourneyReporting } from "${srcDir}/journey/reporter.ts"
export { initLearning } from "${srcDir}/learning/index.ts"
export { ContentManager, setDefaultWordSelector, setDefaultPinnedEntries } from "${srcDir}/ContentManager.ts"
export { createEventBus } from "${srcDir}/events.ts"
`,
  packRoot
)

const schemasPath = path
  .join(corpanRoot, "corpan-app", "src", "contentPacks", "activitySchemas.ts")
  .replace(/\\/g, "/")
const schemas = await bundle(
  `export { ActivitySpecSchema, ActivityItemResultSchema, ActivityResultSchema, ActivityResultEventDetailSchema } from "${schemasPath}"`,
  path.join(corpanRoot, "corpan-app")
)

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const entry = (id, en, es) => ({
  entry_id: id,
  level: "A1",
  domains: ["travel"],
  translations: [
    { language_code: "en", text: en },
    { language_code: "es", text: es },
  ],
})

const SPEC_ENTRIES = [
  entry(101, "the bridge", "el puente"),
  entry(102, "the harbor", "el puerto"),
  entry(103, "the lighthouse", "el faro"),
]
const TOPUP_ENTRIES = [
  entry(900, "the anchor", "el ancla"),
  entry(901, "the seagull", "la gaviota"),
  entry(902, "the wave", "la ola"),
  entry(903, "the sailor", "el marinero"),
  entry(904, "the rope", "la cuerda"),
  entry(905, "the deck", "la cubierta"),
  entry(906, "the sail", "la vela"),
  entry(907, "the tide", "la marea"),
]

const spec = {
  specId: "js-1750000000000-w9t1",
  activityType: "lingo_hero:round",
  itemRefs: [
    { kind: "phrase", source: "base", id: "101" },
    { kind: "phrase", source: "base", id: "102" },
    { kind: "phrase", source: "travel-pack", id: "103" },
  ],
  params: { rounds: 3, mode: "practice", intensity: 0.5 },
  targetLang: "es",
  nativeLang: "en",
}
assert(schemas.ActivitySpecSchema.safeParse(spec).success, "fixture spec passes ActivitySpecSchema")

const makeHost = ({ withJourney }) => {
  const reported = { items: [], results: [], abandons: [] }
  const byId = new Map(SPEC_ENTRIES.map((e) => [e.entry_id, e]))
  const host = {
    speak: () => {},
    getStackConfig: () => ({
      activeStackId: "s1",
      languages: ["en", "es"],
      domains: [],
      levels: [],
      rate: 1,
      textSize: "medium",
      showRomanization: false,
    }),
    getRandomEntries: async (n) => TOPUP_ENTRIES.slice(0, n),
    getEntryById: async (id, _source) => {
      const e = byId.get(id)
      if (!e) throw new Error(`no entry ${id}`)
      return e
    },
  }
  if (withJourney) {
    host.journey = {
      isActive: () => true,
      getSpec: () => spec,
      reportItem: (item) => reported.items.push(item),
      reportResult: (result) => reported.results.push(result),
      abandon: (reason) => reported.abandons.push(reason ?? "user_exit"),
    }
  }
  return { host, reported }
}

const wave = (entryId, foreign, outcome, combo) => ({
  word: { entryId, foreign, english: "x", lang: "es" },
  outcome,
  correct: outcome === "correct",
  combo,
  mode: 0,
})

// ---------------------------------------------------------------------------
// (a) ContentManager pinning: spec entries become round targets, in order.
// ---------------------------------------------------------------------------
{
  const { host } = makeHost({ withJourney: true })
  const run = m.beginJourneyRun(spec, host, null)
  run.setPinned(SPEC_ENTRIES)
  const cm = new m.ContentManager(host, {
    selector: run.selector,
    pinnedEntries: SPEC_ENTRIES,
  })
  const r1 = await cm.getRound(["en", "es"])
  const r2 = await cm.getRound(["en", "es"])
  const r3 = await cm.getRound(["en", "es"])
  assert(
    r1.entryId === 101 && r2.entryId === 102 && r3.entryId === 103,
    `pinned entries served as targets in spec order (got ${r1.entryId}, ${r2.entryId}, ${r3.entryId})`
  )
  assert(
    r1.targetText === "el puente" && r1.targetLang === "es",
    "round target text/lang come from the pinned entry"
  )
  assert(
    r1.distractorWords.length > 0,
    "random top-up still populates distractors (answer-dedup pool intact)"
  )
  const r4 = await cm.getRound(["en", "es"])
  assert(
    typeof r4.entryId === "number" && r4.targetWords.length > 0,
    "after the backlog is exhausted the selector falls back to default behavior (round still coherent)"
  )
  m.endJourneyRun()
}

// ---------------------------------------------------------------------------
// (b)+(c) Reporter: per-item rail + terminal result, schema-validated.
// ---------------------------------------------------------------------------
{
  const { host, reported } = makeHost({ withJourney: true })
  const run = m.beginJourneyRun(spec, host, null)
  run.setPinned(SPEC_ENTRIES)
  const bus = m.createEventBus()
  const off = m.initJourneyReporting(bus, run)

  assert(run.rounds === 3, "params.rounds honored (3)")
  assert(run.mode === "practice", "params.mode honored")
  assert(run.initialStreak === 3, "params.intensity 0.5 seeds the streak curve midpoint")

  bus.emit("scoreChange", { value: 340, delta: 340 })
  bus.emit("comboChange", { value: 5, previous: 4 })
  bus.emit("decoy-dodged", { lane: 1, x: 0, y: 0, combo: 5, points: 40, mode: 0 })

  bus.emit("wave-resolved", wave(101, "el puente", "correct", 5))
  assert(!run.isComplete(), "run not complete after 1 of 3 charts")
  bus.emit("comboChange", { value: 6, previous: 5 })
  bus.emit("wave-resolved", wave(900, "el ancla", "correct", 6)) // top-up chart
  bus.emit("wave-resolved", wave(103, "el faro", "passed", 0))
  assert(run.isComplete(), "run complete after params.rounds charts")

  assert(reported.items.length === 2, `only spec-entry waves reported (got ${reported.items.length})`)
  for (const item of reported.items) {
    assert(
      schemas.ActivityItemResultSchema.safeParse(item).success,
      `reportItem payload passes ActivityItemResultSchema (${item.itemRef.id})`
    )
  }
  assert(
    reported.items[0].itemRef.id === "101" && reported.items[0].outcome === "pass",
    "correct wave maps to pass with the engine's exact ItemRef"
  )
  assert(
    reported.items[1].itemRef.source === "travel-pack" && reported.items[1].outcome === "fail",
    "passed wave maps to fail; phrase-pack source preserved verbatim"
  )
  assert(
    reported.items[0].detail?.numbers?.combo === 5,
    "per-item detail carries the combo in the R3 numbers envelope"
  )

  bus.emit("scoreChange", { value: 480, delta: 140 })
  const result = run.finish()
  assert(reported.results.length === 1, "exactly one terminal reportResult")
  assert(
    schemas.ActivityResultSchema.safeParse(reported.results[0]).success,
    "terminal ActivityResult passes ActivityResultSchema"
  )
  assert(result.specId === spec.specId, "result.specId round-trips the spec")
  assert(result.perItem.length === 2, "perItem carries only FACED spec items")
  assert(Math.abs(result.score - 0.5) < 1e-9, "score = clean-catch rate over spec items (1 pass / 2 faced)")
  assert(
    result.detail?.numbers?.finalScore === 480 &&
      result.detail?.numbers?.bestCombo === 6 &&
      result.detail?.numbers?.decoysDodged === 1,
    "detail.numbers carries finalScore/bestCombo/decoysDodged"
  )
  assert(typeof result.durationMs === "number" && result.durationMs >= 0, "durationMs measured from mount")
  assert(result.abandoned === undefined, "natural completion is not abandoned")

  assert(run.finish() === null, "finish() is idempotent (second call reports nothing)")
  assert(reported.results.length === 1, "no double terminal report")
  off()
  m.endJourneyRun()
}

// ---------------------------------------------------------------------------
// (d) Event-rail fallback when hostApi.journey is absent.
// ---------------------------------------------------------------------------
{
  const events = []
  globalThis.window = {
    dispatchEvent: (e) => { events.push(e); return true },
  }
  try {
    const { host } = makeHost({ withJourney: false })
    const run = m.beginJourneyRun(spec, host, null)
    run.setPinned(SPEC_ENTRIES)
    const bus = m.createEventBus()
    m.initJourneyReporting(bus, run)
    bus.emit("wave-resolved", wave(101, "el puente", "correct", 1))
    run.finish()
    const evt = events.find((e) => e.type === "corpan:activity-result")
    assert(!!evt, "terminal result dispatched on the corpan:activity-result event rail")
    assert(
      schemas.ActivityResultEventDetailSchema.safeParse(evt?.detail).success,
      "event detail passes ActivityResultEventDetailSchema"
    )
    assert(evt?.detail?.packId === "lingo_hero", "event rail carries the REGISTERED (underscore) pack id")
    m.endJourneyRun()
  } finally {
    delete globalThis.window
  }
}

// ---------------------------------------------------------------------------
// (e) Leitner retirement: initLearning under a journey run wires the reporter
//     and never touches localStorage (WordStatsStore is retired, D11).
// ---------------------------------------------------------------------------
{
  const storageCalls = []
  globalThis.localStorage = {
    getItem: (k) => { storageCalls.push(["get", k]); return null },
    setItem: (k) => { storageCalls.push(["set", k]) },
    removeItem: (k) => { storageCalls.push(["remove", k]) },
  }
  try {
    const { host, reported } = makeHost({ withJourney: true })
    const run = m.beginJourneyRun(spec, host, null)
    run.setPinned(SPEC_ENTRIES)
    const bus = m.createEventBus()
    const api = m.initLearning(bus, host)
    bus.emit("wave-resolved", wave(101, "el puente", "correct", 2))
    assert(reported.items.length === 1, "initLearning (journey mode) wires the journey reporter")
    assert(
      storageCalls.filter(([op]) => op === "set").length === 0,
      "journey mode never writes the Leitner store (localStorage untouched)"
    )
    assert(api.getMastery() === null, "journey mode exposes no Leitner mastery")
    api.dispose()
    bus.emit("wave-resolved", wave(102, "el puerto", "correct", 3))
    assert(reported.items.length === 1, "dispose detaches the reporter")
    m.endJourneyRun()
  } finally {
    delete globalThis.localStorage
  }
}

// ---------------------------------------------------------------------------
if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED`)
  process.exit(1)
}
console.log("\nAll journey instrumentation assertions passed.")
