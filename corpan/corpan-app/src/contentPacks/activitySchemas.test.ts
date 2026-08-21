// Tests for the Journey host boundary (Zod schemas) and the single-owner
// activity session module (spec §3 / R8): lifecycle, per-item dedup
// (last-write-wins by itemRefKey), first-terminal-wins, teardown synthesis
// from the item buffer, and the exactly-one-result guarantee.
//
// Run with the repo's native runner: `npm test` →
//   node --experimental-strip-types --test 'src/**/*.test.ts'
//
// `activitySchemas.ts` imports zod + extensionless relative modules, which
// the bare Node strip-types loader can't resolve, so we bundle it through
// esbuild (already a dev dep — the same resolver Vite uses) and import the
// real exported functions. This exercises production code, not a copy.

import { test, before, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

import type {
  ActivitySpec,
  ActivityResult,
  ActivityItemResult,
  ItemRef,
} from "./activityContract.ts"

type Meta = { synthesized: boolean; reason?: string; receivedAt: number }
type Callbacks = { onResult: (result: ActivityResult, meta: Meta) => void }

type SchemasModule = {
  JOURNEY_CONTRACT_VERSION: number
  ActivitySpecSchema: { safeParse: (v: unknown) => { success: boolean } }
  ActivityResultSchema: { safeParse: (v: unknown) => { success: boolean } }
  ActivityItemResultSchema: { safeParse: (v: unknown) => { success: boolean } }
  ActivityResultEventDetailSchema: { safeParse: (v: unknown) => { success: boolean } }
  PackActivityDeclarationSchema: { safeParse: (v: unknown) => { success: boolean } }
  beginActivitySession: (packId: string, spec: ActivitySpec, cb: Callbacks) => boolean
  endActivitySession: () => void
  isActiveFor: (packId: string) => boolean
  activeSpecFor: (packId: string) => ActivitySpec | null
  ingestItem: (packId: string, raw: unknown) => boolean
  ingestResult: (packId: string, raw: unknown) => boolean
  finalizeAbandoned: (reason: string) => void
  installActivityResultEventRail: () => () => void
  setActivityRejectionListener: (l: ((packId: string, why: string) => void) | null) => void
}

let m: SchemasModule

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    entryPoints: [path.join(here, "activitySchemas.ts")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "node",
  })
  const code = res.outputFiles[0].text
  m = (await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )) as SchemasModule
})

// Fresh session state before every test — exactly-one-result makes leftover
// sessions impossible to observe except via a stray onResult, so drain hard.
beforeEach(() => {
  m.setActivityRejectionListener(null)
  m.endActivitySession()
})

const ref = (id: string): ItemRef => ({ kind: "phrase", source: "base", id })

const spec = (over: Partial<ActivitySpec> = {}): ActivitySpec => ({
  specId: "js-1700000000000-ab12",
  activityType: "lingo_hero:round",
  itemRefs: [ref("1"), ref("2"), ref("3")],
  targetLang: "es",
  ...over,
})

const item = (id: string, outcome: ActivityItemResult["outcome"] = "pass"): ActivityItemResult => ({
  itemRef: ref(id),
  outcome,
})

const result = (over: Partial<ActivityResult> = {}): ActivityResult => ({
  specId: "js-1700000000000-ab12",
  score: 0.5,
  perItem: [item("1"), item("2", "fail")],
  durationMs: 1234,
  ...over,
})

/** begin a session and collect every onResult it ever fires. */
const begin = (over: Partial<ActivitySpec> = {}, packId = "lingo_hero") => {
  const results: Array<{ result: ActivityResult; meta: Meta }> = []
  const ok = m.beginActivitySession(packId, spec(over), {
    onResult: (r, meta) => results.push({ result: r, meta }),
  })
  return { ok, results }
}

// --- Zod boundary ------------------------------------------------------------

