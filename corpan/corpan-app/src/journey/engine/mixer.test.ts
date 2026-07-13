// engine.md §8.2 mixer — batch invariants over seeded sessions on the
// fixture graph (§5.4 step-5 rules, model batching, debt brake, timebox,
// determinism).

import { test } from "node:test"
import assert from "node:assert/strict"

import { DAY_MS } from "./clock.ts"
import { CHECKPOINT_BACK_TO_BACK_FLOOR, DEBT_BRAKE_RATIO, NEW_PER_DAY_MAX } from "./constants.ts"
import { adjustQuotas, isDebtBrakeActive } from "./mixer.ts"
import type { ActivityTemplate, CourseGraph, CourseState, EngineCard, ItemRef } from "./types.ts"
import { makeFixtureGraph, nativeTemplates } from "./__fixtures__/fixtureGraph.ts"
import { answer, makeEngine, playBatch, type Harness } from "./__fixtures__/harness.ts"

const CONS = { availableProviders: ["native"] }

/** Fixture graph whose single-token kinds (word/phoneme) carry the SAME native
 *  template set (choice_pick, cloze, word_order, …) so the mixer's selection
 *  gate — not a template shortfall — is what keeps cloze/word_order off them.
 *  Retags every item of skill index `k` inside each unit to `kind`. */
function graphWithKind(
  kind: ItemRef["kind"],
  opts: Parameters<typeof makeFixtureGraph>[0] = {},
  everyN = 2,
): CourseGraph {
  const graph = makeFixtureGraph({ withLessons: false, ...opts })
  const templates: ActivityTemplate[] = [...graph.activityTemplates]
  // Mirror every native phrase template onto the new kind so type choice has
  // the full menu (incl. the multi-token cloze/word_order it must NOT pick).
  for (const t of nativeTemplates(kind)) templates.push(t)
  graph.activityTemplates = templates
  let flipped = 0
  for (const item of Object.values(graph.items)) {
    // retag every Nth item so both kinds coexist in the pools
    if (flipped % everyN === 0) {
      item.kind = kind
      item.ref = { kind, source: item.ref.source, id: item.ref.id } as ItemRef
    }
    flipped += 1
  }
  return graph
}

function modelKey(card: EngineCard): number {
  const m = card.spec.modelNeeds ?? []
  if (m.includes("llm")) return 3
  if (m.includes("stt")) return 2
  if (m.includes("tts")) return 1
  return 0
}

function checkBatchInvariants(_h: Harness, cards: EngineCard[], label: string): number {
  let adjacencyViolations = 0
  // no two consecutive slots share activityType (relaxations are
  // telemetry-logged; pairs inside a mandated-contiguous stt/llm/tts block
  // are exempt — §5.4 step 6)
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].spec.activityType !== cards[i - 1].spec.activityType) continue
    if (modelKey(cards[i]) !== 0 || modelKey(cards[i - 1]) !== 0) continue
    adjacencyViolations += 1
  }
  // same item never within gap < 2 (the relaxed floor is never crossed)
  const seen = new Map<string, number>()
  cards.forEach((c, i) => {
    for (const ref of c.spec.itemRefs) {
      const key = `${ref.kind}:${ref.source}:${ref.id}`
      const prev = seen.get(key)
      if (prev !== undefined) {
        assert.ok(i - prev >= 2, `${label}: item ${key} gap ${i - prev} < 2`)
      }
      seen.set(key, i)
    }
  })
  // model-residency: stt/llm blocks contiguous, non-model cards never after them
  const keys = cards.filter((c) => !c.meta.checkpoint && c.meta.pool !== "jump").map(modelKey)
  for (let i = 1; i < keys.length; i++) {
    assert.ok(keys[i] >= keys[i - 1], `${label}: model blocks not contiguous (${keys.join(",")})`)
  }
  // a card with modelNeeds never occupies slot 0 when alternatives exist
  if (cards.length > 1 && keys.some((k) => k === 0)) {
    assert.equal(modelKey(cards[0]), 0, `${label}: model-needing card at slot 0`)
  }
  return adjacencyViolations
}

