// src/lib/localAnalytics/queries.ts — the aggregation contract
// (storage-analytics.md §4.5). All queries read ROLLUPS first (O(days));
// only getCalibrationReport and the session/streak parts of
// getPersonalRecords fall through to a bounded, cursor-chunked
// localEvents.scan. No query calls read() without a range bound.

import { localEvents, analyticsNow, localDay } from "./index"
import { getAllRollups, getRollup, rollupId, type DailyRollup } from "./rollups"
import type { Strand } from "./events"

const DAY_MS = 24 * 60 * 60 * 1000

/* ------------------------------ day helpers ------------------------------ */

function dayToEpoch(day: string): number {
  const [y, m, d] = day.split("-").map((s) => Number(s))
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1)
}

function dayDiff(a: string, b: string): number {
  return Math.round((dayToEpoch(a) - dayToEpoch(b)) / DAY_MS)
}

function addDays(day: string, n: number): string {
  const d = new Date(dayToEpoch(day) + n * DAY_MS)
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

/* ------------------------------- calibration ----------------------------- */

export type CalibrationBucket = {
  pLow: number
  pHigh: number
  predictedMean: number
  actualPassRate: number
  n: number
}
export type CalibrationReport = {
  buckets: CalibrationBucket[]
  brier: number
  n: number
  windowDays: number
}

/** Engine calibration: predicted (FSRS retrievability at ask time) vs actual
 *  pass, bucketed by predicted decile. Feeds the D4 report + future weight
 *  optimization. Exact Brier needs per-record residuals, so this one scans
 *  the (ts-bounded) window. */
export async function getCalibrationReport(
  courseId: string,
  opts?: { windowDays?: number; buckets?: number },
): Promise<CalibrationReport> {
  const windowDays = opts?.windowDays ?? 30
  const nBuckets = opts?.buckets ?? 10
  const fromTs = analyticsNow() - windowDays * DAY_MS
  const acc = await localEvents.scan(
    (a, rec) => {
      const ev = rec.entry
      if (ev.courseId !== courseId || ev.e.type !== "activity_result") return a
      for (const item of ev.e.items) {
        if (typeof item.predictedRecall !== "number") continue
        const p = Math.min(Math.max(item.predictedRecall, 0), 1)
        const pass = item.outcome === "pass" ? 1 : 0
        const b = Math.min(nBuckets - 1, Math.floor(p * nBuckets))
        a.buckets[b].n += 1
        a.buckets[b].pSum += p
        a.buckets[b].passes += pass
        a.brierSum += (p - pass) ** 2
        a.n += 1
      }
      return a
    },
    {
      buckets: Array.from({ length: nBuckets }, () => ({ n: 0, pSum: 0, passes: 0 })),
      brierSum: 0,
      n: 0,
    },
    { fromTs },
  )
  return {
    buckets: acc.buckets.map((b, i) => ({
      pLow: i / nBuckets,
      pHigh: (i + 1) / nBuckets,
      predictedMean: b.n > 0 ? b.pSum / b.n : 0,
      actualPassRate: b.n > 0 ? b.passes / b.n : 0,
      n: b.n,
    })),
    brier: acc.n > 0 ? acc.brierSum / acc.n : 0,
    n: acc.n,
    windowDays,
  }
}

/* ----------------------------- personal records --------------------------- */

export type PersonalRecords = {
  bestDayCards: { day: string; cards: number }
  bestSessionPassRate: { sid: string; passRate: number; cards: number }
  fastestCorrectMsByActivityType: Record<string, number>
  longestStreak: number
  mostItemsIntroducedInDay: { day: string; items: number }
}

/** "Ghost of you": the learner races their own bests, never a leaderboard. */
export async function getPersonalRecords(courseId: string): Promise<PersonalRecords> {
  const rollups = await getAllRollups(courseId)
  const best: PersonalRecords = {
    bestDayCards: { day: "", cards: 0 },
    bestSessionPassRate: { sid: "", passRate: 0, cards: 0 },
    fastestCorrectMsByActivityType: {},
    longestStreak: 0,
    mostItemsIntroducedInDay: { day: "", items: 0 },
  }
  for (const r of rollups) {
    if (r.cards > best.bestDayCards.cards) best.bestDayCards = { day: r.day, cards: r.cards }
    if (r.itemsIntroduced > best.mostItemsIntroducedInDay.items) {
      best.mostItemsIntroducedInDay = { day: r.day, items: r.itemsIntroduced }
    }
    for (const [type, t] of Object.entries(r.byActivityType)) {
      if (t.fastestCorrectMs === undefined) continue
      const cur = best.fastestCorrectMsByActivityType[type]
      if (cur === undefined || t.fastestCorrectMs < cur) {
        best.fastestCorrectMsByActivityType[type] = t.fastestCorrectMs
      }
    }
  }
  // Session bests + streak length live only in the raw log (chunked fold).
  const scanned = await localEvents.scan(
    (a, rec) => {
      const ev = rec.entry
      if (ev.courseId !== courseId) return a
      if (ev.e.type === "session_end" && ev.e.cards > 0) {
        if (
          ev.e.passRate > a.bestSession.passRate ||
          (ev.e.passRate === a.bestSession.passRate && ev.e.cards > a.bestSession.cards)
        ) {
          a.bestSession = { sid: ev.sid, passRate: ev.e.passRate, cards: ev.e.cards }
        }
      } else if (ev.e.type === "streak_day") {
        a.longestStreak = Math.max(a.longestStreak, ev.e.length)
      }
      return a
    },
    { bestSession: best.bestSessionPassRate, longestStreak: 0 },
  )
  best.bestSessionPassRate = scanned.bestSession
  best.longestStreak = scanned.longestStreak
  return best
}

/* -------------------------------- engagement ------------------------------ */

export type EngagementStatus = "new" | "current" | "at_risk" | "resurrected" | "dormant"
export type EngagementSnapshot = {
  status: EngagementStatus
  activeDaysLast28: number
  lastActiveDay: string | null
  gapDays: number
  resurrectedAt?: string // day the current return-from-≥7-day-gap began
}

/** CURR-style buckets applied to THIS learner's own day-series (local, per
 *  course): current = active within 1 day; at_risk = gap 2–6 days;
 *  resurrected = active today after gap ≥7; new = first 7 days since first
 *  event; dormant = gap ≥7 and inactive. Drives warm-win openers and
 *  re-entry copy — never notification spam. */
export async function getEngagementSnapshot(courseId?: string): Promise<EngagementSnapshot> {
  const rollups = await getAllRollups(courseId ?? null)
  const today = localDay(analyticsNow())
  const activeDays = rollups
    .filter((r) => r.cards > 0 || r.sessions > 0)
    .map((r) => r.day)
    .sort()
  if (activeDays.length === 0) {
    return { status: "new", activeDaysLast28: 0, lastActiveDay: null, gapDays: 0 }
  }
  const firstDay = activeDays[0]
  const lastActiveDay = activeDays[activeDays.length - 1]
  const gapDays = Math.max(0, dayDiff(today, lastActiveDay))
  const activeDaysLast28 = activeDays.filter((d) => dayDiff(today, d) < 28).length

  // Find the start of the current activity run and the gap that preceded it.
  let runStart = lastActiveDay
  for (let i = activeDays.length - 2; i >= 0; i -= 1) {
    if (dayDiff(runStart, activeDays[i]) >= 7) break
    runStart = activeDays[i]
  }
  const runStartIdx = activeDays.indexOf(runStart)
  const gapBeforeRun =
    runStartIdx > 0 ? dayDiff(runStart, activeDays[runStartIdx - 1]) : 0

  let status: EngagementStatus
  if (gapDays >= 7) status = "dormant"
  else if (dayDiff(today, firstDay) < 7) status = "new"
  else if (gapDays <= 1 && gapBeforeRun >= 7 && dayDiff(today, runStart) < 7) {
    status = "resurrected"
  } else if (gapDays <= 1) status = "current"
  else status = "at_risk"

  return {
    status,
    activeDaysLast28,
    lastActiveDay,
    gapDays,
    ...(status === "resurrected" ? { resurrectedAt: runStart } : {}),
  }
}

/* ------------------------------ strand balance ---------------------------- */

export type StrandBalance = Record<Strand, { ms: number; cards: number; share: number }>

/** Strand accounting over a rolling window — the D4 mixer's enforcement input.
 *  `share` is the strand's fraction of total time (sums to 1 when any time
 *  was spent). */
export async function getStrandBalance(
  courseId: string,
  windowDays = 7,
): Promise<StrandBalance> {
  const today = localDay(analyticsNow())
  const fromDay = addDays(today, -(windowDays - 1))
  const rollups = await getDailyRollups(courseId, fromDay, today)
  const out: StrandBalance = {
    mfi: { ms: 0, cards: 0, share: 0 },
    mfo: { ms: 0, cards: 0, share: 0 },
    lfl: { ms: 0, cards: 0, share: 0 },
    fd: { ms: 0, cards: 0, share: 0 },
  }
  for (const r of rollups) {
    for (const s of ["mfi", "mfo", "lfl", "fd"] as const) {
      out[s].ms += r.byStrand[s]?.ms ?? 0
      out[s].cards += r.byStrand[s]?.cards ?? 0
    }
  }
  const totalMs = out.mfi.ms + out.mfo.ms + out.lfl.ms + out.fd.ms
  if (totalMs > 0) {
    for (const s of ["mfi", "mfo", "lfl", "fd"] as const) out[s].share = out[s].ms / totalMs
  }
  return out
}

/* -------------------------------- raw rollups ----------------------------- */

export async function getDailyRollups(
  courseId: string | null,
  fromDay: string,
  toDay: string,
): Promise<DailyRollup[]> {
  const out: DailyRollup[] = []
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    const r = await getRollup(courseId, day)
    if (r) out.push(r)
    // Hard stop against malformed inputs (fromDay > toDay handled by the
    // loop condition; malformed day strings would loop forever otherwise).
    if (out.length > 10_000) break
  }
  return out
}

export { rollupId }
