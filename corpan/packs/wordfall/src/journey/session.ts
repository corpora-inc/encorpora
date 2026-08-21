/**
 * journey/session.ts — the Journey-launch session for Wordfall.
 *
 * One WordfallSession per journey mount (activity-contract §6.1). It owns:
 *   - the ActivitySpec (target/native langs, itemRefs, params),
 *   - the per-item evidence buffer (reportItem streams as each tile resolves),
 *   - the terminal ActivityResult (reportResult ONCE at the natural end).
 *
 * It is DOM-free and Game-free so the instrumentation is unit-testable headless.
 * When NOT journey-launched, no session exists — the game samples random entries
 * and never reports (see main.ts / Game standalone path).
 *
 * Reporting rails (activity-contract §3.3):
 *   - typed rail `hostApi.journey.reportItem/reportResult` when present;
 *   - `corpan:activity-result` CustomEvent fallback for the TERMINAL result only
 *     (there is deliberately NO event fallback for reportItem — contract §3.3).
 */

import type {
  ActivitySpec,
  ActivityItemResult,
  ActivityResult,
  ActivityOutcome,
  ItemRef,
} from "../sdk/activityContract"
import { itemRefKey } from "../sdk/activityContract"
import type { HostApi } from "../sdk/types"

/** The pack's registered id — MUST stay the underscore form (installer rule). */
export const PACK_ID = "wordfall"

/** The one activity type this provider implements (activity-contract §6.1). */
export const JOURNEY_ACTIVITY_TYPE = "wordfall:catch"

/** Spec params for `wordfall:catch`. */
export type WordfallParams = {
  /** How many target tiles to rain (defaults to itemRefs.length, min 1). */
  rounds?: number
  /** 0..1 starting fall-speed bias; ramps up each round. */
  intensity?: number
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

export type CatchOutcome = "caught" | "missed" | "wrong"

const OUTCOME_MAP: Record<CatchOutcome, ActivityOutcome> = {
  caught: "pass",
  // A distractor caught (wrong tap) or the correct tile hit the floor both
  // count as a fail for the item's FSRS grade.
  wrong: "fail",
  missed: "fail",
}

export class WordfallSession {
  readonly spec: ActivitySpec
  readonly rounds: number
  readonly initialIntensity: number

  private hostApi: HostApi
  private startedAt = Date.now()

  /** spec item lookup: entry id → the exact ItemRef the engine sent. */
  private refByEntryId = new Map<number, ItemRef>()
  /** entry ids from the spec, in presentation order (the round backlog). */
  readonly entryIds: number[] = []

  /** per-item evidence buffer (last write wins per itemRefKey). */
  private itemsByKey = new Map<string, ActivityItemResult>()
  private itemOrder: string[] = []

  private bestCombo = 0
  private reported = false

  constructor(spec: ActivitySpec, hostApi: HostApi) {
    this.spec = spec
    this.hostApi = hostApi

    const params = (spec.params ?? {}) as WordfallParams
    const intensity = Number(params.intensity)
    this.initialIntensity = Number.isFinite(intensity) ? clamp01(intensity) : 0.15

    for (const ref of spec.itemRefs) {
      // Accept phrase (corpus entry) and word ItemRefs; both address a target
      // surface. Only numeric-id phrase refs resolve to corpus entries.
      const id = Number(ref.id)
      if (!Number.isFinite(id)) continue
      if (!this.refByEntryId.has(id)) {
        this.refByEntryId.set(id, ref)
        this.entryIds.push(id)
      }
    }

    const wanted = Number(params.rounds)
    this.rounds =
      Number.isFinite(wanted) && wanted >= 1
        ? Math.floor(wanted)
        : Math.max(1, this.entryIds.length)
  }

  refFor(entryId: number): ItemRef | undefined {
    return this.refByEntryId.get(entryId)
  }

  noteCombo(combo: number): void {
    if (combo > this.bestCombo) this.bestCombo = combo
  }

  /**
   * Record one resolved tile and stream it to the host (reportItem). Only
   * entries that came from the spec are reported; random top-up tiles are
   * scenery (they escalate the round but carry no FSRS evidence).
   */
  noteResolved(
    entryId: number,
    outcome: CatchOutcome,
    latencyMs: number,
    combo: number
  ): void {
    this.noteCombo(combo)
    const ref = this.refByEntryId.get(entryId)
    if (!ref) return
    const item: ActivityItemResult = {
      itemRef: ref,
      outcome: OUTCOME_MAP[outcome],
      latencyMs: Math.max(0, Math.round(latencyMs)),
      hintsUsed: 0,
      detail: { numbers: { combo } },
    }
    const key = itemRefKey(ref)
    if (!this.itemsByKey.has(key)) this.itemOrder.push(key)
    // Last write wins: a re-faced item (rare) keeps its most recent verdict.
    this.itemsByKey.set(key, item)
    try {
      this.hostApi.journey?.reportItem(item)
    } catch (err) {
      console.warn("[wordfall journey] reportItem failed:", err)
    }
  }

  private perItem(): ActivityItemResult[] {
    return this.itemOrder
      .map((k) => this.itemsByKey.get(k))
      .filter((x): x is ActivityItemResult => !!x)
  }

  buildResult(): ActivityResult {
    const perItem = this.perItem()
    const passed = perItem.filter((i) => i.outcome === "pass").length
    return {
      specId: this.spec.specId,
      score: perItem.length > 0 ? clamp01(passed / perItem.length) : 0,
      perItem,
      detail: {
        numbers: {
          bestCombo: this.bestCombo,
          faced: perItem.length,
          caught: passed,
        },
      },
      durationMs: Math.max(0, Date.now() - this.startedAt),
    }
  }

  /**
   * Terminal report (activity-contract §3): typed rail when present, else the
   * `corpan:activity-result` event rail. Idempotent — first call wins. Returns
   * the result it reported (or null when already reported).
   */
  finish(): ActivityResult | null {
    if (this.reported) return null
    this.reported = true
    const result = this.buildResult()
    try {
      if (this.hostApi.journey) {
        this.hostApi.journey.reportResult(result)
      } else if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("corpan:activity-result", {
            detail: { packId: PACK_ID, result },
          })
        )
      }
    } catch (err) {
      console.warn("[wordfall journey] reportResult failed:", err)
    }
    return result
  }

  get alreadyReported(): boolean {
    return this.reported
  }
}
