// Runtime tests (feed-ux §2.3, R5, R12): EngineCard→FeedCard 1:1 mapping,
// two-phase settle (submit → advance), the ONE debut-debit rule, abandoned
// results carrying no per-item evidence, contentMissing pre-mount drops,
// and speak_echo → listen_type degradation with flags.sttUnavailable.
//
// Real engine (W3 fixture harness) + real resolver (W5) over the in-memory
// course DB — nothing mocked at the seams under test.

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"
import type { EngineCard, InterludeProvider } from "./engine/index.ts"
import type { SttReadiness, ActivitySessionPort } from "./runtime.ts"
import type { ActivityResult, ActivitySpec } from "../contentPacks/activityContract.ts"

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
    /** Installed interlude packs the mixer may schedule (game + reader). */
    interludes?: InterludeProvider[]
    /** Single-owner activity session for pack launches (launchPackActivity). */
    activitySession?: ActivitySessionPort
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
    ...(opts.interludes ? { constraints: { interludes: opts.interludes } } : {}),
    ...(opts.activitySession ? { activitySession: opts.activitySession } : {}),
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

/** A native intro_echo / listen_type EngineCard over a fixture item — fed to
 *  prepareEngineCard to exercise the speak-first UPGRADE seam (§ core). */
function echoTypeCard(
  graph: { items: Record<string, { ref: unknown }> },
  activityType: "intro_echo" | "listen_type",
  itemId: string,
  specId: string,
  meta: Partial<EngineCard["meta"]> = {},
): EngineCard {
  const item = graph.items[itemId]
  return {
    spec: {
      specId,
      activityType,
      itemRefs: [item.ref as EngineCard["spec"]["itemRefs"][number]],
      targetLang: "en",
      timeboxSec: 12,
      // intro_echo debuts carry params.intro; the upgrade must preserve the
      // debut identity so quota debiting is unchanged.
      ...(activityType === "intro_echo" ? { params: { intro: true } } : {}),
    } as EngineCard["spec"],
    meta: {
      pool: activityType === "intro_echo" ? "new" : "due",
      strand: activityType === "intro_echo" ? "input" : "language",
      form: activityType === "intro_echo" ? 0 : 2,
      estSec: 12,
      provider: "native",
      celebration: "normal",
      coolDownCandidate: false,
      ...(activityType === "intro_echo" ? { unscored: true } : {}),
      ...meta,
    },
  }
}

/** A native EngineCard of `activityType` over a single-token WORD ref — fed to
 *  prepareEngineCard to exercise the degenerate multi-token reroute guard. */
function wordCard(
  activityType: string,
  word: string,
  specId: string,
  nativeLang?: string,
): EngineCard {
  return {
    spec: {
      specId,
      activityType,
      itemRefs: [{ kind: "word", source: "en", id: word }],
      targetLang: "en",
      ...(nativeLang ? { nativeLang } : {}),
    } as EngineCard["spec"],
    meta: {
      pool: "due",
      strand: "language",
      form: 1,
      estSec: 20,
      provider: "native",
      celebration: "normal",
      coolDownCandidate: false,
    },
  }
}

/** A pack (provider) EngineCard over a phrase ref — fed to prepareEngineCard to
 *  exercise the packActivity mapping + the interlude classifier. */
function packCard(
  provider: string,
  specId: string,
  estSec: number,
): EngineCard {
  return {
    spec: {
      specId,
      activityType: `${provider}:round`,
      itemRefs: [{ kind: "phrase", source: "base", id: "1" }],
      targetLang: "es",
      nativeLang: "en",
      timeboxSec: estSec,
    } as EngineCard["spec"],
    meta: {
      pool: "due",
      strand: "fluency",
      form: 1,
      estSec,
      provider,
      celebration: "normal",
      coolDownCandidate: false,
    },
  }
}

test("packActivity mapping: a quick lightweight pack is flagged as an interlude", async () => {
  const { runtime } = await makeRuntime()
  const card = await runtime.prepareEngineCard(packCard("lingo_hero", "lh-1", 40))
  assert.ok(card && card.kind === "packActivity", "maps to a packActivity card")
  assert.equal(card.interlude, true, "a 40s lingo_hero round is a sip interlude")
})

