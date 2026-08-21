// src/lib/localAnalytics/index.ts — THE local analytics store
// (storage-analytics.md §4). Stance (normative):
//
// > This is the learner's own history, not telemetry. Every record stays on
// > this device. There is no upload path, no endpoint constant, no
// > drain/acknowledge seam in this module, and adding one is out of scope for
// > any engineering task without an explicit operator decision. It exists so
// > the app can be smart offline: engine calibration, personal records,
// > streak truth, strand balance. Cloud telemetry lives in util/analytics.ts
// > + lib/storage/eventStore.ts and is a different store.
//
// It is NOT gated by `corpan-analytics-disabled` — that flag governs
// telemetry upload; this data never leaves the device regardless (D-c). The
// user control here is deletion: Settings → Privacy → "Delete learning
// history" calls clearAll() (wipes log + rollups; FSRS cards are separate).
//
// Retention: 100k records / 48MB (namespaces.ts), oldest pruned in 10%
// batches — >16 months of history at a heavy learner's ~200 events/day.

import { appendLog, type AppendLog } from "../storage/log"
import {
  createEnginePersistence,
  type EnginePersistence,
} from "../storage/enginePersistence"
import type { DocCodec } from "../storage/doc"
import {
  localAnalyticsCodec,
  type LocalAnalyticsEvent,
  type LocalEventPayload,
  type SessionStartEvent,
  type SessionEndEvent,
} from "./events"
import { applyToRollups, clearRollups } from "./rollups"

export * from "./events"
export {
  rebuildRollups,
  getAllRollups,
  type DailyRollup,
} from "./rollups"
export * from "./queries"
export { buildPackLocalAnalyticsApi, type PackLocalAnalyticsApi } from "./packApi"

export const LOCAL_ANALYTICS_NS = "local-analytics"

/* ------------------------------ configuration ---------------------------- */

type LocalAnalyticsConfig = {
  /** Active stack id provider. The app wires the settings store here
   *  (INTEGRATOR/W10: `configureLocalAnalytics({ getStackId: () =>
   *  useSettingsStore.getState().activeStackId || "default" })` at boot). */
  getStackId: () => string
  /** Injected clock (deterministic tests; no naked Date.now in queries). */
  now: () => number
  /** Session-id minting. */
  makeSid: () => string
}

const config: LocalAnalyticsConfig = {
  getStackId: () => "default",
  now: () => Date.now(),
  makeSid: () => {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
      }
    } catch {
      /* fall through */
    }
    return `sid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  },
}

export function configureLocalAnalytics(cfg: Partial<LocalAnalyticsConfig>): void {
  Object.assign(config, cfg)
}

/** Injected-clock accessor shared with ./queries.ts. */
export function analyticsNow(): number {
  return config.now()
}

/** The in-memory session id (never persisted anywhere else). Used by the
 *  pack rate-limiter to seed today's count without double-counting this
 *  session's own events. */
export function currentSessionId(): string | null {
  return currentSid
}

/** The app's one local-day unit (YYYY-MM-DD, local tz — quotas.ts convention). */
export function localDay(epochMs: number): string {
  const d = new Date(epochMs)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

/* --------------------------------- the log ------------------------------- */

/** The one append-only source. Cap comes from namespaces.ts (100k/48MB).
 *  The engine reads this via EnginePersistence.events (§3.7) — one log, two
 *  readers, no second copy (D-a). */
export const localEvents: AppendLog<LocalAnalyticsEvent> = appendLog<LocalAnalyticsEvent>(
  LOCAL_ANALYTICS_NS,
  localAnalyticsCodec,
  { tsOf: (ev) => ev.ts, now: () => config.now() },
)

/* -------------------------------- recorder ------------------------------- */

let currentSid: string | null = null

function envelope(e: LocalEventPayload, ctx?: { courseId?: string }): LocalAnalyticsEvent {
  const ts = config.now()
  return {
    v: 1,
    ts,
    day: localDay(ts),
    sid: currentSid ?? (currentSid = config.makeSid()),
    stackId: config.getStackId(),
    ...(ctx?.courseId ? { courseId: ctx.courseId } : {}),
    e,
  }
}

/** Fire-and-forget append + incremental rollup. Never throws. */
export function recordLocal(e: LocalEventPayload, ctx?: { courseId?: string }): void {
  try {
    const ev = envelope(e, ctx)
    void localEvents.append(ev)
    void applyToRollups(ev)
  } catch (err) {
    console.error("[localAnalytics] recordLocal failed:", err)
  }
}

export function startLocalSession(
  s: Omit<SessionStartEvent, "type">,
  ctx?: { courseId?: string },
): string {
  currentSid = config.makeSid()
  recordLocal({ type: "session_start", ...s }, ctx)
  return currentSid
}

export function endLocalSession(
  e: Omit<SessionEndEvent, "type">,
  ctx?: { courseId?: string },
): void {
  recordLocal({ type: "session_end", ...e }, ctx)
  // Bound loss on kill to ≤ one batch window.
  void localEvents.flush()
}

/** "Delete learning history" (Settings → Privacy). Log + rollups; FSRS cards
 *  are separate and get their own reset in Journey settings. */
export async function clearAll(): Promise<void> {
  await localEvents.clear()
  await clearRollups()
}

/* --------------------------- engine persistence -------------------------- */

/** App wiring for the D5 engine persistence: cards + meta per
 *  (stackId, courseId), events = THE shared local-analytics log. */
export function createJourneyPersistence<Card>(
  stackId: string,
  courseId: string,
  cardCodec: DocCodec<Card>,
): EnginePersistence<Card, LocalAnalyticsEvent> {
  return createEnginePersistence({ stackId, courseId, cardCodec, events: localEvents })
}

/* ------------------------------- dev helpers ----------------------------- */

/** Doctor button: seed n synthetic events (test data for the dev panel). */
export async function seedSyntheticEvents(n = 100): Promise<number> {
  const strands = ["mfi", "mfo", "lfl", "fd"] as const
  for (let i = 0; i < n; i += 1) {
    recordLocal(
      {
        type: "activity_result",
        specId: `seed-${i}`,
        activityType: "choice_pick",
        provider: "native",
        slot: i % 5 === 0 ? "new" : "due",
        strand: strands[i % strands.length],
        score: (i % 10) / 10,
        durationMs: 4_000 + (i % 7) * 500,
        items: [
          {
            ref: `phrase:base:${1000 + i}`,
            outcome: i % 3 === 0 ? "fail" : "pass",
            grade: i % 3 === 0 ? 1 : 3,
            latencyMs: 900 + (i % 11) * 100,
            predictedRecall: ((i % 10) + 0.5) / 10,
          },
        ],
      },
      { courseId: "journey_en" },
    )
  }
  await localEvents.flush()
  return n
}
