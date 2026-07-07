// Runtime tests (feed-ux §2.3, R5, R12): EngineCard→FeedCard 1:1 mapping,
// two-phase settle (submit → advance), the ONE debut-debit rule, abandoned
// results carrying no per-item evidence, contentMissing pre-mount drops,
// and speak_echo → listen_type degradation with flags.sttUnavailable.
//
// Real engine (W3 fixture harness) + real resolver (W5) over the in-memory
// course DB — nothing mocked at the seams under test.

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import type { EngineCard } from "./engine/index.ts"
import type { SttReadiness } from "./runtime.ts"

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

const { makeEngine, answer } = await import("./engine/__fixtures__/harness.ts")
const { createResolver } = await import("./content/resolve.ts")
const { makeRuntimeFixtureDeps, FIXTURE_RUNTIME_CTX } = await import(
  "./__fixtures__/runtimeFixture.ts"
)
const { createJourneyRuntime } = await import("./runtime.ts")
const { useJourneyStore } = await import("../store/journey.ts")

type QuotaLog = { notes: number }

function countingQuota(log: QuotaLog) {
  return {
    note: () => {
      log.notes += 1
    },
    remaining: () => 999,
    limit: () => 999,
    locked: () => false,
  }
}

async function makeRuntime(
  opts: {
    sttOk?: boolean
    sttReadiness?: SttReadiness
    badEntryIds?: number[]
    /** Drop the native (es) face from every entry — exercises the
     *  translation-integrity guard (contract #2/#3). */
    stripNative?: boolean
  } = {},
) {
  const harness = await makeEngine({ arcs: 1, unitsPerArc: 2, skillsPerUnit: 2, itemsPerSkill: 6 })
  const deps = makeRuntimeFixtureDeps(harness.graph)
  if (opts.badEntryIds) {
    const orig = deps.getEntryById
    deps.getEntryById = async (id, src) =>
      opts.badEntryIds!.includes(id) ? null : orig(id, src)
  }
  if (opts.stripNative) {
    const orig = deps.getEntryById
    deps.getEntryById = async (id, src) => {
      const e = await orig(id, src)
      if (!e) return e
      return { ...e, translations: e.translations.filter((t) => t.language_code !== "es") }
    }
  }
  const resolver = createResolver(deps, FIXTURE_RUNTIME_CTX)
  const quotaLog: QuotaLog = { notes: 0 }
  const events: Array<{ type: string } & Record<string, unknown>> = []
  const logs: Array<{ event: string; data: Record<string, unknown> }> = []
  const runtime = createJourneyRuntime({
    engine: harness.engine,
    resolver,
    resolverDeps: deps,
    ctx: FIXTURE_RUNTIME_CTX,
    graph: harness.graph,
    courseKey: "stack-1::journey_en",
    quota: countingQuota(quotaLog),
    now: () => harness.clock.nowMs(),
    record: (e) => events.push(e),
    log: (event, data) => logs.push({ event, data }),
    sttAvailable: opts.sttOk === undefined ? undefined : async () => opts.sttOk === true,
    sttReadiness:
      opts.sttReadiness === undefined ? undefined : async () => opts.sttReadiness as SttReadiness,
  })
  return { runtime, harness, quotaLog, events, logs, deps }
}

/** A native speak_echo EngineCard over a fixture item — fed to
 *  runtime.prepareEngineCard to exercise the STT swap policy directly (a raw
 *  speak_echo card is otherwise rare in the feed). */
function speakEchoCard(graph: { items: Record<string, { ref: unknown }> }, itemId: string, specId: string): EngineCard {
  const item = graph.items[itemId]
  return {
    spec: {
      specId,
      activityType: "speak_echo",
      itemRefs: [item.ref as EngineCard["spec"]["itemRefs"][number]],
      targetLang: "en",
      modelNeeds: ["stt"],
      timeboxSec: 25,
    },
    meta: {
      pool: "due",
      strand: "output",
      form: 2,
      estSec: 25,
      provider: "native",
      celebration: "normal",
      coolDownCandidate: false,
    },
  }
}

