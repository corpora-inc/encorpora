// Shared engine test harness: fixture graph + memory persistence + manual
// clock + scripted-responder helpers. No wall clock, no unseeded randomness.

import { createManualClock, DAY_MS, type ManualClock } from "../clock.ts"
import { createJourneyEngine, createMemoryPersistence, type JourneyEngine } from "../engine.ts"
import type { MemoryPersistence } from "../persistence/memory.ts"
import type { ActivityResult, CourseGraph, EngineCard } from "../types.ts"
import { makeFixtureGraph, type FixtureOpts } from "./fixtureGraph.ts"

export const START_DAY = 20_000 // fixed epoch day anchor

export interface Harness {
  engine: JourneyEngine
  clock: ManualClock
  graph: CourseGraph
  persistence: MemoryPersistence
}

export async function makeEngine(opts: FixtureOpts = {}, graphOverride?: CourseGraph): Promise<Harness> {
  const graph = graphOverride ?? makeFixtureGraph(opts)
  const clock = createManualClock({ startMs: START_DAY * DAY_MS + 10 * 3_600_000 })
  const persistence = createMemoryPersistence({ now: () => clock.nowMs() })
  const engine = createJourneyEngine({
    key: { stackId: "stack-1", courseId: graph.courseId },
    graph,
    persistence,
    clock,
  })
  await engine.load()
  return { engine, clock, graph, persistence }
}

/** Answer one EngineCard. pass=true → full-score pass on every item. */
export function answer(
  card: EngineCard,
  opts: {
    pass?: boolean
    score?: number
    latencyMs?: number
    hintsUsed?: number
    partial?: boolean
    abandoned?: boolean
    perItem?: boolean
  } = {},
): ActivityResult {
  const pass = opts.pass ?? true
  const outcome = opts.partial ? "partial" : pass ? "pass" : "fail"
  const score = opts.score ?? (opts.partial ? 0.6 : pass ? 1 : 0)
  const perItem =
    opts.perItem === false
      ? []
      : card.spec.itemRefs.map((itemRef) => ({
          itemRef,
          outcome: outcome as "pass" | "partial" | "fail",
          latencyMs: opts.latencyMs ?? 4000,
          hintsUsed: opts.hintsUsed ?? 0,
        }))
  return {
    specId: card.spec.specId,
    score,
    perItem,
    durationMs: opts.latencyMs ?? 5000,
    abandoned: opts.abandoned,
  }
}

/** Drive a batch through applyResult with a fixed pass pattern. */
export function playBatch(
  engine: JourneyEngine,
  cards: EngineCard[],
  passFn: (card: EngineCard, i: number) => boolean = () => true,
): void {
  cards.forEach((card, i) => {
    engine.applyResult(answer(card, { pass: passFn(card, i) }))
  })
}
