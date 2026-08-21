// src/lib/storage/enginePersistence.ts — the persistence adapter the Journey
// engine consumes (storage-analytics.md §3.7, R15). Learner state is keyed
// (stackId, courseId) per D5. The engine is pure TS (zero DOM/Tauri imports,
// D4): it RECEIVES this interface at construction; the app wires the real
// stores, simulation harnesses wire in-memory fakes.
//
// Type parameters instead of concrete types on purpose:
//   - `Card` (ItemCardRecord) is OWNED by specs/engine.md (W3). This spec
//     fixes only WHERE cards live and that their codec must supply
//     schemaVersion + parse + migrate (FSRS card loss = re-placement —
//     recoverable but expensive, so `migrate` is mandatory for any card
//     schema bump; enforced by review).
//   - `Ev` is LocalAnalyticsEvent in the app wiring. The concrete factory
//     (`createJourneyPersistence`) lives in lib/localAnalytics/index.ts so
//     this module stays free of upward imports.
//
// INTEGRATOR (W3/W10): the engine imports `EnginePersistence` from
// "@/lib/storage" (type-only); the app calls
// `createJourneyPersistence(stackId, courseId, cardCodec)` from
// "@/lib/localAnalytics" in src/journey/persistence.ts.

import { docStore, type DocStore, type DocCodec } from "./doc"
import { docKvStore, type KVStore } from "./kv"
import type { AppendLog } from "./log"
import type { WriteBatcher } from "./batch"

export interface EnginePersistence<Card = unknown, Ev = unknown> {
  /** FSRS item cards. Doc id = serialized ItemRef (activityContract.ts R2).
   *  ns = `journey-cards:${stackId}:${courseId}`. ~64B × ≤25k ≈ 1.6MB (D5). */
  itemCards: DocStore<Card>
  /** THE review history. This is the §4 local analytics log — the engine
   *  reads `activity_result` records for calibration + future FSRS weight
   *  optimization. One log, two readers; no second copy (D-a). */
  events: AppendLog<Ev>
  /** Small engine meta: θ, placement snapshot, mixer window state.
   *  ns = `journey-meta:${stackId}:${courseId}` (IDB-DOC via docKvStore). */
  meta: KVStore
}

export function journeyCardsNs(stackId: string, courseId: string): string {
  return `journey-cards:${stackId}:${courseId}`
}

export function journeyMetaNs(stackId: string, courseId: string): string {
  return `journey-meta:${stackId}:${courseId}`
}

/** Assemble an EnginePersistence from its parts. The events log is injected
 *  (the app passes the shared local-analytics log; sims pass a memory fake). */
export function createEnginePersistence<Card, Ev>(opts: {
  stackId: string
  courseId: string
  cardCodec: DocCodec<Card>
  events: AppendLog<Ev>
  batcher?: WriteBatcher
}): EnginePersistence<Card, Ev> {
  return {
    itemCards: docStore<Card>(
      journeyCardsNs(opts.stackId, opts.courseId),
      opts.cardCodec,
      opts.batcher,
    ),
    events: opts.events,
    meta: docKvStore(journeyMetaNs(opts.stackId, opts.courseId), opts.batcher),
  }
}
