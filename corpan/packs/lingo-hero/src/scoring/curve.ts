/**
 * scoring/curve.ts — Pure, deterministic gamification math for Lingo Hero.
 *
 * STREAM: gamification. This module owns the *numbers* behind the juice:
 * combo→multiplier curve, XP economy, level thresholds, streak/rank tiers,
 * milestone detection. It is intentionally side-effect-free and dependency-free
 * so it can be unit-reasoned, reused by the HUD/VFX, and stays 60fps-cheap.
 *
 * NOTHING here mutates Game.ts state. Game.ts owns the authoritative score and
 * combo; this layer derives a *richer* read model (XP, levels, multipliers,
 * ranks, streak tiers) on top of the bus events the foundation emits.
 *
 * Design intent:
 *  - The multiplier is a smooth, capped staircase so big combos feel powerful
 *    without runaway inflation. It is a *display/XP* multiplier — it never
 *    edits the score Game.ts already computed.
 *  - XP rewards both raw points and combo discipline, then rolls into a level
 *    curve that grows super-linearly (each level costs more) so early levels
 *    pop fast (dopamine) and later levels feel earned.
 *  - Ranks/streak tiers exist purely to give the HUD/SFX named milestones to
 *    celebrate ("ON FIRE", "UNSTOPPABLE", "GODLIKE").
 */

/** A named combo tier, used to drive escalating celebration. */
export interface ComboTier {
  /** Minimum combo (inclusive) to be in this tier. */
  readonly min: number;
  /** Short id, stable for CSS hooks / SFX selection. */
  readonly id: string;
  /** Human-facing shout. */
  readonly label: string;
  /** Display multiplier awarded at this tier (>= 1). */
  readonly multiplier: number;
}

/**
 * Combo → tier staircase. Ordered DESCENDING by `min` so a linear scan finds
 * the highest tier the combo qualifies for. Multipliers are capped at 8x.
 *
 * The thresholds (5/10/20/35/50/75/100) are tuned so a competent player crosses
 * a fresh celebration every ~10-15s of clean play, then plateaus into the
 * top-tier flex zone. Crossing INTO a new tier is a "milestone" (see below).
 */
export const COMBO_TIERS: readonly ComboTier[] = [
  { min: 100, id: "godlike", label: "GODLIKE", multiplier: 8 },
  { min: 75, id: "legendary", label: "LEGENDARY", multiplier: 6 },
  { min: 50, id: "unstoppable", label: "UNSTOPPABLE", multiplier: 5 },
  { min: 35, id: "rampage", label: "RAMPAGE", multiplier: 4 },
  { min: 20, id: "onfire", label: "ON FIRE", multiplier: 3 },
  { min: 10, id: "hot", label: "HOT STREAK", multiplier: 2 },
  { min: 5, id: "warm", label: "COMBO x5", multiplier: 1.5 },
  { min: 0, id: "base", label: "", multiplier: 1 },
] as const;

/** Resolve the combo tier for a given combo value (never null; base is the floor). */
export function comboTier(combo: number): ComboTier {
  const c = combo < 0 ? 0 : combo;
  for (const tier of COMBO_TIERS) {
    if (c >= tier.min) return tier;
  }
  // COMBO_TIERS always ends at min:0, so this is unreachable, but keep TS happy.
  return COMBO_TIERS[COMBO_TIERS.length - 1];
}

/**
 * The display/XP multiplier for a combo. Smoothly interpolated *between* tier
 * anchors so the HUD multiplier readout ticks up continuously rather than
 * snapping, while still respecting the 8x cap.
 */
export function comboMultiplier(combo: number): number {
  const c = combo < 0 ? 0 : combo;
  // Walk anchors ascending to find the bracket [lo, hi] containing c.
  const ascending = [...COMBO_TIERS].reverse(); // base → godlike
  for (let i = 0; i < ascending.length - 1; i++) {
    const lo = ascending[i];
    const hi = ascending[i + 1];
    if (c >= lo.min && c < hi.min) {
      const span = hi.min - lo.min || 1;
      const t = (c - lo.min) / span;
      const m = lo.multiplier + (hi.multiplier - lo.multiplier) * t;
      return Math.round(m * 100) / 100;
    }
  }
  // At or beyond the top anchor.
  return ascending[ascending.length - 1].multiplier;
}

