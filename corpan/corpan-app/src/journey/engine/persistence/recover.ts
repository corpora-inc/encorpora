// journey/engine/persistence/recover.ts — the pure engine-level recovery
// ladder (engine.md §3.5). Record-level corruption is absorbed below us (the
// DocStore codec drops invalid records); this handles the SEMANTIC gaps that
// leaves — per-record, never wholesale, never a throw.

import { epochDayFromLocalDay } from "../clock.ts"
import { NEW_PER_DAY_DEFAULT } from "../constants.ts"
import type { GraphIndex } from "../graph.ts"
import { createMastery, defaultScalars } from "../mastery.ts"
import type { Scheduler } from "../scheduler.ts"
import type {
  CourseState,
  ItemCard,
  RecoveryReport,
  ReviewLogEntry,
  SkillScalars,
} from "../types.ts"

/** Narrow raw AppendLog entries (the shared local-analytics envelope) into
 *  the engine's ReviewLogEntry projection (engine.md §2.2). Alien or
 *  other-course records are skipped silently — the log is app-wide. */
export function projectActivityEvents(entries: unknown[], courseId: string): ReviewLogEntry[] {
  const out: ReviewLogEntry[] = []
  for (const raw of entries) {
    const env = raw as {
      ts?: unknown
      day?: unknown
      courseId?: unknown
      e?: { type?: unknown; specId?: unknown; activityType?: unknown; items?: unknown }
    } | null
    if (!env || typeof env !== "object") continue
    if (env.courseId !== courseId) continue
    const e = env.e
    if (!e || e.type !== "activity_result" || !Array.isArray(e.items)) continue
    const ts = typeof env.ts === "number" ? env.ts : 0
    const day = typeof env.day === "string" ? epochDayFromLocalDay(env.day) : null
    if (day === null) continue
    const specId = typeof e.specId === "string" ? e.specId : ""
    const activityType = typeof e.activityType === "string" ? e.activityType : ""
    for (const it of e.items as Array<{ ref?: unknown; grade?: unknown; latencyMs?: unknown }>) {
      if (typeof it?.ref !== "string") continue
      const grade = it.grade
      if (grade !== 1 && grade !== 2 && grade !== 3 && grade !== 4) continue
      out.push({
        itemId: it.ref,
        ts,
        day,
        grade,
        activityType,
        latencyMs: typeof it.latencyMs === "number" ? it.latencyMs : undefined,
        specId,
      })
    }
  }
  return out
}

export interface RecoverInput {
  gidx: GraphIndex
  scheduler: Scheduler
  nowMs: number
  day: number
  course: CourseState | undefined
  skills: SkillScalars[] | undefined
  cards: Map<string, ItemCard>
  log: ReviewLogEntry[]
  /** Codec-dropped card count reported by the storage layer (0 for fakes). */
  corruptCards: number
  makeDefaultCourse(): CourseState
}

export interface RecoverOutput {
  course: CourseState
  skills: Map<string, SkillScalars>
  cards: Map<string, ItemCard>
  report: RecoveryReport
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[idx]
}

export function recoverEngineState(input: RecoverInput): RecoverOutput {
  const { gidx, scheduler, cards, log } = input
  const report: RecoveryReport = {
    corruptCards: input.corruptCards,
    rebuiltFromLog: 0,
    reseeded: 0,
    courseStateLost: false,
    skillsLost: false,
  }

  // form recovery: activityType → form via the graph's registry-fed templates
  const formOfType = new Map<string, 0 | 1 | 2>()
  for (const t of gidx.graph.activityTemplates) {
    const prev = formOfType.get(t.activityType)
    if (prev === undefined || t.form > prev) formOfType.set(t.activityType, t.form)
  }

  // 1a. ItemCard missing but logged → scheduler.replay rebuild (eager)
  const byItem = new Map<string, ReviewLogEntry[]>()
  for (const e of log) {
    if (!gidx.graph.items[e.itemId]) continue
    const arr = byItem.get(e.itemId) ?? []
    arr.push(e)
    byItem.set(e.itemId, arr)
  }
  for (const [itemId, entries] of byItem) {
    if (cards.has(itemId)) continue
    const fsrs = scheduler.replay(entries, input.nowMs)
    if (!fsrs) continue
    let form: 0 | 1 | 2 = 0
    for (const e of entries) {
      if (e.grade < 2) continue // only passes ratchet
      const f = formOfType.get(e.activityType)
      if (f !== undefined && f > form) form = f
    }
    cards.set(itemId, { itemId, fsrs, flags: 0, form })
    report.rebuiltFromLog += 1
    console.error(`[journey-engine] recovered card ${itemId} from the review log`)
  }
  // 1b/1c (priorKnown reseed / fresh-on-exposure) stay lazy — getOrCreateCard.

  const hadHistory = cards.size > 0 || log.length > 0

  // 2. skills meta lost → recreate scalars from derived state
  let skills: Map<string, SkillScalars>
  if (input.skills) {
    skills = new Map(input.skills.map((s) => [s.skillId, s]))
  } else {
    skills = new Map()
    report.skillsLost = hadHistory
    if (hadHistory) console.error("[journey-engine] recovered skills meta from derived state")
    const mastery = createMastery({ gidx, cards, skills, scheduler })
    for (const skillId of Object.keys(gidx.graph.skills)) {
      const derived = mastery.getSkillState(skillId, input.nowMs)
      const scalars = defaultScalars(skillId)
      scalars.accEwma = derived.strength // best available proxy
      scalars.announcedLevel = 0
      skills.set(skillId, scalars)
      // recompute with the proxy in place; suppress a celebration storm
      mastery.markDirty(skillId)
      scalars.announcedLevel = mastery.getSkillState(skillId, input.nowMs).level
      if (input.course?.placement) scalars.placedAt = undefined // placement seeds carry placedAt below
    }
    if (input.course?.placement && input.course.placement.outcome !== "skipped-zero-beginner") {
      // re-stamp placedAt on skills the placement day plausibly unlocked
      for (const [skillId, scalars] of skills) {
        const skill = gidx.graph.skills[skillId]
        if (skill && skill.b <= input.course.placement.theta - 0.5) {
          scalars.placedAt = input.course.placement.day
        }
      }
    }
  }

  // 3. course meta lost → θ re-estimate + defaults; soft toast, never an error
  let course: CourseState
  if (input.course) {
    course = input.course
  } else {
    course = input.makeDefaultCourse()
    report.courseStateLost = hadHistory
    if (hadHistory) {
      console.error("[journey-engine] recovered course meta (θ re-estimated)")
      const mastery = createMastery({ gidx, cards, skills, scheduler })
      const practicedBs: number[] = []
      for (const skillId of Object.keys(gidx.graph.skills)) {
        if (mastery.levelOf(skillId, input.nowMs) >= 3) {
          practicedBs.push(gidx.graph.skills[skillId].b)
        }
      }
      practicedBs.sort((a, b) => a - b)
      course.theta = practicedBs.length > 0 ? percentile(practicedBs, 0.75) : -4
      course.newPerDay = NEW_PER_DAY_DEFAULT
      // position recomputed from derived levels
      let unitOrdinal = 0
      for (let i = 0; i < gidx.units.length; i++) {
        const done = gidx.units[i].skillIds.every((s) => mastery.levelOf(s, input.nowMs) >= 3)
        if (!done) {
          unitOrdinal = i
          break
        }
        unitOrdinal = i
      }
      const unit = gidx.units[unitOrdinal]
      if (unit) course.position = { arcId: unit.arcId, unitId: unit.unitId, unitOrdinal }
    }
  }

  return { course, skills, cards, report }
}