test("mixer invariants hold across 3 simulated weeks of seeded batches", async () => {
  const h = await makeEngine({ unitsPerArc: 3, itemsPerSkill: 8 })
  let adjacency = 0
  let batches = 0
  for (let day = 0; day < 21; day++) {
    h.engine.startSession()
    for (let b = 0; b < 4; b++) {
      const cards = h.engine.nextFeedItems(10, CONS)
      if (cards.length === 0) break
      batches += 1
      adjacency += checkBatchInvariants(h, cards, `day ${day} batch ${b}`)
      playBatch(h.engine, cards, (_c, i) => i % 5 !== 4) // 80% pass
    }
    h.clock.advance(DAY_MS)
  }
  assert.ok(batches > 40, `served ${batches} batches`)
  // adjacency violations only where the mixer logged a relaxation
  assert.ok(
    adjacency <= h.engine.getTelemetry().relaxations,
    `adjacency ${adjacency} > logged relaxations ${h.engine.getTelemetry().relaxations}`,
  )
})

test("debut order: intro precedes recognition with gap ≥ 3, same session", async () => {
  const h = await makeEngine({ withLessons: false })
  h.engine.startSession()
  const positions = new Map<string, { intro?: number; recog?: number }>()
  let pos = 0
  for (let b = 0; b < 4; b++) {
    const cards = h.engine.nextFeedItems(10, CONS)
    if (cards.length === 0) break
    for (const c of cards) {
      if (c.meta.pool === "new" && c.spec.itemRefs.length === 1) {
        const ref = c.spec.itemRefs[0]
        const key = `${ref.kind}:${ref.source}:${ref.id}`
        const entry = positions.get(key) ?? {}
        if (c.spec.params?.intro === true) entry.intro = pos
        else entry.recog = pos
        positions.set(key, entry)
      }
      pos += 1
    }
    playBatch(h.engine, cards)
  }
  let debutsChecked = 0
  for (const [key, e] of positions) {
    if (e.intro !== undefined && e.recog !== undefined) {
      debutsChecked += 1
      assert.ok(e.recog - e.intro >= 3, `${key}: recognition gap ${e.recog - e.intro} < 3`)
    }
  }
  assert.ok(debutsChecked > 0, "at least one full debut pair observed")
})

test("debt brake: a due avalanche zeroes NEW intake", async () => {
  // itemsPerSkill sized so the 6-day learn → 25-day-gap avalanche clears the
  // 1.5×capacity threshold even with multi-item match_pairs consolidating more
  // items per card (defect #2) than the pre-feature single-pair form.
  const h = await makeEngine({ unitsPerArc: 3, itemsPerSkill: 16 })
  // learn for 6 days, then vanish for 25 (lapser pattern)
  for (let day = 0; day < 6; day++) {
    h.engine.startSession()
    for (let b = 0; b < 4; b++) {
      const cards = h.engine.nextFeedItems(10, CONS)
      if (cards.length === 0) break
      playBatch(h.engine, cards)
    }
    h.clock.advance(DAY_MS)
  }
  h.clock.advance(25 * DAY_MS)
  h.engine.startSession()
  assert.ok(h.engine.getCourseSnapshot().debtBrakeActive, "avalanche engages the brake")
  let brakedBatches = 0
  for (let b = 0; b < 3; b++) {
    // the brake is evaluated per batch — reviews within the session can
    // legitimately clear the backlog and re-open intake
    const braked = h.engine.getCourseSnapshot().debtBrakeActive
    const cards = h.engine.nextFeedItems(10, CONS)
    if (braked) {
      brakedBatches += 1
      for (const c of cards) {
        assert.notEqual(c.meta.pool, "new", "debt brake must zero NEW")
        assert.notEqual(c.meta.pool, "trickle", "debt brake pauses TRICKLE")
      }
    }
    playBatch(h.engine, cards)
  }
  assert.ok(brakedBatches >= 1, "at least the first batch ran under the brake")
})

test("timebox trims the batch to the estSec budget", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  const cards = h.engine.nextFeedItems(10, { ...CONS, timeboxSec: 45 })
  const total = cards.reduce((a, c) => a + c.meta.estSec, 0)
  assert.ok(cards.length >= 1)
  assert.ok(total <= 45 || cards.length === 1, `Σ estSec ${total} > 45`)
})

