// engine.md §8.2 — small-module cases: rng, flow, forms, leech, latency,
// theta, strands, pools.

import { test } from "node:test"
import assert from "node:assert/strict"

import { DAY_MS } from "./clock.ts"
import { LEECH_LAPSES, LEECH_REPS_RATIO, LEECH_SUSPEND_EXTRA_LAPSES } from "./constants.ts"
import { classifyFlow } from "./flow.ts"
import { chooseForm, productionReady, ratchetForm } from "./forms.ts"
import { buildGraphIndex } from "./graph.ts"
import { expectedLatency, lengthScale, updateLatencyBaseline } from "./latency.ts"
import { checkLeech, leechTypeAllowed, recordLeechServing } from "./leech.ts"
import { createMastery } from "./mastery.ts"
import { buildPools, duePriority, type PoolsInput } from "./pools.ts"
import { createRng, deriveSessionSeed, fnv1a32, mulberry32, weightedPick } from "./rng.ts"
import { createScheduler } from "./scheduler.ts"
import { creditStrand, languageShareLast40, mostDeficientStrand, strandShares } from "./strands.ts"
import { sigmoid, updateTheta } from "./theta.ts"
import { CardFlags, type CourseState, type ItemCard, type SessionState, type SkillScalars } from "./types.ts"
import { makeFixtureGraph } from "./__fixtures__/fixtureGraph.ts"

const DAY = 20_000

// ---- rng --------------------------------------------------------------------

test("rng: canonical vectors + deterministic sampling helpers", () => {
  assert.equal(fnv1a32(""), 0x811c9dc5)
  assert.equal(fnv1a32("a"), 0xe40c292c)
  assert.equal(fnv1a32("foobar"), 0xbf9cf968)
  const a = mulberry32(42)
  const b = mulberry32(42)
  for (let i = 0; i < 100; i++) assert.equal(a(), b())
  assert.equal(
    deriveSessionSeed("s", "c", 3),
    fnv1a32("s:c:3"),
  )
  const rng = createRng(7)
  const rng2 = createRng(7)
  assert.equal(rng.gauss(0, 1), rng2.gauss(0, 1))
  assert.equal(weightedPick(rng, [["a", 0], ["b", 5]] as const), "b")
  assert.equal(weightedPick(rng, []), undefined)
})

// ---- flow --------------------------------------------------------------------

test("flow: cold window normal; cruise/struggle at exact thresholds", () => {
  const w = (scores: number[], z = 0) => scores.map((score) => ({ score, latencyZ: z }))
  assert.equal(classifyFlow(w([1, 1, 1])), "normal", "cold window (<4)")
  assert.equal(classifyFlow(w([1, 1, 1, 1, 1, 1, 1, 1])), "cruise")
  assert.equal(classifyFlow(w([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9])), "cruise", "perf 0.9 exactly")
  assert.equal(classifyFlow(w([0.89, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9])), "normal")
  assert.equal(classifyFlow(w([0, 0, 0, 1, 1, 1, 1, 1])), "struggle", "3 fails")
  assert.equal(classifyFlow(w([0.54, 0.54, 0.54, 0.54])), "struggle", "perf < 0.55")
  // latency penalty: perfect scores but everything slow ⇒ 1 − 0.15 = 0.85 < 0.9
  assert.equal(classifyFlow(w([1, 1, 1, 1, 1, 1, 1, 1], 1.5)), "normal")
})

// ---- forms -------------------------------------------------------------------

test("forms: ratchet, guessable never ratchets, struggle never escalates, productionReady 0.69/0.7", () => {
  const card: ItemCard = { itemId: "x", fsrs: { s: 5, d: 5, due: DAY, last: DAY, reps: 3, lapses: 0, state: 2 }, flags: 0, form: 1 }
  ratchetForm(card, 2, false, true)
  assert.equal(card.form, 2)
  card.form = 0
  ratchetForm(card, 2, true, true) // guessable pass never ratchets
  assert.equal(card.form, 0)
  ratchetForm(card, 2, false, false) // fails never promote
  assert.equal(card.form, 0)

  assert.equal(productionReady({ ...card, form: 1 }, 0.7), true)
  assert.equal(productionReady({ ...card, form: 1 }, 0.69), false)
  assert.equal(productionReady({ ...card, form: 0 }, 0.99), false)

  const rng = createRng(1)
  const c1: ItemCard = { ...card, form: 1 }
  for (let i = 0; i < 50; i++) {
    assert.ok(chooseForm(c1, "struggle", 0.9, rng) <= 1, "struggle proposals never exceed card.form")
  }
  assert.equal(chooseForm(c1, "cruise", 0.9, rng), 2, "cruise prefers the ceiling")
  assert.equal(chooseForm(c1, "cruise", 0.5, rng), 1, "not productionReady ⇒ ceiling 1")
})

