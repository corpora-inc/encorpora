// src/lib/localAnalytics/rollups.ts — daily rollups (storage-analytics.md
// §4.6). Derived, rebuildable state: maintained incrementally at record time
// (riding the same WriteBatcher), and reproducible byte-identically from the
// raw log via rebuildRollups() — that's this namespace's §3.10 level-2
// recovery and a doctor button.

import { docStore, type DocStore, type DocCodec } from "../storage/doc"
import type { LocalAnalyticsEvent, Strand } from "./events"

export const CALIB_DECILES = 10

export type DailyRollup = {
  day: string
  courseId: string | null
  /** Completed activities (cards). */
  cards: number
  /** ITEM-level outcome tallies across the day's activity_results. */
  passes: number
  partials: number
  fails: number
  ms: number
  sessions: number
  /** Items debuted (counted from `slot: "new"` cards — the R12 debut slot). */
  itemsIntroduced: number
  byStrand: Record<Strand, { ms: number; cards: number }>
  byActivityType: Record<string, { cards: number; passes: number; fastestCorrectMs?: number }>
  /** 10 fixed predicted-recall deciles: {n, pSum, passes} per bucket. */
  calib: Array<{ n: number; pSum: number; passes: number }>
}

const ROLLUP_NS = "analytics-rollups"
const ROLLUP_SCHEMA = 1

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

const rollupCodec: DocCodec<DailyRollup> = {
  schemaVersion: ROLLUP_SCHEMA,
  parse(raw: unknown): DailyRollup | null {
    if (!isRecord(raw)) return null
    if (typeof raw.day !== "string") return null
    if (typeof raw.cards !== "number") return null
    if (!isRecord(raw.byStrand)) return null
    if (!Array.isArray(raw.calib)) return null
    return raw as unknown as DailyRollup
  },
}

let store: DocStore<DailyRollup> | null = null
function rollupStore(): DocStore<DailyRollup> {
  if (!store) store = docStore<DailyRollup>(ROLLUP_NS, rollupCodec)
  return store
}

export function rollupId(courseId: string | null, day: string): string {
  return `${courseId ?? "app"}:${day}`
}

export function emptyRollup(courseId: string | null, day: string): DailyRollup {
  return {
    day,
    courseId,
    cards: 0,
    passes: 0,
    partials: 0,
    fails: 0,
    ms: 0,
    sessions: 0,
    itemsIntroduced: 0,
    byStrand: {
      mfi: { ms: 0, cards: 0 },
      mfo: { ms: 0, cards: 0 },
      lfl: { ms: 0, cards: 0 },
      fd: { ms: 0, cards: 0 },
    },
    byActivityType: {},
    calib: Array.from({ length: CALIB_DECILES }, () => ({ n: 0, pSum: 0, passes: 0 })),
  }
}

// In-memory cache of live rollup docs so bursts of events mutate one object
// and coalesce into one batched put per flush window. Single-flight loads.
const cache = new Map<string, DailyRollup>()
const loading = new Map<string, Promise<DailyRollup>>()

async function loadRollup(courseId: string | null, day: string): Promise<DailyRollup> {
  const id = rollupId(courseId, day)
  const hit = cache.get(id)
  if (hit) return hit
  const inFlight = loading.get(id)
  if (inFlight) return inFlight
  const p = (async () => {
    const existing = await rollupStore().get(id)
    const r = existing ?? emptyRollup(courseId, day)
    cache.set(id, r)
    loading.delete(id)
    return r
  })()
  loading.set(id, p)
  return p
}

/** Fold ONE event into a rollup object (pure mutation — used by both the
 *  live apply path and rebuildRollups, so they cannot diverge). */