test("availability filter: stt-less host never sees stt cards; quota redistributes", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  for (let b = 0; b < 3; b++) {
    const cards = h.engine.nextFeedItems(10, { ...CONS, modelsAvailable: [] })
    assert.ok(cards.length > 0, "feed degrades gracefully, never empties")
    for (const c of cards) {
      assert.equal((c.spec.modelNeeds ?? []).length, 0)
    }
    playBatch(h.engine, cards)
  }
})

test("excludeActivityTypes is honored (quiet mode)", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  const cards = h.engine.nextFeedItems(10, { ...CONS, excludeActivityTypes: ["speak_echo", "listen_type"] })
  for (const c of cards) {
    assert.notEqual(c.spec.activityType, "speak_echo")
    assert.notEqual(c.spec.activityType, "listen_type")
  }
})

test("P6-style determinism: identical seeds ⇒ identical spec transcripts", async () => {
  const run = async (): Promise<string[]> => {
    const h = await makeEngine()
    const out: string[] = []
    for (let day = 0; day < 3; day++) {
      h.engine.startSession()
      for (let b = 0; b < 3; b++) {
        const cards = h.engine.nextFeedItems(10, CONS)
        if (cards.length === 0) break
        out.push(...cards.map((c) => `${c.spec.specId}|${c.spec.activityType}|${c.meta.pool}`))
        playBatch(h.engine, cards, (_c, i) => i % 3 !== 2)
      }
      h.clock.advance(DAY_MS)
    }
    return out
  }
  const a = await run()
  const b = await run()
  assert.ok(a.length > 20)
  assert.deepEqual(a, b)
})

test("nextFeedItems returns ≥1 card or a typed shortfall reason", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  // impossible constraints: every native type excluded
  const allTypes = [...new Set(h.graph.activityTemplates.map((t) => t.activityType))]
  const cards = h.engine.nextFeedItems(10, { ...CONS, excludeActivityTypes: allTypes })
  if (cards.length === 0) {
    assert.ok(h.engine.getTelemetry().lastShortfallReason, "shortfall must carry a reason")
  }
})

test("match_pairs cards carry multiple items (defect #2)", async () => {
  const h = await makeEngine({ unitsPerArc: 3, itemsPerSkill: 8 })
  let matchPairs = 0
  let multiItem = 0
  for (let day = 0; day < 3; day++) {
    h.engine.startSession()
    for (let b = 0; b < 4; b++) {
      const cards = h.engine.nextFeedItems(10, CONS)
      if (cards.length === 0) break
      for (const c of cards) {
        if (c.spec.activityType !== "match_pairs") continue
        matchPairs += 1
        const n = c.spec.itemRefs.length
        assert.ok(n >= 2, `match_pairs card has ${n} item(s) — the one-pair collapse is the bug`)
        assert.ok(n <= 6, `match_pairs card has ${n} items (> 6)`)
        // all items share one kind (the renderer pairs like with like)
        assert.equal(new Set(c.spec.itemRefs.map((r) => r.kind)).size, 1)
        // no duplicate items inside one card
        const keys = c.spec.itemRefs.map((r) => `${r.kind}:${r.source}:${r.id}`)
        assert.equal(new Set(keys).size, keys.length, "no repeated item within a match_pairs card")
        if (n >= 4) multiItem += 1
      }
      playBatch(h.engine, cards)
    }
    h.clock.advance(DAY_MS)
  }
  assert.ok(matchPairs > 0, "session surfaced match_pairs cards")
  assert.ok(multiItem > 0, "at least one match_pairs card reached the 4–6 item band")
})

test("recipe variety: an A1 session surfaces ≥4 distinct activity types (defect #10)", async () => {
  const h = await makeEngine({ unitsPerArc: 3, itemsPerSkill: 8 })
  const types = new Set<string>()
  for (let day = 0; day < 2; day++) {
    h.engine.startSession()
    for (let b = 0; b < 5; b++) {
      const cards = h.engine.nextFeedItems(10, { availableProviders: ["native"], modelsAvailable: ["stt", "tts"] })
      if (cards.length === 0) break
      for (const c of cards) {
        if (c.meta.pool === "checkpoint" || c.meta.pool === "jump") continue
        types.add(c.spec.activityType)
      }
      playBatch(h.engine, cards, (_c, i) => i % 4 !== 3)
    }
    h.clock.advance(DAY_MS)
  }
  assert.ok(types.size >= 4, `distinct activity types (${types.size}): ${[...types].join(", ")}`)
})

