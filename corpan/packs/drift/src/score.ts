/**
 * score.ts — Drift's arcade scoring, pure + DOM-free so it unit-tests headless.
 *
 * The arcade score is PRESENTATION only — it drives the score chip, streak, and
 * star end-screen so a run has a goal and an ending (the FUN/WOW knob). It never
 * inflates the engine-facing accuracy score (that stays caught/faced in
 * session.ts). Wrong taps and drift-outs never subtract — calm brief: a miss
 * costs the streak, never points.
 */

/** Flat points for any catch. */
export const BASE_POINTS = 100
/** Extra points a catch can earn for being early (× remainingFraction). */
export const EARLY_BONUS = 50

/**
 * Points for one catch: 100 + floor(50 × remainingFraction). Early catch pays
 * up to 150; a last-second catch still pays 100 (a skill knob, never a
 * punishment). `remainingFraction` is clamped defensively.
 */
export function catchPoints(remainingFraction: number): number {
  const rf = Math.max(0, Math.min(1, remainingFraction))
  return BASE_POINTS + Math.floor(EARLY_BONUS * rf)
}

/** Streak multiplier: ×1 (base) / ×1.5 (streak ≥ 3) / ×2 (streak ≥ 6). */
export function multiplierForStreak(streak: number): number {
  if (streak >= 6) return 2
  if (streak >= 3) return 1.5
  return 1
}

/** Stars from ACCURACY (comparable across 5- and 6-beat runs). */
export function starsForAccuracy(accuracy: number): 0 | 1 | 2 | 3 {
  if (accuracy >= 1) return 3
  if (accuracy >= 0.75) return 2
  if (accuracy >= 0.5) return 1
  return 0
}

/** localStorage key for a scene's personal best (pure helper; IO lives in game.ts). */
export function bestStorageKey(sceneId: string): string {
  return `drift.best.${sceneId}`
}

export type Best = { arcadeScore: number; stars: number }

/** Parse a persisted best blob defensively (null on anything malformed). */
export function parseBest(raw: string | null): Best | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<Best>
    if (typeof v?.arcadeScore !== "number" || typeof v?.stars !== "number") return null
    return { arcadeScore: v.arcadeScore, stars: Math.max(0, Math.min(3, v.stars)) }
  } catch {
    return null
  }
}

/** Merge a fresh run into the stored best (higher score wins; stars follow). */
export function mergeBest(prev: Best | null, next: Best): Best {
  if (!prev) return next
  return next.arcadeScore > prev.arcadeScore ? next : prev
}

/** "★★☆" for a star count 0..3 (filled + hollow). */
export function starGlyphs(stars: number): string {
  const s = Math.max(0, Math.min(3, Math.round(stars)))
  return "★".repeat(s) + "☆".repeat(3 - s)
}