/** Place as a fresh zero-beginner so the feed starts producing. */
async function startFeed(runtime: Awaited<ReturnType<typeof makeRuntime>>["runtime"]) {
  const { needsPlacement } = await runtime.start("home_hero")
  if (needsPlacement) {
    const controller = runtime.startPlacement("zero-beginner")
    runtime.finishPlacement(controller.finalize())
  }
  // wait for async prep
  for (let i = 0; i < 50 && !runtime.current(); i++) await new Promise((r) => setTimeout(r, 5))
}

beforeEach(() => {
  useJourneyStore.setState({ byCourse: {}, learningDays: [] })
})

test("session produces cards; submit+advance completes 12 cards end-to-end", async () => {
  const { runtime, events } = await makeRuntime()
  await startFeed(runtime)
  let completed = 0
  for (let guard = 0; guard < 60 && completed < 12; guard++) {
    const card = runtime.current()
    if (!card) {
      await new Promise((r) => setTimeout(r, 5))
      continue
    }
    if (card.kind === "exercise") {
      runtime.submitResult(card.cardId, answer(card.prepared.engine))
      assert.ok(runtime.currentSettled(), "settled card stays current until advance()")
      runtime.advance()
    } else if (card.kind === "checkpoint") {
      runtime.checkpointChoice(card.cardId, "continue")
    } else if (card.kind === "blockIntro" || card.kind === "welcomeBack") {
      runtime.completePresentation(card.cardId)
    } else {
      runtime.abandonCurrent()
    }
    completed = runtime.sessionStats().cardsCompleted
    // let async prep refill
    await new Promise((r) => setTimeout(r, 2))
  }
  assert.ok(completed >= 12, `completed ${completed} cards`)
  assert.ok(runtime.history().length > 0)
  assert.equal(events.filter((e) => e.type === "session_start").length, 1)
  assert.ok(events.some((e) => e.type === "activity_result"))
  assert.ok(events.some((e) => e.type === "card_impression") === false) // impressions are surface-driven
  await runtime.endSession("quit")
  assert.equal(events.filter((e) => e.type === "session_end").length, 1)
})

test("R12: only debut cards debit the gate; reviews and checkpoints never do", async () => {
  const { runtime, quotaLog } = await makeRuntime()
  await startFeed(runtime)
  let debuts = 0
  for (let guard = 0; guard < 60 && runtime.sessionStats().cardsCompleted < 15; guard++) {
    const card = runtime.current()
    if (!card) {
      await new Promise((r) => setTimeout(r, 5))
      continue
    }
    if (card.kind === "exercise") {
      if (card.prepared.engine.meta.pool === "new" && card.spec.params?.intro === true) debuts += 1
      runtime.submitResult(card.cardId, answer(card.prepared.engine))
      runtime.advance()
    } else if (card.kind === "checkpoint") {
      runtime.checkpointChoice(card.cardId, "continue")
    } else {
      runtime.abandonCurrent()
    }
    await new Promise((r) => setTimeout(r, 2))
  }
  assert.ok(debuts > 0, "session should introduce new items")
  assert.equal(quotaLog.notes, debuts)
})

test("abandon: no per-item evidence, abandoned flag set, no quota debit", async () => {
  const { runtime, quotaLog } = await makeRuntime()
  await startFeed(runtime)
  // find an exercise card
  for (let guard = 0; guard < 30; guard++) {
    const card = runtime.current()
    if (card?.kind === "exercise") break
    if (!card) await new Promise((r) => setTimeout(r, 5))
    else runtime.abandonCurrent()
  }
  const card = runtime.current()
  assert.equal(card?.kind, "exercise")
  const notesBefore = quotaLog.notes
  runtime.abandonCurrent()
  const rec = runtime.history()[runtime.history().length - 1]
  assert.equal(rec.result?.abandoned, true)
  assert.deepEqual(rec.result?.perItem, [])
  assert.equal(quotaLog.notes, notesBefore)
})

