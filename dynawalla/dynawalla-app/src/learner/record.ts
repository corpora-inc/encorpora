// What one learner has done, across every pack.
//
// The host ships no exercises, so it does not know what an exercise *is*. It
// knows that something a pack mounted reported an answer and whether that
// answer was right (`packs/host.ts`). Two totals is the whole record, and that
// is deliberate: a per-skill model needs a skill catalog, a skill catalog is
// content, and content lives in packs (ADR-0022). `@dynawalla/engine` is
// unchanged and unwired, waiting for the first pack that declares one.
//
// Totals only ever rise. There is no code path here that lowers `correct`, and
// the absence of one is where "no loss" is enforced rather than promised — a
// migration that reset the counts would be a child's history disappearing on an
// app update, which is the same failure as a loss state with a different cause.

import { create, type StoreApi, type UseBoundStore } from "zustand"
import { persist } from "zustand/middleware"

import { storageKey } from "../app/profile.ts"
import { durable } from "../app/persist.ts"

export interface LearnerRecord {
  readonly answered: number
  readonly correct: number
}

export const EMPTY_RECORD: LearnerRecord = { answered: 0, correct: 0 }

export interface RecordState extends LearnerRecord {
  answer: (correct: boolean) => void
}

export type RecordStore = UseBoundStore<StoreApi<RecordState>>

/**
 * A stored count, or zero. A record written by an older build is untrusted
 * input: a string, a negative, a `NaN` from a half-written JSON blob.
 */
export function whole(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

/**
 * One store per learner, keyed by their namespace.
 *
 * A factory rather than a singleton because the profile dimension is the
 * point: the app builds one per learner it has seen this launch, and the tests
 * build three side by side and cross-read their keys.
 */
export function createRecordStore(profileId: string): RecordStore {
  return create<RecordState>()(
    persist(
      (set) => ({
        ...EMPTY_RECORD,
        answer: (correct) =>
          set((state) => ({
            answered: state.answered + 1,
            correct: state.correct + (correct ? 1 : 0),
          })),
      }),
      {
        name: storageKey(profileId, "record"),
        version: 1,
        storage: durable,
        partialize: ({ answered, correct }) => ({ answered, correct }),
        // Rehydration is the one place a *stored* count could take a child
        // backwards, so it is the one place that is checked. `Math.max` against
        // what is already in memory can only ever raise.
        merge: (persisted, current) => {
          const stored = persisted as Partial<LearnerRecord> | undefined
          return {
            ...current,
            answered: Math.max(current.answered, whole(stored?.answered)),
            correct: Math.max(current.correct, whole(stored?.correct)),
          }
        },
      },
    ),
  )
}