test("schemas accept well-formed contract payloads", () => {
  assert.equal(m.ActivitySpecSchema.safeParse(spec()).success, true)
  assert.equal(m.ActivityResultSchema.safeParse(result()).success, true)
  assert.equal(m.ActivityItemResultSchema.safeParse(item("1")).success, true)
  assert.equal(
    m.ActivityResultEventDetailSchema.safeParse({ packId: "p", result: result() }).success,
    true,
  )
  assert.equal(
    m.PackActivityDeclarationSchema.safeParse({
      activityType: "corpan_city:build-sentence",
      itemKinds: ["phrase"],
      strands: ["lfl"],
      typicalDurationSec: 60,
    }).success,
    true,
  )
})

test("schemas reject malformed payloads at the boundary", () => {
  // score outside 0..1
  assert.equal(m.ActivityResultSchema.safeParse(result({ score: 1.5 })).success, false)
  // missing perItem
  const { perItem: _p, ...noPerItem } = result()
  assert.equal(m.ActivityResultSchema.safeParse(noPerItem).success, false)
  // unknown outcome
  assert.equal(
    m.ActivityItemResultSchema.safeParse({ itemRef: ref("1"), outcome: "meh" }).success,
    false,
  )
  // unknown ItemRef kind
  assert.equal(
    m.ActivityItemResultSchema.safeParse({
      itemRef: { kind: "meme", source: "x", id: "1" },
      outcome: "pass",
    }).success,
    false,
  )
  // empty itemKinds on a declaration
  assert.equal(
    m.PackActivityDeclarationSchema.safeParse({ activityType: "p:x", itemKinds: [] }).success,
    false,
  )
})

test("JOURNEY_CONTRACT_VERSION is 1", () => {
  assert.equal(m.JOURNEY_CONTRACT_VERSION, 1)
})

// --- Session lifecycle -------------------------------------------------------

test("lifecycle: begin → reportItems → terminal result → end fires exactly one onResult", () => {
  const { ok, results } = begin()
  assert.equal(ok, true)
  assert.equal(m.isActiveFor("lingo_hero"), true)
  assert.equal(m.isActiveFor("other_pack"), false)
  assert.equal(m.activeSpecFor("lingo_hero")?.specId, spec().specId)

  assert.equal(m.ingestItem("lingo_hero", item("1")), true)
  assert.equal(m.ingestResult("lingo_hero", result()), true)
  m.endActivitySession() // idempotent teardown after a normal result — no-op

  assert.equal(results.length, 1)
  assert.equal(results[0].meta.synthesized, false)
  assert.equal(results[0].result.score, 0.5)
  // The terminal result's perItem is authoritative, not the buffer.
  assert.equal(results[0].result.perItem.length, 2)
})

test("standalone launches: no session ⇒ every journey call is an inert no-op", () => {
  assert.equal(m.isActiveFor("lingo_hero"), false)
  assert.equal(m.activeSpecFor("lingo_hero"), null)
  assert.equal(m.ingestItem("lingo_hero", item("1")), false)
  assert.equal(m.ingestResult("lingo_hero", result()), false)
  m.finalizeAbandoned("user_exit") // must not throw
})

test("begin rejects a spec declaring both stt and llm (mutually exclusive, §7)", () => {
  const { ok, results } = begin({ modelNeeds: ["stt", "llm"] })
  assert.equal(ok, false)
  assert.equal(m.isActiveFor("lingo_hero"), false)
  assert.equal(results.length, 0)
})

test("begin over a still-open session finalizes the old one as abandoned first", () => {
  const first = begin()
  m.ingestItem("lingo_hero", item("1"))
  const second = begin({ specId: "js-2-cd34" }, "corpan_city")
  assert.equal(second.ok, true)
  // Old session got its synthesized abandoned result...
  assert.equal(first.results.length, 1)
  assert.equal(first.results[0].result.abandoned, true)
  assert.equal(first.results[0].meta.synthesized, true)
  // ...and the new one is live.
  assert.equal(m.isActiveFor("corpan_city"), true)
  m.ingestResult("corpan_city", result({ specId: "js-2-cd34" }))
})

// --- Dedup -------------------------------------------------------------------

