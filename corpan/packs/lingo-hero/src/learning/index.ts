/**
 * learning/index.ts — Spaced-difficulty + mastery orchestrator.
 *
 * STREAM: learning. Wires the per-word memory (WordStatsStore), the gentle
 * adaptive-difficulty signal, the content-selection bias (WordSelector via the
 * foundation's setDefaultWordSelector hook), and the HUD mastery readout — all
 * WITHOUT editing Game.ts or Hud.ts.
 *
 * HOW IT HOOKS IN (no Game.ts edits):
 *   - The selector reaches ContentManager via the process-wide default registry
 *     (`setDefaultWordSelector`). Game.ts's existing `new ContentManager(hostApi)`
 *     transparently resolves it. We register it in `initLearning` AND, as a
 *     belt-and-suspenders side effect, on module import (see bottom of file) so
 *     the bias is live even if init ordering ever shifts.
 *   - Outcomes flow from the typed bus's `wave-resolved` event (Game.ts is the
 *     sole emitter; we only subscribe). One subscription updates the memory,
 *     the difficulty signal, and the mastery readout.
 *
 * SCOPING: memory is keyed (stackId, lang). We derive the scope from each
 * `wave-resolved` event's `word.lang` (most reliable) and lazily create a store
 * per scope, so switching languages mid-session never cross-contaminates.
 *
 * OFFLINE-FIRST: all persistence is localStorage (guarded). No network.
 */

import type { GameEventBus } from "../events";
import type { HostApi } from "../sdk/types";
import { setDefaultWordSelector } from "../ContentManager";
import { getJourneyRun } from "../journey/state";
import { initJourneyReporting } from "../journey/reporter";
import { WordStatsStore } from "./wordStats";
import { AdaptiveDifficulty } from "./difficulty";
import { createWordSelector } from "./selector";
import {
  computeMastery,
  formatReadout,
  renderMasterySlot,
  type MasterySummary,
} from "./mastery";

export interface LearningApi {
  /** Structured mastery for the CURRENT (active) scope; null before any word. */
  getMastery: () => MasterySummary | null;
  /** Current gentle content-difficulty signal (0..1) for the active scope. */
  getDifficulty: () => number;
  /** Tear down subscriptions + flush all per-scope memory. */
  dispose: () => void;
}

/** Resolve the active stack id defensively (scope namespacing). */
function resolveStackId(hostApi: HostApi): string {
  try {
    return hostApi.getStackConfig?.().activeStackId || "default";
  } catch {
    return "default";
  }
}

/**
 * A shared, process-wide learning context so the selector registered at module
 * import time and the bus-driven init agree on the SAME memory + difficulty.
 * Lazily creates a store per (stackId, lang) scope.
 */
class LearningContext {
  private stores = new Map<string, WordStatsStore>();
  private difficulties = new Map<string, AdaptiveDifficulty>();
  /** The scope the selector should read for the CURRENT wave. */
  activeScope = "default::";

  constructor(private stackIdProvider: () => string) {}

  private scopeKey(lang: string): string {
    return `${this.stackIdProvider()}::${lang || ""}`;
  }

  store(lang: string): WordStatsStore {
    const key = this.scopeKey(lang);
    let s = this.stores.get(key);
    if (!s) {
      s = new WordStatsStore(key);
      this.stores.set(key, s);
    }
    return s;
  }

  difficulty(lang: string): AdaptiveDifficulty {
    const key = this.scopeKey(lang);
    let d = this.difficulties.get(key);
    if (!d) {
      d = new AdaptiveDifficulty();
      this.difficulties.set(key, d);
    }
    return d;
  }

  /** The store/difficulty the selector should consult right now. */
  activeStore(): WordStatsStore {
    const lang = this.activeScope.split("::")[1] ?? "";
    return this.store(lang);
  }
  activeDifficulty(): AdaptiveDifficulty {
    const lang = this.activeScope.split("::")[1] ?? "";
    return this.difficulty(lang);
  }

  setActiveLang(lang: string): void {
    this.activeScope = this.scopeKey(lang);
  }

  disposeAll(): void {
    for (const s of this.stores.values()) s.dispose();
    this.stores.clear();
    this.difficulties.clear();
  }
}

// Process-wide singleton so the import-time selector and the runtime init share
// state. Stack-id is read lazily (the host may not be ready at import time).
let sharedCtx: LearningContext | null = null;
let lastHostApi: HostApi | null = null;

function ensureContext(): LearningContext {
  if (!sharedCtx) {
    sharedCtx = new LearningContext(() =>
      lastHostApi ? resolveStackId(lastHostApi) : "default"
    );
  }
  return sharedCtx;
}

/**
 * Register the spaced-difficulty selector as the process-wide default. The
 * selector reads whatever scope `ctx.activeScope` points at, which the bus init
 * keeps in sync with the active language. Idempotent.
 */
