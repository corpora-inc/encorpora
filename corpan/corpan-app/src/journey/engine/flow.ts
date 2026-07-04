// journey/engine/flow.ts — session flow controller (adaptivity §6.1).
// Window = last 8 SCORED cards; perf = mean(score) − 0.15 × mean(latencyZ > 1).

import {
  FLOW_CRUISE_PERF,
  FLOW_FAIL_SCORE,
  FLOW_LATENCY_PENALTY,
  FLOW_MIN_SCORED,
  FLOW_STRUGGLE_FAILS,
  FLOW_STRUGGLE_PERF,
  FLOW_WINDOW,
} from "./constants.ts"
import type { SessionState } from "./types.ts"

export type FlowMode = "cruise" | "normal" | "struggle"

export function classifyFlow(win: { score: number; latencyZ: number }[]): FlowMode {
  if (win.length < FLOW_MIN_SCORED) return "normal" // cold window
  let scoreSum = 0
  let slowCount = 0
  let fails = 0
  for (const w of win) {
    scoreSum += w.score
    if (w.latencyZ > 1) slowCount += 1
    if (w.score < FLOW_FAIL_SCORE) fails += 1
  }
  const perf = scoreSum / win.length - FLOW_LATENCY_PENALTY * (slowCount / win.length)
  if (fails >= FLOW_STRUGGLE_FAILS || perf < FLOW_STRUGGLE_PERF) return "struggle"
  if (perf >= FLOW_CRUISE_PERF && fails === 0) return "cruise"
  return "normal"
}

/** Push one scored card and recompute the mode. */
export function pushFlow(session: SessionState, entry: { score: number; latencyZ: number }): FlowMode {
  session.flow.window.push(entry)
  if (session.flow.window.length > FLOW_WINDOW) session.flow.window.shift()
  session.flow.mode = classifyFlow(session.flow.window)
  session.modeTally[session.flow.mode] += 1
  return session.flow.mode
}