test("selection gate: single-token WORD items never get cloze/word_order", async () => {
  const graph = graphWithKind("word", { unitsPerArc: 3, itemsPerSkill: 8 })
  const h = await makeEngine({}, graph)
  let wordCards = 0
  let sawWordChoice = false
  for (let day = 0; day < 3; day++) {
    h.engine.startSession()
    for (let b = 0; b < 4; b++) {
      const cards = h.engine.nextFeedItems(10, CONS)
      if (cards.length === 0) break
      for (const c of cards) {
        const kinds = new Set(c.spec.itemRefs.map((r) => r.kind))
        if (!kinds.has("word")) continue
        wordCards += 1
        assert.notEqual(c.spec.activityType, "cloze", "word item must never get cloze")
        assert.notEqual(c.spec.activityType, "word_order", "word item must never get word_order")
        if (c.spec.activityType === "choice_pick" || c.spec.activityType === "listen_pick") {
          sawWordChoice = true
        }
      }
      playBatch(h.engine, cards, (_c, i) => i % 4 !== 3)
    }
    h.clock.advance(DAY_MS)
  }
  assert.ok(wordCards > 0, "session surfaced word cards")
  assert.ok(sawWordChoice, "word items rerouted to a valid recognition activity")
})

test("selection gate: single-token PHONEME items never get cloze/word_order", async () => {
  // Phonemes are a minority (every 4th item) so enough vocab accumulates to
  // clear the anti-domination deferral and let phoneme cards actually surface,
  // exercising the type gate rather than the deferral.
  const graph = graphWithKind("phoneme", { unitsPerArc: 4, itemsPerSkill: 10 }, 4)
  const h = await makeEngine({}, graph)
  let phonemeCards = 0
  for (let day = 0; day < 10; day++) {
    h.engine.startSession()
    for (let b = 0; b < 4; b++) {
      const cards = h.engine.nextFeedItems(10, CONS)
      if (cards.length === 0) break
      for (const c of cards) {
        if (!c.spec.itemRefs.some((r) => r.kind === "phoneme")) continue
        phonemeCards += 1
        assert.notEqual(c.spec.activityType, "cloze")
        assert.notEqual(c.spec.activityType, "word_order")
      }
      playBatch(h.engine, cards, (_c, i) => i % 4 !== 3)
    }
    h.clock.advance(DAY_MS)
  }
  assert.ok(phonemeCards > 0, "session surfaced phoneme cards")
})

test("phoneme intake never dominates the opening feed (deferred + capped)", async () => {
  const graph = graphWithKind("phoneme", { unitsPerArc: 3, itemsPerSkill: 8 })
  const h = await makeEngine({}, graph)
  // Opening session for a fresh beginner: count new (debut) phoneme vs total.
  h.engine.startSession()
  let openingNewPhoneme = 0
  let openingNew = 0
  for (let b = 0; b < 3; b++) {
    const cards = h.engine.nextFeedItems(10, CONS)
    if (cards.length === 0) break
    for (const c of cards) {
      if (c.meta.pool !== "new") continue
      openingNew += 1
      if (c.spec.itemRefs.some((r) => r.kind === "phoneme")) openingNewPhoneme += 1
    }
    playBatch(h.engine, cards)
  }
  assert.ok(openingNew > 0, "opening session introduced new items")
  // A beginner with <12 seen vocab must not be drilled on phoneme contrasts.
  assert.equal(
    openingNewPhoneme,
    0,
    `phonemes flooded the opening feed (${openingNewPhoneme}/${openingNew} new cards)`,
  )
})

test("newPerDay caps completed debuts per local day", async () => {
  const h = await makeEngine({ unitsPerArc: 3, itemsPerSkill: 12, withLessons: false })
  h.engine.startSession()
  for (let b = 0; b < 10; b++) {
    const cards = h.engine.nextFeedItems(10, CONS)
    if (cards.length === 0) break
    playBatch(h.engine, cards)
  }
  const snap = h.engine.getCourseSnapshot()
  assert.ok(snap.newRemainingToday >= 0, `over-introduced: ${snap.newRemainingToday}`)
})

