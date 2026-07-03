// src/lib/localAnalytics/packApi.ts — the `hostApi.localAnalytics` builder
// (storage-analytics.md §5.2). Deliberately narrow: packs WRITE namespaced
// events and READ only aggregates derived from their own events (+ the
// journey activity_results whose providerId is theirs). No raw log reads, no
// cross-pack visibility, no envelope fields exposed (sid/stackId stay
// host-side). NEVER uploaded (§4.1).
//
// Journey-launched pack activities do NOT need `record` for results —
// results flow through hostApi.journey.reportResult and the HOST writes the
// `activity_result` event (§5.3, one writer, one shape). `record` is for
// pack-internal progression facts (e.g. a corpan-city badge earned) that the
// pack wants to survive its own localStorage retirement.
//
// INTEGRATOR (W10): wire in contentPacks/hostApi.ts as
//   localAnalytics: buildPackLocalAnalyticsApi(packId)
// type the member in contentPacks/types.ts as
// `localAnalytics?: PackLocalAnalyticsApi`, and advertise
// `localAnalytics: 1` in __CORPAN_HOST_CAPS.

import { recordLocal, localEvents, analyticsNow, localDay, currentSessionId } from "./index"
import type { PackEvent } from "./events"
import { PACK_EVENTS_PER_DAY } from "../storage/namespaces"
import { countPackEventDrop } from "../storage/health"

const DAY_MS = 24 * 60 * 60 * 1000

export interface PackLocalAnalyticsApi {
  /** Append a pack event to the on-device log. The host stamps the envelope
   *  and namespaces `type` to `pack:<packId>:<type>`; payload values are
   *  string | number | boolean only. Rate limit: 5,000 events/pack/day —
   *  excess dropped + counted in the doctor. */
  record(type: string, payload?: Record<string, string | number | boolean>): void
  getDailyCounts(opts: {
    type?: string
    windowDays?: number
  }): Promise<Array<{ day: string; count: number }>>
  getOwnActivityStats(opts?: {
    windowDays?: number
  }): Promise<{ cards: number; passRate: number; avgLatencyMs?: number }>
}

function sanitizePayload(
  payload?: Record<string, unknown>,
): Record<string, string | number | boolean> | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function buildPackLocalAnalyticsApi(packId: string): PackLocalAnalyticsApi {
  const prefix = `pack:${packId}:`

  // Daily rate-limit counter. In-memory for the session, seeded lazily from
  // today's log so an app restart can't reset a pack's budget. Writes made
  // while the seed scan is in flight are allowed through (bounded slop).
  let counterDay = ""
  let counter = 0
  let seeded = false
  let seeding: Promise<void> | null = null
  const seed = (day: string): void => {
    if (seeded || seeding) return
    const sid = currentSessionId()
    seeding = localEvents
      .scan(
        (n, rec) =>
          rec.entry.day === day &&
          rec.entry.e.type.startsWith(prefix) &&
          rec.entry.sid !== sid // this session's events are already counted
            ? n + 1
            : n,
        0,
        { fromTs: analyticsNow() - DAY_MS },
      )
      .then((n) => {
        counter += n
        seeded = true
      })
      .catch(() => {
        seeded = true // budget accounting is best-effort; never block capture
      })
  }

  return {
    record(type, payload) {
      try {
        if (!type || typeof type !== "string") return
        const day = localDay(analyticsNow())
        if (day !== counterDay) {
          counterDay = day
          counter = 0
          seeded = false
          seeding = null
        }
        seed(day)
        if (counter >= PACK_EVENTS_PER_DAY) {
          countPackEventDrop(packId)
          return
        }
        counter += 1
        const e: PackEvent = { type: `${prefix}${type}` as PackEvent["type"] }
        const clean = sanitizePayload(payload)
        if (clean) e.payload = clean
        recordLocal(e)
      } catch (err) {
        console.error(`[hostApi.localAnalytics] record failed for ${packId}:`, err)
      }
    },

    async getDailyCounts(opts) {
      const windowDays = opts.windowDays ?? 7
      const fullType = opts.type ? `${prefix}${opts.type}` : null
      const fromTs = analyticsNow() - windowDays * DAY_MS
      const byDay = await localEvents.scan<Map<string, number>>(
        (acc, rec) => {
          const t = rec.entry.e.type
          const match = fullType ? t === fullType : t.startsWith(prefix)
          if (match) acc.set(rec.entry.day, (acc.get(rec.entry.day) ?? 0) + 1)
          return acc
        },
        new Map(),
        { fromTs },
      )
      return [...byDay.entries()]
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => (a.day < b.day ? -1 : 1))
    },

    async getOwnActivityStats(opts) {
      const windowDays = opts?.windowDays ?? 30
      const fromTs = analyticsNow() - windowDays * DAY_MS
      const acc = await localEvents.scan(
        (a, rec) => {
          const e = rec.entry.e
          if (e.type !== "activity_result" || e.providerId !== packId) return a
          a.cards += 1
          for (const item of e.items) {
            a.items += 1
            if (item.outcome === "pass") a.passes += 1
            if (typeof item.latencyMs === "number") {
              a.latencySum += item.latencyMs
              a.latencyN += 1
            }
          }
          return a
        },
        { cards: 0, items: 0, passes: 0, latencySum: 0, latencyN: 0 },
        { fromTs },
      )
      return {
        cards: acc.cards,
        passRate: acc.items > 0 ? acc.passes / acc.items : 0,
        ...(acc.latencyN > 0 ? { avgLatencyMs: acc.latencySum / acc.latencyN } : {}),
      }
    },
  }
}
