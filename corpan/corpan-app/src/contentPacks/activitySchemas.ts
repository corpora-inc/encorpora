// Journey activity contract — HOST-SIDE validation + session ownership.
//
// Two things live here, neither of which ever enters the pack-facing SDK copy
// (activityContract.ts is the vendored, dependency-free contract; this file is
// host-only and may depend on zod):
//
//   1. Zod schemas for every payload that crosses in FROM a pack. Each schema
//      is pinned to its TS type with `satisfies z.ZodType<...>` so the type
//      file and the validator cannot drift silently.
//   2. The activity SESSION module — the SINGLE owner of result routing and
//      the abandon path (spec §3.2 / R8). The typed rail (`hostApi.journey`)
//      and the event rail (`corpan:activity-result`) both funnel into the one
//      ingest here; the feed consumes results ONLY through the
//      `beginActivitySession` callback and never re-implements routing or
//      synthesizes results itself. Guarantees: per-item dedup by itemRefKey
//      (last write wins), first terminal result wins, teardown synthesis from
//      the buffered `reportItem` evidence, exactly one `onResult` per session.
//
// Spec: corpan/docs/journey/specs/activity-contract.md §3.

import { z } from "zod"
import type {
  ItemRef,
  ActivitySpec,
  ActivityDetail,
  ActivityItemResult,
  ActivityResult,
  ActivityResultEventDetail,
  PackActivityDeclaration,
  AbandonReason,
} from "./activityContract"
import { itemRefKey } from "./activityContract"
// itemRefKey/parseItemRef live in activityContract.ts (R2) — the ONE helper;
// nothing here re-implements serialization.

/** Journey contract version advertised in `__CORPAN_HOST_CAPS.journey`. */
export const JOURNEY_CONTRACT_VERSION = 1

// ============================================================
// Zod schemas — the host boundary (§3.1)
// ============================================================

export const ItemRefKindSchema = z.enum([
  "phrase", "word", "char", "segment", "grammarNode", "phoneme", "concept",
])

export const ItemRefSchema = z.object({
  kind: ItemRefKindSchema,
  source: z.string().min(1),
  id: z.string().min(1),
}) satisfies z.ZodType<ItemRef>

export const ModelNeedSchema = z.enum(["stt", "llm", "tts"])

export const ActivitySpecSchema = z.object({
  specId: z.string().min(1),
  activityType: z.string().min(1),
  itemRefs: z.array(ItemRefSchema),
  params: z.record(z.string(), z.unknown()).optional(),
  level: z.string().optional(),
  targetLang: z.string().min(2),
  nativeLang: z.string().min(2).optional(),
  timeboxSec: z.number().positive().optional(),
  modelNeeds: z.array(ModelNeedSchema).optional(),
}) satisfies z.ZodType<ActivitySpec>

export const ActivityDetailSchema = z.object({
  numbers: z.record(z.string(), z.number()).optional(),
  flags: z.record(z.string(), z.boolean()).optional(),
  selfReport: z.enum(["already-knew", "never-learned"]).optional(),
  stt: z.object({
    overallScore: z.number().min(0).max(1),
    perWord: z.array(z.object({
      word: z.string(),
      probability: z.number(),
      startMs: z.number(),
      endMs: z.number(),
    })).optional(),
  }).optional(),
}) satisfies z.ZodType<ActivityDetail>

export const ActivityItemResultSchema = z.object({
  itemRef: ItemRefSchema,
  outcome: z.enum(["pass", "partial", "fail"]),
  latencyMs: z.number().nonnegative().optional(),
  hintsUsed: z.number().int().nonnegative().optional(),
  detail: ActivityDetailSchema.optional(),
}) satisfies z.ZodType<ActivityItemResult>

export const ActivityResultSchema = z.object({
  specId: z.string().min(1),
  score: z.number().min(0).max(1),
  perItem: z.array(ActivityItemResultSchema),
  detail: ActivityDetailSchema.optional(),
  durationMs: z.number().nonnegative(),
  abandoned: z.boolean().optional(),
}) satisfies z.ZodType<ActivityResult>

export const ActivityResultEventDetailSchema = z.object({
  packId: z.string().min(1),
  result: ActivityResultSchema,
}) satisfies z.ZodType<ActivityResultEventDetail>

