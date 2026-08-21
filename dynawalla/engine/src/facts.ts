/**
 * Layer F — fact memory, and the latency model the rest of the engine reads.
 *
 * Two things about this layer are non-obvious and both are load-bearing
 * (ADR-0008):
 *
 * - **Cards are keyed on classes, never instances.** Generated exercises have no
 *   stable id, so a per-item key would mint a new card per instance and silently
 *   degenerate spaced review into random practice. The key is
 *   `skill:<id>#L<level>#<formId>`.
 * - **The rating is a function of `(correct, latency)`, not correctness alone.**
 *   Fast-correct → Good/Easy; slow-correct → **Hard, with the interval capped**;
 *   incorrect → Again.
 *
 * The FSRS-6 implementation itself is deliberately *not* here. It is a one-file
 * `FactScheduler` seam with a test pinning the default weights, so a library
 * upgrade fails loudly instead of quietly reshuffling every interval.
 */

import {
  FACT_ELIGIBILITY_PHI,
  LATENCY_EWMA_WEIGHT,
  RATING_EASY_RATIO_PERCENT,
  RATING_GOOD_RATIO_PERCENT,
} from "./constants.ts";
import { ZERO, add, div, fromRatio, mul, sqrt, sub } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import type { Day, FactCard, LatencyStats, Rating } from "./types.ts";

export const NEW_LATENCY_STATS: LatencyStats = { meanS: ZERO, varianceS2: ZERO, count: 0 };

/** Milliseconds as fixed-point seconds. Seconds keep the variance in a small range. */
export function latencyToSeconds(latencyMs: number): Fix {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) throw new RangeError("latency must be a non-negative number");
  return fromRatio(Math.round(latencyMs), 1000);
}

/** EWMA of the child's own latency, with the matching EWMA of the squared deviation. */
export function observeLatency(stats: LatencyStats, latencyMs: number): LatencyStats {
  const value = latencyToSeconds(latencyMs);
  if (stats.count === 0) return { meanS: value, varianceS2: ZERO, count: 1 };
  const deviation = sub(value, stats.meanS);
  const meanS = add(stats.meanS, mul(LATENCY_EWMA_WEIGHT, deviation));
  const varianceS2 = add(stats.varianceS2, mul(LATENCY_EWMA_WEIGHT, sub(mul(deviation, deviation), stats.varianceS2)));
  return { meanS, varianceS2, count: stats.count + 1 };
}

/**
 * How unusual this latency is for this child, in standard deviations. Returns 0
 * before there is enough evidence to say anything — an engine that reads noise as
 * a signal on the second card of a session is worse than one that waits.
 */
export function latencyZ(stats: LatencyStats, latencyMs: number): Fix {
  if (stats.count < 5 || stats.varianceS2 <= ZERO) return ZERO;
  const deviation = sub(latencyToSeconds(latencyMs), stats.meanS);
  return div(deviation, sqrt(stats.varianceS2));
}

export type RatingDecision = {
  readonly rating: Rating;
  /**
   * True when the interval must not be allowed to grow. A slow-correct answer is
   * still an answer, but treating it as evidence of durable recall is how a child
   * ends up being asked for a fact they are actually still computing.
   */
  readonly capInterval: boolean;
};

/**
 * `(correct, latency) → rating`, relative to the child's own baseline rather than
 * to a fixed millisecond count: a six-year-old and a ten-year-old do not share a
 * clock.
 */
export function ratingFor(correct: boolean, latencyMs: number, baseline: LatencyStats): RatingDecision {
  if (!correct) return { rating: "again", capInterval: true };
  if (baseline.count === 0) return { rating: "good", capInterval: false };

  const value = latencyToSeconds(latencyMs);
  const easyCeiling = mulPercent(baseline.meanS, RATING_EASY_RATIO_PERCENT);
  const goodCeiling = mulPercent(baseline.meanS, RATING_GOOD_RATIO_PERCENT);
  if (value <= easyCeiling) return { rating: "easy", capInterval: false };
  if (value <= goodCeiling) return { rating: "good", capInterval: false };
  return { rating: "hard", capInterval: true };
}

function mulPercent(value: Fix, percent: number): Fix {
  return mul(value, fromRatio(percent, 100));
}

/**
 * Card creation is gated on φ crossing a fluency threshold, so facts the child
 * still *computes* stay in the Layer-S fluency-burst pool instead of entering
 * spaced review as though they were recalled.
 */
export function isFactEligible(phi: Fix): boolean {
  return phi >= FACT_ELIGIBILITY_PHI;
}

/**
 * The spaced-repetition seam. FSRS-6 lands behind this interface in PR-5.5, with a
 * test pinning its 21 default weights. Nothing else in the engine may know which
 * algorithm is behind it.
 */
export type FactScheduler = {
  readonly name: string;
  /** Number of weights the implementation carries, pinned by a test. */
  readonly weightCount: number;
  create(today: Day): FactCard;
  review(card: FactCard, rating: Rating, today: Day, capInterval: boolean): FactCard;
};

export function isDue(card: FactCard, today: Day): boolean {
  return card.dueDay <= today;
}
