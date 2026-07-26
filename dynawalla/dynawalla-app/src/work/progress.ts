// Durable progress, per profile.
//
// What survives a launch is the **learner model**, encoded by the engine, plus
// the seed cursor and running totals. Everything else — the card on screen, the
// deck, the entry — is rebuilt, so there is no serialization of an `Exercise`
// (whose values are `BigInt`s and therefore not JSON) and no possibility of a
// stored card drifting out of step with a generator revision.
//
// The learner state is a string rather than a nested object on purpose. It is
// the engine's format, the engine owns its schema, and `decodeLearner` returns
// `null` rather than throwing on anything it does not recognise — so a state
// file written by an older build costs a child their model and not their launch.
// Gate EG-3 caps it at 100 KB; the measured size at every ring's cap is 27 KB.
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

import { storageKey } from "../app/profile.ts"

export interface Progress {
  /** The engine's encoded `LearnerState`, or `""` before the first session. */
  readonly learner: string
  readonly seedCursor: number
  /** Whole days since the epoch, as last seen. The engine never reads a clock. */
  readonly day: number
  readonly answered: number
  readonly correct: number
  readonly bugs: Readonly<Record<string, number>>
}

export const INITIAL_PROGRESS: Progress = {
  learner: "",
  seedCursor: 0,
  day: 0,
  answered: 0,
  correct: 0,
  bugs: {},
}

/** Where the child is. Written whenever the model or the seed cursor moves. */
export type Position = Pick<Progress, "learner" | "seedCursor" | "day">

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
 * A stored count, or zero. A record written by an older build is untrusted
 * input: a string, a negative, a `NaN` from a half-written JSON blob.
 */
function whole(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

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
        // Totals only ever rise, **including across a schema migration**. There
        // is no code path that lowers `correct` — no loss is a product rule, and
        // the absence of a decrement here is where it is enforced (P-04's shape,
        // one milestone early). The learner model itself is not a total and does
        // move both ways; what never moves down is what the child is *shown*.
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
        // 2: the fixed ladder's `rung`/`rungCorrect` became the engine's encoded
        // learner state at M5. A v1 record has no model in it, so **the model**
        // migrates to a cold start.
        //
        // The totals do not. `{ ...INITIAL_PROGRESS }` reset `answered`,
        // `correct` and `bugs` to zero eight lines below the comment above
        // saying no code path lowers them — immaterial today, because nothing
        // shipped on v1, and exactly the wrong template for the next schema bump
        // to copy. Only `learner` and `seedCursor` are the model's; the counts
        // are the child's.
        version: 2,
        migrate: (persisted) => {
          const before = persisted as Partial<Progress> | undefined
          return {
            ...INITIAL_PROGRESS,
            answered: whole(before?.answered),
            correct: whole(before?.correct),
            bugs: before?.bugs ?? {},
          }
        },
        storage: createJSONStorage(() =>
          typeof localStorage === "undefined" ? memoryStorage : localStorage,
        ),
        partialize: (state) => ({
          learner: state.learner,
          seedCursor: state.seedCursor,
          day: state.day,
          answered: state.answered,
          correct: state.correct,
          bugs: state.bugs,
        }),
      },
    ),
  )
}