export const PackActivityDeclarationSchema = z.object({
  activityType: z.string().min(1),
  itemKinds: z.array(ItemRefKindSchema).min(1),
  requiredHostApis: z.array(z.string()).optional(),
  modelNeeds: z.array(ModelNeedSchema).optional(),
  typicalDurationSec: z.number().positive().optional(),
  strands: z.array(z.enum(["mfi", "mfo", "lfl", "fd"])).optional(),
  minJourneyCaps: z.number().int().positive().optional(),
}) satisfies z.ZodType<PackActivityDeclaration>

// ============================================================
// The activity session — single owner of routing + abandon (§3.2, R8)
// ============================================================
//
// A module-level singleton session (the architecture guarantees one pack
// overlay at a time). The Journey feed controller owns begin/end;
// `createHostApi` and the `corpan:activity-result` window listener both
// delegate here. Pure TS, no React.

export type ActivityResultMeta = {
  /** true when the host built the result (abandon/unmount/error), not the pack. */
  synthesized: boolean
  reason?: AbandonReason
  receivedAt: number
}

export type ActivitySessionCallbacks = {
  onResult: (result: ActivityResult, meta: ActivityResultMeta) => void
}

type Session = {
  packId: string
  spec: ActivitySpec
  startedAt: number
  itemBuffer: ActivityItemResult[]
  terminal: boolean
  callbacks: ActivitySessionCallbacks
}

let session: Session | null = null

/**
 * Normalize a pack id's hyphen/underscore form (WS-F un-wedge). A provider's
 * own `reportResult()`/event-rail packId has been observed to drift from the
 * id the launch side used — `corpan-city` vs `corpan_city` — never a
 * DIFFERENT pack, just a different separator convention for the SAME one.
 * Every packId identity check below runs both sides through this so a
 * genuine terminal result is never dropped as "result from wrong pack"
 * purely over formatting drift (which previously left the session open
 * forever — see runtime.ts's pendingPack watchdog for the launch-side half
 * of this fix). Pure string normalize; stored ids are never rewritten. */
function normalizePackId(packId: string): string {
  return packId.trim().toLowerCase().replace(/-/g, "_")
}

/**
 * Feed controller calls this IMMEDIATELY BEFORE handleLaunchGame. Returns
 * false when the spec is refused (currently: `modelNeeds` carrying both
 * "stt" and "llm" — mutually exclusive per spec §7; the card is skipped, no
 * session opens). Callers coded against the spec's `void` signature may
 * ignore the return value.
 */
export function beginActivitySession(
  packId: string,
  spec: ActivitySpec,
  callbacks: ActivitySessionCallbacks,
): boolean {
  const needs = spec.modelNeeds ?? []
  if (needs.includes("stt") && needs.includes("llm")) {
    reject(`spec ${spec.specId} declares both stt and llm (mutually exclusive)`, packId)
    return false
  }
  // A still-open previous session is finalized as abandoned("user_exit") first
  // — belt-and-braces; the feed controller normally ends it at card teardown.
  if (session && !session.terminal) finalizeAbandoned("user_exit")
  session = { packId, spec, startedAt: Date.now(), itemBuffer: [], terminal: false, callbacks }
  return true
}

export function isActiveFor(packId: string): boolean {
  return (
    !!session &&
    !session.terminal &&
    normalizePackId(session.packId) === normalizePackId(packId)
  )
}

export function activeSpecFor(packId: string): ActivitySpec | null {
  return isActiveFor(packId) ? session!.spec : null
}

/** Both rails call this. Returns false when rejected (logged, never thrown). */
export function ingestItem(packId: string, raw: unknown): boolean {
  if (!isActiveFor(packId)) return reject("item from inactive session", packId)
  const parsed = ActivityItemResultSchema.safeParse(raw)
  if (!parsed.success) return reject(`invalid item: ${parsed.error.message}`, packId)
  // Per-item dedup: last write wins per itemRefKey (a provider may upgrade
  // partial→pass on retry within one activity); buffer stays presentation-ordered.
  const key = itemRefKey(parsed.data.itemRef)
  const i = session!.itemBuffer.findIndex((x) => itemRefKey(x.itemRef) === key)
  if (i >= 0) session!.itemBuffer[i] = parsed.data
  else session!.itemBuffer.push(parsed.data)
  return true
}

/** Both rails call this. First terminal wins; everything after is dropped. */
export function ingestResult(packId: string, raw: unknown): boolean {
  if (!session || session.terminal) return reject("result after terminal / no session", packId)
  if (normalizePackId(session.packId) !== normalizePackId(packId))
    return reject("result from wrong pack", packId)
  const parsed = ActivityResultSchema.safeParse(raw)
  if (!parsed.success) return reject(`invalid result: ${parsed.error.message}`, packId)
  if (parsed.data.specId !== session.spec.specId)
    return reject(`stale specId ${parsed.data.specId}`, packId)
  session.terminal = true
  session.callbacks.onResult(parsed.data, {
    synthesized: false,
    receivedAt: Date.now(),
  })
  return true
}