// ---- leech -------------------------------------------------------------------

test("leech: flag at exactly LEECH_LAPSES & ratio<LEECH_REPS_RATIO; suspend after 2 more; substitute enters NEW", () => {
  const graph = makeFixtureGraph()
  const gidx = buildGraphIndex(graph)
  const course = { leechSubstitutes: [], leechTypes: {}, newBoost: [] } as unknown as CourseState
  const cards = new Map<string, ItemCard>()
  const itemId = gidx.itemsByIntro[0]
  // reps chosen so reps/lapses < LEECH_REPS_RATIO once lapses hits the bar
  const leechyReps = Math.ceil(LEECH_LAPSES * LEECH_REPS_RATIO) - 1
  const card: ItemCard = { itemId, fsrs: { s: 1, d: 8, due: DAY, last: DAY, reps: leechyReps, lapses: LEECH_LAPSES - 1, state: 2 }, flags: 0, form: 0 }
  cards.set(itemId, card)
  assert.equal(checkLeech(card, gidx, course, cards).flagged, false, "one lapse short: not yet")
  card.fsrs.lapses = LEECH_LAPSES
  const flag = checkLeech(card, gidx, course, cards)
  assert.equal(flag.flagged, true)
  assert.equal((card.flags & CardFlags.Leech) !== 0, true)
  // high-ratio card never flags
  const solidReps = Math.ceil(LEECH_LAPSES * LEECH_REPS_RATIO) + 2
  const solid: ItemCard = { itemId: gidx.itemsByIntro[1], fsrs: { ...card.fsrs, reps: solidReps, lapses: LEECH_LAPSES }, flags: 0, form: 0 }
  assert.equal(checkLeech(solid, gidx, course, cards).flagged, false)
  // 2 further failures ⇒ suspend + substitute (ratio kept leechy)
  card.fsrs.lapses = LEECH_LAPSES + LEECH_SUSPEND_EXTRA_LAPSES
  card.fsrs.reps = Math.ceil((LEECH_LAPSES + LEECH_SUSPEND_EXTRA_LAPSES) * LEECH_REPS_RATIO) - 1
  const sus = checkLeech(card, gidx, course, cards)
  assert.equal(sus.suspended, true)
  assert.equal((card.flags & CardFlags.Suspended) !== 0, true)
  assert.ok(sus.substituteId, "substitute promoted")
  assert.ok(course.leechSubstitutes.includes(sus.substituteId!))
  // presentation swap bookkeeping
  recordLeechServing(course, itemId, "cloze")
  recordLeechServing(course, itemId, "word_order")
  recordLeechServing(course, itemId, "flip_recall")
  assert.equal(leechTypeAllowed(course, itemId, "word_order"), false)
  assert.equal(leechTypeAllowed(course, itemId, "cloze"), true, "only the last two block")
})

// ---- latency ------------------------------------------------------------------

test("latency: seeds at n=0, EWMA on correct only (caller-gated), lengthScale clamps", () => {
  const baselines: CourseState["latencyBaselines"] = {}
  assert.equal(lengthScale(3), 0.6)
  assert.equal(lengthScale(300), 2.5)
  assert.equal(lengthScale(30), 1)
  assert.equal(expectedLatency(baselines, "cloze", 30), 9000)
  updateLatencyBaseline(baselines, "cloze", 30, 4000)
  const after = expectedLatency(baselines, "cloze", 30)
  assert.ok(after < 9000 && after > 4000, "EWMA moved toward the observation")
  updateLatencyBaseline(baselines, "cloze", 30, -5) // garbage ignored
  assert.equal(expectedLatency(baselines, "cloze", 30), after)
})

// ---- theta ---------------------------------------------------------------------

test("theta: K decays 0.5 → 0.08; converges on a scripted 1PL responder", () => {
  const course = { theta: -3, thetaK: 0.5, resultCount: 0 } as CourseState
  const trueAbility = 0.5
  for (let i = 0; i < 200; i++) {
    const b = trueAbility + ((i % 5) - 2) * 0.4
    updateTheta(course, sigmoid(trueAbility - b) > 0.5 ? 1 : 0, b)
  }
  assert.ok(Math.abs(course.theta - trueAbility) < 1, `θ ${course.theta} near ${trueAbility}`)
  assert.equal(course.thetaK, 0.08, "K floor reached")
})