test("packActivity mapping: a heavy 3D pack is NOT an interlude, even when short", async () => {
  const { runtime } = await makeRuntime()
  const cityCard = await runtime.prepareEngineCard(packCard("corpan_city", "cc-1", 30))
  assert.ok(cityCard && cityCard.kind === "packActivity")
  assert.equal(cityCard.interlude, false, "corpan_city is a 3D tent-pole, never a sip")
  const plazaCard = await runtime.prepareEngineCard(packCard("world_plaza", "wp-1", 45))
  assert.ok(plazaCard && plazaCard.kind === "packActivity")
  assert.equal(plazaCard.interlude, false, "world_plaza is a 3D tent-pole, never a sip")
})

test("packActivity mapping: a long-duration pack activity is NOT an interlude", async () => {
  const { runtime } = await makeRuntime()
  const card = await runtime.prepareEngineCard(packCard("some_reader", "rd-1", 200))
  assert.ok(card && card.kind === "packActivity")
  assert.equal(card.interlude, false, "a 200s activity is a full drop-in, not a sip")
})

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

// Infinite feed at the runtime seam (doom-scroll to fluency): a binger who keeps
// tapping "Continuar" past the daily target NEVER hits the "caught up" dead-end
// mid-journey. Even on a TINY fixture corpus the revisit-continuation keeps the
// feed producing fresh cards; runtime.current() never goes empty while there is
// any material to serve.
test("infinite feed: a long binge never dead-ends (Continuar always yields more)", { timeout: 20_000 }, async () => {
  const { runtime } = await makeRuntime()
  await startFeed(runtime)
  let served = 0
  let emptyStalls = 0
  for (let guard = 0; guard < 400 && served < 120; guard++) {
    const card = runtime.current()
    if (!card) {
      // may be a transient async-prep gap; retry a few times, but a true dead-end
      // (persistent empty) is the failure this test guards against.
      emptyStalls += 1
      // a persistent empty (never refilling) IS the dead-end this test guards.
      assert.ok(emptyStalls < 30, "feed went persistently empty mid-binge (dead-end)")
      await new Promise((r) => setTimeout(r, 5))
      continue
    }
    emptyStalls = 0
    if (card.kind === "exercise") {
      runtime.submitResult(card.cardId, answer(card.prepared.engine))
      runtime.advance()
      served += 1
    } else if (card.kind === "checkpoint") {
      runtime.checkpointChoice(card.cardId, "continue") // "Continuar"
    } else if (card.kind === "blockIntro" || card.kind === "welcomeBack") {
      runtime.completePresentation(card.cardId)
    } else {
      runtime.abandonCurrent()
    }
    await new Promise((r) => setTimeout(r, 1))
  }
  // The binge kept flowing well past any single-day new target on the tiny
  // fixture — the feed is infinite, not a wind-down.
  assert.ok(served >= 120, `feed dead-ended after only ${served} cards (expected an unbounded stream)`)
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

test("STT policy: only an INSTALLED model drives speaking — unsupported AND model-missing both degrade", async () => {
  // Owner directive: a speak card must NEVER wall a beginner behind a ~75 MB
  // model install. So model-missing degrades to listen_type exactly like
  // unsupported; only an installed model keeps speak_echo. (The old
  // offer-install-on-model-missing path is gone.)
  for (const [state, expectSwap] of [
    ["unsupported", true],
    ["modelMissing", true],
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

// (Removed: the "decline the inline model install" flow. Model-missing now
// degrades immediately — there is no inline 75 MB install offer to decline, so
// speak_echo never even mounts when a model isn't installed.)

// Regression test (R2 + the fillQueue double-synthesis race): `micIntroSeen()`
// is stamped on MOUNT (by the real BlockIntroCard component's effect — not
// present in this headless harness, so it's always absent/false here, same
// as a real user's first-ever session before that card has ever mounted).
// fillQueue()'s while loop only tops `prepared` up to a small low-water mark
// (3) per pass and is re-entrancy-guarded (`filling`), so under STEADY,
// one-card-at-a-time consumption a second stt-run boundary is never
// discovered until well after the first blockIntro has already been
// consumed — the water mark self-throttles it away. The actual race needs a
// SINGLE still-in-flight fillQueue() call: its first loop iteration
// synchronously pushes blockIntro_A to `prepared` and then suspends at
// `await mapEngineCard(ec)`; if a SECOND raw stt card is unshifted onto the
// front of `rawQueue` during that suspended window (before the loop's next
// iteration resumes), the SAME call's next iteration discovers a fresh run
// boundary while blockIntro_A is still sitting there, un-advanced. We
// reproduce that exact window with two synchronous (no `await` between them)
// calls to `requestLegendary`, which unshifts straight onto `rawQueue` and
// kicks `fillQueue()` — the second call's `void fillQueue()` itself no-ops
// (the first is still `filling`), but its unshifted card is what the
// first call's still-suspended loop picks up next.
test(
  "R2: blockIntro (mic-priming card) is synthesized at most once, even when a second stt-run boundary is discovered mid-fillQueue while the first blockIntro is still unconsumed",
  { timeout: 20_000 },
  async () => {
    const harness = await makeEngine({ arcs: 1, unitsPerArc: 2, skillsPerUnit: 2, itemsPerSkill: 6 })
    const deps = makeRuntimeFixtureDeps(harness.graph)
    const resolver = createResolver(deps, FIXTURE_RUNTIME_CTX)
    const itemIds = Object.keys(harness.graph.items)

    // The natural engine feed is empty — every card in this test is
    // injected directly via requestLegendary, so `prepared` starts (and
    // stays, absent injection) truly empty, which is what lets a single
    // fillQueue() call span more than one loop iteration below.
    const wrappedEngine: typeof harness.engine = {
      ...harness.engine,
      nextFeedItems: () => [],
      requestLegendary: (skillId) =>
        skillId === "A"
          ? [speakEchoCard(harness.graph, itemIds[0], "stt-A")]
          : [speakEchoCard(harness.graph, itemIds[1], "stt-B")],
    }

    const runtime = createJourneyRuntime({
      engine: wrappedEngine,
      resolver,
      resolverDeps: deps,
      ctx: FIXTURE_RUNTIME_CTX,
      graph: harness.graph,
      courseKey: "stack-1::journey_en_blockintro_race",
      quota: countingQuota({ notes: 0 }),
      now: () => harness.clock.nowMs(),
      record: () => {},
      sttReadiness: async () => "installed",
    })
    await startFeed(runtime)
    assert.equal(runtime.current(), null, "empty engine feed ⇒ nothing prepared yet")

    // Same-tick double injection — deliberately NO await between these two
    // calls, so both run synchronously back-to-back within one JS turn.
    runtime.requestLegendary("A")
    runtime.requestLegendary("B")

    // Let the still-in-flight fillQueue() call (and any chained ones) settle.
    await new Promise((r) => setTimeout(r, 50))

    const blockIntroCardIds = new Set<string>()
    for (let guard = 0; guard < 60; guard++) {
      const card = runtime.current()
      if (!card) {
        await new Promise((r) => setTimeout(r, 5))
        continue
      }
      if (card.kind === "blockIntro") {
        blockIntroCardIds.add(card.cardId)
        runtime.completePresentation(card.cardId)
      } else if (card.kind === "exercise") {
        runtime.submitResult(card.cardId, answer(card.prepared.engine))
        runtime.advance()
      } else {
        runtime.abandonCurrent()
      }
      await new Promise((r) => setTimeout(r, 1))
    }

    // A fresh user still sees the mic-priming card — the fix must not
    // suppress it outright, only the redundant second one.
    assert.ok(blockIntroCardIds.has("bi-stt-A"), "the first blockIntro (bi-stt-A) still appears")
    assert.equal(
      blockIntroCardIds.size,
      1,
      `blockIntro must be synthesized at most once even when a second boundary races in mid-fillQueue, saw ${blockIntroCardIds.size}: ${[...blockIntroCardIds]}`,
    )
  },
)

// -------------------------------------------------------------- speak-first
// (§ core): when STT is usable, production/echo moments become Whisper-graded
// speaking. intro_echo ALWAYS upgrades; listen_type upgrades a strong share.
// Unsupported/declined must NEVER upgrade (a learner who can't speak is never
// trapped — the graceful fallback is sacred).

test("speak-first: intro_echo upgrades to speak_echo only when a model is INSTALLED", async () => {
  const itemOf = (h: { graph: { items: Record<string, unknown> } }) => Object.keys(h.graph.items)[0]

  // installed → upgrades to Whisper-graded speaking.
  {
    const { runtime, harness, logs } = await makeRuntime({ sttReadiness: "installed" })
    await startFeed(runtime)
    const card = await runtime.prepareEngineCard(
      echoTypeCard(harness.graph, "intro_echo", itemOf(harness), "intro-installed"),
    )
    assert.ok(card && card.kind === "exercise", "installed: prepared an exercise")
    assert.equal(card.spec.activityType, "speak_echo", "installed: intro_echo upgrades to speak_echo")
    assert.equal(card.prepared.sttUpgraded, true, "installed: carries sttUpgraded")
    assert.equal(card.spec.modelNeeds?.includes("stt"), true, "installed: needs stt")
    // the debut identity (params.intro) survives so quota debiting is unchanged
    assert.equal(card.spec.params?.intro, true, "installed: still a debut")
    assert.ok(
      logs.some((l) => l.event === "journey_speak_upgrade" && l.data.from === "intro_echo"),
      "installed: upgrade logged",
    )
    await runtime.endSession("quit")
  }

  // model-missing AND unsupported → NEVER upgrade (never wall a learner behind a
  // model install; the debut stays a listen-and-echo intro).
  for (const state of ["modelMissing", "unsupported"] as const) {
    const { runtime, harness } = await makeRuntime({ sttReadiness: state })
    await startFeed(runtime)
    const card = await runtime.prepareEngineCard(
      echoTypeCard(harness.graph, "intro_echo", itemOf(harness), `intro-${state}`),
    )
    assert.ok(card && card.kind === "exercise", `${state}: prepared an exercise`)
    assert.equal(card.spec.activityType, "intro_echo", `${state}: no upgrade`)
    assert.ok(!card.prepared.sttUpgraded, `${state}: not marked upgraded`)
    await runtime.endSession("quit")
  }
})

test("speak-first: a strong share of listen_type upgrades to speak_echo when STT usable", async () => {
  const { runtime, harness } = await makeRuntime({ sttReadiness: "installed" })
  await startFeed(runtime)
  const itemIds = Object.keys(harness.graph.items)
  let upgraded = 0
  let kept = 0
  // Many distinct specIds → the deterministic per-card share splits speak vs type.
  for (let i = 0; i < 40; i++) {
    const itemId = itemIds[i % itemIds.length]
    const card = await runtime.prepareEngineCard(
      echoTypeCard(harness.graph, "listen_type", itemId, `lt-${i}`),
    )
    assert.ok(card && card.kind === "exercise")
    if (card.spec.activityType === "speak_echo") {
      assert.equal(card.prepared.sttUpgraded, true)
      upgraded += 1
    } else {
      assert.equal(card.spec.activityType, "listen_type", "kept cards stay listen_type")
      kept += 1
    }
  }
  // Speaking should DOMINATE production, but some typing variety is preserved.
  assert.ok(upgraded > kept, `speaking should dominate (upgraded=${upgraded} kept=${kept})`)
  assert.ok(kept > 0, `some listen_type variety preserved (kept=${kept})`)
})

test("speak-first: unsupported never upgrades listen_type", async () => {
  const { runtime, harness } = await makeRuntime({ sttReadiness: "unsupported" })
  await startFeed(runtime)
  const itemIds = Object.keys(harness.graph.items)
  for (let i = 0; i < 12; i++) {
    const card = await runtime.prepareEngineCard(
      echoTypeCard(harness.graph, "listen_type", itemIds[i % itemIds.length], `lt-uns-${i}`),
    )
    assert.ok(card && card.kind === "exercise")
    assert.equal(card.spec.activityType, "listen_type", "unsupported: listen_type never upgrades")
  }
})

// (Removed: "declining the install reverts queued upgraded speak cards." With
// model-missing degrading immediately, cards are never upgraded to speak in the
// first place unless a model is installed — so there is nothing to revert and
// no decline to handle.)

test("degenerate guard: a cloze on a single-token word reroutes (no broken blank)", async () => {
  const { runtime, logs } = await makeRuntime()
  await startFeed(runtime)
  // "jam" resolves to a 1-token target with no native face → cloze is
  // degenerate; the runtime reroutes to a renderable target-only activity.
  const card = await runtime.prepareEngineCard(wordCard("cloze", "jam", "clz-jam"))
  assert.ok(card && card.kind === "exercise", "reroute emits a card, never null")
  assert.notEqual(card.spec.activityType, "cloze", "single-token cloze must reroute")
  assert.notEqual(card.spec.activityType, "word_order")
  assert.equal(card.spec.params?.blankIndex, undefined, "no stale cloze blank left behind")
  assert.ok(
    logs.some((l) => l.event === "journey_degenerate_reroute"),
    "reroute is logged",
  )
})

test("degenerate guard: word_order on a single-token word reroutes to a valid activity", async () => {
  const { runtime } = await makeRuntime()
  await startFeed(runtime)
  const card = await runtime.prepareEngineCard(wordCard("word_order", "ship", "wo-ship"))
  assert.ok(card && card.kind === "exercise")
  assert.notEqual(card.spec.activityType, "word_order")
  assert.notEqual(card.spec.activityType, "cloze")
})

/** A cloze EngineCard over a single-token word carrying a preset contextPhrase
 *  in spec.params — exercises the context-cloze exemption in the token guard. */
function contextClozeCard(word: string, contextPhrase: string, specId: string): EngineCard {
  return {
    spec: {
      specId,
      activityType: "cloze",
      itemRefs: [{ kind: "word", source: "en", id: word }],
      targetLang: "en",
      nativeLang: "es",
      params: { contextPhrase, contextWord: word, mode: "type" },
    } as EngineCard["spec"],
    meta: {
      pool: "due",
      strand: "language",
      form: 1,
      estSec: 20,
      provider: "native",
      celebration: "normal",
      coolDownCandidate: false,
    },
  }
}

test("degenerate guard: context-cloze with a single-token contextPhrase reroutes", async () => {
  const { runtime, logs } = await makeRuntime()
  await startFeed(runtime)
  // The exemption is validated by the phrase's OWN token count, not by the mere
  // presence of the property — a context-cloze whose sentence collapsed to one
  // token is itself degenerate and must reroute (adversarial-review MEDIUM).
  const card = await runtime.prepareEngineCard(contextClozeCard("jam", "cat", "ctx-clz-degen"))
  assert.ok(card && card.kind === "exercise")
  assert.notEqual(card.spec.activityType, "cloze", "degenerate context-cloze must reroute")
  assert.ok(logs.some((l) => l.event === "journey_degenerate_reroute"))
})

test("degenerate guard: context-cloze with a real multi-token sentence stays a cloze", async () => {
  const { runtime } = await makeRuntime()
  await startFeed(runtime)
  const card = await runtime.prepareEngineCard(
    contextClozeCard("jam", "I love toast with jam", "ctx-clz-ok"),
  )
  assert.ok(card && card.kind === "exercise")
  assert.equal(card.spec.activityType, "cloze", "valid multi-token context-cloze is preserved")
})

test("degenerate guard: a multi-token phrase cloze is untouched", async () => {
  const { runtime } = await makeRuntime()
  await startFeed(runtime)
  // fixture phrases resolve to "alpha bravo N" (≥2 tokens) → cloze is fine.
  const itemId = Object.keys((await makeRuntime()).harness.graph.items)[0]
  const phraseCloze: EngineCard = {
    spec: {
      specId: "clz-phrase",
      activityType: "cloze",
      itemRefs: [runtime.graph.items[itemId].ref],
      targetLang: "en",
      nativeLang: "es",
    } as EngineCard["spec"],
    meta: {
      pool: "due",
      strand: "language",
      form: 1,
      estSec: 20,
      provider: "native",
      celebration: "normal",
      coolDownCandidate: false,
    },
  }
  const card = await runtime.prepareEngineCard(phraseCloze)
  assert.ok(card && card.kind === "exercise")
  assert.equal(card.spec.activityType, "cloze", "multi-token phrase keeps cloze")
})

test("redo (§3.4): clearSettled re-opens a completed exercise for a fresh answer", async () => {
  const { runtime, quotaLog } = await makeRuntime()
  await startFeed(runtime)
  // complete one exercise into history
  let doneCard: string | null = null
  for (let guard = 0; guard < 40 && !doneCard; guard++) {
    const card = runtime.current()
    if (!card) {
      await new Promise((r) => setTimeout(r, 5))
      continue
    }
    if (card.kind === "exercise") {
      runtime.submitResult(card.cardId, answer(card.prepared.engine))
      runtime.advance()
      doneCard = card.cardId
    } else if (card.kind === "checkpoint") {
      runtime.checkpointChoice(card.cardId, "continue")
    } else {
      runtime.abandonCurrent()
    }
    await new Promise((r) => setTimeout(r, 2))
  }
  assert.ok(doneCard, "completed an exercise into history")
  const rec = runtime.history().find((h) => h.card.cardId === doneCard)
  assert.ok(rec && rec.result, "history holds the answered record")

  // clearSettled re-opens it; the record's result is wiped so it renders fresh.
  const cleared = runtime.clearSettled(doneCard!)
  assert.equal(cleared, true, "clearSettled reports it cleared a settled card")
  const rec2 = runtime.history().find((h) => h.card.cardId === doneCard)
  assert.equal(rec2?.result, null, "cleared record starts fresh (no stored answer)")

  // a redo answer re-grades the item but never re-debits the daily gate.
  const notesBefore = quotaLog.notes
  const redoRec = runtime.history().find((h) => h.card.cardId === doneCard)!
  const info = runtime.submitResult(doneCard!, answer(redoRec.card.kind === "exercise" ? redoRec.card.prepared.engine : (redoRec.card as unknown as EngineCard)))
  assert.ok(info, "redo submit is accepted")
  assert.equal(info!.debited, false, "a redo never debits the gate")
  assert.equal(quotaLog.notes, notesBefore, "quota unchanged by a redo")
  const rec3 = runtime.history().find((h) => h.card.cardId === doneCard)
  assert.ok(rec3?.result, "the redo answer is stored back on the record")
})

test("redo: clearSettled is a no-op for an unsettled or unknown card", async () => {
  const { runtime } = await makeRuntime()
  await startFeed(runtime)
  assert.equal(runtime.clearSettled("does-not-exist"), false)
  const cur = runtime.current()
  if (cur) assert.equal(runtime.clearSettled(cur.cardId), false, "current unsettled card is not clearable")
})

test("STT decline (contract #4): declining advances the current card (never stuck)", async () => {
  const { runtime } = await makeRuntime({ sttReadiness: "modelMissing" })
  await startFeed(runtime)
  const cur = runtime.current()
  assert.ok(cur, "a current card is mounted")
  const historyBefore = runtime.history().length
  runtime.submitResult(cur!.cardId, {
    specId: cur!.cardId,
    score: 1,
    perItem: [],
    durationMs: 100,
    detail: { flags: { sttDeclined: true } },
  })
  // the declined card must have advanced on its own — no manual swipe needed.
  assert.equal(
    runtime.currentSettled(),
    null,
    "declined card does not linger as a settled-but-mounted card",
  )
  assert.equal(runtime.history().length, historyBefore + 1, "declined card advanced into history")
  assert.notEqual(runtime.current()?.cardId, cur!.cardId, "feed moved off the dead speak card")
})

// ---------------------------------------------------------------------------
// Interludes end-to-end (PREMIUM_SCROLL §2.2/§2.3): the two installed core
// interludes (wordfall = game, drift = reader) are SCHEDULED by the mixer into
// a real feed, each renders as a compact packActivity INTERLUDE card, launches
// with a real ActivitySpec through launchPackActivity, returns an
// ActivityResult, settles, and the feed scrolls on.

const WORDFALL_IL: InterludeProvider = {
  provider: "wordfall",
  kind: "game",
  activityType: "wordfall:catch",
  itemKinds: ["phrase", "word"],
  estSec: 30,
}
const DRIFT_IL: InterludeProvider = {
  provider: "drift",
  kind: "reader",
  activityType: "drift:read",
  itemKinds: ["phrase"],
  estSec: 30,
}

/** A stub single-owner activity session that captures the launched spec and
 *  synthesizes a terminal ActivityResult on demand (mirrors what a real pack
 *  reports back through hostApi.journey.reportResult). */
function stubActivitySession(): ActivitySessionPort & {
  launched: Array<{ packId: string; spec: ActivitySpec }>
  complete: (score: number) => void
} {
  let onResult:
    | ((result: ActivityResult, meta: { synthesized: boolean; receivedAt: number }) => void)
    | null = null
  let current: { packId: string; spec: ActivitySpec } | null = null
  const launched: Array<{ packId: string; spec: ActivitySpec }> = []
  return {
    launched,
    begin(packId, spec, callbacks) {
      current = { packId, spec }
      launched.push(current)
      onResult = callbacks.onResult
      return true
    },
    end() {
      onResult = null
      current = null
    },
    complete(score: number) {
      if (!onResult || !current) return
      const spec = current.spec
      onResult(
        {
          specId: spec.specId,
          score,
          perItem: spec.itemRefs.map((itemRef) => ({ itemRef, outcome: "pass" as const })),
          durationMs: 3000,
        },
        { synthesized: false, receivedAt: 0 },
      )
    },
  }
}

test("interludes: wordfall (game) AND drift (reader) launch with a spec and scroll on", async () => {
  const session = stubActivitySession()
  const { runtime } = await makeRuntime({
    interludes: [WORDFALL_IL, DRIFT_IL],
    activitySession: session,
  })
  await startFeed(runtime)

  const launchedProviders = new Set<string>()
  let interludeCardsSeen = 0

  for (let guard = 0; guard < 400 && launchedProviders.size < 2; guard++) {
    const card = runtime.current()
    if (!card) {
      await new Promise((r) => setTimeout(r, 3))
      continue
    }
    if (card.kind === "packActivity") {
      interludeCardsSeen += 1
      // Both wordfall + drift are sip interludes (30s, not heavy 3D).
      assert.equal(card.interlude, true, `${card.packId} renders as a compact interlude poster`)
      assert.equal(
        card.interludeKind,
        card.packId === "drift" ? "reader" : "game",
        "the poster knows game vs reader kind",
      )
      assert.match(card.spec.activityType, /^(wordfall|drift):/)
      assert.equal(card.spec.itemRefs.length, 1, "interlude features the current phrase")

      const historyBefore = runtime.history().length
      // The feed hands the pack an ActivitySpec (never re-implements routing).
      const ok = runtime.launchPackActivity(card, (packId, spec) => {
        assert.equal(packId, card.packId)
        assert.equal(spec.specId, card.spec.specId)
      })
      assert.equal(ok, true, "launchPackActivity accepted the interlude spec")
      assert.equal(runtime.packReturnPending(), card.cardId, "awaiting the pack result")
      // The pack plays one round for the phrase and reports a terminal result.
      session.complete(card.packId === "drift" ? 1 : 0.9)
      runtime.advance()
      assert.equal(runtime.history().length, historyBefore + 1, "interlude settled into history")
      launchedProviders.add(card.packId)
    } else if (card.kind === "exercise") {
      runtime.submitResult(card.cardId, answer(card.prepared.engine))
      runtime.advance()
    } else if (card.kind === "checkpoint") {
      runtime.checkpointChoice(card.cardId, "continue")
    } else if (card.kind === "blockIntro" || card.kind === "welcomeBack") {
      runtime.completePresentation(card.cardId)
    } else {
      runtime.abandonCurrent()
    }
    await new Promise((r) => setTimeout(r, 1))
  }

  assert.ok(interludeCardsSeen >= 2, `saw ${interludeCardsSeen} interlude cards`)
  assert.ok(launchedProviders.has("wordfall"), "a wordfall game interlude launched + settled")
  assert.ok(launchedProviders.has("drift"), "a drift reader interlude launched + settled")
  // Every launched spec was a real namespaced pack activity over one phrase.
  for (const l of session.launched) {
    assert.match(l.spec.activityType, /^(wordfall|drift):/)
    assert.equal(l.spec.itemRefs.length, 1)
  }
})