test("per-item dedup: last write wins per itemRefKey, buffer stays arrival-ordered", () => {
  const { results } = begin()
  m.ingestItem("lingo_hero", item("1", "partial"))
  m.ingestItem("lingo_hero", item("2", "fail"))
  m.ingestItem("lingo_hero", item("1", "pass")) // upgrade partial→pass in place
  m.endActivitySession()

  assert.equal(results.length, 1)
  const perItem = results[0].result.perItem
  assert.equal(perItem.length, 2)
  assert.equal(perItem[0].itemRef.id, "1")
  assert.equal(perItem[0].outcome, "pass")
  assert.equal(perItem[1].itemRef.id, "2")
  assert.equal(perItem[1].outcome, "fail")
})

test("shuffled/subset item arrival is fine — items join by key, never by position", () => {
  // Spec order is 1,2,3; a provider reports a SUBSET in shuffled order.
  const { results } = begin()
  m.ingestItem("lingo_hero", item("3", "pass"))
  m.ingestItem("lingo_hero", item("1", "fail"))
  // item 2 never faced — must simply be absent (no evidence, never a fail).
  m.endActivitySession()

  const perItem = results[0].result.perItem
  assert.deepEqual(perItem.map((x) => x.itemRef.id), ["3", "1"])
  assert.equal(perItem.some((x) => x.itemRef.id === "2"), false)
})

test("first terminal wins: later results for the same specId are dropped", () => {
  const { results } = begin()
  assert.equal(m.ingestResult("lingo_hero", result({ score: 1 })), true)
  assert.equal(m.ingestResult("lingo_hero", result({ score: 0 })), false)
  m.endActivitySession()
  assert.equal(results.length, 1)
  assert.equal(results[0].result.score, 1)
})

test("items arriving after the terminal result are dropped", () => {
  begin()
  m.ingestResult("lingo_hero", result())
  assert.equal(m.ingestItem("lingo_hero", item("3")), false)
  m.endActivitySession()
})

// --- Scoping / boundary rejection ---------------------------------------------

test("reports are rejected from the wrong pack and on stale specIds", () => {
  const { results } = begin()
  assert.equal(m.ingestResult("corpan_city", result()), false) // wrong pack
  assert.equal(
    m.ingestResult("lingo_hero", result({ specId: "js-STALE-0000" })), // stale spec
    false,
  )
  assert.equal(m.ingestItem("corpan_city", item("1")), false) // wrong pack item
  assert.equal(results.length, 0) // session still open, nothing terminal
  m.endActivitySession()
  assert.equal(results.length, 1) // teardown synthesis still delivers exactly one
})

test("invalid payloads are dropped, logged, and reported to the rejection listener", () => {
  const rejections: Array<{ packId: string; why: string }> = []
  m.setActivityRejectionListener((packId, why) => rejections.push({ packId, why }))
  const { results } = begin()
  assert.equal(m.ingestResult("lingo_hero", { specId: 42 }), false)
  assert.equal(m.ingestItem("lingo_hero", "not an item"), false)
  assert.ok(rejections.length >= 2)
  assert.equal(rejections[0].packId, "lingo_hero")
  // Session survives invalid payloads — the pack may retry with a valid one.
  assert.equal(m.ingestResult("lingo_hero", result()), true)
  assert.equal(results.length, 1)
  m.endActivitySession()
})

test("a throwing rejection listener never breaks the reporting path", () => {
  m.setActivityRejectionListener(() => {
    throw new Error("analytics exploded")
  })
  begin()
  assert.equal(m.ingestResult("lingo_hero", { junk: true }), false) // must not throw
  m.endActivitySession()
})

// --- Teardown synthesis / abandon ---------------------------------------------

test("teardown synthesis: abandoned result built from the item buffer, partial work kept", () => {
  const { results } = begin()
  m.ingestItem("lingo_hero", item("1", "pass"))
  m.ingestItem("lingo_hero", item("2", "fail"))
  m.ingestItem("lingo_hero", item("3", "pass"))
  m.endActivitySession() // user swiped away before reportResult

  assert.equal(results.length, 1)
  const r = results[0].result
  assert.equal(r.abandoned, true)
  assert.equal(r.specId, spec().specId)
  assert.equal(r.perItem.length, 3)
  assert.equal(r.score, 2 / 3) // passed / attempted
  assert.ok(r.durationMs >= 0)
  assert.equal(results[0].meta.synthesized, true)
  assert.equal(results[0].meta.reason, "user_exit")
})

