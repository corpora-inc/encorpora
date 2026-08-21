// engine.md §8.2 lessons — recipe slots, boss batches, pass_score gating,
// REPAIR routing, cadence checkpoints, welcomeBack, rare determinism.

import { test } from "node:test"
import assert from "node:assert/strict"

import { DAY_MS } from "./clock.ts"
import { buildGraphIndex } from "./graph.ts"
import { rollRare, type LessonBag } from "./lessons.ts"
import { createMastery } from "./mastery.ts"
import { createRng } from "./rng.ts"
import { createScheduler } from "./scheduler.ts"
import type { EngineCard, ItemCard, SkillScalars } from "./types.ts"
import { answer, makeEngine, playBatch, type Harness } from "./__fixtures__/harness.ts"
import { makeFixtureGraph } from "./__fixtures__/fixtureGraph.ts"

const CONS = { availableProviders: ["native"] }

/** Play batches until the unit boss appears (or budget runs out). */
async function reachBoss(h: Harness, opts: { failBoss?: boolean; bossScore?: number } = {}): Promise<{
  boss: EngineCard[] | null
  outcome?: { checkpointId: string; passed: boolean; score: number }
}> {
  for (let day = 0; day < 30; day++) {
    h.engine.startSession()
    for (let b = 0; b < 6; b++) {
      const cards = h.engine.nextFeedItems(10, CONS)
      if (cards.length === 0) break
      if (cards.every((c) => c.meta.checkpoint && c.meta.checkpoint.passScore > 0)) {
        // the boss batch — answer it per opts
        let out: { checkpointId: string; passed: boolean; score: number } | undefined
        for (const card of cards) {
          const score = opts.bossScore ?? (opts.failBoss ? 0 : 1)
          const res = h.engine.applyResult(answer(card, { pass: score >= 0.5, score }))
          if (res.checkpoint) out = res.checkpoint
        }
        return { boss: cards, outcome: out }
      }
      playBatch(h.engine, cards)
    }
    h.clock.advance(DAY_MS)
  }
  return { boss: null }
}

test("lesson recipes shape the first session; boss batch follows plan exhaustion", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  const first = h.engine.nextFeedItems(10, CONS)
  // the recipe's new.intro slot appears (intro_echo) in the first batch
  assert.ok(first.some((c) => c.spec.activityType === "intro_echo"), "recipe intro slot filled")
  playBatch(h.engine, first)
  const { boss, outcome } = await reachBoss(h)
  assert.ok(boss, "unit boss emitted after the lesson plan")
  assert.ok(boss!.length >= 2)
  const cp = boss![0].meta.checkpoint!
  assert.equal(cp.checkpointId, "cp-unit-00")
  assert.equal(cp.scope, "unit")
  assert.equal(cp.count, boss!.length)
  assert.equal(cp.summary.passScore, cp.passScore)
  assert.ok(cp.summary.skillIds.length > 0)
  assert.ok(outcome, "final boss card settles the batch")
})

test("pass at exactly passScore advances position; 0.01 below holds it and routes REPAIR", async () => {
  // exact pass
  const h1 = await makeEngine({ passScore: 0.7 })
  h1.engine.startSession()
  const r1 = await reachBoss(h1, { bossScore: 0.7 })
  assert.ok(r1.outcome)
  assert.equal(r1.outcome!.passed, true)
  assert.equal(h1.engine.getCourseSnapshot().position.unitId, "unit-01")

  // 0.01 below
  const h2 = await makeEngine({ passScore: 0.7 })
  h2.engine.startSession()
  const r2 = await reachBoss(h2, { bossScore: 0.69 })
  assert.ok(r2.outcome)
  assert.equal(r2.outcome!.passed, false)
  assert.equal(h2.engine.getCourseSnapshot().position.unitId, "unit-00", "position holds")
  // weak items' skills route to REPAIR: repair-pool cards appear in
  // normal-mode sessions (cruise folds repair into new by design, §5.3.1)
  let repairSeen = false
  for (let s = 0; s < 3 && !repairSeen; s++) {
    h2.engine.startSession()
    for (let b = 0; b < 6 && !repairSeen; b++) {
      const cards = h2.engine.nextFeedItems(10, CONS)
      if (cards.length === 0) break
      repairSeen = cards.some((c) => c.meta.pool === "repair")
      playBatch(h2.engine, cards, (c, i) => (c.meta.checkpoint ? true : i % 3 !== 2)) // ~67% pass ⇒ normal mode
    }
  }
  assert.ok(repairSeen, "REPAIR pool serves the failed checkpoint's material")
})

test("cadence checkpoint appears every checkpointCadence cards (non-graded face)", async () => {
  const h = await makeEngine({ withLessons: false, withCheckpoints: false })
  h.engine.startSession()
  const seenAt: number[] = []
  let emitted = 0
  for (let b = 0; b < 4; b++) {
    const cards = h.engine.nextFeedItems(10, { ...CONS, checkpointCadence: 5 })
    if (cards.length === 0) break
    for (const c of cards) {
      if (c.meta.checkpoint && c.meta.checkpoint.passScore === 0) seenAt.push(emitted)
      emitted += 1
    }
    playBatch(h.engine, cards)
  }
  assert.ok(seenAt.length >= 2, `cadence checkpoints at ${seenAt.join(",")}`)
})

test("welcomeBack fires at gap 7, not 6, with retainedPct = mean R", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  for (let b = 0; b < 3; b++) {
    const cards = h.engine.nextFeedItems(10, CONS)
    if (cards.length === 0) break
    playBatch(h.engine, cards) // scored recognitions set lastActiveDay
  }
  h.clock.advance(6 * DAY_MS)
  assert.equal(h.engine.startSession().welcomeBack, undefined, "gap 6 stays silent")
  h.clock.advance(1 * DAY_MS)
  const wb = h.engine.startSession().welcomeBack
  assert.ok(wb, "gap 7 fires")
  assert.equal(wb!.gapDays, 7)
  assert.ok(wb!.retainedPct > 0 && wb!.retainedPct <= 1)
})

test("rareVariant draw is seed-deterministic over graph.rareCards", () => {
  const graph = makeFixtureGraph()
  const gidx = buildGraphIndex(graph)
  const scheduler = createScheduler()
  const cards = new Map<string, ItemCard>()
  const skills = new Map<string, SkillScalars>()
  const mastery = createMastery({ gidx, cards, skills, scheduler })
  const bag = {
    gidx,
    course: {
      position: { arcId: "arc-0", unitId: "unit-00", unitOrdinal: 0 },
    },
    cards,
    mastery,
    scheduler,
    nowMs: 0,
    day: 20_000,
  } as unknown as LessonBag
  const draws = (_seed: number): string =>
    JSON.stringify(
      Array.from({ length: 200 }, (_, i) => i).map(() => {
        const roll = rollRare(bag, createRngOnce(), ["native", "lingo_hero"])
        return roll?.rareVariant ?? "-"
      }),
    )
  let counter = 0
  function createRngOnce() {
    counter += 1
    return createRng(counter)
  }
  counter = 0
  const a = draws(1)
  counter = 0
  const b = draws(1)
  assert.equal(a, b, "identical seeds ⇒ identical rare draws")
  // story cards never roll (R11); ratios roughly match 1:8 + 1:25 + 1:50
  const parsed = JSON.parse(a) as string[]
  assert.ok(!parsed.includes("storyChapter"))
  const hits = parsed.filter((x) => x !== "-").length
  assert.ok(hits > 10 && hits < 80, `rare rate ${hits}/200`)
})
