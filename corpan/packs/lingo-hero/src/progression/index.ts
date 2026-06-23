import type { GameEventBus } from "../events";
import type { HostApi } from "../sdk/types";
import { GameMode } from "../types";
import {
  comboMultiplier,
  comboTier,
  crossedComboTier,
  gradeRun,
  levelForXp,
  xpForHit,
  type ComboTier,
  type RunGrade,
} from "../scoring/curve";
import {
  loadState,
  saveState,
  type PersistedProgression,
} from "./storage";

/**
 * Progression layer — XP, levels, combo multipliers, streaks, high scores,
 * milestone celebrations and end-of-run stats.
 *
 * STREAM: gamification. Subscribes to the foundation bus (read-only — Game.ts is
 * the sole emitter) and maintains a rich, cheap-to-poll read model the HUD
 * surfaces every frame. NOTHING here mutates Game.ts; the in-run score/combo
 * stay authoritative in Game.ts. This layer adds the *meta-game* on top.
 *
 * Cross-stream coordination: the typed GameEventBus only carries the
 * foundation's fixed event set and only Game.ts may emit on it. To let the
 * VFX/SFX/UI streams react to milestones WITHOUT importing this module, we
 * expose a tiny independent milestone observer (`onMilestone`) on the returned
 * API. A stream that receives the ProgressionApi (the Hud does, and may relay)
 * can subscribe; this never violates the "Game.ts is the only bus emitter" rule
 * because it is a separate, progression-owned channel — not the GameEventBus.
 */

/** A celebratory beat the HUD/VFX/SFX can react to. */
export type Milestone =
  | {
      kind: "comboTier";
      tier: ComboTier;
      combo: number;
    }
  | {
      kind: "levelUp";
      level: number;
      /** Levels gained at once (usually 1, can be >1 on a big score jump). */
      gained: number;
    }
  | {
      kind: "newHighScore";
      score: number;
      previous: number;
    }
  | {
      kind: "newBestStreak";
      streak: number;
      previous: number;
    }
  | {
      kind: "runComplete";
      stats: RunStats;
    };

/** End-of-run summary for the game-over celebration screen. */
export interface RunStats {
  mode: GameMode;
  finalScore: number;
  hits: number;
  misses: number;
  bestStreak: number;
  xpEarned: number;
  grade: RunGrade;
  leveledUp: boolean;
  newHighScore: boolean;
}

/**
 * The HUD polls this snapshot every frame. The foundation declared the first
 * five fields; we extend (structurally compatible) with richer read state so
 * the HUD can render XP bars, tier labels, accuracy, etc. without new plumbing.
 */
export interface ProgressionSnapshot {
  xp: number;
  level: number;
  /** Display score multiplier derived from current combo (>= 1). */
  comboMultiplier: number;
  /** Longest combo streak this session. */
  bestStreak: number;
  /** High score (lifetime/persisted if available, else session). */
  highScore: number;

  // --- gamification extensions (optional for foundation consumers) ---
  /** XP accrued within the current level. */
  xpIntoLevel: number;
  /** XP required to finish the current level. */
  xpForLevel: number;
  /** 0..1 fill for the level bar. */
  levelProgress: number;
  /** Current combo value (mirrors the live combo). */
  combo: number;
  /** Named tier for the current combo (drives celebration styling). */
  comboTierId: string;
  /** Shout label for the current combo tier ("ON FIRE", ...). */
  comboTierLabel: string;
  /** Live run tally: correct hits so far. */
  hits: number;
  /** Live run tally: misses so far. */
  misses: number;
  /** Live run accuracy 0..1. */
  accuracy: number;
  /** Lifetime correct hits across all runs. */
  lifetimeHits: number;
  /** Total runs completed. */
  runs: number;
  /** End-of-run summary (null until a run ends; reset on next start). */
  lastRun: RunStats | null;
}

export interface ProgressionApi {
  /** Cheap synchronous snapshot for the HUD to poll. */
  getSnapshot: () => ProgressionSnapshot;
  /**
   * Subscribe to milestone beats (combo tiers, level-ups, records, run
   * complete). Returns an idempotent unsubscribe. This is a progression-owned
   * channel, NOT the GameEventBus — it exists so sibling streams can celebrate
   * without coupling to this module's internals.
   */
  onMilestone: (handler: (m: Milestone) => void) => () => void;
  /** Tear down listeners + flush persistence. */
  dispose: () => void;
}