// Infinite feed (doom-scroll to fluency): the OPPOSITE of the retired wind-down.
// A learner who keeps continuing past the daily target must NEVER dead-end
// mid-journey and must NEVER see degenerate repetition. Once the day's normal
// work is met, the FRONTIER pulls forward — the next reachable units' fresh
// material — and every card differs from the last (item AND, where the menu
// allows, activity type). The only acceptable terminal is a genuinely-empty
// corpus, which this graph (a bounded fixture) eventually reaches AFTER pulling
// far past the position unit — never at the daily target.
test("infinite feed: keeps producing fresh, varied cards past the daily target (never dead-ends mid-journey)", async () => {
  const h = await makeEngine({ arcs: 2, unitsPerArc: 3, skillsPerUnit: 2, itemsPerSkill: 6, withLessons: false })

  h.engine.startSession()
  const startUnit = h.engine.getCourseSnapshot().position.unitOrdinal
  let realCardsAfterTarget = 0
  let targetMetAtCard = -1
  let dueEverExhausted = false
  const seenUnitsAhead = new Set<number>()
  // Card-level sequence (one entry per card) for anti-repeat: consecutive cards
  // must differ in their item set and — where the type menu allows — activity.
  const cardSeq: { items: string[]; type: string; modelKey: number }[] = []
  // Full emitted-stream item positions (INCLUDING checkpoints as positions) —
  // the ITEM_MIN_GAP contract measured on the real stream.
  const lastItemPos = new Map<string, number>()
  let streamPos = 0
  let minItemGap = Infinity
  let realCardCount = 0
  let batches = 0
  let checkpointsSeen = 0
  // Stream positions of every emitted "Punto de control" (checkpoint_summary)
  // card — used to assert milestones never fire several times in a row.
  const checkpointPositions: number[] = []

  for (let i = 0; i < 60; i++) {
    const batch = h.engine.nextFeedItems(10, { ...CONS, modelsAvailable: ["tts"] })
    if (batch.length === 0) break // true content-exhaustion terminal (fail-safe)
    batches += 1
    const snap = h.engine.getCourseSnapshot()
    if (snap.newRemainingToday === 0 && snap.dueCount === 0) {
      dueEverExhausted = true
      if (targetMetAtCard < 0) targetMetAtCard = realCardCount
    }
    for (const c of batch) {
      const t = c.spec.activityType
      // every emitted card advances the stream position (item-gap contract)
      const items = c.spec.itemRefs.map((ref) => `${ref.kind}:${ref.source}:${ref.id}`)
      for (const it of items) {
        const prev = lastItemPos.get(it)
        if (prev !== undefined) minItemGap = Math.min(minItemGap, streamPos - prev)
        lastItemPos.set(it, streamPos)
      }
      if (t === "checkpoint_summary") {
        checkpointsSeen += 1
        checkpointPositions.push(streamPos)
      }
      streamPos += 1
      if (t === "checkpoint_summary" || t === "jump_offer") continue
      // checkpoint/jump batches are §5.10-exempt from adjacency (returned as-is)
      const antiRepeatEligible = c.meta.pool !== "checkpoint" && c.meta.pool !== "jump"
      realCardCount += 1
      if (antiRepeatEligible) cardSeq.push({ items, type: t, modelKey: modelKey(c) })
      // which unit does this item belong to? (frontier pull-forward evidence)
      for (const ref of c.spec.itemRefs) {
        const itemId = Object.keys(h.graph.items).find(
          (id) =>
            h.graph.items[id].ref.kind === ref.kind &&
            h.graph.items[id].ref.source === ref.source &&
            h.graph.items[id].ref.id === ref.id,
        )
        const skillId = itemId ? h.graph.items[itemId].skillIds[0] : undefined
        const unitId = skillId ? h.graph.skills[skillId]?.unitId : undefined
        const ord = h.graph.units.findIndex((u) => u.unitId === unitId)
        if (ord > startUnit) seenUnitsAhead.add(ord)
      }
      if (targetMetAtCard >= 0) realCardsAfterTarget += 1
      h.engine.applyResult(answer(c, { pass: true }))
    }
  }

  // 1. Never dead-ends at the daily target: after the target was met, the feed
  //    kept producing a long run of real cards (frontier pull-forward).
  assert.ok(dueEverExhausted, "the daily target was reached (precondition for the test)")
  assert.ok(
    realCardsAfterTarget > 20,
    `feed dead-ended near the daily target (only ${realCardsAfterTarget} real cards after)`,
  )
  // 2. Frontier pull-forward: the binger unlocked material from units AHEAD of
  //    the position cursor in one sitting (position itself stays checkpoint-gated).
  assert.ok(
    seenUnitsAhead.size > 0,
    "frontier never pulled a next-unit's material forward (feed stalled on the position unit)",
  )
  // 3. No degenerate repetition: the same item never appears within the
  //    ITEM_MIN_GAP_RELAXED (2) floor of the emitted stream (the old
  //    fun:match_pairs loop replayed the same item back-to-back), and consecutive
  //    same-activity only occurs where the mixer logged a relaxation (thin type
  //    menus) or inside a mandated model block (§5.4 step 6 exemption).
  assert.ok(
    minItemGap >= 2,
    `an item repeated within gap ${minItemGap} < 2 — degenerate item repetition`,
  )
  let typeRepeats = 0
  for (let k = 1; k < cardSeq.length; k++) {
    if (cardSeq[k].type !== cardSeq[k - 1].type) continue
    if (cardSeq[k].modelKey !== 0 || cardSeq[k - 1].modelKey !== 0) continue
    typeRepeats += 1
  }
  assert.ok(
    typeRepeats <= h.engine.getTelemetry().relaxations,
    `consecutive same-activity (${typeRepeats}) beyond logged relaxations (${h.engine.getTelemetry().relaxations})`,
  )
  // 4. Cadence checkpoints stay milestones (never the old every-10-forever loop);
  //    with real content flowing they pace out, not pile up.
  assert.ok(checkpointsSeen >= 1, "at least one milestone checkpoint over a long run")
  assert.ok(batches > 6, `served ${batches} batches of continuous content`)
  // 5. Never several "Punto de control" checkpoints back-to-back: with the
  //    cross-batch floor (+ snapped catch-up tally), consecutive checkpoint
  //    positions in the emitted stream stay at least CHECKPOINT_BACK_TO_BACK_FLOOR
  //    apart — the over-fire (one boss/overshoot leaving a per-batch drain) is gone.
  assert.ok(checkpointPositions.length >= 2, "several milestone checkpoints over a long run")
  for (let k = 1; k < checkpointPositions.length; k++) {
    const gap = checkpointPositions[k] - checkpointPositions[k - 1]
    assert.ok(
      gap >= CHECKPOINT_BACK_TO_BACK_FLOOR,
      `checkpoints ${gap} apart must be >= ${CHECKPOINT_BACK_TO_BACK_FLOOR} (no "Punto de control" run) — positions ${checkpointPositions.join(",")}`,
    )
  }
})

