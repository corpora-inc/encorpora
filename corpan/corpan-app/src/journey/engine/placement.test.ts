// engine.md §8.2 placement — ladder + R10 ceiling + zero-beginner +
// placeUser equivalence + lazy priorKnown seeding.

import { test } from "node:test"
import assert from "node:assert/strict"

import type { EngineCard, ProbeResult } from "./types.ts"
import { answer, makeEngine } from "./__fixtures__/harness.ts"

async function runPlacement(
  respond: (itemB: number) => boolean,
  fixtureOpts: Parameters<typeof makeEngine>[0] = {},
) {
  const h = await makeEngine(fixtureOpts)
  h.engine.startSession()
  const controller = h.engine.startPlacement("probe")
  const transcript: ProbeResult[] = []
  for (;;) {
    const card: EngineCard | undefined = controller.next()
    if (!card) break
    const ref = card.spec.itemRefs[0]
    const itemId = `${ref.kind}:${ref.source}:${ref.id}`
    const correct = respond(h.graph.items[itemId]?.b ?? 0)
    transcript.push({ itemId, correct, latencyMs: 2500 })
    // probes route through the normal applyResult path (engine forwards)
    h.engine.applyResult(answer(card, { pass: correct }))
  }
  const outcome = controller.finalize()
  return { h, outcome, transcript }
}

test("all-correct ladder tops out ≤ max_b and above-content terminates Phase 2 early (R10)", async () => {
  // ceiling at b = −1: an all-correct learner blows past it fast
  const { h, outcome, transcript } = await runPlacement(() => true, { bMax: -1 })
  assert.equal(outcome.record.outcome, "above-content")
  assert.ok(transcript.length <= 20, `Phase-2 budget respected (${transcript.length})`)
  // never probed above max_b
  for (const a of outcome.record.asked) assert.ok(a.b <= -1 + 1e-9)
  // frontier = end of shipped content (R10): the LAST unit's skills — a
  // usable in-pack frontier, not an empty list; every skill provisionally
  // unlocked; θ̂ pinned to "just past the ceiling" (no items above max_b ⇒
  // no discriminating support beyond it)
  const lastUnit = h.graph.units[h.graph.units.length - 1]
  assert.deepEqual([...outcome.frontier].sort(), [...lastUnit.skillIds].sort())
  assert.ok(outcome.unlockedSkills.length > 0)
  assert.equal(outcome.record.theta, -1 + 0.5) // maxB + PLACEMENT_ABOVE_CONTENT_MARGIN
})

test("narrow-band pack (R10): mid-band learner places IN BAND — never 'above-content' off two ladder passes", async () => {
  // the real journey_en shape: b ∈ [−3.5, −1.5]; a 1PL responder with true
  // ability at the band midpoint (−2.5). Pre-fix, the global-ladder rungs
  // collapsed to [−3, −1.5], both passed, and θ̂ exited "above-content"
  // pinned above the ceiling with se ≈ 1.9 (W10 P8 FAIL on the real pack).
  const { outcome, transcript } = await runPlacement((b) => b < -2.5, {
    bMin: -3.5,
    bMax: -1.5,
  })
  assert.ok(transcript.length <= 25, `asked ${transcript.length}`)
  assert.equal(outcome.record.outcome, "placed")
  assert.ok(
    Math.abs(outcome.record.theta - -2.5) <= 0.6,
    `θ̂ ${outcome.record.theta} within ±0.6 of the responder's −2.5 threshold`,
  )
})

test("1PL responder with true ability −1.2 places mid-course within 25 items", async () => {
  const { outcome, transcript } = await runPlacement((b) => b < -1.2)
  assert.ok(transcript.length <= 25, `asked ${transcript.length}`)
  assert.equal(outcome.record.outcome, "placed")
  assert.ok(
    outcome.record.theta > -2.6 && outcome.record.theta < 0,
    `θ̂ ${outcome.record.theta} near the responder's threshold`,
  )
  // only skills comfortably below θ̂ unlocked
  assert.ok(outcome.unlockedSkills.length > 0)
})

test("zero-beginner path: no cards, θ = −4, frontier = root skills", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  const controller = h.engine.startPlacement("zero-beginner")
  assert.equal(controller.next(), undefined)
  const outcome = controller.finalize()
  assert.equal(outcome.record.outcome, "skipped-zero-beginner")
  assert.equal(outcome.record.theta, -4)
  assert.equal(outcome.unlockedSkills.length, 0)
  assert.ok(outcome.frontier.every((s) => h.graph.skills[s].prereqs.length === 0))
  assert.equal(outcome.startUnitId, h.graph.units[0].unitId)
  const persisted = await h.persistence.itemCards.getAll()
  assert.equal(persisted.size, 0, "placement creates no cards")
})

test("placeUser(transcript) ≡ interactive controller (bit-identical outcome)", async () => {
  // deterministic responder keyed on item b via the graph
  const first = await runPlacement(() => true, { bMax: 0.5 })
  const h2 = await makeEngine({ bMax: 0.5 })
  h2.engine.startSession()
  const replayed = h2.engine.placeUser(first.transcript)
  assert.deepEqual(replayed.record.asked, first.outcome.record.asked)
  assert.equal(replayed.record.theta, first.outcome.record.theta)
  assert.equal(replayed.record.outcome, first.outcome.record.outcome)
  assert.deepEqual([...replayed.unlockedSkills].sort(), [...first.outcome.unlockedSkills].sort())
  assert.equal(replayed.startUnitId, first.outcome.startUnitId)
})

test("lazy priorKnown seeding: no cards at finalize; first encounter creates Easy+Good card with both flags", async () => {
  const { h, outcome } = await runPlacement(() => true, { bMax: 0.5 })
  assert.ok(outcome.unlockedSkills.length > 0, "placement unlocked skills")
  assert.equal((await h.persistence.itemCards.getAll()).size, 0, "no eager card creation")
  // now serve the feed; TRICKLE surfaces the placed backlog
  h.engine.startSession()
  let seeded = 0
  for (let b = 0; b < 6 && seeded === 0; b++) {
    const cards = h.engine.nextFeedItems(10, { availableProviders: ["native"] })
    if (cards.length === 0) break
    for (const card of cards) h.engine.applyResult(answer(card))
    await h.engine.flush()
    const persisted = await h.persistence.itemCards.getAll()
    for (const [, c] of persisted) {
      if ((c.flags & 1) !== 0 && (c.flags & 2) !== 0) {
        seeded += 1
        assert.ok(c.fsrs.reps >= 3, "seed (Easy+Good) plus the graded encounter")
      }
    }
  }
  assert.ok(seeded > 0, "a placement-seeded card was created lazily on encounter")
})

test("probe results never create cards and never enter grading", async () => {
  const { h, transcript } = await runPlacement(() => true, { bMax: 0.5 })
  assert.ok(transcript.length > 0)
  assert.equal((await h.persistence.itemCards.getAll()).size, 0)
})
