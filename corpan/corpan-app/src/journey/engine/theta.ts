// journey/engine/theta.ts — the Elo/1PL ability scalar θ (adaptivity §2.3).

import { THETA_K_DECAY, THETA_K_FLOOR } from "./constants.ts"
import type { CourseGraph, CourseState } from "./types.ts"

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/** Importance-weighted mean b over a result's items (engine.md §4.4). */
export function meanB(graph: CourseGraph, itemIds: string[]): number {
  let num = 0
  let den = 0
  for (const id of itemIds) {
    const item = graph.items[id]
    if (!item) continue
    num += item.b * item.importance
    den += item.importance
  }
  return den > 0 ? num / den : 0
}

/** θ += K·(score − σ(θ − b̄)); K decays 0.5 → 0.08 with resultCount. */
export function updateTheta(course: CourseState, score: number, bBar: number): void {
  course.theta += course.thetaK * (score - sigmoid(course.theta - bBar))
  course.resultCount += 1
  course.thetaK = Math.max(THETA_K_FLOOR, course.thetaK * THETA_K_DECAY)
}
