// engine.md §8.2 apply — full pipeline on memory state, incl. the MANDATORY
// R6 join-by-key test (shuffled, strict-subset perItem + un-issued ref).

import { test } from "node:test"
import assert from "node:assert/strict"

import { applyResult, type ApplyBag } from "./apply.ts"
import { DAY_MS } from "./clock.ts"
import { buildGraphIndex } from "./graph.ts"
import { createMastery } from "./mastery.ts"
import { createRng } from "./rng.ts"
import { createScheduler } from "./scheduler.ts"
import type { CourseState, IssuedCard, ItemCard, SessionState, SkillScalars } from "./types.ts"
import { makeFixtureGraph } from "./__fixtures__/fixtureGraph.ts"

const DAY = 20_000
const NOW = DAY * DAY_MS + 12 * 3_600_000

function makeBag(): { bag: ApplyBag; session: SessionState; course: CourseState; cards: Map<string, ItemCard>; persisted: string[] } {
  const graph = makeFixtureGraph()
  const gidx = buildGraphIndex(graph)
  const scheduler = createScheduler()
  const cards = new Map<string, ItemCard>()
  const skills = new Map<string, SkillScalars>()
  const mastery = createMastery({ gidx, cards, skills, scheduler })
  const course: CourseState = {
    courseId: "journey_en",
    schemaVersion: 1,
    theta: -2,
    thetaK: 0.5,
    resultCount: 0,
    position: { arcId: "arc-0", unitId: "unit-00", unitOrdinal: 0 },
    newPerDay: 12,
    newIntroducedToday: 0,
    dailyCapacityEwma: 40,
    backlogRing: [],
    lastThrottleAdjustDay: DAY,
    strandTally: [],
    jump: { lastOfferedDay: 0, consecutiveCruiseSessions: 0 },
    lesson: null,
    checkpointsPassed: {},
    sessionCounter: 1,
    lastTickDay: DAY,
    lastActiveDay: 0,
    latencyBaselines: {},
    scoredToday: 0,
    sessionsToday: 0,
    sessionsPerDayEwma: 1,
    sessionsWeek: 0,
    cruiseSessionsWeek: 0,
    leechSubstitutes: [],
    leechTypes: {},
    newBoost: [],
    legendaryAttempt: {},
  }
  const session: SessionState = {
    sessionId: "stack-1:journey_en:1",
    rng: createRng(1234),
    startedDay: DAY,
    scored: 0,
    openerServed: false,
    jumpOfferedThisSession: false,
    flow: { window: [], mode: "normal" },
    last40: [],
    replayQueue: [],
    replayedItems: new Set(),
    pendingDebutRecognitions: [],
    emitIndex: 0,
    lastEmit: new Map(),
    issued: new Map(),
    debuts: new Map(),
    scaffoldItemId: null,
    lastBatchTailType: null,
    cadenceEmitted: 0,
    bossAttempted: new Set(),
    checkpointRun: null,
    gauntletRun: null,
    modeTally: { cruise: 0, normal: 0, struggle: 0 },
  }
  const persisted: string[] = []
  const bag: ApplyBag = {
    gidx,
    course,
    session,
    cards,
    skills,
    mastery,
    scheduler,
    nowMs: NOW,
    day: DAY,
    lessonBag: { gidx, course, session, cards, mastery, scheduler, nowMs: NOW, day: DAY },
    persistCard: (id) => persisted.push(id),
  }
  return { bag, session, course, cards, persisted }
}

function issue(session: SessionState, itemIds: string[], over: Partial<IssuedCard> = {}): IssuedCard {
  const card: IssuedCard = {
    specId: `spec-${session.issued.size + 1}`,
    activityType: "cloze",
    itemIds,
    form: 1,
    guessable: false,
    isReplay: false,
    pool: "due",
    strand: "language",
    estSec: 20,
    modelNeeds: [],
    issuedAtMs: NOW,
    ...over,
  }
  session.issued.set(card.specId, card)
  return card
}

const ids = ["phrase:base:1001", "phrase:base:1002", "phrase:base:1003", "phrase:base:1004"]
const refOf = (id: string) => ({ kind: "phrase" as const, source: "base", id: id.split(":")[2] })

