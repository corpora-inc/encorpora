// journey/engine/apply.ts — the single result-update pipeline (engine.md
// §4.4). Composes grading, scheduler, mastery, θ, flow, leech, latency,
// strands, replay, debut, checkpoint and gauntlet bookkeeping.
//
// R6: grades join by KEY (itemRefKey), never by position. Un-issued refs are
// warn-and-dropped; issued-but-absent items are untouched (no evidence).

import { itemRefKey } from "../../contentPacks/activityContract.ts"
import {
  ACC_EWMA_ALPHA,
  JUMP_THETA_BONUS,
  PLACED_ACC_EWMA,
  REPLAY_MIN_GAP,
  RETIRE_PERFECT_STREAK,
} from "./constants.ts"
import { pushFlow } from "./flow.ts"
import { ratchetForm } from "./forms.ts"
import { toGrade } from "./grading.ts"
import type { GraphIndex } from "./graph.ts"
import { latencyZ, updateLatencyBaseline } from "./latency.ts"
import { checkLeech } from "./leech.ts"
import { applyCheckpointResult, type LessonBag } from "./lessons.ts"
import type { Mastery } from "./mastery.ts"
import type { Scheduler } from "./scheduler.ts"
import { creditStrand } from "./strands.ts"
import { meanB, sigmoid, updateTheta } from "./theta.ts"
import {
  CardFlags,
  type ActivityResult,
  type ApplyOutcome,
  type CourseState,
  type IssuedCard,
  type ItemCard,
  type SessionState,
  type SkillScalars,
} from "./types.ts"

export interface ApplyBag {
  gidx: GraphIndex
  course: CourseState
  session: SessionState
  cards: Map<string, ItemCard>
  skills: Map<string, SkillScalars>
  mastery: Mastery
  scheduler: Scheduler
  nowMs: number
  day: number
  lessonBag: LessonBag
  /** Stage a card write (fire-and-forget; the WriteBatcher owns debounce). */
  persistCard(itemId: string): void
}

function emptyOutcome(session: SessionState): ApplyOutcome {
  return {
    grades: [],
    items: [],
    replaysQueued: [],
    skillTransitions: [],
    flowMode: session.flow.mode,
    celebrationHint: "pass",
  }
}

export function getOrCreateCard(bag: ApplyBag, itemId: string): ItemCard {
  let card = bag.cards.get(itemId)
  if (card) return card
  const item = bag.gidx.graph.items[itemId]
  const placedSkill = (item?.skillIds ?? []).some(
    (s) => bag.skills.get(s)?.placedAt !== undefined,
  )
  if (placedSkill) {
    // §4.3.3 lazy priorKnown seeding: first review EASY then one GOOD advance
    card = {
      itemId,
      fsrs: bag.scheduler.seedPriorKnown(itemId, bag.nowMs),
      flags: CardFlags.PriorKnown | CardFlags.PlacementSeeded,
      form: 0,
    }
  } else {
    card = { itemId, fsrs: bag.scheduler.emptyCard(bag.day), flags: 0, form: 0 }
  }
  bag.cards.set(itemId, card)
  return card
}

/** Jump/legendary gauntlet path: θ + tally only — probe-like, no cards. */
function applyGauntlet(bag: ApplyBag, issued: IssuedCard, r: ActivityResult): ApplyOutcome {
  const { session, course } = bag
  const run = session.gauntletRun
  const outcome = emptyOutcome(session)
  if (!run || issued.gauntletId !== run.id) return outcome
  const correct = r.perItem.length > 0 ? r.perItem.every((p) => p.outcome === "pass") : r.score >= 0.5
  run.resolved += 1
  if (!correct) {
    run.mistakes += 1
    run.failedItemIds.push(...issued.itemIds)
  }
  // probe-style θ update
  const b = meanB(bag.gidx.graph, issued.itemIds)
  course.theta += 0.15 * ((correct ? 1 : 0) - sigmoid(course.theta - b))

  if (run.resolved >= run.count || run.mistakes > run.mistakesAllowed) {
    session.gauntletRun = null
    const passed = run.mistakes <= run.mistakesAllowed && run.resolved >= run.count
    if (run.kind === "jump") {
      if (passed) {
        for (const skillId of run.skillIds) {
          const scalars = bag.mastery.ensureScalars(skillId)
          scalars.placedAt = bag.day
          scalars.accEwma = Math.max(scalars.accEwma, PLACED_ACC_EWMA)
          bag.mastery.markDirty(skillId)
        }
        course.theta += JUMP_THETA_BONUS
        // advance the position cursor past newly-provisional units
        outcome.celebrationHint = "levelup"
      } else {
        // zero penalty; failed layers' first items head the NEW queue
        for (const itemId of run.failedItemIds) {
          if (!course.newBoost.includes(itemId)) course.newBoost.push(itemId)
        }
        course.jump.consecutiveCruiseSessions = 0
      }
    } else if (passed) {
      const scalars = bag.mastery.ensureScalars(run.skillIds[0])
      scalars.legendaryAt = bag.day
      bag.mastery.markDirty(run.skillIds[0])
      outcome.celebrationHint = "levelup"
    }
  }
  return outcome
}