export function foldEvent(r: DailyRollup, ev: LocalAnalyticsEvent): void {
  const e = ev.e
  switch (e.type) {
    case "activity_result": {
      r.cards += 1
      r.ms += e.durationMs
      const strand = r.byStrand[e.strand]
      if (strand) {
        strand.cards += 1
        strand.ms += e.durationMs
      }
      const byType = (r.byActivityType[e.activityType] ??= { cards: 0, passes: 0 })
      byType.cards += 1
      let allPassed = e.items.length > 0
      for (const item of e.items) {
        if (item.outcome === "pass") r.passes += 1
        else if (item.outcome === "partial") r.partials += 1
        else r.fails += 1
        if (item.outcome !== "pass") allPassed = false
        if (item.outcome === "pass" && typeof item.latencyMs === "number") {
          byType.fastestCorrectMs =
            byType.fastestCorrectMs === undefined
              ? item.latencyMs
              : Math.min(byType.fastestCorrectMs, item.latencyMs)
        }
        if (typeof item.predictedRecall === "number") {
          const p = Math.min(Math.max(item.predictedRecall, 0), 1)
          const bucket = Math.min(CALIB_DECILES - 1, Math.floor(p * CALIB_DECILES))
          const b = r.calib[bucket]
          b.n += 1
          b.pSum += p
          if (item.outcome === "pass") b.passes += 1
        }
      }
      if (allPassed) byType.passes += 1
      if (e.slot === "new") r.itemsIntroduced += e.items.length
      break
    }
    case "session_end":
      r.sessions += 1
      break
    default:
      // Impressions, placement, streak, checkpoint, rare, pack events don't
      // shape the daily rollup; queries that need them scan the log.
      break
  }
}

/** Incremental apply at record time. Rides the shared batcher (coalesced put
 *  per flush window). Writes the course rollup AND the app-wide rollup. */
export async function applyToRollups(ev: LocalAnalyticsEvent): Promise<void> {
  try {
    const targets: Array<string | null> = [null]
    if (ev.courseId) targets.push(ev.courseId)
    for (const courseId of targets) {
      const r = await loadRollup(courseId, ev.day)
      foldEvent(r, ev)
      void rollupStore().put(rollupId(courseId, ev.day), r)
    }
  } catch (err) {
    console.error("[localAnalytics/rollups] apply failed:", err)
  }
}

export async function getRollup(
  courseId: string | null,
  day: string,
): Promise<DailyRollup | undefined> {
  const id = rollupId(courseId, day)
  return cache.get(id) ?? rollupStore().get(id)
}

/** Every rollup for a course (or the app-wide series with null). */
export async function getAllRollups(courseId: string | null): Promise<DailyRollup[]> {
  const prefix = `${courseId ?? "app"}:`
  const all = await rollupStore().getAll()
  const out: DailyRollup[] = []
  for (const [id, r] of all) {
    if (id.startsWith(prefix)) out.push(cache.get(id) ?? r)
  }
  out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  return out
}

/** Rebuild the whole namespace from the raw log (chunked scan) — the
 *  derived-state recovery path. Returns the number of rollup docs written. */
export async function rebuildRollups(): Promise<number> {
  const { localEvents } = await import("./index")
  await rollupStore().clear()
  cache.clear()
  loading.clear()
  const rebuilt = await localEvents.scan<Map<string, DailyRollup>>(
    (acc, rec) => {
      const ev = rec.entry
      const targets: Array<string | null> = [null]
      if (ev.courseId) targets.push(ev.courseId)
      for (const courseId of targets) {
        const id = rollupId(courseId, ev.day)
        let r = acc.get(id)
        if (!r) {
          r = emptyRollup(courseId, ev.day)
          acc.set(id, r)
        }
        foldEvent(r, ev)
      }
      return acc
    },
    new Map(),
  )
  for (const [id, r] of rebuilt) {
    cache.set(id, r)
    void rollupStore().put(id, r)
  }
  await rollupStore().flush()
  return rebuilt.size
}

export async function clearRollups(): Promise<void> {
  cache.clear()
  loading.clear()
  await rollupStore().clear()
}