// ---- strands -------------------------------------------------------------------

test("strands: 2-week shares, deficit pick, last-40 language share", () => {
  const course = { strandTally: [] } as unknown as CourseState
  creditStrand(course, "language", 60_000, DAY)
  creditStrand(course, "input", 20_000, DAY)
  creditStrand(course, "input", 20_000, DAY - 1)
  const shares = strandShares(course, DAY)
  assert.ok(Math.abs(shares[2] - 0.6) < 1e-9)
  assert.ok(Math.abs(shares[0] - 0.4) < 1e-9)
  // A1 targets [.3,.1,.4,.2]: fluency missing 0.2 is the worst gap
  assert.equal(mostDeficientStrand(course, DAY, "A1"), "fluency")
  const session = { last40: [] } as unknown as SessionState
  for (let i = 0; i < 30; i++) {
    session.last40.push({ activityType: "cloze", strand: i < 24 ? "language" : "input", itemIds: [] })
  }
  assert.ok(languageShareLast40(session) > 0.65)
})

// ---- pools ---------------------------------------------------------------------

test("pools: DUE priority formula ordering, suspended exclusion, NEW introOrder + cap, FUN R>0.9", () => {
  const graph = makeFixtureGraph({ itemsPerSkill: 6 })
  const gidx = buildGraphIndex(graph)
  const scheduler = createScheduler()
  const cards = new Map<string, ItemCard>()
  const skills = new Map<string, SkillScalars>()
  const mastery = createMastery({ gidx, cards, skills, scheduler })
  const nowMs = DAY * DAY_MS + 12 * 3_600_000

  // two overdue cards with different importance/lapses; one suspended
  const [i1, i2, i3] = gidx.itemsByIntro
  for (const [itemId, lapses] of [[i1, 0], [i2, 3], [i3, 0]] as const) {
    const card: ItemCard = { itemId, fsrs: scheduler.emptyCard(DAY - 30), flags: 0, form: 0 }
    card.fsrs = scheduler.next(card, (DAY - 30) * DAY_MS, 3).fsrs
    card.fsrs.lapses = lapses
    card.fsrs.due = DAY - 5
    cards.set(itemId, card)
  }
  cards.get(i3)!.flags |= CardFlags.Suspended
  // a strong-known card for FUN
  const funId = gidx.itemsByIntro[5]
  const funCard: ItemCard = { itemId: funId, fsrs: scheduler.emptyCard(DAY), flags: 0, form: 0 }
  funCard.fsrs = scheduler.next(funCard, nowMs - 3_600_000, 4).fsrs
  funCard.fsrs.due = DAY + 20
  cards.set(funId, funCard)

  const course = {
    newPerDay: 4,
    newIntroducedToday: 1,
    position: { arcId: "arc-0", unitId: "unit-00", unitOrdinal: 0 },
    leechSubstitutes: [],
    newBoost: [],
  } as unknown as CourseState
  const session = { debuts: new Map(), flow: { window: [], mode: "normal" } } as unknown as SessionState

  const input: PoolsInput = { gidx, cards, skills, course, session, mastery, scheduler, nowMs, day: DAY }
  const pools = buildPools(input)

  assert.ok(!pools.due.includes(i3), "suspended excluded")
  // priority: same R (same schedule), i2 has lapses ⇒ higher priority
  const r1 = pools.r.get(i1)!
  const item1 = graph.items[i1]
  const item2 = graph.items[i2]
  const p1 = duePriority(r1, item1.importance, 0)
  const p2 = duePriority(pools.r.get(i2)!, item2.importance, 3)
  assert.equal(pools.due[0], p2 > p1 ? i2 : i1, "DUE sorted by the priority formula")
  // NEW: introOrder order, minus carded items, capped at newPerDay − introduced = 3
  assert.equal(pools.new.length, 3)
  const intros = pools.new.map((id) => graph.items[id].introOrder)
  assert.deepEqual([...intros].sort((a, b) => a - b), intros)
  assert.ok(!pools.new.includes(i1))
  // FUN: only the fresh R>0.9 card (match_pairs has funWeight in the fixture)
  assert.ok(pools.fun.includes(funId))
  assert.ok(!pools.fun.includes(i1), "overdue low-R cards are not FUN material")
})
