/**
 * journey/state.ts — the Journey-launch session for Lingo Hero.
 *
 * One JourneyRun exists per journey mount (activity-contract §6.1): it owns the
 * ActivitySpec, the pinned-entry bookkeeping, the per-item evidence buffer, the
 * round counter, and the terminal ActivityResult. It is deliberately DOM-light
 * and Game-free so the instrumentation is unit-testable headless.
 *
 * Reporting rails (activity-contract §3.3):
 *   - typed rail `hostApi.journey.reportItem/reportResult` when present;
 *   - `corpan:activity-result` CustomEvent fallback for the terminal result
 *     (there is deliberately NO event fallback for reportItem — contract §3.3).
 *
 * Under a journey launch the Leitner store is RETIRED (D11) — FSRS is the one
 * scheduler; see learning/index.ts. Standalone launches are untouched.
 */

import type {
  ActivitySpec,
  ActivityItemResult,
  ActivityResult,
  ActivityOutcome,
  ItemRef,
} from "../sdk/activityContract";
import { itemRefKey } from "../sdk/activityContract";
import type { EntryOut, HostApi } from "../sdk/types";
import type { WordSelector } from "../ContentManager";
import type { WaveResolvedEvent } from "../types";

/** The pack's registered id — MUST stay the underscore form (installer rule). */
export const PACK_ID = "lingo_hero";

/** The one activity type this provider implements (activity-contract §6.1). */
export const JOURNEY_ACTIVITY_TYPE = "lingo_hero:round";

/** Spec params for `lingo_hero:round` (activity-contract §6.1). */
export type LingoHeroRoundParams = {
  /** Number of phrase charts to play, then report + exit. Default 3. */
  rounds?: number;
  mode?: "practice" | "blitz";
  /**
   * Initial decoy count / beat-gap bias, 0..1 — maps onto the existing
   * streak→gap curve (Game.beatGapForStreak reaches its floor by streak 6).
   */
  intensity?: number;
};

