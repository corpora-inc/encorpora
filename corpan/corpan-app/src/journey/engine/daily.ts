// journey/engine/daily.ts — tickDay: rollover, newPerDay throttle, debt-brake
// accounting, level-transition announcements (engine.md §4.6). Idempotent per
// local day; the facade runs it for each day boundary crossed.

import {
  BACKLOG_RING_SIZE,
  CAPACITY_EWMA_ALPHA,
  DEBT_BRAKE_RATIO,
  FIRST_WEEK_JUMP_ABOVE,
  FIRST_WEEK_RESULTS,
  FIRST_WEEK_REWIND_BELOW,
  NEW_PER_DAY_MAX,
  NEW_PER_DAY_MIN,
  THROTTLE_ADJUST_INTERVAL_DAYS,
  THROTTLE_DOWN_FACTOR,
  THROTTLE_DOWN_RATIO,
  THROTTLE_HARD_RATIO,
  THROTTLE_UP_FACTOR,
  THROTTLE_UP_RATIO,
} from "./constants.ts"
import type { GraphIndex } from "./graph.ts"
import { advancePosition, arcCheckpoint, unitCheckpoint, unitSkillsPracticed, type LessonBag } from "./lessons.ts"
import type { Mastery } from "./mastery.ts"
import { dueCount } from "./pools.ts"
import { pruneStrandTally } from "./strands.ts"
import type { CourseState, DayRollover, ItemCard, SkillScalars } from "./types.ts"

export interface DailyBag {
  gidx: GraphIndex
  course: CourseState
  cards: Map<string, ItemCard>
  skills: Map<string, SkillScalars>
  mastery: Mastery
  lessonBag: LessonBag
  nowMs: number
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** One tick for the boundary into `day`. */
export function tickOneDay(bag: DailyBag, day: number): DayRollover {
  const { course, gidx, mastery } = bag
  const rollover: DayRollover = {
    day,
    announcements: [],
    newPerDay: course.newPerDay,
    debtBrakeActive: false,
  }

  // 1. close yesterday's strand bucket; drop entries older than 14 days
  pruneStrandTally(course, day)

  // 2. yesterday's end-of-day |DUE| — only for days with ≥1 scored result
  const wasActive = course.scoredToday > 0
  if (wasActive) {
    course.backlogRing.push(dueCount(bag.cards, day - 1))
    while (course.backlogRing.length > BACKLOG_RING_SIZE) course.backlogRing.shift()
    course.dailyCapacityEwma =
      course.dailyCapacityEwma + CAPACITY_EWMA_ALPHA * (course.scoredToday - course.dailyCapacityEwma)
    course.sessionsPerDayEwma =
      course.sessionsPerDayEwma +
      CAPACITY_EWMA_ALPHA * (Math.max(1, course.sessionsToday) - course.sessionsPerDayEwma)
  }

  // 3. reset daily counters; evaluate the week-one check exactly once
  course.newIntroducedToday = 0
  course.scoredToday = 0
  course.sessionsToday = 0
  if (course.firstWeek && course.firstWeek.results >= FIRST_WEEK_RESULTS) {
    const acc = course.firstWeek.results > 0 ? course.firstWeek.correct / course.firstWeek.results : 0
    if (acc < FIRST_WEEK_REWIND_BELOW) {
      rollover.placementCheck = "offer-rewind"
      course.placementCheckPending = "offer-rewind"
      // soft rewind one layer: step the position cursor back one unit
      if (course.position.unitOrdinal > 0) {
        const prev = gidx.units[course.position.unitOrdinal - 1]
        course.position = { arcId: prev.arcId, unitId: prev.unitId, unitOrdinal: course.position.unitOrdinal - 1 }
      }
    } else if (acc > FIRST_WEEK_JUMP_ABOVE && course.firstWeek.cruiseSessions >= 2) {
      rollover.placementCheck = "offer-jump"
      course.placementCheckPending = "offer-jump"
    }
    course.firstWeek = undefined
  }

  // 4. weekly newPerDay adaptation
  if (day - course.lastThrottleAdjustDay >= THROTTLE_ADJUST_INTERVAL_DAYS) {
    if (course.backlogRing.length > 0) {
      const med = median(course.backlogRing)
      const cruiseShare =
        course.sessionsWeek > 0 ? course.cruiseSessionsWeek / course.sessionsWeek : 0
      // thresholds in constants.ts (W11 round 2): the down-step targets a
      // median backlog of ~1.0× capacity, below the 1.5× debt brake — keyed
      // to the brake it parked the queue AT the brake boundary (P1 FAIL).
      if (med > THROTTLE_HARD_RATIO * course.dailyCapacityEwma) {
        course.newPerDay = Math.round(course.newPerDay * THROTTLE_DOWN_FACTOR * THROTTLE_DOWN_FACTOR)
      } else if (med > THROTTLE_DOWN_RATIO * course.dailyCapacityEwma) {
        course.newPerDay = Math.round(course.newPerDay * THROTTLE_DOWN_FACTOR)
      } else if (med < THROTTLE_UP_RATIO * course.dailyCapacityEwma && cruiseShare > 0.5) {
        course.newPerDay = Math.round(course.newPerDay * THROTTLE_UP_FACTOR)
      }
      course.newPerDay = Math.min(NEW_PER_DAY_MAX, Math.max(NEW_PER_DAY_MIN, course.newPerDay))
    }
    course.lastThrottleAdjustDay = day
    course.sessionsWeek = 0
    course.cruiseSessionsWeek = 0
  }
  rollover.newPerDay = course.newPerDay

  // 5. level-transition announcements (hysteresis — once per local day)
  for (const skillId of Object.keys(gidx.graph.skills)) {
    const scalars = mastery.ensureScalars(skillId)
    const level = mastery.levelOf(skillId, bag.nowMs)
    if (level !== scalars.announcedLevel) {
      rollover.announcements.push({ skillId, from: scalars.announcedLevel, to: level })
      if (level < scalars.announcedLevel && level === 2) scalars.demotedAt = day
      scalars.announcedLevel = level
    }
  }

  // 6. position advance — only when the unit's skills all derive ≥ 3 AND the
  //    unit's checkpoint (and, at arc boundaries, the arc gate) has passed.
  let guard = 0
  while (guard < gidx.units.length) {
    guard += 1
    const unit = gidx.units[course.position.unitOrdinal]
    if (!unit) break
    if (!unitSkillsPracticed(bag.lessonBag, course.position.unitOrdinal)) break
    const cp = unitCheckpoint(gidx, unit.unitId)
    if (cp && course.checkpointsPassed[cp.checkpointId] === undefined) break
    const isLastOfArc = gidx.units[course.position.unitOrdinal + 1]?.arcId !== unit.arcId
    if (isLastOfArc) {
      const gate = arcCheckpoint(gidx, unit.arcId)
      if (gate && course.checkpointsPassed[gate.checkpointId] === undefined) break
    }
    if (course.position.unitOrdinal >= gidx.units.length - 1) break
    advancePosition(bag.lessonBag)
  }

  // 7. bookkeeping
  course.lastTickDay = day
  rollover.debtBrakeActive = dueCount(bag.cards, day) > DEBT_BRAKE_RATIO * course.dailyCapacityEwma
  return rollover
}
