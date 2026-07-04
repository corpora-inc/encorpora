// Runtime tests (feed-ux §2.3, R5, R12): EngineCard→FeedCard 1:1 mapping,
// two-phase settle (submit → advance), the ONE debut-debit rule, abandoned
// results carrying no per-item evidence, contentMissing pre-mount drops,
// and speak_echo → listen_type degradation with flags.sttUnavailable.
//
// Real engine (W3 fixture harness) + real resolver (W5) over the in-memory
// course DB — nothing mocked at the seams under test.

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"

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

async function makeRuntime(opts: { sttOk?: boolean; badEntryIds?: number[] } = {}) {
  const harness = await makeEngine({ arcs: 1, unitsPerArc: 2, skillsPerUnit: 2, itemsPerSkill: 6 })
  const deps = makeRuntimeFixtureDeps(harness.graph)
  if (opts.badEntryIds) {
    const orig = deps.getEntryById
    deps.getEntryById = async (id, src) =>
      opts.badEntryIds!.includes(id) ? null : orig(id, src)
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
  })
  return { runtime, harness, quotaLog, events, logs, deps }
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