export function applyResult(bag: ApplyBag, r: ActivityResult): ApplyOutcome {
  const { session, course, gidx } = bag

  const issued = session.issued.get(r.specId)
  if (!issued) {
    console.warn("[journey-engine] applyResult for unknown specId", r.specId)
    return emptyOutcome(session)
  }
  // exactly one terminal result per specId (first wins)
  session.issued.delete(r.specId)

  if (issued.pool === "jump" && issued.gauntletId) return applyGauntlet(bag, issued, r)

  if (r.abandoned) {
    // no grades; strand tally still credits durationMs
    creditStrand(course, issued.strand, r.durationMs, bag.day)
    return emptyOutcome(session)
  }

  if (issued.unscored) {
    // intro presentations / cadence faces / offers: presentation only
    creditStrand(course, issued.strand, r.durationMs, bag.day)
    return emptyOutcome(session)
  }

  const outcome = emptyOutcome(session)
  const issuedKeys = new Set(issued.itemIds)
  const touchedItems: string[] = []
  const preLevels = new Map<string, number>()
  const zs: number[] = []
  let anyAgain = false

  const gradeItem = (itemId: string, per: ActivityResult["perItem"][number] | undefined): void => {
    const card = getOrCreateCard(bag, itemId)
    const item = gidx.graph.items[itemId]
    const textLen = item?.textLen ?? 10

    for (const skillId of item?.skillIds ?? []) {
      if (!preLevels.has(skillId)) preLevels.set(skillId, bag.mastery.levelOf(skillId, bag.nowMs))
    }

    const predictedRecall =
      card.fsrs.reps > 0 ? bag.scheduler.retrievability(card, bag.nowMs) : undefined

    const { grade, priorKnown } = toGrade({
      result: r,
      per,
      issued,
      cardReps: card.fsrs.reps,
      baselines: course.latencyBaselines,
      textLen,
    })
    if (priorKnown) card.flags |= CardFlags.PriorKnown

    if (grade === "forget") {
      // Genuine FSRS forget → the item is no longer known: reset the perfect
      // streak and UN-RETIRE (R-A: a forgotten item may return to scheduling).
      card.fsrs = bag.scheduler.forget(card, bag.nowMs)
      card.fsrs.perfect = 0
      card.flags &= ~CardFlags.Retired
      outcome.grades.push({ itemId, grade })
      bag.persistCard(itemId)
      touchedItems.push(itemId)
      return
    }

    // R-A retirement bookkeeping (computed around scheduler.next, which returns
    // a FRESH fsrs object without the counter — we re-stamp it below).
    const prevPerfect = card.fsrs.perfect ?? 0
    const lapsesBefore = card.fsrs.lapses
    card.fsrs = bag.scheduler.next(card, bag.nowMs, grade).fsrs
    const lapsed = card.fsrs.lapses > lapsesBefore
    const passed = grade >= 2 // "Hard is never a fail"
    ratchetForm(card, issued.form, issued.guessable, passed)

    // A perfect completion mirrors the runtime combo (score ≥ 0.95, no hints)
    // AND this item itself passed cleanly. Two in a row RETIRE the item so it
    // stops being served (breadth-first). Any miss resets the streak; a genuine
    // FSRS lapse both resets AND un-retires (rare long-interval return).
    const itemHints = per?.hintsUsed ?? 0
    const itemPassedClean = per ? per.outcome === "pass" : passed
    const perfect = itemPassedClean && itemHints === 0 && r.score >= 0.95
    const itemMissed = per ? per.outcome === "fail" : grade === 1
    card.fsrs.perfect = perfect ? prevPerfect + 1 : itemMissed || lapsed ? 0 : prevPerfect
    if (perfect && card.fsrs.perfect >= RETIRE_PERFECT_STREAK) {
      card.flags |= CardFlags.Retired
    } else if (lapsed) {
      card.flags &= ~CardFlags.Retired
    }

    outcome.grades.push({ itemId, grade })
    outcome.items.push({
      ref: itemId,
      outcome: per?.outcome ?? (passed ? "pass" : "fail"),
      grade,
      latencyMs: per?.latencyMs,
      hintsUsed: per?.hintsUsed,
      predictedRecall,
      b: item?.b,
      theta: course.theta,
    })

    if (per?.latencyMs !== undefined) {
      zs.push(latencyZ(course.latencyBaselines, issued.activityType, textLen, per.latencyMs))
      if (per.outcome === "pass") {
        updateLatencyBaseline(course.latencyBaselines, issued.activityType, textLen, per.latencyMs)
      }
    }

    if (grade === 1) {
      anyAgain = true
      session.scaffoldItemId = itemId // most recently failed (struggle re-teach)
      if (issued.isReplay || session.replayedItems.has(itemId)) {
        // frustration guard: one replay max — mark due tomorrow, drop from replay
        card.fsrs.due = Math.max(card.fsrs.due, bag.day + 1)
      } else if (!session.replayQueue.some((e) => e.itemId === itemId)) {
        session.replayQueue.push({
          itemId,
          notBeforeEmitIndex: session.emitIndex + REPLAY_MIN_GAP,
          form: Math.max(0, issued.form - 1) as 0 | 1 | 2,
          failures: 1,
        })
        outcome.replaysQueued.push(itemId)
      }
    }

    const leech = checkLeech(card, gidx, course, bag.cards)
    if (leech.suspended) {
      // a suspended card leaves every queue immediately
      session.replayQueue = session.replayQueue.filter((e) => e.itemId !== itemId)
      if (session.scaffoldItemId === itemId) session.scaffoldItemId = null
    }
    bag.persistCard(itemId)
    touchedItems.push(itemId)
  }

  if (r.perItem.length > 0) {
    // R6 — join by key, never by position (shuffled/subset-safe)
    for (const per of r.perItem) {
      const key = itemRefKey(per.itemRef)
      if (!issuedKeys.has(key)) {
        console.warn("[journey-engine] dropping un-issued itemRef", key)
        continue
      }
      if (touchedItems.includes(key)) continue // dedup double-reports
      gradeItem(key, per)
    }
    // issued-but-absent items: NO evidence — cards untouched (R6)
  } else {
    // score-only round (R9): uniform grade over every issued item, ≤ Good
    for (const itemId of issued.itemIds) gradeItem(itemId, undefined)
  }

  // ---- skills -------------------------------------------------------------
  const touchedSkills = new Set<string>()
  for (const itemId of touchedItems) {
    for (const skillId of gidx.graph.items[itemId]?.skillIds ?? []) touchedSkills.add(skillId)
  }
  for (const skillId of touchedSkills) {
    const scalars = bag.mastery.ensureScalars(skillId)
    if (issued.form >= 1) {
      scalars.accEwma = (1 - ACC_EWMA_ALPHA) * scalars.accEwma + ACC_EWMA_ALPHA * r.score
    }
    bag.mastery.markDirty(skillId)
  }
  for (const skillId of touchedSkills) {
    const from = preLevels.get(skillId) ?? 0
    const to = bag.mastery.levelOf(skillId, bag.nowMs)
    if (to !== from) {
      outcome.skillTransitions.push({ skillId, from, to })
      if (to < from && to === 2) bag.mastery.ensureScalars(skillId).demotedAt = bag.day
    }
  }

  // ---- θ / latency / flow / strands ----------------------------------------
  if (touchedItems.length > 0) {
    updateTheta(course, r.score, meanB(gidx.graph, touchedItems))
  }
  const meanZ = zs.length > 0 ? zs.reduce((a, b) => a + b, 0) / zs.length : 1
  pushFlow(session, { score: r.score, latencyZ: meanZ })
  outcome.flowMode = session.flow.mode
  creditStrand(course, issued.strand, r.durationMs, bag.day)

  // ---- debut / daily / first-week bookkeeping --------------------------------
  if (issued.pool === "new") {
    for (const itemId of issued.itemIds) {
      if (session.debuts.get(itemId) === 2) course.newIntroducedToday += 1
    }
  }
  if (course.firstWeek) {
    course.firstWeek.results += 1
    if (r.score >= 0.5) course.firstWeek.correct += 1
  }
  course.lastActiveDay = bag.day
  course.scoredToday += 1
  session.scored += 1

  // ---- checkpoint batches (§5.10 pass_score gate) ------------------------------
  if (issued.pool === "checkpoint" && issued.checkpointId) {
    outcome.checkpoint = applyCheckpointResult(bag.lessonBag, r.score, issued.itemIds)
  }

  outcome.celebrationHint = anyAgain
    ? "fail"
    : outcome.skillTransitions.some((t) => t.to > t.from && t.to >= 3)
      ? "levelup"
      : session.flow.mode === "cruise"
        ? "streak"
        : "pass"
  return outcome
}
