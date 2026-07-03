// journey-sim runner (engine.md §7): drives the REAL engine through its
// public API with createMemoryPersistence() + a manual clock. One learner =
// one engine instance; metrics accumulate incrementally (no full-transcript
// retention at scale).

import { createManualClock, DAY_MS } from "../../src/journey/engine/clock.ts"
import {
  LEECH_LAPSES,
  LEECH_REPS_RATIO,
  LEECH_SUSPEND_EXTRA_LAPSES,
} from "../../src/journey/engine/constants.ts"
import {
  createJourneyEngine,
  createMemoryPersistence,
} from "../../src/journey/engine/engine.ts"
import { fnv1a32 } from "../../src/journey/engine/rng.ts"
import { CardFlags, type CourseGraph, type CourseState, type EngineCard, type FeedConstraints } from "../../src/journey/engine/types.ts"
import { Learner, type Persona } from "./learner.ts"

const START_DAY = 20_000

const CONSTRAINTS: FeedConstraints = {
  availableProviders: ["native", "lingo_hero"],
  modelsAvailable: ["stt", "llm", "tts"],
}

export interface DayStat {
  day: number
  active: boolean
  dueAtStart: number
  scored: number
  debuts: number
  reviews: number
  theta: number
  brake: boolean
  newPerDay: number
  modes: { cruise: number; normal: number; struggle: number }
  strandShares: [number, number, number, number]
  arcOrdinal: number
  unitOrdinal: number
}

export interface LearnerRun {
  persona: string
  index: number
  a: number
  days: DayStat[]
  grades: { again: number; hard: number; good: number; easy: number; forget: number }
  easyOnGuessable: number
  reviewTouches: number
  debutsCompleted: number
  poolCounts: Record<string, number>
  funCards: number
  totalCards: number
  scoredCards: number
  arc1DoneActiveDay: number | null
  activeDays: number
  p11: { itemGapViolations: number; debutOrderViolations: number; modelBlockViolations: number; replayRepeatViolations: number }
  newPerDayChangeDays: number[]
  brakeEngagements: number
  brakeRecoveryActiveDays: number[]
  debutsOnBrakeDays: number
  leechServings: number
  servingsAfterSuspicion: number
  suspendedAtEnd: number
  leechFlaggedAtEnd: number
  trickleUnvisitedAt60: number | null
  dueStale14AtEnd: number
  shortfallsWithoutReason: number
  relaxations: number
  batches: number
  transcriptHash: number
  finalCourse: CourseState | null
}

const GUESSABLE_TYPES = new Set(["choice_pick", "listen_pick", "match_pairs", "flip_recall"])

function modelKeyOf(card: EngineCard): number {
  const m = card.spec.modelNeeds ?? []
  if (m.includes("llm")) return 3
  if (m.includes("stt")) return 2
  if (m.includes("tts")) return 1
  return 0
}