/** Is `combo` exactly on a tier boundary it just crossed up into? */
export function crossedComboTier(previous: number, value: number): ComboTier | null {
  if (value <= previous) return null;
  const prevTier = comboTier(previous);
  const nextTier = comboTier(value);
  return nextTier.min > prevTier.min ? nextTier : null;
}

// ---------------------------------------------------------------------------
// XP economy + level curve
// ---------------------------------------------------------------------------

/**
 * XP granted for a single correct hit. Rewards the base points the game already
 * computed AND the combo discipline via the display multiplier, so deep combos
 * accrue XP faster (without touching the in-run score).
 *
 * @param basePoints `points` from the noteHit event (100 + combo*10).
 * @param comboAfterHit the combo value AFTER the hit (from noteHit.combo).
 */
export function xpForHit(basePoints: number, comboAfterHit: number): number {
  const mult = comboMultiplier(comboAfterHit);
  // Scale down from raw points so levels aren't trivially fast; XP is a
  // lifetime currency, score is per-run.
  return Math.round((basePoints * mult) / 10);
}

/**
 * Total XP required to COMPLETE level `level` (i.e. to reach level+1).
 * Super-linear: cost(L) = floor(BASE * L^EXP). Level 1→2 is cheap; the gap
 * widens so high levels feel earned. Cumulative XP for "currently at level L"
 * is the sum of costs for levels 1..L-1 (see levelForXp).
 */
const LEVEL_BASE = 120;
const LEVEL_EXP = 1.45;

export function xpToCompleteLevel(level: number): number {
  const L = level < 1 ? 1 : level;
  return Math.floor(LEVEL_BASE * Math.pow(L, LEVEL_EXP));
}

/** Cumulative XP needed to be sitting *at the start of* `level`. */
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToCompleteLevel(l);
  return total;
}

export interface LevelState {
  level: number;
  /** XP accrued within the current level. */
  xpIntoLevel: number;
  /** XP needed to finish the current level. */
  xpForLevel: number;
  /** 0..1 progress through the current level (for HUD bars). */
  progress: number;
}

/**
 * Resolve total lifetime XP into a level + within-level progress. Iterative but
 * cheap (levels grow fast; even 10k XP is a handful of iterations) and bounded.
 */
export function levelForXp(totalXp: number): LevelState {
  const xp = totalXp < 0 ? 0 : totalXp;
  let level = 1;
  let consumed = 0;
  // Hard cap iterations to stay safe even on absurd XP totals.
  for (let guard = 0; guard < 1000; guard++) {
    const cost = xpToCompleteLevel(level);
    if (xp < consumed + cost) break;
    consumed += cost;
    level++;
  }
  const xpForLevel = xpToCompleteLevel(level);
  const xpIntoLevel = xp - consumed;
  return {
    level,
    xpIntoLevel,
    xpForLevel,
    progress: xpForLevel > 0 ? Math.min(1, xpIntoLevel / xpForLevel) : 0,
  };
}

// ---------------------------------------------------------------------------
// Accuracy / end-of-run grading
// ---------------------------------------------------------------------------

export interface RunGrade {
  /** Letter grade S/A/B/C/D for the run. */
  letter: string;
  /** Accuracy 0..1 (hits / (hits+misses)). */
  accuracy: number;
}

/** Grade a finished run from its hit/miss tallies. */
export function gradeRun(hits: number, misses: number, bestStreak: number): RunGrade {
  const total = hits + misses;
  const accuracy = total > 0 ? hits / total : 0;
  let letter: string;
  if (accuracy >= 0.97 && bestStreak >= 30) letter = "S";
  else if (accuracy >= 0.9) letter = "A";
  else if (accuracy >= 0.75) letter = "B";
  else if (accuracy >= 0.5) letter = "C";
  else letter = "D";
  return { letter, accuracy: Math.round(accuracy * 1000) / 1000 };
}