// Frontier DAG gate: pull-forward respects prerequisites — it never surfaces a
// unit whose prereq skills the learner hasn't reached, even for an eager binger.
test("frontier pull-forward is DAG-gated (never unlocks past unreached prereqs)", async () => {
  // chained units: unit u's skill k requires unit u-1's skill k. With the
  // position cursor pinned (no checkpoints to pass ⇒ no advance), the frontier's
  // OWN horizon (position + FRONTIER_LOOKAHEAD_UNITS, DAG-gated) is what bounds
  // reach — a fresh binger cannot skip the whole chained DAG in one sitting.
  const h = await makeEngine({ arcs: 3, unitsPerArc: 3, skillsPerUnit: 2, itemsPerSkill: 6, chainUnits: true, withLessons: false, withCheckpoints: false })
  h.engine.startSession()
  const reached = new Set<number>()
  for (let i = 0; i < 40; i++) {
    const batch = h.engine.nextFeedItems(10, { ...CONS, modelsAvailable: ["tts"] })
    if (batch.length === 0) break
    for (const c of batch) {
      if (c.spec.activityType === "checkpoint_summary" || c.spec.activityType === "jump_offer") continue
      for (const ref of c.spec.itemRefs) {
        const itemId = Object.keys(h.graph.items).find(
          (id) =>
            h.graph.items[id].ref.kind === ref.kind &&
            h.graph.items[id].ref.source === ref.source &&
            h.graph.items[id].ref.id === ref.id,
        )
        const skillId = itemId ? h.graph.items[itemId].skillIds[0] : undefined
        const unitId = skillId ? h.graph.skills[skillId]?.unitId : undefined
        const ord = h.graph.units.findIndex((u) => u.unitId === unitId)
        if (ord >= 0) reached.add(ord)
      }
      h.engine.applyResult(answer(c, { pass: true }))
    }
  }
  // A fresh binger cannot skip the whole chained DAG in one sitting: the deepest
  // units (whose prereqs are still unreached) never surface.
  const maxReached = Math.max(...reached)
  assert.ok(
    maxReached < h.graph.units.length - 1,
    `binger reached the final unit (${maxReached}/${h.graph.units.length - 1}) — DAG gate breached`,
  )
})

