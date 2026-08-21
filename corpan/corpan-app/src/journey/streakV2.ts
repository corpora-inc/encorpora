// src/journey/streakV2.ts — streak v2 accounting (feed-ux §1.8): rest days,
// repair-by-learning, milestone detection. Pure functions over day strings +
// the journey store; NO duplication of store/progress.ts logic — book days
// stay in progress.streakDays(); journey "showed up" days live in the
// journey store (see store.ts note; W10 may re-home the day set into
// progress.ts additively per spec §1.8).
//
// Copy discipline (spec): the chip states "{{count}} days". No loss framing.

import { localDayOf, useJourneyStore, type CourseKey, type JourneyCourseMeta } from "../store/journey.ts"

export const REST_TOKEN_EVERY_DAYS = 7
export const REST_TOKEN_CAP = 2
export const REPAIR_MIN_STREAK = 14
export const REPAIR_WINDOW_DAYS = 3
export const REPAIR_CHECKPOINTS_NEEDED = 2
export const MILESTONE_DAYS = [7, 30, 100, 365] as const

const DAY_MS = 86_400_000

export function dayToEpoch(day: string): number {
  const [y, m, d] = day.split("-").map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1) / DAY_MS
}

export function epochToDay(epochDay: number): string {
  const d = new Date(epochDay * DAY_MS)
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${d.getUTCFullYear()}-${m}-${dd}`
}

/** Consecutive-day streak ending today (or yesterday — a streak is not
 *  "lost" before the user shows up on a new day). `days` = union of
 *  learning days and rest days already applied. */
export function streakLength(days: ReadonlySet<string>, today: string): number {
  if (days.size === 0) return 0
  let cursor = dayToEpoch(today)
  if (!days.has(epochToDay(cursor))) {
    cursor -= 1
    if (!days.has(epochToDay(cursor))) return 0
  }
  let n = 0
  while (days.has(epochToDay(cursor))) {
    n += 1
    cursor -= 1
  }
  return n
}

export interface StreakSnapshot {
  /** Current streak length in days (0 = none). */
  length: number
  restDayTokens: number
  /** localDay a token was auto-applied to today, if any (shown honestly). */
  restDayAppliedTo: string | null
  /** A new token was earned by this tick. */
  tokenEarned: boolean
  /** Milestone crossed by today's activity (7/30/100/365), if any. */
  milestone: number | null
  /** Repair offer active (render the repair card). */
  repair: JourneyCourseMeta["repair"]
}

export interface StreakPorts {
  /** Extra "showed up" day sources (e.g. book days from store/progress.ts).
   *  Registered by the surface; streakV2 never imports progress directly so
   *  the dependency stays one-way (progress stays journey-agnostic). */
  extraDayProviders?: Array<() => string[]>
  today?: string
}

const unionDays = (key: CourseKey, ports?: StreakPorts): Set<string> => {
  const s = useJourneyStore.getState()
  const meta = s.byCourse[key]
  const days = new Set<string>(s.learningDays)
  for (const d of meta?.restDaysUsed ?? []) days.add(d)
  for (const provider of ports?.extraDayProviders ?? []) {
    try {
      for (const d of provider()) days.add(d)
    } catch {
      /* provider failures never break the streak read */
    }
  }
  return days
}

/**
 * The one write path: called by the runtime after each completed card.
 * Idempotent per day. Applies banked rest tokens to a single missed day,
 * grants tokens every 7 consecutive days (cap 2), detects milestones, and
 * opens/settles the repair window.
 */
export function tickStreak(key: CourseKey, ports?: StreakPorts): StreakSnapshot {
  const store = useJourneyStore.getState()
  const today = ports?.today ?? localDayOf(new Date())
  const before = streakLength(unionDays(key, ports), today)

  store.recordLearningDay(today)
  store.enroll(key)
  const meta = () => useJourneyStore.getState().byCourse[key]

  // Rest-day auto-apply: exactly one missed day may be covered by a token.
  // (Two missed days break the streak even with two tokens banked — rest
  // days are a safety net, not a bypass.)
  let restDayAppliedTo: string | null = null
  const days = unionDays(key, ports)
  const yesterday = epochToDay(dayToEpoch(today) - 1)
  const dayBefore = epochToDay(dayToEpoch(today) - 2)
  if (!days.has(yesterday) && days.has(dayBefore) && (meta()?.restDayTokens ?? 0) > 0) {
    if (store.consumeRestDay(key, yesterday)) restDayAppliedTo = yesterday
  }

  const after = streakLength(unionDays(key, ports), today)

  // Token grant: one per 7 consecutive days, cap 2, at most one grant/day.
  let tokenEarned = false
  const m = meta()
  if (
    m &&
    after > 0 &&
    after % REST_TOKEN_EVERY_DAYS === 0 &&
    after !== before &&
    m.restDayTokens < REST_TOKEN_CAP &&
    !m.restDaysGrantedAt.includes(today)
  ) {
    store.grantRestDay(key, today)
    tokenEarned = true
  }

  const milestone =
    after !== before && (MILESTONE_DAYS as readonly number[]).includes(after) ? after : null

  return {
    length: after,
    restDayTokens: meta()?.restDayTokens ?? 0,
    restDayAppliedTo,
    tokenEarned,
    milestone,
    repair: meta()?.repair ?? null,
  }
}

/** Broken streak ≥14 days ⇒ offer a 3-day repair window (one banked at a
 *  time; never purchasable). Called at session start. Returns the offer if
 *  one is (now) active. */
export function maybeOfferRepair(
  key: CourseKey,
  brokenLength: number,
  ports?: StreakPorts,
): JourneyCourseMeta["repair"] {
  const store = useJourneyStore.getState()
  const today = ports?.today ?? localDayOf(new Date())
  const meta = store.byCourse[key]
  if (!meta) return null
  if (meta.repair) {
    // Expire a stale window.
    if (dayToEpoch(today) > dayToEpoch(meta.repair.deadlineDay)) {
      store.updateCourse(key, { repair: null })
      return null
    }
    return meta.repair
  }
  const current = streakLength(unionDays(key, ports), today)
  if (current > 0 || brokenLength < REPAIR_MIN_STREAK) return null
  const repair = {
    offeredAt: today,
    deadlineDay: epochToDay(dayToEpoch(today) + REPAIR_WINDOW_DAYS),
    checkpointsDone: 0,
    length: brokenLength,
  }
  store.updateCourse(key, { repair })
  return repair
}

/** Called when a checkpoint is reached. Completes the repair when the 2nd
 *  standard session lands inside the window; restored length merges into
 *  the display via `repairedLength`. Returns true on restore. */
export function noteRepairCheckpoint(key: CourseKey, ports?: StreakPorts): boolean {
  const store = useJourneyStore.getState()
  const today = ports?.today ?? localDayOf(new Date())
  const meta = store.byCourse[key]
  if (!meta?.repair) return false
  if (dayToEpoch(today) > dayToEpoch(meta.repair.deadlineDay)) {
    store.updateCourse(key, { repair: null })
    return false
  }
  const done = meta.repair.checkpointsDone + 1
  if (done >= REPAIR_CHECKPOINTS_NEEDED) {
    store.updateCourse(key, { repair: null, repairedLength: meta.repair.length })
    return true
  }
  store.updateCourse(key, { repair: { ...meta.repair, checkpointsDone: done } })
  return false
}

/** Display streak: live streak + a completed repair's restored length. */
export function displayStreak(key: CourseKey, ports?: StreakPorts): number {
  const today = ports?.today ?? localDayOf(new Date())
  const live = streakLength(unionDays(key, ports), today)
  const restored = useJourneyStore.getState().byCourse[key]?.repairedLength ?? 0
  return live > 0 ? live + restored : 0
}