export async function runLearner(
  graph: CourseGraph,
  persona: Persona,
  index: number,
  runSeed: number,
  daysToRun: number,
): Promise<LearnerRun> {
  const seed = (runSeed ^ fnv1a32(`${persona.id}:${index}`)) >>> 0
  const learner = new Learner(persona, graph, seed)
  const clock = createManualClock({ startMs: START_DAY * DAY_MS + 9 * 3_600_000 })
  const persistence = createMemoryPersistence({ now: () => clock.nowMs() })
  const engine = createJourneyEngine({
    key: { stackId: `sim-${persona.id}-${index}`, courseId: graph.courseId },
    graph,
    persistence,
    clock,
  })
  await engine.load()

  const run: LearnerRun = {
    persona: persona.id,
    index,
    a: learner.a,
    days: [],
    grades: { again: 0, hard: 0, good: 0, easy: 0, forget: 0 },
    easyOnGuessable: 0,
    reviewTouches: 0,
    debutsCompleted: 0,
    poolCounts: {},
    funCards: 0,
    totalCards: 0,
    scoredCards: 0,
    arc1DoneActiveDay: null,
    activeDays: 0,
    p11: { itemGapViolations: 0, debutOrderViolations: 0, modelBlockViolations: 0, replayRepeatViolations: 0 },
    newPerDayChangeDays: [],
    brakeEngagements: 0,
    brakeRecoveryActiveDays: [],
    debutsOnBrakeDays: 0,
    leechServings: 0,
    servingsAfterSuspicion: 0,
    suspendedAtEnd: 0,
    leechFlaggedAtEnd: 0,
    trickleUnvisitedAt60: null,
    dueStale14AtEnd: 0,
    shortfallsWithoutReason: 0,
    relaxations: 0,
    batches: 0,
    transcriptHash: 0x811c9dc5,
    finalCourse: null,
  }

  // placed-intermediate: adaptive placement driven by the learner's memory
  if (persona.priorKnownItems) {
    engine.startSession()
    const controller = engine.startPlacement("probe")
    for (;;) {
      const card = controller.next()
      if (!card) break
      const res = learner.answer(card, 0)
      engine.applyResult(res)
    }
    controller.finalize()
  }

  // reconstructed leech state (mirrors leech.ts thresholds from the transcript)
  const itemStats = new Map<string, { reps: number; agains: number }>()
  const leechState = (itemId: string): "none" | "flagged" | "suspended" => {
    const st = itemStats.get(itemId)
    if (!st || st.agains < LEECH_LAPSES || st.reps / st.agains >= LEECH_REPS_RATIO) return "none"
    return st.agains >= LEECH_LAPSES + LEECH_SUSPEND_EXTRA_LAPSES ? "suspended" : "flagged"
  }
  let lastNewPerDay: number | null = null
  let brakeActive = false
  let brakeStartActiveDay = 0

  for (let d = 0; d < daysToRun; d++) {
    clock.setDay(START_DAY + d, 9 * 3_600_000)
    engine.tickDay() // hosts tick at every day boundary; lazy + idempotent
    const attends = persona.attends(d, learner.rng)
    const snapStart = engine.getCourseSnapshot()

    const stat: DayStat = {
      day: d,
      active: attends,
      dueAtStart: snapStart.dueCount,
      scored: 0,
      debuts: 0,
      reviews: 0,
      theta: snapStart.theta,
      brake: snapStart.debtBrakeActive,
      newPerDay: snapStart.newPerDay,
      modes: { cruise: 0, normal: 0, struggle: 0 },
      strandShares: snapStart.strandShares,
      arcOrdinal: graph.units[snapStart.position.unitOrdinal]
        ? graph.arcs.findIndex((a) => a.arcId === graph.units[snapStart.position.unitOrdinal].arcId)
        : 0,
      unitOrdinal: snapStart.position.unitOrdinal,
    }

    if (lastNewPerDay !== null && snapStart.newPerDay !== lastNewPerDay) run.newPerDayChangeDays.push(d)
    lastNewPerDay = snapStart.newPerDay

    if (snapStart.debtBrakeActive && !brakeActive) {
      brakeActive = true
      run.brakeEngagements += 1
      brakeStartActiveDay = run.activeDays
    } else if (!snapStart.debtBrakeActive && brakeActive) {
      brakeActive = false
      run.brakeRecoveryActiveDays.push(run.activeDays - brakeStartActiveDay)
    }

    if (attends) {
      run.activeDays += 1
      engine.startSession()
      let secondsUsed = 0
      const budget = persona.sessionMinutes * 60
      const introPos = new Map<string, number>()
      const lastServedPos = new Map<string, number>()
      const replayServed = new Map<string, number>()
      let pos = 0
      let emptyStreak = 0
      while (secondsUsed < budget && emptyStreak < 2) {
        const brakeAtBatch = engine.getCourseSnapshot().debtBrakeActive
        const cards = engine.nextFeedItems(10, CONSTRAINTS)
        if (cards.length === 0) {
          if (!engine.getTelemetry().lastShortfallReason) run.shortfallsWithoutReason += 1
          emptyStreak += 1
          continue
        }
        emptyStreak = 0
        run.batches += 1
        // freeze leech state at batch start: suspension can only take effect
        // on the NEXT batch (an already-issued batch cannot be retracted).
        // Suspension truth comes from the ENGINE's persisted card flags.
        const leechAtBatchStart = new Map<string, "none" | "flagged" | "suspended">()
        for (const card of cards) {
          for (const ref of card.spec.itemRefs) {
            const itemId = `${ref.kind}:${ref.source}:${ref.id}`
            if (leechAtBatchStart.has(itemId)) continue
            const persisted = await persistence.itemCards.get(itemId)
            const suspended = persisted !== undefined && (persisted.flags & CardFlags.Suspended) !== 0
            const flagged = persisted !== undefined && (persisted.flags & CardFlags.Leech) !== 0
            leechAtBatchStart.set(
              itemId,
              suspended ? "suspended" : flagged || leechState(itemId) !== "none" ? "flagged" : "none",
            )
          }
        }
        // P11 model-block contiguity (checkpoint faces + jump offers excluded)
        const keys = cards.filter((c) => !c.meta.checkpoint && c.meta.pool !== "jump").map(modelKeyOf)
        for (let i = 1; i < keys.length; i++) {
          if (keys[i] < keys[i - 1]) run.p11.modelBlockViolations += 1
        }
        // daily-fast / placed-intermediate accept jump offers (§5.9)
        if (persona.takesJumps && cards.some((c) => c.meta.pool === "jump")) {
          const gauntlet = engine.requestJump()
          if (gauntlet) {
            for (const gc of gauntlet) {
              const res = learner.answer(gc, d)
              clock.advance(Math.min(res.durationMs, 60_000))
              engine.applyResult(res)
              run.transcriptHash = (run.transcriptHash ^ fnv1a32(gc.spec.specId)) >>> 0
            }
          }
        }
        for (const card of cards) {
          const isIntro = card.spec.params?.intro === true
          run.totalCards += 1
          run.poolCounts[card.meta.pool] = (run.poolCounts[card.meta.pool] ?? 0) + 1
          if (card.meta.pool === "fun" || card.meta.rareVariant !== undefined) run.funCards += 1
          run.transcriptHash = (run.transcriptHash ^ fnv1a32(card.spec.specId + card.spec.activityType)) >>> 0

          for (const ref of card.spec.itemRefs) {
            const itemId = `${ref.kind}:${ref.source}:${ref.id}`
            const prev = lastServedPos.get(itemId)
            if (prev !== undefined && pos - prev < 2 && !card.meta.checkpoint) run.p11.itemGapViolations += 1
            lastServedPos.set(itemId, pos)
            if (isIntro) introPos.set(itemId, pos)
            if (card.meta.pool === "new" && !isIntro) {
              const ip = introPos.get(itemId)
              if (ip !== undefined && pos - ip < 3) run.p11.debutOrderViolations += 1
            }
            if (card.meta.pool === "replay") {
              const n = (replayServed.get(itemId) ?? 0) + 1
              replayServed.set(itemId, n)
              if (n > 1) run.p11.replayRepeatViolations += 1
            }
            const ls = leechAtBatchStart.get(itemId) ?? "none"
            if (ls !== "none") run.leechServings += 1
            if (ls === "suspended") run.servingsAfterSuspicion += 1
          }

          const res = learner.answer(card, d)
          clock.advance(Math.min(res.durationMs, 120_000))
          // wall-clock budget: actual answer time + ~2s of transition chrome
          // (estSec is the mixer's planning estimate, not a stopwatch)
          secondsUsed += res.durationMs / 1000 + 2
          const out = engine.applyResult(res)
          if (out.grades.length > 0) {
            stat.scored += 1
            run.scoredCards += 1
            stat.modes[out.flowMode] += 1
            if (card.meta.pool === "due" || card.meta.pool === "replay" || card.meta.pool === "repair") {
              run.reviewTouches += 1
              stat.reviews += 1
            }
            if (card.meta.pool === "new" && !isIntro) {
              stat.debuts += 1
              run.debutsCompleted += 1
              if (brakeAtBatch) run.debutsOnBrakeDays += 1
            }
          }
          for (const g of out.grades) {
            if (g.grade !== "forget" && g.grade !== 1) {
              const st = itemStats.get(g.itemId) ?? { reps: 0, agains: 0 }
              st.reps += 1
              itemStats.set(g.itemId, st)
            }
            if (g.grade === "forget") run.grades.forget += 1
            else if (g.grade === 1) {
              run.grades.again += 1
              const st = itemStats.get(g.itemId) ?? { reps: 0, agains: 0 }
              st.reps += 1
              st.agains += 1
              itemStats.set(g.itemId, st)
            } else if (g.grade === 2) run.grades.hard += 1
            else if (g.grade === 3) run.grades.good += 1
            else {
              run.grades.easy += 1
              if (GUESSABLE_TYPES.has(card.spec.activityType)) run.easyOnGuessable += 1
            }
          }
          pos += 1
        }
      }
    }

    const snapEnd = engine.getCourseSnapshot()
    stat.theta = snapEnd.theta
    if (
      run.arc1DoneActiveDay === null &&
      graph.units[snapEnd.position.unitOrdinal] &&
      graph.units[snapEnd.position.unitOrdinal].arcId !== graph.arcs[0].arcId
    ) {
      run.arc1DoneActiveDay = run.activeDays
    }
    run.days.push(stat)

    // placed-intermediate trickle drain checkpoint at active day 60
    if (
      persona.priorKnownItems &&
      run.trickleUnvisitedAt60 === null &&
      run.activeDays >= 60
    ) {
      const cards = await persistence.itemCards.getAll()
      const skills = ((await persistence.meta.getJSON("skills")) ?? []) as { skillId: string; placedAt?: number }[]
      const placed = new Set(skills.filter((s) => s.placedAt !== undefined).map((s) => s.skillId))
      let placedItems = 0
      let unvisited = 0
      for (const item of Object.values(graph.items)) {
        if (!item.skillIds.some((s) => placed.has(s))) continue
        placedItems += 1
        if (!cards.has(item.itemId)) unvisited += 1
      }
      run.trickleUnvisitedAt60 = placedItems > 0 ? unvisited / placedItems : 0
    }
  }

  // end-state reads
  await engine.flush()
  const cards = await persistence.itemCards.getAll()
  const endDay = START_DAY + daysToRun
  for (const [, card] of cards) {
    if ((card.flags & CardFlags.Suspended) !== 0) run.suspendedAtEnd += 1
    if ((card.flags & CardFlags.Leech) !== 0) run.leechFlaggedAtEnd += 1
    if ((card.flags & CardFlags.Suspended) === 0 && card.fsrs.reps > 0 && endDay - card.fsrs.due > 14) {
      run.dueStale14AtEnd += 1
    }
  }
  run.finalCourse = ((await persistence.meta.getJSON("course")) ?? null) as CourseState | null
  run.relaxations = engine.getTelemetry().relaxations
  return run
}