/** wave-resolved outcome → contract outcome (activity-contract §6.1). */
const OUTCOME_MAP: Record<WaveResolvedEvent["outcome"], ActivityOutcome> = {
  correct: "pass",
  wrong: "fail",
  passed: "fail",
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export class JourneyRun {
  readonly spec: ActivitySpec;
  /** Charts to play before the run reports + exits. */
  readonly rounds: number;
  readonly mode: "practice" | "blitz";
  /** Initial difficulty-streak seed derived from params.intensity (0..6). */
  readonly initialStreak: number;

  private hostApi: HostApi;
  private container: HTMLElement | null;
  private startedAt: number;

  /** Spec item lookup: corpus entry id → the exact ItemRef the engine sent. */
  private refByEntryId = new Map<number, ItemRef>();
  /** Pinned entries in spec order (the ordered round backlog). */
  private pinned: EntryOut[] = [];
  /** Entry ids the journey selector has already served as round targets. */
  private played = new Set<number>();

  /** Per-item evidence buffer (last write wins per itemRefKey). */
  private itemsByKey = new Map<string, ActivityItemResult>();
  private itemOrder: string[] = [];

  /** Charts resolved so far (one wave-resolved per chart). */
  roundsResolved = 0;

  // Run-level evidence for detail.numbers.
  private finalScore = 0;
  private bestCombo = 0;
  private decoysDodged = 0;

  private reported = false;
  private cardShown = false;

  constructor(
    spec: ActivitySpec,
    hostApi: HostApi,
    container: HTMLElement | null
  ) {
    this.spec = spec;
    this.hostApi = hostApi;
    this.container = container;
    this.startedAt = Date.now();

    const params = (spec.params ?? {}) as LingoHeroRoundParams;
    const rounds = Number(params.rounds);
    this.rounds =
      Number.isFinite(rounds) && rounds >= 1 ? Math.floor(rounds) : 3;
    this.mode = params.mode === "blitz" ? "blitz" : "practice";
    const intensity = Number(params.intensity);
    this.initialStreak = Number.isFinite(intensity)
      ? Math.round(clamp01(intensity) * 6)
      : 0;

    for (const ref of spec.itemRefs) {
      if (ref.kind !== "phrase") continue;
      const id = Number(ref.id);
      if (!Number.isFinite(id)) continue;
      if (!this.refByEntryId.has(id)) this.refByEntryId.set(id, ref);
    }
  }

  /** Pinned entries resolved from spec.itemRefs (set once, before Game boot). */
  setPinned(entries: EntryOut[]): void {
    this.pinned = entries;
  }

  /**
   * The journey WordSelector (registered via setDefaultWordSelector): serve the
   * NEXT unplayed pinned entry present in the valid candidate pool, in spec
   * order; fall back to default behavior (null) when none qualifies. It only
   * biases choice — ContentManager re-validates candidates, so the coherence /
   * answer-dedup contract is untouched.
   */
  readonly selector: WordSelector = {
    chooseTarget: (candidates: EntryOut[]): EntryOut | null => {
      for (const pin of this.pinned) {
        if (this.played.has(pin.entry_id)) continue;
        const match = candidates.find((c) => c.entry_id === pin.entry_id);
        if (match) {
          this.played.add(pin.entry_id);
          return match;
        }
      }
      return null;
    },
  };

  /** One chart resolved (the authoritative once-per-round verdict). */
  noteWaveResolved(e: WaveResolvedEvent): void {
    this.roundsResolved++;
    const ref = this.refByEntryId.get(e.word.entryId);
    // Waves on non-spec (random top-up) entries are scenery, not scheduled
    // evidence — they count toward the round budget but are never reported.
    if (!ref) return;
    const item: ActivityItemResult = {
      itemRef: ref,
      outcome: OUTCOME_MAP[e.outcome] ?? "fail",
      detail: { numbers: { combo: e.combo } },
    };
    const key = itemRefKey(ref);
    if (!this.itemsByKey.has(key)) this.itemOrder.push(key);
    this.itemsByKey.set(key, item);
    try {
      this.hostApi.journey?.reportItem(item);
    } catch (err) {
      console.warn("[lingo-hero journey] reportItem failed:", err);
    }
  }

  noteScore(value: number): void {
    this.finalScore = value;
  }

  noteCombo(value: number): void {
    if (value > this.bestCombo) this.bestCombo = value;
  }

  noteDecoyDodged(): void {
    this.decoysDodged++;
  }

  /** True once the run has played its budgeted number of charts. */
  isComplete(): boolean {
    return this.roundsResolved >= this.rounds;
  }

  /** Items the learner actually FACED, in presentation order. */
  private perItem(): ActivityItemResult[] {
    return this.itemOrder
      .map((k) => this.itemsByKey.get(k))
      .filter((x): x is ActivityItemResult => !!x);
  }

  buildResult(): ActivityResult {
    const perItem = this.perItem();
    const passed = perItem.filter((i) => i.outcome === "pass").length;
    return {
      specId: this.spec.specId,
      // Clean-catch rate over spec items faced (0 when none faced).
      score: perItem.length > 0 ? clamp01(passed / perItem.length) : 0,
      perItem,
      detail: {
        numbers: {
          finalScore: this.finalScore,
          bestCombo: this.bestCombo,
          decoysDodged: this.decoysDodged,
        },
      },
      durationMs: Math.max(0, Date.now() - this.startedAt),
    };
  }

  /**
   * Terminal report (activity-contract §3): typed rail when present, else the
   * `corpan:activity-result` event rail. Idempotent — first call wins.
   * Returns the result it reported (or null when already reported).
   */
  finish(): ActivityResult | null {
    if (this.reported) return null;
    this.reported = true;
    const result = this.buildResult();
    try {
      if (this.hostApi.journey) {
        this.hostApi.journey.reportResult(result);
      } else if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("corpan:activity-result", {
            detail: { packId: PACK_ID, result },
          })
        );
      }
    } catch (err) {
      console.warn("[lingo-hero journey] reportResult failed:", err);
    }
    return result;
  }

  /**
   * The compact "Round complete" card (activity-contract §6.1 choke point 3):
   * a single CTA that fires reportResult + `corpan:exit`. The host feed's
   * CelebrationLayer does the big juice — this stays minimal. Shown once.
   */
  showCompletionCard(): void {
    if (this.cardShown) return;
    this.cardShown = true;
    if (!this.container || typeof document === "undefined") {
      // No DOM to render into (defensive) — report straight away so the
      // session still terminates with the pack's own result.
      this.finish();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("corpan:exit"));
      }
      return;
    }
    const overlay = document.createElement("div");
    overlay.setAttribute("data-lh-journey-complete", "1");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:60;display:flex;align-items:center;" +
      "justify-content:center;background:rgba(6,8,20,0.82);";
    const card = document.createElement("div");
    card.style.cssText =
      "display:flex;flex-direction:column;align-items:center;gap:16px;" +
      "padding:28px 32px;border-radius:18px;background:#141830;" +
      "border:1px solid rgba(120,140,255,0.35);color:#eef;max-width:80%;" +
      "text-align:center;font-family:inherit;";
    const title = document.createElement("div");
    title.textContent = "Round complete";
    title.style.cssText = "font-size:22px;font-weight:700;";
    const cta = document.createElement("button");
    cta.textContent = "Continue";
    cta.style.cssText =
      "padding:12px 34px;border-radius:999px;border:none;cursor:pointer;" +
      "background:#5d7bff;color:#fff;font-size:17px;font-weight:700;";
    cta.addEventListener("click", () => {
      this.finish();
      window.dispatchEvent(new CustomEvent("corpan:exit"));
    });
    card.appendChild(title);
    card.appendChild(cta);
    overlay.appendChild(card);
    this.container.appendChild(overlay);
  }
}

// --- module singleton (one journey mount at a time, like the host session) ---

let activeRun: JourneyRun | null = null;

export function beginJourneyRun(
  spec: ActivitySpec,
  hostApi: HostApi,
  container: HTMLElement | null
): JourneyRun {
  activeRun = new JourneyRun(spec, hostApi, container);
  return activeRun;
}

/** The active journey run, or null on standalone launches. */
export function getJourneyRun(): JourneyRun | null {
  return activeRun;
}

export function endJourneyRun(): void {
  activeRun = null;
}
