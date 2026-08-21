// engine.md §8.2 mastery — memoization, level-table edges, demotion,
// multi-skill counting.

import { test } from "node:test"
import assert from "node:assert/strict"

import { DAY_MS } from "./clock.ts"
import { buildGraphIndex } from "./graph.ts"
import { createMastery } from "./mastery.ts"
import { createScheduler } from "./scheduler.ts"
import type { CourseGraph, ItemCard, SkillScalars } from "./types.ts"
import { makeFixtureGraph, nativeTemplates } from "./__fixtures__/fixtureGraph.ts"

const DAY = 20_000
const noon = (day: number): number => day * DAY_MS + 12 * 3_600_000

function setup(graph = makeFixtureGraph({ itemsPerSkill: 5 })) {
  const gidx = buildGraphIndex(graph)
  const scheduler = createScheduler()
  const cards = new Map<string, ItemCard>()
  const skills = new Map<string, SkillScalars>()
  const mastery = createMastery({ gidx, cards, skills, scheduler })
  const review = (itemId: string, day = DAY, grade: 1 | 2 | 3 | 4 = 3, form: 0 | 1 | 2 = 1): void => {
    const card = cards.get(itemId) ?? { itemId, fsrs: scheduler.emptyCard(day), flags: 0, form: 0 }
    card.fsrs = scheduler.next(card, noon(day), grade).fsrs
    if (grade >= 2 && form > card.form) card.form = form
    cards.set(itemId, card)
  }
  return { gidx, scheduler, cards, skills, mastery, review }
}

test("levels: locked → unlocked (prereqs ≥3) → learning → practiced at exact coverage edge", () => {
  const { gidx, skills, mastery, review } = setup()
  const s0 = "skill-00-0" // no prereqs
  const s1 = "skill-01-0" // prereq = skill-00-0
  assert.equal(mastery.levelOf(s0, noon(DAY)), 1, "root skill unlocked")
  assert.equal(mastery.levelOf(s1, noon(DAY)), 0, "gated skill locked")

  const items = gidx.skillItems.get(s0)!
  // 3/5 seen = coverage 0.6 < 0.8 ⇒ Learning even with strong acc
  skills.set(s0, { skillId: s0, accEwma: 0.9, announcedLevel: 0 })
  for (const id of items.slice(0, 3)) review(id)
  mastery.markDirty(s0)
  assert.equal(mastery.levelOf(s0, noon(DAY)), 2)
  // 4/5 seen = coverage 0.8 exactly ⇒ Practiced (strength ≈ 1 same-day)
  review(items[3])
  mastery.markDirty(s0)
  assert.equal(mastery.levelOf(s0, noon(DAY)), 3)
  // prereq now ≥3 ⇒ dependent unlocks
  assert.equal(mastery.levelOf(s1, noon(DAY)), 1)
})

test("mastered requires 0.95 coverage + every seen item form ≥ 1", () => {
  const { gidx, skills, mastery, review } = setup()
  const s0 = "skill-00-0"
  const items = gidx.skillItems.get(s0)!
  skills.set(s0, { skillId: s0, accEwma: 0.9, announcedLevel: 0 })
  for (const id of items) review(id, DAY, 4, 1)
  mastery.markDirty(s0)
  assert.equal(mastery.levelOf(s0, noon(DAY)), 4)
  // one item stuck at recognition form ⇒ not mastered
  const { skills: sk2, mastery: m2, review: r2, gidx: g2 } = setup()
  sk2.set(s0, { skillId: s0, accEwma: 0.9, announcedLevel: 0 })
  const items2 = g2.skillItems.get(s0)!
  for (const id of items2.slice(0, 4)) r2(id, DAY, 4, 1)
  r2(items2[4], DAY, 4, 0)
  m2.markDirty(s0)
  assert.equal(m2.levelOf(s0, noon(DAY)), 3)
})

test("demotion at strength < 0.5 (long-unreviewed) and accEwma < 0.5", () => {
  const { skills, mastery, review, gidx } = setup()
  const s0 = "skill-00-0"
  skills.set(s0, { skillId: s0, accEwma: 0.8, announcedLevel: 0 }) // Practiced band, below Mastered
  for (const id of gidx.skillItems.get(s0)!) review(id, DAY, 3, 1)
  mastery.markDirty(s0)
  assert.equal(mastery.levelOf(s0, noon(DAY)), 3)
  // 300 days later: R collapses ⇒ demote → 2 (wrong placement self-heals the same way)
  assert.equal(mastery.levelOf(s0, noon(DAY + 300)), 2)
  // acc collapse demotes too
  skills.get(s0)!.accEwma = 0.49
  mastery.markDirty(s0)
  assert.equal(mastery.levelOf(s0, noon(DAY)), 2)
})

test("placedAt with zero seen items derives provisional Practiced", () => {
  const { skills, mastery } = setup()
  skills.set("skill-02-0", { skillId: "skill-02-0", accEwma: 0.75, placedAt: DAY, announcedLevel: 0 })
  assert.equal(mastery.levelOf("skill-02-0", noon(DAY)), 3)
})

test("memoization: cached per (seq, day); applyResult-style dirty + day rollover invalidate", () => {
  const { mastery, review, gidx } = setup()
  const s0 = "skill-00-0"
  review(gidx.skillItems.get(s0)![0])
  mastery.markDirty(s0)
  const a = mastery.getSkillState(s0, noon(DAY))
  const b = mastery.getSkillState(s0, noon(DAY))
  assert.equal(a, b, "second same-day read returns the cached object")
  mastery.markDirty(s0)
  const c = mastery.getSkillState(s0, noon(DAY))
  assert.notEqual(a, c, "dirty seq forces recompute")
  const d = mastery.getSkillState(s0, noon(DAY + 1))
  assert.notEqual(c, d, "day rollover invalidates (strength decays)")
})

test("an item in k skills counts in each", () => {
  const graph: CourseGraph = {
    courseId: "journey_en",
    arcs: [{ arcId: "a", ordinal: 0, cefr: "A1" }],
    units: [{ unitId: "u", arcId: "a", ordinal: 0, skillIds: ["sA", "sB"] }],
    skills: {
      sA: { skillId: "sA", prereqs: [], itemIds: ["phrase:base:1"], b: -3, unitId: "u" },
      sB: { skillId: "sB", prereqs: [], itemIds: ["phrase:base:1"], b: -3, unitId: "u" },
    },
    items: {
      "phrase:base:1": {
        itemId: "phrase:base:1",
        ref: { kind: "phrase", source: "base", id: "1" },
        skillIds: ["sA", "sB"],
        b: -3,
        introOrder: 1,
        importance: 1,
        textLen: 20,
        kind: "phrase",
      },
    },
    activityTemplates: nativeTemplates(),
    lessonRecipes: {},
    unitLessons: {},
    checkpoints: [],
    rareCards: [],
  }
  const { mastery, review } = setup(graph)
  review("phrase:base:1")
  mastery.markDirty("sA")
  mastery.markDirty("sB")
  assert.equal(mastery.getSkillState("sA", noon(DAY)).coverage, 1)
  assert.equal(mastery.getSkillState("sB", noon(DAY)).coverage, 1)
})
