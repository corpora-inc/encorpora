// src/lib/localAnalytics/events.ts — the on-device event taxonomy (v1) and
// its codec (storage-analytics.md §4.3).
//
// > This is the learner's own history, not telemetry. Every record stays on
// > this device. There is no upload path, no endpoint constant, no
// > drain/acknowledge seam in this module, and adding one is out of scope for
// > any engineering task without an explicit operator decision. It exists so
// > the app can be smart offline: engine calibration, personal records,
// > streak truth, strand balance. Cloud telemetry lives in util/analytics.ts
// > + lib/storage/eventStore.ts and is a different store.
//
// Non-goals: not telemetry; not an A/B substrate; no device/user identifiers
// in any payload; no free-text (fixed unions + numbers + ids only); no PII.
//
// New event types are ADDITIVE (extend the union, bump nothing); breaking
// payload changes bump envelope `v` and the codec migrates or skips old
// records.

import type { DocCodec } from "../storage/doc"

/** Four Strands (D4 mixer accounting). */
export type Strand = "mfi" | "mfo" | "lfl" | "fd"

export type FeedSlot =
  | "due"
  | "new"
  | "repair"
  | "fun"
  | "flex"
  | "checkpoint"
  | "placement"

/** Envelope — every event carries this. */
export type LocalAnalyticsEvent = {
  v: 1
  ts: number // epoch ms
  day: string // localDay() YYYY-MM-DD (the app's one time unit, quotas.ts convention)
  sid: string // in-memory session uuid (new per app session; never persisted elsewhere)
  stackId: string
  courseId?: string // absent for non-journey surfaces
  e: LocalEventPayload
}

export type LocalEventPayload =
  | ActivityResultEvent
  | CardImpressionEvent
  | SessionStartEvent
  | SessionEndEvent
  | PlacementProbeEvent
  | PlacementFinalEvent
  | StreakDayEvent
  | StreakRepairEvent
  | RestDayEarnedEvent
  | StreakLostEvent
  | CheckpointEvent
  | RareCardEvent
  | PackEvent

/** One per completed/abandoned activity. THE calibration + review-history record. */
export type ActivityResultEvent = {
  type: "activity_result"
  specId: string
  activityType: string
  provider: "native" | "capability" | "pack" // D8/D14 provenance
  providerId?: string // pack/module id when not native
  slot: FeedSlot
  strand: Strand // stamped by the mixer on the spec
  score: number // 0..1 (ActivityResult.score)
  durationMs: number
  abandoned?: boolean
  items: Array<{
    ref: string // serialized ItemRef (activityContract.ts R2)
    outcome: "pass" | "partial" | "fail"
    grade: 1 | 2 | 3 | 4 // derived FSRS grade (D4)
    latencyMs?: number
    hintsUsed?: number
    /** FSRS retrievability of this item AT ASK TIME — the predicted-vs-actual key. */
    predictedRecall?: number
    /** Elo inputs at ask time — θ calibration. */
    b?: number
    theta?: number
  }>
}

export type CardImpressionEvent = {
  type: "card_impression"
  specId: string
  activityType: string
  slot: FeedSlot
  strand: Strand
  position: number // 0-based index within the session feed
  itemCount: number
}

export type SessionStartEvent = {
  type: "session_start"
  trigger: "landing" | "home_hero" | "deeplink" | "resume"
  dueCount: number
  newCount: number
  theta?: number
}

export type SessionEndEvent = {
  type: "session_end"
  cards: number
  passRate: number // 0..1 over the session's activity_results
  durationMs: number
  endReason: "checkpoint_stop" | "quit" | "backgrounded" | "daily_lock" | "feed_exhausted"
}

export type PlacementProbeEvent = {
  type: "placement_probe"
  ref: string
  b: number
  outcome: "pass" | "fail"
  thetaAfter: number
  seAfter: number
}

export type PlacementFinalEvent = {
  type: "placement_final"
  theta: number
  se: number
  band: string // arc/unit band label from the course pack
  itemsUsed: number
  durationMs: number
  priorKnownSeeded: number
}

export type StreakDayEvent = { type: "streak_day"; length: number; restDaysBanked: number }
export type StreakRepairEvent = { type: "streak_repair"; lengthRestored: number }
export type RestDayEarnedEvent = { type: "rest_day_earned"; banked: number }
export type StreakLostEvent = { type: "streak_lost"; length: number }

export type CheckpointEvent = { type: "checkpoint"; position: number; choice: "stop" | "continue" }
export type RareCardEvent = {
  type: "rare_card"
  rarity: "delight" | "minigame" | "gem" | "story"
  cardKind: string
}

/** Pack-internal progression fact via hostApi.localAnalytics (§5.2). The
 *  host stamps the `pack:<packId>:` prefix; payload values are
 *  string | number | boolean only. */
export type PackEvent = {
  type: `pack:${string}`
  payload?: Record<string, string | number | boolean>
}

/* -------------------------------- codec ---------------------------------- */

export const LOCAL_ANALYTICS_SCHEMA_VERSION = 1

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Structural validation (dependency-free per the DocCodec contract).
 *  Corrupt records are skipped in reads/scans and counted in the doctor —
 *  never thrown. Unknown FUTURE payload types with a valid envelope pass
 *  through (additive-evolution rule). */
export const localAnalyticsCodec: DocCodec<LocalAnalyticsEvent> = {
  schemaVersion: LOCAL_ANALYTICS_SCHEMA_VERSION,
  parse(raw: unknown): LocalAnalyticsEvent | null {
    if (!isRecord(raw)) return null
    if (raw.v !== 1) return null
    if (typeof raw.ts !== "number" || !Number.isFinite(raw.ts)) return null
    if (typeof raw.day !== "string" || raw.day.length !== 10) return null
    if (typeof raw.sid !== "string" || raw.sid.length === 0) return null
    if (typeof raw.stackId !== "string" || raw.stackId.length === 0) return null
    if (raw.courseId !== undefined && typeof raw.courseId !== "string") return null
    const e = raw.e
    if (!isRecord(e) || typeof e.type !== "string" || e.type.length === 0) return null
    return raw as unknown as LocalAnalyticsEvent
  },
}