/** Provider abandon() OR host teardown. Idempotent. */
export function finalizeAbandoned(reason: AbandonReason): void {
  if (!session || session.terminal) return
  session.terminal = true
  const s = session
  const attempted = s.itemBuffer.length
  const passed = s.itemBuffer.filter((x) => x.outcome === "pass").length
  s.callbacks.onResult(
    {
      specId: s.spec.specId,
      // Score over items FACED only; zero faced ⇒ 0 (the engine ignores the
      // scalar on abandoned results anyway — perItem is the evidence, D4).
      score: attempted > 0 ? passed / attempted : 0,
      perItem: s.itemBuffer,
      durationMs: Date.now() - s.startedAt,
      abandoned: true,
    },
    { synthesized: true, reason, receivedAt: Date.now() },
  )
}

/** Feed controller calls this after the overlay unmounts. */
export function endActivitySession(): void {
  finalizeAbandoned("user_exit") // no-op if a terminal result already landed
  session = null
}

// --- rejection reporting -----------------------------------------------------

type RejectionListener = (packId: string, why: string) => void
let rejectionListener: RejectionListener | null = null

/**
 * Optional fire-and-forget hook for on-device analytics
 * (`journey_result_rejected`, §3.4). Wired by hostApi.ts so this module stays
 * dependency-light (zod + the contract only). The listener must never throw
 * consequences into a pack — failures here are swallowed.
 */
export function setActivityRejectionListener(listener: RejectionListener | null): void {
  rejectionListener = listener
}

function reject(why: string, packId: string): false {
  console.warn(`[journey] dropped activity report from ${packId}: ${why}`)
  try {
    rejectionListener?.(packId, why)
  } catch {
    // fire-and-forget: analytics must never throw into the reporting path
  }
  return false
}

// ============================================================
// Event rail — `corpan:activity-result` (§3.3, fallback for OTA packs) +
// `corpan:exit` teardown synthesis (WS-F un-wedge)
// ============================================================

let eventRailInstalled = false

/**
 * Register the window-event fallback rail ONCE. Validated with Zod at the
 * boundary, then funneled into the same `ingestResult` as the typed rail
 * (single-owner rule, R8). Idempotent; safe to call in non-window contexts
 * (no-op). Returns an uninstaller (used by tests; the app installs for life).
 *
 * Also installs the `corpan:exit` teardown listener (WS-F): App.tsx/
 * ContentPackHost dispatch `corpan:exit` on EVERY experience-overlay exit —
 * normal pack completion (after `reportResult`, so `endActivitySession` here
 * is a no-op: `finalizeAbandoned` only acts on a still-open, non-terminal
 * session) AND the crash / stuck-pack / dropped-report paths that otherwise
 * leave the session (and the host's `pendingPack` launch-gate, runtime.ts)
 * wedged forever. Listening here — inside the single-owner session module,
 * which we own — rather than requiring every overlay-mount call site to
 * remember to call `endActivitySession()` guarantees this runs for every
 * pack exit without editing App.tsx/ContentPackHost (which we don't own).
 * A no-op outside a journey launch: `endActivitySession()` no-ops with no
 * open session, matching the standalone-launch behavior everywhere else in
 * this module. Shares the same install lifecycle/uninstaller as the result
 * rail so `hostApi.ts`'s existing single call site wires both.
 */
export function installActivityResultEventRail(): () => void {
  if (typeof window === "undefined" || eventRailInstalled) return () => {}
  const onActivityResult = (e: Event) => {
    const detail = (e as CustomEvent<unknown>).detail
    const parsed = ActivityResultEventDetailSchema.safeParse(detail)
    if (!parsed.success) {
      console.warn("[journey] invalid corpan:activity-result dropped:", parsed.error.message)
      return
    }
    ingestResult(parsed.data.packId, parsed.data.result)
  }
  const onExit = () => endActivitySession()
  window.addEventListener("corpan:activity-result", onActivityResult)
  window.addEventListener("corpan:exit", onExit)
  eventRailInstalled = true
  return () => {
    window.removeEventListener("corpan:activity-result", onActivityResult)
    window.removeEventListener("corpan:exit", onExit)
    eventRailInstalled = false
  }
}
