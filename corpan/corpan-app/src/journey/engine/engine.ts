// journey/engine/engine.ts — the JourneyEngine facade (engine.md §4).
// Owns EngineState, orchestrates persistence staging/flush and lazy tickDay.
// nextFeedItems/applyResult are SYNCHRONOUS — all state is in memory after
// load(); persistence is staged, never awaited.

import {
  CRUISE_SESSION_MIN_SCORED,
  CAPACITY_SEED,
  JUMP_MISTAKES_FAR,
  JUMP_MISTAKES_NEAR,
  JUMP_NEAR_LAYERS,
  JUMP_PROBES_PER_LAYER,
  LEGENDARY_ITEMS_MAX,
  LEGENDARY_ITEMS_MIN,
  LEGENDARY_MISTAKES_ALLOWED,
  MAX_TICKDAY_ITERATIONS,
  NEW_PER_DAY_DEFAULT,
  ENGINE_SCHEMA,
  THETA_DEFAULT,
  THETA_K_START,
} from "./constants.ts"
import { applyResult as applyResultPipeline, type ApplyBag } from "./apply.ts"
import type { Clock } from "./clock.ts"
import { tickOneDay, type DailyBag } from "./daily.ts"
import { buildGraphIndex, type GraphIndex } from "./graph.ts"
import { computeWelcomeBack, initLessonCursor, type LessonBag } from "./lessons.ts"
import { createMastery, type Mastery } from "./mastery.ts"
import { isDebtBrakeActive, nextFeedItems as mixerNext, type MixerBag, type MixerTelemetry } from "./mixer.ts"
import {
  createPlacementController,
  placeUser as placeUserBatch,
  type PlacementController,
} from "./placement.ts"
import { dueCount } from "./pools.ts"
import { createMemoryPersistence } from "./persistence/memory.ts"
import { projectActivityEvents, recoverEngineState } from "./persistence/recover.ts"
import type { JourneyPersistence } from "./persistence/types.ts"
import { itemCardCodec } from "./persistence/types.ts"
import { createRng, deriveSessionSeed, weightedPick } from "./rng.ts"
import { createScheduler, JOURNEY_FSRS_PARAMS, type Scheduler } from "./scheduler.ts"
import { strandShares } from "./strands.ts"
import { CardFlags } from "./types.ts"
import type {
  ActivityResult,
  ApplyOutcome,
  CourseGraph,
  CourseSnapshot,
  CourseState,
  DayRollover,
  EngineCard,
  EngineKey,
  FeedConstraints,
  ItemCard,
  PlacementOutcome,
  ProbeResult,
  RecoveryReport,
  SessionState,
  SkillScalars,
  SkillState,
} from "./types.ts"

export { JOURNEY_FSRS_PARAMS, createMemoryPersistence, itemCardCodec }

/** Cap on items queued by one PathViz unit-review tap. */
const UNIT_REVIEW_ITEMS_MAX = 8

export interface JourneyEngine {
  load(): Promise<{ fresh: boolean; recovered: RecoveryReport }>
  startSession(): {
    sessionId: string
    needsPlacement: boolean
    welcomeBack?: { gapDays: number; retainedPct: number }
  }
  startPlacement(mode: "probe" | "zero-beginner"): PlacementController
  placeUser(probeResults: ProbeResult[]): PlacementOutcome
  nextFeedItems(n?: number, constraints?: FeedConstraints): EngineCard[]
  applyResult(result: ActivityResult): ApplyOutcome
  tickDay(): DayRollover
  getSkillState(skillId: string): SkillState
  getCourseSnapshot(): CourseSnapshot
  requestJump(targetSkillId?: string): EngineCard[] | undefined
  requestLegendary(skillId: string): EngineCard[] | undefined
  /** PathViz tap-to-review: enqueue a practiced unit's seen items as session
   *  replays (unmetered; once-per-session per item). False = nothing to
   *  review yet (locked/unseen unit). */
  requestUnitReview(unitId: string): boolean
  flush(): Promise<void>
  /** Mixer/starvation telemetry (simulation gate + debug panel). */
  getTelemetry(): MixerTelemetry
}