export function initProgression(
  bus: GameEventBus,
  hostApi: HostApi
): ProgressionApi {
  // Resolve the persistence scope (per active stack) defensively.
  let stackId: string | undefined;
  try {
    stackId = hostApi.getStackConfig?.().activeStackId;
  } catch {
    stackId = undefined;
  }

  // Durable lifetime state.
  const persisted: PersistedProgression = loadState(stackId);

  // Live per-run session state (reset on gameStart).
  let mode: GameMode = GameMode.PRACTICE;
  let combo = 0;
  let sessionBestStreak = 0;
  let hits = 0;
  let misses = 0;
  let runXpEarned = 0;
  let runStartLevel = levelForXp(persisted.xp).level;
  let lastRun: RunStats | null = null;
  let runActive = false;

  // Milestone observers (progression-owned channel).
  const milestoneHandlers = new Set<(m: Milestone) => void>();
  const emitMilestone = (m: Milestone): void => {
    for (const h of [...milestoneHandlers]) {
      try {
        h(m);
      } catch (err) {
        console.error("[progression] milestone handler threw:", err);
      }
    }
  };

  const persist = (): void => saveState(stackId, persisted);

  // --- bus subscriptions (read-only) -------------------------------------

  const offFns: Array<() => void> = [];

  offFns.push(
    bus.on("gameStart", (e) => {
      mode = e.mode;
      combo = 0;
      sessionBestStreak = 0;
      hits = 0;
      misses = 0;
      runXpEarned = 0;
      runStartLevel = levelForXp(persisted.xp).level;
      lastRun = null;
      runActive = true;
    })
  );

  offFns.push(
    bus.on("noteHit", (e) => {
      hits += 1;
      persisted.lifetimeHits += 1;
      const gained = xpForHit(e.points, e.combo);
      runXpEarned += gained;
      persisted.xp += gained;

      const afterLevel = levelForXp(persisted.xp).level;
      if (afterLevel > runStartLevel) {
        const delta = afterLevel - runStartLevel;
        runStartLevel = afterLevel;
        emitMilestone({ kind: "levelUp", level: afterLevel, gained: delta });
      }
      persist();
    })
  );

  offFns.push(
    bus.on("noteMiss", (e) => {
      // "passed" target and "wrong" tap both count as a missed answer; a
      // distractor tap that breaks combo is captured here too. (Empty-lane
      // taps also arrive as "wrong" — counting them keeps accuracy honest.)
      misses += 1;
      void e;
    })
  );

  offFns.push(
    bus.on("comboChange", (e) => {
      combo = e.value;
      if (e.value > sessionBestStreak) {
        sessionBestStreak = e.value;
        if (e.value > persisted.bestStreak) {
          const previous = persisted.bestStreak;
          persisted.bestStreak = e.value;
          persist();
          emitMilestone({
            kind: "newBestStreak",
            streak: e.value,
            previous,
          });
        }
      }
      const crossed = crossedComboTier(e.previous, e.value);
      if (crossed && crossed.min > 0) {
        emitMilestone({ kind: "comboTier", tier: crossed, combo: e.value });
      }
    })
  );

  offFns.push(
    bus.on("scoreChange", (e) => {
      // High-score record check on every positive movement. Game.ts owns the
      // authoritative score value (e.value), so we read it rather than re-sum.
      if (e.value > persisted.highScore) {
        const previous = persisted.highScore;
        persisted.highScore = e.value;
        persist();
        // Only celebrate a record once we've beaten a real prior best (>0).
        if (previous > 0 && e.delta > 0) {
          emitMilestone({
            kind: "newHighScore",
            score: e.value,
            previous,
          });
        }
      }
    })
  );

  offFns.push(
    bus.on("gameOver", (e) => {
      runActive = false;
      persisted.runs += 1;
      const grade = gradeRun(hits, misses, sessionBestStreak);
      const startLevelAtRunBegin = levelForXp(persisted.xp - runXpEarned).level;
      const endLevel = levelForXp(persisted.xp).level;
      const stats: RunStats = {
        mode,
        finalScore: e.finalScore,
        hits,
        misses,
        bestStreak: sessionBestStreak,
        xpEarned: runXpEarned,
        grade,
        leveledUp: endLevel > startLevelAtRunBegin,
        newHighScore: e.finalScore >= persisted.highScore && e.finalScore > 0,
      };
      lastRun = stats;
      persist();
      emitMilestone({ kind: "runComplete", stats });
    })
  );

  // --- read model --------------------------------------------------------

  const getSnapshot = (): ProgressionSnapshot => {
    const lvl = levelForXp(persisted.xp);
    const tier = comboTier(combo);
    const total = hits + misses;
    return {
      xp: persisted.xp,
      level: lvl.level,
      comboMultiplier: comboMultiplier(combo),
      bestStreak: Math.max(sessionBestStreak, persisted.bestStreak),
      highScore: persisted.highScore,
      xpIntoLevel: lvl.xpIntoLevel,
      xpForLevel: lvl.xpForLevel,
      levelProgress: lvl.progress,
      combo,
      comboTierId: tier.id,
      comboTierLabel: tier.label,
      hits,
      misses,
      accuracy: total > 0 ? Math.round((hits / total) * 1000) / 1000 : 0,
      lifetimeHits: persisted.lifetimeHits,
      runs: persisted.runs,
      lastRun,
    };
  };

  const onMilestone = (handler: (m: Milestone) => void): (() => void) => {
    milestoneHandlers.add(handler);
    return () => {
      milestoneHandlers.delete(handler);
    };
  };

  const dispose = (): void => {
    for (const off of offFns) off();
    offFns.length = 0;
    milestoneHandlers.clear();
    // Final flush in case a run was abandoned mid-flight.
    if (runActive) persist();
  };

  return { getSnapshot, onMilestone, dispose };
}
