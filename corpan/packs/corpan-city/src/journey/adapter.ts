/**
 * Journey activity adapter (activity-contract §6.3, R9-reconciled).
 *
 * corpan-city already speaks the activity contract in miniature — this is the
 * thin ActivitySpec ⟷ ChallengeSpec/ChallengeResultPlus adapter, NOT a
 * refactor. On a journey launch the Babylon world NEVER boots: the challenge
 * library mounts alone (the mockChallengeHost-proven standalone path). The
 * frozen city contracts, the NPC/quest flow, Track state, economy and
 * multiplayer are untouched; city standalone keeps all of it.
 *
 * Evidence rules (R9, normative): perItem prefers GENUINE per-entry verdicts
 * (the reserved `detail["item:<entryId>"]` convention). When a tool emits none
 * of those AND the spec scheduled EXACTLY ONE item (the Journey interlude
 * "drill one phrase" case, PREMIUM_SCROLL §4.2), the adapter bins the aggregate
 * `score` into that single item's outcome and stamps the reserved
 * `aggregateBinned` flag — the engine then clamps any derived FSRS grade to
 * [Hard, Good] (grading.ts, R9), so the one phrase the interlude taught gets
 * real per-item evidence instead of being lost as score-only. Multi-item rounds
 * with no per-entry verdicts still report SCORE-ONLY (`perItem: []`) — an
 * aggregate over several items is NEVER fanned out into fabricated per-item rows.
 */

import {
  ChallengeToolId,
  type ChallengeContext,
  type ChallengeResultPlus,
} from "@corpan-city/contracts"
import { runChallenge, createChallengeHost } from "../challenges/registry"
import type {
  ChallengeRuntimeHost,
  ChallengeEntry,
  CorpanChallengeHostApi,
} from "../challenges/host"
import type {
  ActivitySpec,
  ActivityResult,
  ActivityItemResult,
  ActivityOutcome,
  ItemRef,
  JourneyHostApi,
} from "../sdk/activityContract"

/** The pack's REGISTERED id (underscore form — installer rule). */
export const PACK_ID = "corpan_city"
const TYPE_PREFIX = `${PACK_ID}:`

/** The slice of HostApi the adapter touches (journey seam + content/TTS/STT). */
export type JourneyCapableHostApi = CorpanChallengeHostApi & {
  journey?: JourneyHostApi
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/**
 * Parse `corpan_city:<toolId>` → a runnable ChallengeToolId (legacy aliases
 * resolve inside runChallenge). Null for foreign namespaces / unknown tools.
 */
export function parseJourneyToolId(
  activityType: string,
): ChallengeToolId | null {
  if (!activityType.startsWith(TYPE_PREFIX)) return null
  const raw = activityType.slice(TYPE_PREFIX.length)
  const parsed = ChallengeToolId.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** The spec→challenge field mapping inputs (normative table, contract §6.3). */
export interface JourneyChallengeInputs {
  ctx: ChallengeContext
  /** Merged over the tool's buildSpec output, exactly like NPC tool-calls. */
  partialSpec: Record<string, unknown>
  /** entry id → source, for refs outside the base corpus. */
  entrySources: Record<string, string>
  /** entry id → the exact ItemRef the engine sent (result-side vocabulary). */
  refByEntryId: Map<number, ItemRef>
}

export function buildChallengeInputs(spec: ActivitySpec): JourneyChallengeInputs {
  const entryIds: number[] = []
  const entrySources: Record<string, string> = {}
  const refByEntryId = new Map<number, ItemRef>()
  for (const ref of spec.itemRefs) {
    if (ref.kind !== "phrase") continue
    const id = Number(ref.id)
    if (!Number.isFinite(id)) continue
    entryIds.push(id)
    refByEntryId.set(id, ref)
    // ChallengeSpec.entryIds carries no source; non-base refs travel through
    // params.entrySources so getEntriesByIds can forward the right source —
    // entry_id is only unique per source (contract §1.2).
    if (ref.source !== "base") entrySources[ref.id] = ref.source
  }

  // THEMED/LEVEL filter, when the engine sent one (contract §6.3 step 2).
  const contentFilter =
    spec.params && typeof spec.params.contentFilter === "object"
      ? (spec.params.contentFilter as { domains?: string[]; levels?: string[] })
      : undefined

  const ctx: ChallengeContext = {
    language: spec.targetLang,
    nativeLanguage: spec.nativeLang,
    level: spec.level,
    mode: "solo", // always, for journey
    entryIds: entryIds.length > 0 ? entryIds : undefined,
    domains: contentFilter?.domains,
    levels: contentFilter?.levels,
  }

  const partialSpec: Record<string, unknown> = {
    // Round-trip key: the internal challengeId IS the specId (contract §6.3).
    challengeId: spec.specId,
    ...(entryIds.length > 0 ? { entryIds } : {}),
    params: {
      ...(spec.params ?? {}),
      ...(Object.keys(entrySources).length > 0 ? { entrySources } : {}),
    },
  }

  return { ctx, partialSpec, entrySources, refByEntryId }
}

/**
 * ChallengeResultPlus → ActivityResult (normative mapping table, §6.3).
 * `xp`/`rewards`/`sig`/`playerId`/`offline` are dropped — Journey's
 * CelebrationLayer + FSRS replace the city economy for journey launches.
 */
export function toActivityResult(
  spec: ActivitySpec,
  plus: ChallengeResultPlus,
  durationMs: number,
  refByEntryId: Map<number, ItemRef>,
): ActivityResult {
  // perItem ONLY from genuine per-entry verdicts: the reserved
  // `item:<entryId>` = 0 | 0.5 | 1 detail convention (R9). Anything else —
  // including every city tool today — reports score-only.
  const perItem: ActivityItemResult[] = []
  for (const [key, value] of Object.entries(plus.detail ?? {})) {
    if (!key.startsWith("item:")) continue
    const entryId = Number(key.slice("item:".length))
    const ref = refByEntryId.get(entryId)
    // Verdicts on entries the engine didn't schedule are scenery, not evidence.
    if (!ref) continue
    const outcome: ActivityOutcome =
      value >= 1 ? "pass" : value > 0 ? "partial" : "fail"
    perItem.push({ itemRef: ref, outcome })
  }

  // SINGLE-ITEM AGGREGATE BINNING (R9, the interlude "one phrase" case): when a
  // tool emits NO genuine per-entry verdicts but the spec scheduled exactly one
  // phrase, the round's aggregate score IS that one phrase's evidence. Bin it and
  // flag `aggregateBinned` so the engine clamps the derived grade to [Hard, Good]
  // — never fabricating an Easy/Again from an aggregate. A completed round only
  // (an aborted round already carries `abandoned`, and binning a bail as a graded
  // hit would misinform FSRS).
  const scheduled = [...refByEntryId.values()]
  if (perItem.length === 0 && scheduled.length === 1 && plus.outcome !== "aborted") {
    const s = clamp01(plus.score)
    const outcome: ActivityOutcome = s >= 0.8 ? "pass" : s > 0 ? "partial" : "fail"
    perItem.push({
      itemRef: scheduled[0],
      outcome,
      detail: { flags: { aggregateBinned: true } },
    })
  }

  return {
    specId: spec.specId,
    score: clamp01(plus.score),
    perItem,
    // R3 envelope: the city's numeric detail maps into detail.numbers verbatim.
    detail: { numbers: { ...plus.detail } },
    durationMs: Math.max(0, durationMs),
    ...(plus.outcome === "aborted" ? { abandoned: true } : {}),
  }
}

/** Typed rail when present; `corpan:activity-result` event rail otherwise. */
function reportResult(
  hostApi: JourneyCapableHostApi,
  result: ActivityResult,
): void {
  try {
    if (hostApi.journey) {
      hostApi.journey.reportResult(result)
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("corpan:activity-result", {
          detail: { packId: PACK_ID, result },
        }),
      )
    }
  } catch (err) {
    console.error("[corpan-city journey] reportResult failed:", err)
  }
}

function exitPack(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  }
}

