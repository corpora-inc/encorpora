/**
 * session.ts — the journey-launch session for Drift (activity-contract §3/§6.1).
 *
 * DOM-free + Game-free so the reporting contract is unit-testable headless.
 * One DriftSession per journey mount. It owns:
 *   - the ActivitySpec + the set of spec itemRefs (what the engine scheduled),
 *   - the per-item evidence buffer (reportItem streams as each challenge
 *     resolves; only spec-scheduled items carry FSRS evidence — random-fill
 *     beats are scenery, exactly like wordfall's top-up tiles),
 *   - the terminal ActivityResult (reportResult ONCE at natural completion).
 *
 * Reporting rails mirror wordfall/journey/session.ts: typed rail
 * `hostApi.journey.reportItem/reportResult/abandon` when present; the
 * `corpan:activity-result` CustomEvent is the TERMINAL fallback only.
 */

import type {
  AbandonReason,
  ActivityItemResult,
  ActivityResult,
  ActivitySpec,
  ItemRef,
} from "./sdk/activityContract"
import { itemRefKey } from "./sdk/activityContract"
import type { HostApi } from "./sdk/types"

/** The pack's registered id (underscore form — installer rule). */
export const PACK_ID = "drift"

/** The one activity type this provider implements. */
export const JOURNEY_ACTIVITY_TYPE = "drift:read"

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

export class DriftSession {
  readonly spec: ActivitySpec
  private hostApi: HostApi
  private startedAt = Date.now()

  /** itemRefKeys the engine actually scheduled (evidence is only kept for these). */
  private specKeys = new Set<string>()
  /** per-item evidence buffer (last write wins per itemRefKey). */
  private itemsByKey = new Map<string, ActivityItemResult>()
  private itemOrder: string[] = []

  private faced = 0
  private correct = 0
  private reported = false
  /** Presentation-layer run metrics folded into the terminal detail.numbers. */
  private extras: Record<string, number> = {}

  constructor(spec: ActivitySpec, hostApi: HostApi) {
    this.spec = spec
    this.hostApi = hostApi
    for (const ref of spec.itemRefs) this.specKeys.add(itemRefKey(ref))
  }

  /**
   * Record one answered challenge. Always advances the aggregate tally; streams
   * an FSRS per-item verdict (reportItem) only when the challenge's beat came
   * from a SPEC itemRef the engine scheduled.
   */
  noteAnswer(
    itemRef: ItemRef | undefined,
    correct: boolean,
    latencyMs: number,
    hintsUsed = 0,
  ): void {
    this.faced += 1
    if (correct) this.correct += 1
    if (!itemRef) return
    const key = itemRefKey(itemRef)
    if (!this.specKeys.has(key)) return
    const item: ActivityItemResult = {
      itemRef,
      outcome: correct ? "pass" : "fail",
      latencyMs: Math.max(0, Math.round(latencyMs)),
      hintsUsed: Math.max(0, Math.round(hintsUsed)),
    }
    if (!this.itemsByKey.has(key)) this.itemOrder.push(key)
    this.itemsByKey.set(key, item)
    try {
      this.hostApi.journey?.reportItem(item)
    } catch (err) {
      console.warn("[drift journey] reportItem failed:", err)
    }
  }

  /**
   * Fold presentation-layer run metrics (arcadeScore, bestStreak, driftOuts,
   * stars) into the terminal detail.numbers. Additive only — the engine-facing
   * `score` stays caught/faced. Call before finish().
   */
  setExtras(extras: Record<string, number>): void {
    for (const [k, v] of Object.entries(extras)) {
      if (typeof v === "number" && Number.isFinite(v)) this.extras[k] = v
    }
  }

  private perItem(): ActivityItemResult[] {
    return this.itemOrder
      .map((k) => this.itemsByKey.get(k))
      .filter((x): x is ActivityItemResult => !!x)
  }

  buildResult(abandoned = false): ActivityResult {
    const perItem = this.perItem()
    return {
      specId: this.spec.specId,
      score: this.faced > 0 ? clamp01(this.correct / this.faced) : 0,
      perItem,
      detail: { numbers: { faced: this.faced, correct: this.correct, ...this.extras } },
      durationMs: Math.max(0, Date.now() - this.startedAt),
      ...(abandoned ? { abandoned: true } : {}),
    }
  }

  /**
   * Terminal report at NATURAL completion. Typed rail when present, else the
   * `corpan:activity-result` event rail. Idempotent — first call wins.
   */
  finish(): ActivityResult | null {
    if (this.reported) return null
    this.reported = true
    const result = this.buildResult(false)
    try {
      if (this.hostApi.journey) {
        this.hostApi.journey.reportResult(result)
      } else if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("corpan:activity-result", {
            detail: { packId: PACK_ID, result },
          }),
        )
      }
    } catch (err) {
      console.warn("[drift journey] reportResult failed:", err)
    }
    return result
  }

  /**
   * User-initiated early exit (Drift's own Done button). Per the contract this
   * is an ABANDON: the host synthesizes `{abandoned:true}` from the buffered
   * reportItem verdicts, so partial work is preserved and the pack never fakes
   * a terminal result. On the event-only fallback rail (no typed journey), we
   * emit an abandoned terminal result so partial evidence still lands.
   */
  abandon(reason: AbandonReason = "user_exit"): void {
    if (this.reported) return
    this.reported = true
    try {
      if (this.hostApi.journey) {
        this.hostApi.journey.abandon(reason)
      } else if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("corpan:activity-result", {
            detail: { packId: PACK_ID, result: this.buildResult(true) },
          }),
        )
      }
    } catch (err) {
      console.warn("[drift journey] abandon failed:", err)
    }
  }

  get alreadyReported(): boolean {
    return this.reported
  }
}
