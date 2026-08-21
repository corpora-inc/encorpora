/**
 * Timing judgement.
 *
 * The windows are deliberately generous — this is a children's product, and the
 * difficulty should come from what is being asked, never from demanding
 * millisecond precision. For reference, DDR's "Great" is about ±92ms and osu!'s
 * mid-difficulty 100-window is about ±100ms; Splitbeat's *Good* reaches ±155ms.
 *
 * The one place they tighten is when notes get close together: a ±155ms window
 * on a 16th-note run at 150bpm (100ms apart) would let one tap claim three
 * different notes. So every window is clamped to a fraction of the current
 * spacing. That clamp is the difference between a run feeling crisp and feeling
 * like mush.
 */

export type Verdict = "perfect" | "great" | "good" | "miss";

export type Windows = { perfect: number; great: number; good: number; miss: number };

export const BASE_WINDOWS: Windows = {
  perfect: 0.058,
  great: 0.105,
  good: 0.155,
  miss: 0.205,
};

/** `spacing` is seconds between adjacent notes in the densest active lane. */
export function windowsFor(spacing: number): Windows {
  // The 45ms floor stops the windows collapsing to nothing on a dense bar, but
  // it must never grow past half the gap between two notes — if it did, one tap
  // would sit inside two notes' windows at once and the nearest-note search
  // would silently eat the wrong one.
  const cap = Math.min(spacing * 0.5, Math.max(0.045, spacing * 0.46));
  return {
    perfect: Math.min(BASE_WINDOWS.perfect, cap * 0.34),
    great: Math.min(BASE_WINDOWS.great, cap * 0.62),
    good: Math.min(BASE_WINDOWS.good, cap * 0.86),
    miss: Math.min(BASE_WINDOWS.miss, cap),
  };
}

/**
 * The windows on one of the three ANSWER tiles.
 *
 * `strikeSec` comes from `answerPlan(item)` and from nothing else — see
 * `answer.ts` for why that matters — so unlike `windowsFor` this takes no
 * spacing, consults no tempo, and cannot narrow because the run sped up. The
 * four bands keep the same proportions the base windows have, so the verdict
 * word a child sees on a tile means what it means everywhere else.
 *
 * `windowsFor` is deliberately NOT reused with `spacing = strikeSec * 2`: it
 * clamps against `BASE_WINDOWS`, so every plan above ±205 ms would silently
 * collapse back onto the motion constant this exists to escape.
 */
export function strikeWindows(strikeSec: number): Windows {
  const s = Number.isFinite(strikeSec) && strikeSec > 0 ? strikeSec : BASE_WINDOWS.miss;
  return {
    perfect: s * (BASE_WINDOWS.perfect / BASE_WINDOWS.miss),
    great: s * (BASE_WINDOWS.great / BASE_WINDOWS.miss),
    good: s * (BASE_WINDOWS.good / BASE_WINDOWS.miss),
    miss: s,
  };
}

/** `delta` is (hitTime - noteTime); sign is kept by the caller for the meter. */
export function verdictFor(delta: number, w: Windows): Verdict | null {
  const a = Math.abs(delta);
  if (a <= w.perfect) return "perfect";
  if (a <= w.great) return "great";
  if (a <= w.good) return "good";
  if (a <= w.miss) return "miss";
  return null; // not this note's business at all
}

export const VERDICT_SCORE: Record<Verdict, number> = {
  perfect: 100,
  great: 62,
  good: 28,
  miss: 0,
};

/** Combo multiplier: climbs fast early so it is felt, then caps. */
export function multiplierFor(combo: number): number {
  if (combo < 8) return 1;
  if (combo < 20) return 2;
  if (combo < 40) return 3;
  if (combo < 70) return 4;
  if (combo < 110) return 6;
  return 8;
}

/** How much of the band is playing, from the same combo ladder. */
export function layerFor(combo: number): number {
  if (combo < 8) return 0;
  if (combo < 20) return 1;
  if (combo < 40) return 2;
  if (combo < 80) return 3;
  return 4;
}
