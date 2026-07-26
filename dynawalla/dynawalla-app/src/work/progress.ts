// Durable progress, per profile.
//
// What survives a launch is deliberately small: where the child is on the ladder,
// how many correct answers they have at that rung, the seed cursor so the same
// problems are not served twice, and running totals. Everything else — the card
// on screen, the deck, the entry — is rebuilt from those four numbers, so there
// is no serialization of an `Exercise` (whose values are `BigInt`s and therefore
// not JSON) and no possibility of a stored card drifting out of step with a
// generator revision.
//
// Storage is `localStorage` because it is synchronous at module load; ADR-0018's
// second tier (IndexedDB for the event ring) arrives with the engine at M5 and
// has nothing to hold yet.
//
// `bugs` counts diagnoses per mal-rule id. It is a mastery-adjacent record, so it
// is namespaced with everything else, and it is internal: no learner-facing
// string ever names a misconception (M-16).

import { create, type StoreApi, type UseBoundStore } from "zustand"
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware"

import { storageKey } from "./profile.ts"

export interface Progress {
  readonly rung: number
  readonly rungCorrect: number
  readonly seedCursor: number
  readonly answered: number
  readonly correct: number
  readonly bugs: Readonly<Record<string, number>>
}

export const INITIAL_PROGRESS: Progress = {
  rung: 0,
  rungCorrect: 0,
  seedCursor: 0,
  answered: 0,
  correct: 0,
  bugs: {},
}

/** Where the child is. Written whenever the ladder or the seed cursor moves. */
export type Position = Pick<Progress, "rung" | "rungCorrect" | "seedCursor">

export interface ProgressState extends Progress {
  savePosition: (position: Position) => void
  recordAnswer: (correct: boolean) => void
  countBug: (misconception: string) => void
}

/**
 * Web storage is absent under `node --test` and can be disabled in a WebView.
 * Neither is a reason to throw at a child, so the preference degrades to process
 * lifetime. Shared and module-level on purpose: the namespacing test reads it to
 * prove three profiles wrote three keys.
 */
export const ephemeral = new Map<string, string>()

const memoryStorage: StateStorage = {
  getItem: (name) => ephemeral.get(name) ?? null,
  setItem: (name, value) => void ephemeral.set(name, value),
  removeItem: (name) => void ephemeral.delete(name),
}

export type ProgressStore = UseBoundStore<StoreApi<ProgressState>>

/**
 * One store per profile, keyed by the profile's namespace.
 *
 * A factory rather than a singleton because the profile dimension is the point:
 * `progress.test.ts` builds three and cross-reads their keys, which is the test
 * `Q-12` names. The app instantiates exactly one until the M9 switcher exists.
 */
export function createProgressStore(profileId: string): ProgressStore {
  return create<ProgressState>()(
    persist(
      (set) => ({
        ...INITIAL_PROGRESS,
        savePosition: (position) => set(position),
        // Totals only ever rise. There is no code path that lowers `correct`,
        // clears the ladder or forgets a rung — no loss is a product rule, and
        // the absence of a decrement here is where it is enforced (P-04's shape,
        // one milestone early).
        recordAnswer: (correct) =>
          set((state) => ({
            answered: state.answered + 1,
            correct: state.correct + (correct ? 1 : 0),
          })),
        countBug: (misconception) =>
          set((state) => ({ bugs: { ...state.bugs, [misconception]: (state.bugs[misconception] ?? 0) + 1 } })),
      }),
      {
        name: storageKey(profileId, "progress"),
        version: 1,
        storage: createJSONStorage(() =>
          typeof localStorage === "undefined" ? memoryStorage : localStorage,
        ),
        partialize: (state) => ({
          rung: state.rung,
          rungCorrect: state.rungCorrect,
          seedCursor: state.seedCursor,
          answered: state.answered,
          correct: state.correct,
          bugs: state.bugs,
        }),
      },
    ),
  )
}