function registerSelector(): void {
  const ctx = ensureContext();
  setDefaultWordSelector(
    createWordSelector(
      // Bind to a thin live-view so the selector always reads the ACTIVE scope's
      // store/difficulty even as the active language changes mid-session.
      new Proxy({} as WordStatsStore, {
        get(_t, prop) {
          const store = ctx.activeStore() as unknown as Record<string | symbol, unknown>;
          const v = store[prop];
          return typeof v === "function" ? (v as Function).bind(ctx.activeStore()) : v;
        },
      }),
      new Proxy({} as AdaptiveDifficulty, {
        get(_t, prop) {
          const d = ctx.activeDifficulty() as unknown as Record<string | symbol, unknown>;
          const v = d[prop];
          return typeof v === "function" ? (v as Function).bind(ctx.activeDifficulty()) : v;
        },
      })
    )
  );
}

/**
 * Initialise the learning layer against a bus + host. Called from the
 * progression init (which Game.ts already constructs with bus + hostApi), so no
 * Game.ts edit is needed. Returns a LearningApi for introspection + dispose.
 */
export function initLearning(bus: GameEventBus, hostApi: HostApi): LearningApi {
  // JOURNEY LAUNCH (D11 / activity-contract §6.1): the Leitner store is
  // RETIRED — FSRS (the host engine) is the one scheduler, so we neither
  // register the SRS-biased selector (the journey selector is already the
  // process-wide default, set at mount) nor write WordStatsStore. Outcomes
  // flow to the host through the journey reporter's wave-resolved subscriber
  // instead. Standalone launches fall through UNCHANGED.
  const journeyRun = getJourneyRun();
  if (journeyRun) {
    const off = initJourneyReporting(bus, journeyRun);
    return {
      getMastery: () => null,
      getDifficulty: () => 0,
      dispose: off,
    };
  }

  lastHostApi = hostApi;
  const ctx = ensureContext();
  registerSelector(); // ensure the selector is live for this run

  // Default active scope from the current stack config (best-effort).
  try {
    const cfg = hostApi.getStackConfig?.();
    const lang = cfg?.languages?.find((l) => l && l !== "en") ?? cfg?.languages?.[0] ?? "";
    ctx.setActiveLang(lang);
  } catch {
    /* keep default scope */
  }

  const offFns: Array<() => void> = [];

  // Refresh the readout for the active scope.
  const refreshReadout = (): void => {
    const summary = computeMastery(ctx.activeStore());
    renderMasterySlot(formatReadout(summary));
  };

  offFns.push(
    bus.on("gameStart", (e) => {
      // The active-language context arrives on gameStart. Point the scope at it
      // and reset the per-run difficulty ride to an encouraging baseline.
      ctx.setActiveLang(e.language.code);
      ctx.activeDifficulty().reset();
      refreshReadout();
    })
  );

  // Mark the target as SHOWN as soon as a wave begins. There is no dedicated
  // "wave-spawned" event, so we lean on the FIRST signal we get for a wave —
  // noteHit/noteMiss both carry the word — guarded so we stamp "shown" at most
  // once per wave (the resolve handler clears the guard).
  let shownThisWave = -1;
  const markShownOnce = (entryId: number, foreign: string, english: string): void => {
    if (shownThisWave === entryId) return;
    shownThisWave = entryId;
    ctx.activeStore().markShown(entryId, foreign, english);
  };

  offFns.push(
    bus.on("noteHit", (e) => {
      markShownOnce(e.word.entryId, e.word.foreign, e.word.english);
    })
  );
  offFns.push(
    bus.on("noteMiss", (e) => {
      markShownOnce(e.word.entryId, e.word.foreign, e.word.english);
    })
  );

  // The authoritative learning signal: one final verdict per wave.
  offFns.push(
    bus.on("wave-resolved", (e) => {
      // Make sure the scope matches the word's language (defensive — the event
      // is the source of truth for which language was actually quizzed).
      if (e.word.lang) ctx.setActiveLang(e.word.lang);
      const store = ctx.activeStore();
      // Ensure it's been counted as shown even if the show-guard missed it.
      markShownOnce(e.word.entryId, e.word.foreign, e.word.english);
      store.recordOutcome(e.word.entryId, e.correct, e.word.foreign, e.word.english);
      ctx.activeDifficulty().record(e.correct);
      shownThisWave = -1; // arm for the next wave
      refreshReadout();
    })
  );

  // On return to menu, flush memory so progress is durable even mid-session.
  offFns.push(
    bus.on("menuShown", () => {
      ctx.activeStore().flush();
    })
  );
  offFns.push(
    bus.on("gameOver", () => {
      ctx.activeStore().flush();
    })
  );

  return {
    getMastery: () => {
      const summary = computeMastery(ctx.activeStore());
      return summary.seen > 0 ? summary : null;
    },
    getDifficulty: () => ctx.activeDifficulty().value,
    dispose: () => {
      for (const off of offFns) off();
      offFns.length = 0;
      ctx.disposeAll();
    },
  };
}

// --- import-time side effect ------------------------------------------------
// Register the selector as the process-wide default the moment this module is
// imported, so ContentManager picks up the spaced-difficulty bias even before
// initLearning runs (belt-and-suspenders; initLearning re-registers harmlessly).
registerSelector();