test("teardown synthesis with an empty buffer scores 0", () => {
  const { results } = begin()
  m.endActivitySession()
  assert.equal(results[0].result.score, 0)
  assert.deepEqual(results[0].result.perItem, [])
})

test("provider abandon(reason) synthesizes with the provider's reason", () => {
  const { results } = begin()
  m.ingestItem("lingo_hero", item("1"))
  m.finalizeAbandoned("unsupported")
  assert.equal(results.length, 1)
  assert.equal(results[0].meta.reason, "unsupported")
  assert.equal(results[0].result.abandoned, true)
  m.endActivitySession() // must not fire a second result
  assert.equal(results.length, 1)
})

test("exactly-one-result: every path is idempotent after the terminal", () => {
  const { results } = begin()
  m.ingestResult("lingo_hero", result())
  m.finalizeAbandoned("error")
  m.endActivitySession()
  m.finalizeAbandoned("user_exit")
  assert.equal(results.length, 1)
  assert.equal(results[0].meta.synthesized, false)
})

// --- Event rail ----------------------------------------------------------------

test("event rail: validated CustomEvents funnel into the same ingest; junk is dropped", () => {
  // Node has no window — install a minimal EventTarget stand-in.
  const w = new EventTarget() as EventTarget & { dispatchEvent: (e: Event) => boolean }
  ;(globalThis as { window?: unknown }).window = w
  const uninstall = m.installActivityResultEventRail()
  try {
    const { results } = begin()
    // Junk detail → dropped at the Zod boundary.
    w.dispatchEvent(new CustomEvent("corpan:activity-result", { detail: { nope: 1 } }))
    assert.equal(results.length, 0)
    // Spoofed packId → rejected by session scoping.
    w.dispatchEvent(
      new CustomEvent("corpan:activity-result", {
        detail: { packId: "evil_pack", result: result() },
      }),
    )
    assert.equal(results.length, 0)
    // The real thing → terminal result lands, not synthesized.
    w.dispatchEvent(
      new CustomEvent("corpan:activity-result", {
        detail: { packId: "lingo_hero", result: result() },
      }),
    )
    assert.equal(results.length, 1)
    assert.equal(results[0].meta.synthesized, false)
    m.endActivitySession()
    assert.equal(results.length, 1)
  } finally {
    uninstall()
    delete (globalThis as { window?: unknown }).window
  }
})

// --- corpan:exit teardown (WS-F un-wedge) ---------------------------------------

test("corpan:exit finalizes a still-open session as abandoned (crash / dropped result)", () => {
  const w = new EventTarget() as EventTarget & { dispatchEvent: (e: Event) => boolean }
  ;(globalThis as { window?: unknown }).window = w
  const uninstall = m.installActivityResultEventRail()
  try {
    const { results } = begin()
    m.ingestItem("lingo_hero", item("1", "pass"))
    // The pack crashed / the overlay was torn down without ever calling
    // reportResult — App.tsx/ContentPackHost dispatch corpan:exit on every
    // overlay exit regardless. Nothing else in this module currently listens
    // for it; if it stopped finalizing, the session (and the host's
    // pendingPack launch-gate, runtime.ts) would wedge forever.
    w.dispatchEvent(new CustomEvent("corpan:exit"))
    assert.equal(results.length, 1)
    assert.equal(results[0].result.abandoned, true)
    assert.equal(results[0].meta.synthesized, true)
    assert.equal(results[0].meta.reason, "user_exit")
    assert.equal(results[0].result.perItem.length, 1) // buffered evidence kept
    assert.equal(m.isActiveFor("lingo_hero"), false)
  } finally {
    uninstall()
    delete (globalThis as { window?: unknown }).window
  }
})