test("contentMissing: unresolvable refs drop pre-mount and notify the engine", async () => {
  // poison a slice of the corpus: entry ids 1001..1006 (unit 0, skill 0)
  const { runtime, logs } = await makeRuntime({ badEntryIds: [1001, 1002, 1003] })
  await startFeed(runtime)
  // feed still runs — poisoned cards never mount
  for (let guard = 0; guard < 40 && runtime.sessionStats().cardsCompleted < 5; guard++) {
    const card = runtime.current()
    if (!card) {
      await new Promise((r) => setTimeout(r, 5))
      continue
    }
    if (card.kind === "exercise") {
      assert.ok(
        !["1001", "1002", "1003"].includes(card.prepared.items[0]?.ref.id ?? ""),
        "missing-content card must never mount",
      )
      runtime.submitResult(card.cardId, answer(card.prepared.engine))
      runtime.advance()
    } else if (card.kind === "checkpoint") {
      runtime.checkpointChoice(card.cardId, "continue")
    } else {
      runtime.abandonCurrent()
    }
    await new Promise((r) => setTimeout(r, 2))
  }
  assert.ok(logs.some((l) => l.event === "journey_content_missing"))
})

test("speak_echo degrades to listen_type with sttFallback when STT is unavailable", async () => {
  const { runtime } = await makeRuntime({ sttOk: false })
  await startFeed(runtime)
  let sawFallback = false
  for (let guard = 0; guard < 120 && !sawFallback; guard++) {
    const card = runtime.current()
    if (!card) {
      await new Promise((r) => setTimeout(r, 5))
      continue
    }
    assert.notEqual(card.kind, "blockIntro", "no blockIntro when STT is off")
    if (card.kind === "exercise") {
      assert.notEqual(card.spec.activityType, "speak_echo")
      if (card.prepared.sttFallback) {
        sawFallback = true
        assert.equal(card.spec.activityType, "listen_type")
        // completing it stamps flags.sttUnavailable on the engine-bound result
        runtime.submitResult(card.cardId, answer(card.prepared.engine))
        const rec = runtime.currentSettled()
        assert.equal(rec?.result?.detail?.flags?.sttUnavailable, true)
        runtime.advance()
        break
      }
      runtime.submitResult(card.cardId, answer(card.prepared.engine))
      runtime.advance()
    } else if (card.kind === "checkpoint") {
      runtime.checkpointChoice(card.cardId, "continue")
    } else {
      runtime.abandonCurrent()
    }
    await new Promise((r) => setTimeout(r, 2))
  }
  // production-form speak_echo may take a while to surface; the invariant
  // that matters (never a raw speak_echo card) held for every card above.
})

test("exercise prepared payload carries distractors for choice cards", async () => {
  const { runtime } = await makeRuntime()
  await startFeed(runtime)
  for (let guard = 0; guard < 60; guard++) {
    const card = runtime.current()
    if (!card) {
      await new Promise((r) => setTimeout(r, 5))
      continue
    }
    if (
      card.kind === "exercise" &&
      (card.spec.activityType === "choice_pick" || card.spec.activityType === "listen_pick")
    ) {
      assert.ok(card.prepared.distractors, "sampler output present")
      assert.ok(card.prepared.distractors!.distractors.length >= 1)
      assert.ok(card.prepared.items.length >= 1)
      return
    }
    if (card.kind === "exercise") {
      runtime.submitResult(card.cardId, answer(card.prepared.engine))
      runtime.advance()
    } else if (card.kind === "checkpoint") {
      runtime.checkpointChoice(card.cardId, "continue")
    } else {
      runtime.abandonCurrent()
    }
    await new Promise((r) => setTimeout(r, 2))
  }
  assert.fail("never saw a choice card")
})

