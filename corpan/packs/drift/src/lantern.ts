/**
 * lantern.ts — the "catch the drift" spawn/timing model, DOM-free + seeded so it
 * unit-tests headless (mirrors challenge.ts / wordfall's tileLayout).
 *
 * A catch window floats 2–4 word-LANTERNS onto a slow current. They drift from
 * the right edge to the left over a crossing budget; catch (tap) the one
 * carrying the target word before it drifts off. This module decides ONLY the
 * arrangement + timing (lane, stagger, crossing duration, spawn order, the
 * guaranteed-early-win first spawn) and the pure remaining-fraction math the
 * scorer reads. It never touches the DOM, TTS, or the journey seam.
 */

import { CHALLENGE_WINDOW_MS, isCorrectPick, makeRng, shuffle } from "./challenge"

/** Two staggered vertical lanes so pills never overlap as they cross. */
export const LANE_COUNT = 2
/** A single lantern's crossing time (right edge → off the left edge). */
export const CROSS_MS = CHALLENGE_WINDOW_MS
/** Launch stagger between successive lanterns, ms. */
export const STAGGER_MS = 520

/** One drifting word-lantern. */
export type Lantern = {
  /** The candidate word this lantern carries. */
  word: string
  /** True when this lantern carries the target (the correct catch). */
  isTarget: boolean
  /** 0..LANE_COUNT-1 — vertical lane. */
  lane: number
  /** ms after window start before this lantern launches onto the current. */
  startDelayMs: number
  /** One-time soft pulse (the guaranteed-early-win first lantern). */
  pulse: boolean
}

/** A laid-out catch window: the lanterns + the timing budget. */
export type LanternField = {
  lanterns: Lantern[]
  /** Per-lantern crossing time, ms. */
  crossMs: number
  /** Total window life (last launch + one crossing) — the drift-out deadline. */
  windowMs: number
}

/**
 * Arrange a catch window deterministically for `seed`.
 *  - `guaranteedFirst` (used on the FIRST window of a run): the CORRECT lantern
 *    launches FIRST and pulses once, so the player scores within seconds of
 *    launch — the "obvious in 3s" + early-win graft.
 *  - otherwise the launch order is a seeded shuffle.
 * `reduced` (prefers-reduced-motion): no stagger — every lantern is present at
 * once as a static bobbing row, timed by one depleting glow bar.
 */
export function layoutLanterns(
  options: readonly string[],
  targetWord: string,
  seed: number,
  opts: { guaranteedFirst?: boolean; reduced?: boolean } = {},
): LanternField {
  const rng = makeRng(seed)
  const target = options.find((o) => isCorrectPick(o, targetWord)) ?? targetWord
  const rest = options.filter((o) => !isCorrectPick(o, targetWord))
  const order = opts.guaranteedFirst
    ? [target, ...shuffle(rest, rng)]
    : shuffle(options, rng)

  const stagger = opts.reduced ? 0 : STAGGER_MS
  const lanterns: Lantern[] = order.map((word, i) => ({
    word,
    isTarget: isCorrectPick(word, targetWord),
    lane: i % LANE_COUNT,
    startDelayMs: i * stagger,
    pulse: !!opts.guaranteedFirst && i === 0,
  }))
  const maxDelay = lanterns.length > 0 ? (lanterns.length - 1) * stagger : 0
  return { lanterns, crossMs: CROSS_MS, windowMs: maxDelay + CROSS_MS }
}

/**
 * The unfinished share of a lantern's crossing at tap time, 0..1. An early
 * catch pays more (rf→1); a last-second catch still pays the floor (rf→0). Pure
 * + clamped so it is safe to feed straight into the scorer.
 */
export function remainingFraction(elapsedMs: number, crossMs: number): number {
  if (!(crossMs > 0)) return 0
  return Math.max(0, Math.min(1, 1 - elapsedMs / crossMs))
}

/** A lantern's crossing progress 0..1 (1 = drifted off) at `elapsedMs`. */
export function crossingProgress(elapsedMs: number, crossMs: number): number {
  if (!(crossMs > 0)) return 1
  return Math.max(0, Math.min(1, elapsedMs / crossMs))
}
