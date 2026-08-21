// What the child built, kept across launches.
//
// One number on disk. Everything drawn is derived from it, so there is no
// serialized geometry to fall out of step with a change to the rosette, and no
// list of cells that a bad merge could shorten.
//
// The storage key is a **parameter**, not something this module works out. The
// namespace belongs to the learner and the learner belongs to the app; the
// world knows only how a screen is cut. The caller — which knows about both —
// hands the namespace in. That is also why this is a factory rather than a
// singleton: a family has several of them side by side.

import { create, type StoreApi, type UseBoundStore } from "zustand"
import { persist } from "zustand/middleware"

import { durable } from "../app/persist.ts"
import { place, NOTHING_BUILT, type Construction } from "./construction.ts"

export interface WorldState extends Construction {
  /**
   * Cut one aperture. The only mutation. Returns the new count so a caller can
   * ask what closed without reading the store back and racing itself.
   */
  placeOne: () => number
}

export type WorldStore = UseBoundStore<StoreApi<WorldState>>

export function createWorldStore(namespace: string): WorldStore {
  return create<WorldState>()(
    persist(
      (set, get) => ({
        ...NOTHING_BUILT,
        placeOne: () => {
          const next = place({ placed: get().placed })
          set({ placed: next.placed })
          return next.placed
        },
      }),
      {
        name: namespace,
        version: 1,
        storage: durable,
        partialize: (state) => ({ placed: state.placed }),
        // A stored value that is not a whole number — a corrupted key, a
        // hand-edited devtools session — must not be able to take the world
        // backwards. `Math.max` against what is already there is the one place
        // a *rehydrated* count is checked, and it can only ever raise.
        merge: (persisted, current) => {
          const stored = (persisted as Partial<Construction> | undefined)?.placed
          const safe = typeof stored === "number" && Number.isFinite(stored) ? Math.floor(stored) : 0
          return { ...current, placed: Math.max(current.placed, Math.max(0, safe)) }
        },
      },
    ),
  )
}