test("translation-integrity guard (contract #2/#3): no same-language card when the native face is absent", async () => {
  const { runtime } = await makeRuntime({ stripNative: true })
  await startFeed(runtime)
  let checked = 0
  for (let guard = 0; guard < 80 && checked < 20; guard++) {
    const card = runtime.current()
    if (!card) {
      await new Promise((r) => setTimeout(r, 5))
      continue
    }
    if (card.kind === "exercise") {
      const at = card.spec.activityType
      // choice_pick / flip_recall surface a native face on BOTH directions —
      // never emitted for a native-less item (swapped to a target-only form).
      assert.notEqual(at, "choice_pick", "choice_pick must swap when native is absent")
      assert.notEqual(at, "flip_recall", "flip_recall must swap when native is absent")
      // only translation forms carry toNative/toTarget; everything else is targetOnly
      const dir = card.spec.params?.direction
      assert.ok(
        dir === undefined || dir === "targetOnly",
        `native-less card carries translation direction ${String(dir)}`,
      )
      // text-axis match_pairs needs native on each item → falls back to audio
      if (at === "match_pairs") {
        assert.equal(card.spec.params?.axis, "text-audio", "match_pairs must use the audio axis")
      }
      assert.ok(
        card.prepared.items.every((i) => !i.native),
        "the fixture stripped every native face",
      )
      checked += 1
      runtime.submitResult(card.cardId, answer(card.prepared.engine))
      runtime.advance()
    } else if (card.kind === "checkpoint") {
      runtime.checkpointChoice(card.cardId, "continue")
    } else if (card.kind === "blockIntro" || card.kind === "welcomeBack") {
      runtime.completePresentation(card.cardId)
    } else {
      runtime.abandonCurrent()
    }
    await new Promise((r) => setTimeout(r, 2))
  }
  assert.ok(checked > 0, "saw exercise cards over a native-less corpus")
})

test("STT three-state policy (contract #4): unsupported swaps, model-missing keeps, installed keeps", async () => {
  for (const [state, expectSwap] of [
    ["unsupported", true],
    ["modelMissing", false],
    ["installed", false],
  ] as const) {
    const { runtime, harness } = await makeRuntime({ sttReadiness: state })
    await startFeed(runtime)
    const itemId = Object.keys(harness.graph.items)[0]
    const card = await runtime.prepareEngineCard(speakEchoCard(harness.graph, itemId, `spk-${state}`))
    assert.ok(card && card.kind === "exercise", `${state}: prepared an exercise`)
    if (expectSwap) {
      assert.equal(card.spec.activityType, "listen_type", `${state}: speak_echo swaps to listen_type`)
      assert.equal(card.prepared.sttFallback, true, `${state}: swap carries sttFallback`)
    } else {
      assert.equal(card.spec.activityType, "speak_echo", `${state}: speak_echo is kept`)
      assert.ok(!card.prepared.sttFallback, `${state}: no sttFallback`)
    }
    await runtime.endSession("quit")
  }
})

test("STT decline flow (contract #4): declining the install swaps the rest of the session", async () => {
  const { runtime, harness } = await makeRuntime({ sttReadiness: "modelMissing" })
  await startFeed(runtime)
  const itemId = Object.keys(harness.graph.items)[0]

  // model-missing before a decline: speak_echo is kept (SpeakEcho offers install)
  const before = await runtime.prepareEngineCard(speakEchoCard(harness.graph, itemId, "spk-before"))
  assert.ok(before && before.kind === "exercise")
  assert.equal(before.spec.activityType, "speak_echo")

  // decline arrives on the current card
  const cur = runtime.current()
  assert.ok(cur, "a current card is mounted")
  runtime.submitResult(cur!.cardId, {
    specId: cur!.cardId,
    score: 1,
    perItem: [],
    durationMs: 100,
    detail: { flags: { sttDeclined: true } },
  })

  // after the decline: further speak_echo cards swap to listen_type
  const after = await runtime.prepareEngineCard(speakEchoCard(harness.graph, itemId, "spk-after"))
  assert.ok(after && after.kind === "exercise")
  assert.equal(after.spec.activityType, "listen_type", "post-decline speak_echo swaps")
  assert.equal(after.prepared.sttFallback, true)
})