// Speak-first mix (§ core, upweight): a resident Whisper model (sttInstalled)
// up-weights the OUTPUT (speaking) strand at slot selection, so installing STT
// visibly increases live speaking beyond the flat stage target. The stock
// fixture only carries speak_echo at form 2 (rarely reached), so we add a
// form-0 output template competing head-to-head with the form-0 language
// template — the only difference between runs is the sttInstalled flag.
test("sttInstalled up-weights the output (speaking) strand in the mix", async () => {
  const buildGraph = (): CourseGraph => {
    const graph = makeFixtureGraph({ arcs: 2, unitsPerArc: 3, skillsPerUnit: 2, itemsPerSkill: 8, withLessons: false })
    graph.activityTemplates = [
      ...graph.activityTemplates,
      // A speaking activity available at the EASY form so selection actually
      // reaches it (no STT model gate on selection beyond modelsAvailable).
      { activityType: "speak_echo", itemKind: "phrase", form: 0, strand: "output", guessable: false, estSec: 18, modelNeeds: ["stt"], provider: "native" },
    ]
    return graph
  }

  const countSpeak = async (sttInstalled: boolean): Promise<number> => {
    const h = await makeEngine({}, buildGraph())
    let speak = 0
    for (let day = 0; day < 3; day++) {
      h.engine.startSession()
      for (let b = 0; b < 8; b++) {
        const batch = h.engine.nextFeedItems(8, {
          ...CONS,
          modelsAvailable: ["stt", "tts"],
          sttInstalled,
        })
        if (batch.length === 0) break
        for (const c of batch) {
          const t = c.spec.activityType
          if (t === "speak_echo") speak += 1
          if (t === "checkpoint_summary" || t === "jump_offer") continue
          h.engine.applyResult(answer(c, { pass: true }))
        }
      }
      h.clock.advance(DAY_MS)
      h.engine.tickDay()
    }
    return speak
  }

  const off = await countSpeak(false)
  const on = await countSpeak(true)
  // Identical graph + RNG stream; the only lever is the installed up-weight,
  // which must yield strictly more speaking.
  assert.ok(on > off, `installed STT did not increase speaking (on=${on} off=${off})`)
})

// Intensive-intake guardrail: lifting NEW_PER_DAY_MAX (grinders start with a high
// newPerDay) must NOT let unseen items pile on top of a review debt. The intake
// ceiling is a SOFT throttle; the debt-brake is the hard guardrail and still
// zeroes NEW, handing the freed quota to reviews — the feed yields, never
// dead-ends on new.
test("raised intake ceiling still yields to reviews: debt-brake zeroes NEW even at a high newPerDay", () => {
  // A grinder seeded at the raised ceiling.
  const course = {
    newPerDay: NEW_PER_DAY_MAX,
    dailyCapacityEwma: 40,
    sessionsPerDayEwma: 1,
  } as unknown as CourseState

  // No backlog → intake flows (new quota is positive), so the ceiling is real.
  const clear = adjustQuotas(course, "normal", 0)
  assert.equal(clear.debt, false, "no backlog ⇒ brake off")
  assert.ok(clear.new > 0, "with no review debt, new intake is served")

  // A review avalanche past 1.5×capacity → brake binds regardless of newPerDay.
  const dueAvalanche = Math.ceil(DEBT_BRAKE_RATIO * course.dailyCapacityEwma) + 1
  assert.ok(isDebtBrakeActive(course, dueAvalanche), "backlog past the ratio engages the brake")
  const braked = adjustQuotas(course, "normal", dueAvalanche)
  assert.equal(braked.debt, true, "brake active under backlog")
  assert.equal(braked.new, 0, "debt-brake zeroes NEW no matter how high the ceiling is")
  assert.ok(braked.review > clear.review, "the freed intake quota burns the review backlog down")
})
