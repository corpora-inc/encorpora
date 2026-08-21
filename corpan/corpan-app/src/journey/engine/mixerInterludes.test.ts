// engine.md §5.4 / PREMIUM_SCROLL §2.2–§2.3 — Journey interlude scheduling.
//
// Proves the generalized interlude scheduler: given the INSTALLED interlude
// packs (a game + a reader, keyed by their declared activities — NOT a
// hardcoded provider), a real session schedules BOTH a game interlude
// (wordfall:catch) AND a reader interlude (drift:read), each bound to the
// current phrase, at the design cadence, never two back-to-back.

import { test } from "node:test"
import assert from "node:assert/strict"

import type { EngineCard, FeedConstraints, InterludeProvider } from "./types.ts"
import { makeEngine, answer } from "./__fixtures__/harness.ts"
import {
  GAME_INTERLUDE_MIN_GAP,
  READER_INTERLUDE_MIN_GAP,
  INTERLUDE_BACK_TO_BACK_FLOOR,
} from "./constants.ts"

/** The two tiny core interludes the SystemPackInstaller auto-installs, in the
 *  exact shape buildInterludeProviders() produces from their manifest
 *  `activities`. */
const WORDFALL: InterludeProvider = {
  provider: "wordfall",
  kind: "game",
  activityType: "wordfall:catch",
  itemKinds: ["phrase", "word"],
  estSec: 30,
}
const DRIFT: InterludeProvider = {
  provider: "drift",
  kind: "reader",
  activityType: "drift:read",
  itemKinds: ["phrase"],
  estSec: 30,
}

const CONS = (extra?: Partial<FeedConstraints>): FeedConstraints => ({
  availableProviders: ["native"],
  interludes: [WORDFALL, DRIFT],
  ...extra,
})

/** Drive `batches` feed batches, answering each card to keep the session
 *  advancing, and collect every emitted card in order. Returns the flat card
 *  stream plus the emit position of each card. */
function runSession(
  h: Awaited<ReturnType<typeof makeEngine>>,
  batches: number,
  cons: FeedConstraints,
): { cards: EngineCard[]; positions: number[] } {
  h.engine.startSession()
  const cards: EngineCard[] = []
  const positions: number[] = []
  let pos = 0
  for (let b = 0; b < batches; b++) {
    const batch = h.engine.nextFeedItems(10, cons)
    if (batch.length === 0) break
    for (const card of batch) {
      cards.push(card)
      positions.push(pos++)
      // Answer native content cards so the session keeps flowing; pack
      // (interlude) cards and checkpoints are settled with a benign result.
      if (card.meta.provider === "native" && card.spec.activityType !== "checkpoint_summary" && card.spec.activityType !== "jump_offer") {
        h.engine.applyResult(answer(card, { pass: true }))
      }
    }
    h.clock.advance(60_000)
  }
  return { cards, positions }
}

const isInterlude = (c: EngineCard): boolean => c.meta.provider !== "native"

test("mixer schedules BOTH a wordfall (game) and a drift (reader) interlude", async () => {
  const h = await makeEngine({ arcs: 3, unitsPerArc: 3, itemsPerSkill: 8 })
  const { cards } = runSession(h, 30, CONS())

  const interludes = cards.filter(isInterlude)
  const providers = new Set(interludes.map((c) => c.meta.provider))
  assert.ok(providers.has("wordfall"), "a wordfall game interlude was scheduled")
  assert.ok(providers.has("drift"), "a drift reader interlude was scheduled")

  // Each interlude launches with a real ActivitySpec over the pack's namespaced
  // activityType and carries exactly one featured item (the current phrase).
  for (const c of interludes) {
    assert.match(c.spec.activityType, /^(wordfall|drift):/, "interlude spec is a namespaced pack activity")
    assert.equal(c.spec.itemRefs.length, 1, "interlude features exactly one phrase")
    assert.equal(c.spec.itemRefs[0].kind, "phrase")
    assert.equal(c.meta.estSec, 30, "interlude carries the pack's typicalDurationSec")
  }
})

test("never two interludes back-to-back (the shared floor holds)", async () => {
  const h = await makeEngine({ arcs: 3, unitsPerArc: 3, itemsPerSkill: 8 })
  const { cards } = runSession(h, 40, CONS())

  const interludePositions = cards
    .map((c, i) => (isInterlude(c) ? i : -1))
    .filter((i) => i >= 0)
  assert.ok(interludePositions.length >= 2, "several interludes over a long session")
  for (let k = 1; k < interludePositions.length; k++) {
    const gap = interludePositions[k] - interludePositions[k - 1]
    assert.ok(
      gap >= INTERLUDE_BACK_TO_BACK_FLOOR,
      `interludes ${gap} apart must be >= ${INTERLUDE_BACK_TO_BACK_FLOOR} (no two back-to-back)`,
    )
  }
})

test("a cold stretch prefers a GAME spike; a hot combo prefers a READER breath", async () => {
  // Cold: combo 0 → first eligible interlude is a game (re-ignite).
  const cold = await makeEngine({ arcs: 3, unitsPerArc: 3, itemsPerSkill: 8 })
  const coldCards = runSession(cold, 30, CONS({ combo: 0 })).cards.filter(isInterlude)
  assert.equal(coldCards[0]?.meta.provider, "wordfall", "cold stretch opens with a game spike")

  // Hot: a high combo → once BOTH kinds are eligible, a reader breath is
  // preferred (comedown). Reader cadence is longer, so we run long enough for a
  // reader to become eligible and assert at least one drift appears under heat.
  const hot = await makeEngine({ arcs: 3, unitsPerArc: 3, itemsPerSkill: 8 })
  const hotCards = runSession(hot, 40, CONS({ combo: 8 })).cards.filter(isInterlude)
  assert.ok(
    hotCards.some((c) => c.meta.provider === "drift"),
    "a hot session still schedules a reader breath",
  )
})

test("no interlude packs installed ⇒ a native-only feed (no pack cards)", async () => {
  const h = await makeEngine({ arcs: 2, unitsPerArc: 2, itemsPerSkill: 6 })
  const { cards } = runSession(h, 20, { availableProviders: ["native"] })
  assert.equal(cards.filter(isInterlude).length, 0, "no interludes without installed packs")
})

test("game interlude respects its own ~1-in-12–18 cadence; reader its ~1-in-20–30", async () => {
  const h = await makeEngine({ arcs: 3, unitsPerArc: 3, itemsPerSkill: 8 })
  const { cards } = runSession(h, 40, CONS())
  const gamePos = cards.map((c, i) => (c.meta.provider === "wordfall" ? i : -1)).filter((i) => i >= 0)
  const readerPos = cards.map((c, i) => (c.meta.provider === "drift" ? i : -1)).filter((i) => i >= 0)
  for (let k = 1; k < gamePos.length; k++) {
    assert.ok(gamePos[k] - gamePos[k - 1] >= GAME_INTERLUDE_MIN_GAP, "game gap >= min")
  }
  for (let k = 1; k < readerPos.length; k++) {
    assert.ok(readerPos[k] - readerPos[k - 1] >= READER_INTERLUDE_MIN_GAP, "reader gap >= min")
  }
})