export function createJourneyEngine(deps: {
  key: EngineKey
  graph: CourseGraph
  persistence: JourneyPersistence
  clock: Clock
}): JourneyEngine {
  const { key, persistence, clock } = deps
  const gidx: GraphIndex = buildGraphIndex(deps.graph)
  const scheduler: Scheduler = createScheduler()
  const cards = new Map<string, ItemCard>()
  const skills = new Map<string, SkillScalars>()
  const mastery: Mastery = createMastery({ gidx, cards, skills, scheduler })
  const telemetry: MixerTelemetry = { batches: 0, relaxations: 0, shortfalls: 0, lastShortfallReason: null }

  let course: CourseState | null = null
  let session: SessionState | null = null
  let loaded = false
  let loadPromise: Promise<{ fresh: boolean; recovered: RecoveryReport }> | null = null
  let activePlacement: PlacementController | null = null
  let probeCounter = 0

  const makeDefaultCourse = (): CourseState => {
    const firstUnit = gidx.units[0]
    return {
      courseId: key.courseId,
      schemaVersion: ENGINE_SCHEMA,
      theta: THETA_DEFAULT,
      thetaK: THETA_K_START,
      resultCount: 0,
      position: {
        arcId: firstUnit?.arcId ?? "",
        unitId: firstUnit?.unitId ?? "",
        unitOrdinal: 0,
      },
      newPerDay: NEW_PER_DAY_DEFAULT,
      newIntroducedToday: 0,
      dailyCapacityEwma: CAPACITY_SEED,
      backlogRing: [],
      lastThrottleAdjustDay: clock.epochDay(),
      strandTally: [],
      jump: { lastOfferedDay: 0, consecutiveCruiseSessions: 0 },
      lesson: null,
      checkpointsPassed: {},
      sessionCounter: 0,
      lastTickDay: clock.epochDay(),
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
  }

  const makeSession = (c: CourseState): SessionState => {
    const sessionId = `${key.stackId}:${key.courseId}:${c.sessionCounter}`
    return {
      sessionId,
      rng: createRng(deriveSessionSeed(key.stackId, key.courseId, c.sessionCounter)),
      startedDay: clock.epochDay(),
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
      funServedSession: 0,
      bossAttempted: new Set(),
      checkpointRun: null,
      gauntletRun: null,
      modeTally: { cruise: 0, normal: 0, struggle: 0 },
      lastInterludeEmit: -1,
      lastGameInterludeEmit: -1,
      lastReaderInterludeEmit: -1,
    }
  }

  const requireLoaded = (): CourseState => {
    if (!loaded || !course) throw new Error("[journey-engine] call load() first")
    return course
  }

  const requireSession = (): SessionState => {
    const c = requireLoaded()
    if (!session) {
      c.sessionCounter += 1
      session = makeSession(c)
    }
    return session
  }

  const persistCard = (itemId: string): void => {
    const card = cards.get(itemId)
    if (card) void persistence.itemCards.put(itemId, card)
  }

  const persistMeta = (): void => {
    if (!course) return
    void persistence.meta.setJSON("course", course)
    void persistence.meta.setJSON("skills", [...skills.values()])
  }

  const bags = (): {
    lessonBag: LessonBag
    mixerBag: MixerBag
    applyBag: ApplyBag
    dailyBag: DailyBag
  } => {
    const c = requireLoaded()
    const s = requireSession()
    const nowMs = clock.nowMs()
    const day = clock.epochDay()
    const lessonBag: LessonBag = { gidx, course: c, session: s, cards, mastery, scheduler, nowMs, day }
    const mixerBag: MixerBag = { gidx, course: c, session: s, cards, skills, mastery, scheduler, nowMs, day, telemetry }
    const applyBag: ApplyBag = { gidx, course: c, session: s, cards, skills, mastery, scheduler, nowMs, day, lessonBag, persistCard }
    const dailyBag: DailyBag = { gidx, course: c, cards, skills, mastery, lessonBag, nowMs }
    return { lessonBag, mixerBag, applyBag, dailyBag }
  }

  const maybeTickDay = (): DayRollover | null => {
    const c = requireLoaded()
    const today = clock.epochDay()
    if (today <= c.lastTickDay) return null
    let missed = today - c.lastTickDay
    let day = c.lastTickDay + 1
    if (missed > MAX_TICKDAY_ITERATIONS) {
      // beyond the 7/14-day windows nothing needs per-day fidelity
      day = today
      missed = 1
    }
    let last: DayRollover | null = null
    for (; day <= today; day++) {
      const { dailyBag } = bags()
      last = tickOneDay(dailyBag, day)
    }
    persistMeta()
    return last
  }

  /** Settle the previous session's cruise bookkeeping (§5.6 tail rule). */
  const settlePreviousSession = (c: CourseState): void => {
    if (!session) return
    if (session.scored >= CRUISE_SESSION_MIN_SCORED) {
      const t = session.modeTally
      const cruiseDominant = t.cruise > t.normal && t.cruise > t.struggle
      if (cruiseDominant) {
        c.jump.consecutiveCruiseSessions += 1
        c.cruiseSessionsWeek += 1
        if (c.firstWeek) c.firstWeek.cruiseSessions += 1
      } else {
        c.jump.consecutiveCruiseSessions = 0
      }
    }
    c.sessionsWeek += 1
  }

  /** Probe cards: fast, guessable-OK, no speaking, no hints (adaptivity §4.2). */
  const mintProbe = (itemId: string): EngineCard | undefined => {
    const c = requireLoaded()
    const s = requireSession()
    const item = gidx.graph.items[itemId]
    if (!item) return undefined
    const templates = (gidx.templatesByKind.get(item.kind) ?? []).filter(
      (t) => t.form === 0 && t.modelNeeds.length === 0 && t.provider === "native",
    )
    const t = templates[0] ?? (gidx.templatesByKind.get(item.kind) ?? []).find((x) => x.modelNeeds.length === 0)
    if (!t) return undefined
    probeCounter += 1
    const specId = `${s.sessionId}:probe:${probeCounter}`
    s.issued.set(specId, {
      specId,
      activityType: t.activityType,
      itemIds: [itemId],
      form: t.form,
      guessable: t.guessable,
      isReplay: false,
      pool: "probe",
      strand: t.strand,
      estSec: t.estSec,
      modelNeeds: [...t.modelNeeds],
      issuedAtMs: clock.nowMs(),
    })
    return {
      spec: {
        specId,
        activityType: t.activityType,
        itemRefs: [item.ref],
        params: { probe: true },
        level: gidx.arcById.get(c.position.arcId)?.cefr,
        targetLang: gidx.targetLang,
        timeboxSec: t.estSec,
      },
      meta: {
        pool: "probe",
        strand: t.strand,
        form: t.form,
        estSec: t.estSec,
        provider: t.provider,
        celebration: "normal",
        coolDownCandidate: false,
      },
    }
  }

  /** Mint one gauntlet card (jump/legendary), production-form bias, no hints. */
  const mintGauntletCard = (itemId: string, gauntletId: string): EngineCard | undefined => {
    const c = requireLoaded()
    const s = requireSession()
    const item = gidx.graph.items[itemId]
    if (!item) return undefined
    const all = (gidx.templatesByKind.get(item.kind) ?? []).filter(
      (t) => t.provider === "native" && t.modelNeeds.length === 0,
    )
    const t =
      all.find((x) => x.form === 2) ?? all.find((x) => x.form === 1) ?? all[0]
    if (!t) return undefined
    probeCounter += 1
    const specId = `${s.sessionId}:jump:${probeCounter}`
    s.issued.set(specId, {
      specId,
      activityType: t.activityType,
      itemIds: [itemId],
      form: t.form,
      guessable: t.guessable,
      isReplay: false,
      pool: "jump",
      strand: t.strand,
      estSec: t.estSec,
      modelNeeds: [...t.modelNeeds],
      issuedAtMs: clock.nowMs(),
      gauntletId,
    })
    return {
      spec: {
        specId,
        activityType: t.activityType,
        itemRefs: [item.ref],
        params: { noHints: true },
        level: gidx.arcById.get(c.position.arcId)?.cefr,
        targetLang: gidx.targetLang,
        timeboxSec: t.estSec,
      },
      meta: {
        pool: "jump",
        strand: t.strand,
        form: t.form,
        estSec: t.estSec,
        provider: t.provider,
        celebration: "normal",
        coolDownCandidate: false,
      },
    }
  }

  return {
    async load() {
      if (loadPromise) return loadPromise
      loadPromise = (async () => {
        const [rawCards, rawCourse, rawSkills] = await Promise.all([
          persistence.itemCards.getAll(),
          persistence.meta.getJSON<CourseState>("course"),
          persistence.meta.getJSON<SkillScalars[]>("skills"),
        ])
        let corruptCards = 0
        for (const [id, raw] of rawCards) {
          const parsed = itemCardCodec.parse(raw)
          if (parsed) cards.set(id, parsed)
          else corruptCards += 1
        }
        const rawEvents = await persistence.events.read({ limit: 50_000 })
        const log = projectActivityEvents(rawEvents.map((r) => r.entry), key.courseId)

        const fresh = !rawCourse && cards.size === 0 && log.length === 0
        const recovered = recoverEngineState({
          gidx,
          scheduler,
          nowMs: clock.nowMs(),
          day: clock.epochDay(),
          course: rawCourse ?? undefined,
          skills: rawSkills ?? undefined,
          cards,
          log,
          corruptCards,
          makeDefaultCourse,
        })
        course = recovered.course
        for (const [id, s] of recovered.skills) skills.set(id, s)
        mastery.markAllDirty()
        loaded = true
        if (fresh) {
          const { lessonBag } = bags()
          initLessonCursor(lessonBag)
        }
        maybeTickDay()
        persistMeta()
        return { fresh, recovered: recovered.report }
      })()
      return loadPromise
    },

    startSession() {
      const c = requireLoaded()
      maybeTickDay()
      settlePreviousSession(c)
      c.sessionCounter += 1
      c.sessionsToday += 1
      session = makeSession(c)
      activePlacement = null
      const nowMs = clock.nowMs()
      const day = clock.epochDay()
      const welcomeBack = computeWelcomeBack({ cards, scheduler, nowMs, course: c, day })
      persistMeta()
      return {
        sessionId: session.sessionId,
        needsPlacement: c.placement === undefined && cards.size === 0,
        welcomeBack,
      }
    },

    startPlacement(mode) {
      const c = requireLoaded()
      const s = requireSession()
      const controller = createPlacementController(
        {
          gidx,
          course: c,
          session: s,
          mastery,
          rng: s.rng,
          nowMs: () => clock.nowMs(),
          day: clock.epochDay(),
          mintProbe,
        },
        mode,
      )
      // wrap finalize to persist + re-init the lesson cursor
      activePlacement = {
        next: () => controller.next(),
        submit: (r) => controller.submit(r),
        finalize: () => {
          const out = controller.finalize()
          activePlacement = null
          const { lessonBag } = bags()
          initLessonCursor(lessonBag)
          mastery.markAllDirty()
          persistMeta()
          return out
        },
        abort: () => {
          controller.abort()
          activePlacement = null
        },
      }
      return activePlacement
    },

    placeUser(probeResults) {
      const c = requireLoaded()
      const out = placeUserBatch({ gidx, course: c, mastery, day: clock.epochDay() }, probeResults)
      const { lessonBag } = bags()
      initLessonCursor(lessonBag)
      mastery.markAllDirty()
      persistMeta()
      return out
    },

    nextFeedItems(n = 10, constraints) {
      requireLoaded()
      maybeTickDay()
      const { mixerBag } = bags()
      return mixerNext(mixerBag, n, constraints)
    },

    applyResult(result) {
      requireLoaded()
      maybeTickDay()
      const { applyBag } = bags()
      const s = requireSession()
      const issued = s.issued.get(result.specId)
      if (issued?.pool === "probe") {
        s.issued.delete(result.specId)
        activePlacement?.submit(result)
        return {
          grades: [],
          items: [],
          replaysQueued: [],
          skillTransitions: [],
          flowMode: s.flow.mode,
          celebrationHint: "pass",
        }
      }
      const outcome = applyResultPipeline(applyBag, result)
      persistMeta()
      return outcome
    },

    tickDay() {
      const c = requireLoaded()
      const rolled = maybeTickDay()
      if (rolled) return rolled
      const { dailyBag } = bags()
      // explicit same-day call: return current-state rollover without mutation
      return {
        day: c.lastTickDay,
        announcements: [],
        newPerDay: c.newPerDay,
        debtBrakeActive: isDebtBrakeActive(c, dueCount(dailyBag.cards, clock.epochDay())),
      }
    },

    getSkillState(skillId) {
      requireLoaded()
      return mastery.getSkillState(skillId, clock.nowMs())
    },

    getCourseSnapshot() {
      const c = requireLoaded()
      const day = clock.epochDay()
      const due = dueCount(cards, day)
      return {
        theta: c.theta,
        position: { ...c.position },
        dueCount: due,
        newRemainingToday: Math.max(0, c.newPerDay - c.newIntroducedToday),
        flowMode: session?.flow.mode ?? "normal",
        strandShares: strandShares(c, day),
        jumpAvailable:
          c.jump.consecutiveCruiseSessions >= 2 && !isDebtBrakeActive(c, due),
        debtBrakeActive: isDebtBrakeActive(c, due),
        newPerDay: c.newPerDay,
      }
    },

    requestJump(targetSkillId) {
      const c = requireLoaded()
      const s = requireSession()
      if (s.gauntletRun) return undefined
      const due = dueCount(cards, clock.epochDay())
      if (isDebtBrakeActive(c, due)) return undefined // clearing debt beats skipping
      const nowMs = clock.nowMs()

      // skipped = skills on DAG paths frontier → target (default: +1 unit)
      const targetUnitOrdinal = Math.min(c.position.unitOrdinal + 1, gidx.units.length - 1)
      let targetSkills: string[]
      if (targetSkillId && gidx.graph.skills[targetSkillId]) {
        targetSkills = [targetSkillId]
      } else {
        targetSkills = gidx.units[targetUnitOrdinal]?.skillIds ?? []
        if (targetUnitOrdinal === c.position.unitOrdinal) return undefined
      }
      const skipped = new Set<string>()
      for (const target of targetSkills) {
        if (mastery.levelOf(target, nowMs) < 3) skipped.add(target)
        for (const p of gidx.prereqClosure.get(target) ?? []) {
          if (mastery.levelOf(p, nowMs) < 3) skipped.add(p)
        }
      }
      if (skipped.size === 0) return undefined
      const skippedUnits = new Set(
        [...skipped].map((sk) => gidx.unitPos.get(gidx.graph.skills[sk].unitId) ?? 0),
      )
      const layers = Math.max(1, skippedUnits.size)
      const mistakesAllowed = layers <= JUMP_NEAR_LAYERS ? JUMP_MISTAKES_NEAR : JUMP_MISTAKES_FAR
      const gauntletId = `jump:${s.sessionId}:${s.emitIndex}`
      const cardsOut: EngineCard[] = []
      const skillList = [...skipped]
      for (let layer = 0; layer < layers && cardsOut.length < layers * JUMP_PROBES_PER_LAYER; layer++) {
        for (let i = 0; i < JUMP_PROBES_PER_LAYER; i++) {
          const skillId = skillList[(layer * JUMP_PROBES_PER_LAYER + i) % skillList.length]
          const pool = gidx.skillItems.get(skillId) ?? []
          const pick = weightedPick(
            s.rng,
            pool.filter((id) => !cardsOut.some((ec) => ec.spec.itemRefs.some((ref) => gidx.graph.items[id]?.ref === ref)))
              .map((id) => [id, 1] as const),
          )
          if (!pick) continue
          const card = mintGauntletCard(pick, gauntletId)
          if (card) cardsOut.push(card)
        }
      }
      if (cardsOut.length === 0) return undefined
      s.gauntletRun = {
        kind: "jump",
        id: gauntletId,
        skillIds: skillList,
        layers,
        // an all-miss transcript must never pass a short gauntlet
        mistakesAllowed: Math.min(mistakesAllowed, cardsOut.length - 1),
        count: cardsOut.length,
        resolved: 0,
        mistakes: 0,
        failedItemIds: [],
      }
      return cardsOut
    },

    requestLegendary(skillId) {
      const c = requireLoaded()
      const s = requireSession()
      if (s.gauntletRun) return undefined
      const day = clock.epochDay()
      if (c.legendaryAttempt[skillId] === day) return undefined // one attempt/day
      const items = gidx.skillItems.get(skillId) ?? []
      if (items.length === 0) return undefined
      c.legendaryAttempt[skillId] = day
      const count = Math.min(LEGENDARY_ITEMS_MAX, Math.max(LEGENDARY_ITEMS_MIN, items.length))
      const gauntletId = `legendary:${s.sessionId}:${skillId}`
      const shuffled = s.rng.shuffle([...items])
      const cardsOut: EngineCard[] = []
      for (const itemId of shuffled) {
        if (cardsOut.length >= count) break
        const card = mintGauntletCard(itemId, gauntletId)
        if (card) cardsOut.push(card)
      }
      if (cardsOut.length < LEGENDARY_ITEMS_MIN) return undefined
      s.gauntletRun = {
        kind: "legendary",
        id: gauntletId,
        skillIds: [skillId],
        layers: 1,
        mistakesAllowed: LEGENDARY_MISTAKES_ALLOWED,
        count: cardsOut.length,
        resolved: 0,
        mistakes: 0,
        failedItemIds: [],
      }
      return cardsOut
    },

    requestUnitReview(unitId) {
      // PathViz tap-to-review (W10/W4 fix c): enqueue a practiced unit's SEEN
      // items as session replays. Rides the existing replay machinery — gap
      // discipline, once-per-session guard, unmetered (replays never debit
      // the daily gate, R12). Returns false when nothing is reviewable.
      requireLoaded()
      const s = requireSession()
      const unit = gidx.units[gidx.unitPos.get(unitId) ?? -1]
      if (!unit) return false
      let queued = 0
      for (const skillId of unit.skillIds) {
        for (const itemId of gidx.skillItems.get(skillId) ?? []) {
          if (queued >= UNIT_REVIEW_ITEMS_MAX) break
          const card = cards.get(itemId)
          if (!card || card.fsrs.reps === 0 || (card.flags & CardFlags.Suspended) !== 0) continue
          if (s.replayedItems.has(itemId)) continue
          if (s.replayQueue.some((e) => e.itemId === itemId)) continue
          s.replayQueue.push({
            itemId,
            notBeforeEmitIndex: s.emitIndex,
            form: card.form,
            failures: 0,
          })
          queued += 1
        }
      }
      return queued > 0
    },

    async flush() {
      persistMeta()
      await persistence.itemCards.flush()
      await persistence.events.flush()
    },

    getTelemetry() {
      return telemetry
    },
  }
}