test("corpan:exit after a normal terminal result is a harmless no-op (idempotent)", () => {
  const w = new EventTarget() as EventTarget & { dispatchEvent: (e: Event) => boolean }
  ;(globalThis as { window?: unknown }).window = w
  const uninstall = m.installActivityResultEventRail()
  try {
    const { results } = begin()
    m.ingestResult("lingo_hero", result({ score: 1 }))
    w.dispatchEvent(new CustomEvent("corpan:exit"))
    assert.equal(results.length, 1) // no second (synthesized) result appended
    assert.equal(results[0].result.score, 1)
    assert.equal(results[0].meta.synthesized, false)
  } finally {
    uninstall()
    delete (globalThis as { window?: unknown }).window
  }
})

test("corpan:exit with no journey session active never throws", () => {
  const w = new EventTarget() as EventTarget & { dispatchEvent: (e: Event) => boolean }
  ;(globalThis as { window?: unknown }).window = w
  const uninstall = m.installActivityResultEventRail()
  try {
    assert.doesNotThrow(() => w.dispatchEvent(new CustomEvent("corpan:exit")))
  } finally {
    uninstall()
    delete (globalThis as { window?: unknown }).window
  }
})

// --- packId normalization (WS-F) -------------------------------------------------

test("ingestResult accepts a hyphen/underscore packId variant of the launching pack", () => {
  const { results } = begin(undefined, "corpan_city")
  // The provider reports back with the OPPOSITE separator convention — a
  // real drift seen between a manifest id and a provider's own string, never
  // a different pack. Must not be dropped as "result from wrong pack".
  assert.equal(m.ingestResult("corpan-city", result()), true)
  assert.equal(results.length, 1)
  assert.equal(results[0].result.score, 0.5)
})

test("isActiveFor / activeSpecFor also normalize packId separators", () => {
  begin(undefined, "corpan-city")
  assert.equal(m.isActiveFor("corpan_city"), true)
  assert.equal(m.activeSpecFor("corpan_city")?.specId, spec().specId)
  assert.equal(m.ingestItem("corpan_city", item("1")), true)
})

test("packId normalization never conflates two genuinely different packs", () => {
  begin(undefined, "lingo_hero")
  assert.equal(m.isActiveFor("corpan_city"), false)
  assert.equal(m.ingestResult("corpan_city", result()), false) // still wrong pack
  m.endActivitySession()
})

// --- relaunch-after-wedge (WS-F) --------------------------------------------------

test("relaunch after a wedge: a fresh begin() for a NEW pack finalizes the orphaned one first", () => {
  // Simulates runtime.ts's pendingPackIsStale watchdog: the first pack
  // (corpan_city) crashed — no reportResult, no corpan:exit ever reached this
  // module — leaving its session open. The learner backs out (the feed
  // becomes interactive again) and taps Play on a DIFFERENT pack. Once
  // runtime.ts stops gating that on its OWN stale `pendingPack` bookkeeping,
  // beginActivitySession's existing belt-and-braces guard (a still-open
  // session finalized before the new one opens) is what actually recovers —
  // this pins that guarantee at the module boundary.
  const stuck = begin(undefined, "corpan_city")
  m.ingestItem("corpan_city", item("1", "pass"))
  assert.equal(m.isActiveFor("corpan_city"), true)

  const fresh = begin({ specId: "js-fresh-0001" }, "wordfall")
  assert.equal(fresh.ok, true)

  // The orphaned session got its synthesized abandon — pendingPack's owner
  // (runtime.ts) would clear its bookkeeping from exactly this callback.
  assert.equal(stuck.results.length, 1)
  assert.equal(stuck.results[0].result.abandoned, true)
  assert.equal(stuck.results[0].meta.synthesized, true)
  assert.equal(stuck.results[0].result.perItem.length, 1)

  // The new pack is live and can complete normally.
  assert.equal(m.isActiveFor("wordfall"), true)
  assert.equal(m.isActiveFor("corpan_city"), false)
  assert.equal(m.ingestResult("wordfall", result({ specId: "js-fresh-0001" })), true)
  assert.equal(fresh.results.length, 1)
  assert.equal(fresh.results[0].meta.synthesized, false)
})