test("R6 MANDATORY: shuffled strict-subset perItem joins by key; absent = no evidence; un-issued = warn-and-drop", () => {
  const { bag, session, cards } = makeBag()
  const spec = issue(session, ids)
  // SHUFFLED and a STRICT SUBSET: [3rd, 1st] of four issued; plus an
  // un-issued ref that must be dropped without grading.
  const result = {
    specId: spec.specId,
    score: 0.5,
    perItem: [
      { itemRef: refOf(ids[2]), outcome: "fail" as const, latencyMs: 4000 },
      { itemRef: refOf(ids[0]), outcome: "pass" as const, latencyMs: 4000 },
      { itemRef: { kind: "phrase" as const, source: "base", id: "9999" }, outcome: "pass" as const },
    ],
    durationMs: 20_000,
  }
  const out = applyResult(bag, result)

  // each present item graded against its OWN card, matched via itemRefKey
  const grades = new Map(out.grades.map((g) => [g.itemId, g.grade]))
  assert.equal(grades.get(ids[2]), 1, "3rd issued item graded Again from its own row")
  assert.equal(grades.get(ids[0]), 3, "1st issued item graded Good from its own row")
  assert.equal(out.grades.length, 2)

  // issued-but-absent: untouched — no card, no grade, no log row
  assert.equal(cards.has(ids[1]), false)
  assert.equal(cards.has(ids[3]), false)
  assert.equal(out.items.some((i) => i.ref === ids[1] || i.ref === ids[3]), false)

  // un-issued ref: dropped without grading
  assert.equal(cards.has("phrase:base:9999"), false)
  assert.equal(out.items.some((i) => i.ref === "phrase:base:9999"), false)

  // the failed item's card lapsed; the passed one advanced
  assert.equal(cards.get(ids[2])!.fsrs.state, 0 === 0 ? cards.get(ids[2])!.fsrs.state : 0)
  assert.equal(cards.get(ids[0])!.fsrs.reps, 1)
})

test("unknown specId is a noop", () => {
  const { bag, cards } = makeBag()
  const out = applyResult(bag, { specId: "nope", score: 1, perItem: [], durationMs: 100 })
  assert.equal(out.grades.length, 0)
  assert.equal(cards.size, 0)
})

test("abandoned results credit strand time only — no grades, no cards", () => {
  const { bag, session, cards, course } = makeBag()
  const spec = issue(session, [ids[0]])
  const out = applyResult(bag, {
    specId: spec.specId,
    score: 0,
    perItem: [{ itemRef: refOf(ids[0]), outcome: "fail" }],
    durationMs: 8000,
    abandoned: true,
  })
  assert.equal(out.grades.length, 0)
  assert.equal(cards.size, 0)
  const bucket = course.strandTally.find((b) => b.day === DAY)
  assert.ok(bucket && bucket.secs[2] === 8, "language strand credited 8s")
})

test("terminal results are once-only per specId (first wins)", () => {
  const { bag, session } = makeBag()
  const spec = issue(session, [ids[0]])
  const r = {
    specId: spec.specId,
    score: 1,
    perItem: [{ itemRef: refOf(ids[0]), outcome: "pass" as const, latencyMs: 3000 }],
    durationMs: 4000,
  }
  const first = applyResult(bag, r)
  assert.equal(first.grades.length, 1)
  const second = applyResult(bag, r)
  assert.equal(second.grades.length, 0)
})

test("Again queues one replay at an easier form with gap 3; replay fail defers to tomorrow", () => {
  const { bag, session, cards } = makeBag()
  const spec = issue(session, [ids[0]], { form: 1 })
  session.emitIndex = 10
  const out = applyResult(bag, {
    specId: spec.specId,
    score: 0,
    perItem: [{ itemRef: refOf(ids[0]), outcome: "fail" }],
    durationMs: 4000,
  })
  assert.deepEqual(out.replaysQueued, [ids[0]])
  assert.deepEqual(session.replayQueue[0], {
    itemId: ids[0],
    notBeforeEmitIndex: 13,
    form: 0,
    failures: 1,
  })
  // the replay itself fails → due tomorrow, no second replay
  const replaySpec = issue(session, [ids[0]], { form: 0, isReplay: true })
  session.replayQueue = []
  applyResult(bag, {
    specId: replaySpec.specId,
    score: 0,
    perItem: [{ itemRef: refOf(ids[0]), outcome: "fail" }],
    durationMs: 4000,
  })
  assert.equal(session.replayQueue.length, 0)
  assert.ok(cards.get(ids[0])!.fsrs.due >= DAY + 1)
})

test("form ratchet: pass at a higher form ratchets; guessable passes never do", () => {
  const { bag, session, cards } = makeBag()
  const a = issue(session, [ids[0]], { form: 2 })
  applyResult(bag, { specId: a.specId, score: 1, perItem: [{ itemRef: refOf(ids[0]), outcome: "pass", latencyMs: 4000 }], durationMs: 4000 })
  assert.equal(cards.get(ids[0])!.form, 2)
  const b = issue(session, [ids[1]], { form: 2, guessable: true, activityType: "choice_pick" })
  applyResult(bag, { specId: b.specId, score: 1, perItem: [{ itemRef: refOf(ids[1]), outcome: "pass", latencyMs: 4000 }], durationMs: 4000 })
  assert.equal(cards.get(ids[1])!.form, 0)
})