/**
 * Wrap the runtime host so getEntriesByIds honors per-entry sources (the
 * params.entrySources caveat, contract §6.3) without widening the frozen city
 * contracts.
 */
function sourceAwareHost(
  base: ChallengeRuntimeHost,
  entrySources: Record<string, string>,
): ChallengeRuntimeHost {
  if (Object.keys(entrySources).length === 0) return base
  return {
    ...base,
    getEntriesByIds: async (ids, source) => {
      const out: ChallengeEntry[] = []
      for (const id of ids) {
        const src = entrySources[String(id)] ?? source
        out.push(...(await base.getEntriesByIds([id], src)))
      }
      return out
    },
  }
}

/**
 * Mount corpan-city as a Journey activity provider: parse the tool from the
 * spec, run the challenge library standalone (world never boots), map the
 * result, report, exit. `runChallenge` never rejects (a cancel resolves with
 * `outcome: "aborted"`), so the mapping is total.
 */
export function mountJourneyChallenge(
  container: HTMLElement,
  hostApi: unknown,
  spec: ActivitySpec,
): { unmount: () => void } {
  const api = (hostApi ?? {}) as JourneyCapableHostApi
  const toolId = parseJourneyToolId(spec.activityType)
  if (!toolId) {
    // A spec this provider does not implement (contract §4.2).
    console.warn(
      `[corpan-city journey] unsupported activityType: ${spec.activityType}`,
    )
    try {
      api.journey?.abandon("unsupported")
    } catch (err) {
      console.error("[corpan-city journey] abandon failed:", err)
    }
    exitPack()
    return { unmount: () => {} }
  }

  const { ctx, partialSpec, entrySources, refByEntryId } =
    buildChallengeInputs(spec)
  const chHost = sourceAwareHost(createChallengeHost(api), entrySources)

  let disposed = false
  const startedAt = Date.now()

  void runChallenge(toolId, ctx, chHost, {
    container,
    partialSpec,
    uiLanguage: spec.nativeLang,
  }).then((plus) => {
    // After unmount the host already synthesized the abandoned result — a
    // late resolution here would be a stale duplicate; drop it.
    if (disposed) return
    disposed = true
    const result = toActivityResult(
      spec,
      plus,
      Date.now() - startedAt,
      refByEntryId,
    )
    reportResult(api, result)
    exitPack()
  })

  return {
    unmount: () => {
      disposed = true
    },
  }
}
