// journey/engine/latency.ts — expected-latency baselines (engine.md §4.5).
// EWMA (α=0.2) of log-latency over CORRECT responses only; per-type seeds
// used at n=0; lengthScale clamps.

import {
  LATENCY_EWMA_ALPHA,
  LATENCY_SEEDS_MS,
  LATENCY_SEED_DEFAULT_MS,
  LENGTH_SCALE_DIVISOR,
  LENGTH_SCALE_MAX,
  LENGTH_SCALE_MIN,
} from "./constants.ts"
import type { CourseState } from "./types.ts"

export function lengthScale(textLen: number): number {
  const raw = textLen / LENGTH_SCALE_DIVISOR
  return Math.min(LENGTH_SCALE_MAX, Math.max(LENGTH_SCALE_MIN, raw))
}

export function seedLatencyMs(activityType: string): number {
  return LATENCY_SEEDS_MS[activityType] ?? LATENCY_SEED_DEFAULT_MS
}

/** exp(logMean) × lengthScale(textLen); seed when no baseline yet. */
export function expectedLatency(
  baselines: CourseState["latencyBaselines"],
  activityType: string,
  textLen: number,
): number {
  const base = baselines[activityType]
  const ms = base && base.n > 0 ? Math.exp(base.logMean) : seedLatencyMs(activityType)
  return ms * lengthScale(textLen)
}

/** Normalized latency: z = latencyMs / expectedLatency. */
export function latencyZ(
  baselines: CourseState["latencyBaselines"],
  activityType: string,
  textLen: number,
  latencyMs: number,
): number {
  const expected = expectedLatency(baselines, activityType, textLen)
  return expected > 0 ? latencyMs / expected : 1
}

/** Update the baseline from a CORRECT response (post-grading — §4.5).
 *  Length-normalized so mixed-length items share one per-type baseline. */
export function updateLatencyBaseline(
  baselines: CourseState["latencyBaselines"],
  activityType: string,
  textLen: number,
  latencyMs: number,
): void {
  if (!(latencyMs > 0)) return
  const normalized = latencyMs / lengthScale(textLen)
  const logL = Math.log(normalized)
  const base = baselines[activityType]
  if (!base || base.n === 0) {
    // First observation blends with the seed so one outlier can't own the baseline.
    const seed = Math.log(seedLatencyMs(activityType))
    baselines[activityType] = { logMean: seed + LATENCY_EWMA_ALPHA * (logL - seed), n: 1 }
    return
  }
  base.logMean = base.logMean + LATENCY_EWMA_ALPHA * (logL - base.logMean)
  base.n += 1
}