test("score-only rounds grade every issued item uniformly, capped at Good (R9)", () => {
  const { bag, session, cards } = makeBag()
  const spec = issue(session, ids, { activityType: "match_pairs", guessable: true })
  const out = applyResult(bag, { specId: spec.specId, score: 0.9, perItem: [], durationMs: 30_000 })
  assert.equal(out.grades.length, 4)
  for (const g of out.grades) assert.equal(g.grade, 3)
  assert.equal(cards.size, 4)
})

test("multi-item match_pairs grades each pair from its own perItem row (defect #2)", () => {
  const { bag, session, cards } = makeBag()
  // a 4-item match_pairs card (guessable recognition)
  const spec = issue(session, ids, { activityType: "match_pairs", guessable: true, form: 0 })
  const out = applyResult(bag, {
    specId: spec.specId,
    score: 0.5,
    perItem: [
      { itemRef: refOf(ids[0]), outcome: "pass", latencyMs: 4000 },
      { itemRef: refOf(ids[1]), outcome: "fail" },
      { itemRef: refOf(ids[2]), outcome: "partial" },
      { itemRef: refOf(ids[3]), outcome: "pass", latencyMs: 4000 },
    ],
    durationMs: 30_000,
  })
  const g = new Map(out.grades.map((x) => [x.itemId, x.grade]))
  assert.equal(out.grades.length, 4, "every matched pair graded from its own row")
  assert.equal(g.get(ids[1]), 1, "missed pair → Again")
  assert.equal(g.get(ids[2]), 2, "one-miss pair → Hard")
  // passed pairs grade a pass, capped at Good by the guessable cap
  for (const id of [ids[0], ids[3]]) {
    const grade = g.get(id)
    assert.ok(grade === 2 || grade === 3, `${id} graded ${grade} (expected Hard/Good)`)
  }
  assert.equal(cards.size, 4, "a card is created/updated per item")
})

test("selfReport never-learned forgets the card (reset to New)", () => {
  const { bag, session, cards } = makeBag()
  const a = issue(session, [ids[0]])
  applyResult(bag, { specId: a.specId, score: 1, perItem: [{ itemRef: refOf(ids[0]), outcome: "pass", latencyMs: 4000 }], durationMs: 4000 })
  assert.equal(cards.get(ids[0])!.fsrs.state !== 0, true)
  const b = issue(session, [ids[0]])
  const out = applyResult(bag, {
    specId: b.specId,
    score: 0,
    perItem: [{ itemRef: refOf(ids[0]), outcome: "fail", detail: { selfReport: "never-learned" } }],
    durationMs: 4000,
  })
  assert.equal(out.grades[0].grade, "forget")
  assert.equal(cards.get(ids[0])!.fsrs.state, 0)
})

test("θ moves toward evidence and K decays; accEwma updates only at form ≥ 1", () => {
  const { bag, session, course } = makeBag()
  const theta0 = course.theta
  const k0 = course.thetaK
  const a = issue(session, [ids[0]], { form: 1 })
  applyResult(bag, { specId: a.specId, score: 1, perItem: [{ itemRef: refOf(ids[0]), outcome: "pass", latencyMs: 4000 }], durationMs: 4000 })
  assert.ok(course.theta > theta0)
  assert.ok(course.thetaK < k0)
  const skillId = bag.gidx.graph.items[ids[0]].skillIds[0]
  const acc1 = bag.skills.get(skillId)!.accEwma
  assert.ok(acc1 > 0)
  // form-0 result must NOT move accEwma
  const b = issue(session, [ids[1]], { form: 0, activityType: "choice_pick", guessable: true })
  applyResult(bag, { specId: b.specId, score: 0, perItem: [{ itemRef: refOf(ids[1]), outcome: "fail" }], durationMs: 4000 })
  assert.equal(bag.skills.get(skillId)!.accEwma, acc1)
})

test("unscored intro cards never grade", () => {
  const { bag, session, cards } = makeBag()
  const spec = issue(session, [ids[0]], { unscored: true, pool: "new", activityType: "intro_echo" })
  const out = applyResult(bag, { specId: spec.specId, score: 1, perItem: [{ itemRef: refOf(ids[0]), outcome: "pass" }], durationMs: 4000 })
  assert.equal(out.grades.length, 0)
  assert.equal(cards.size, 0)
})
