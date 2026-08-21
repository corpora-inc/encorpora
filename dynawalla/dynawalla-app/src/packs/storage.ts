// The keys a pack keeps, kept for it.
//
// A pack frame is sandboxed without `allow-same-origin`, so it has no
// `localStorage`, no IndexedDB and no cookies — which is the point, and which
// is why the `storage` capability exists. This is the other end of it: a small
// map, per learner, per pack, written through the same durable adapter as every
// other store in the app so a parent's "erase everything" reaches it.
//
// Per learner rather than per device: a level a child reached is theirs, and
// two siblings sharing a tablet must not share a save.
//
// The budget (`MAX_STORAGE_KEYS`, `MAX_STORAGE_VALUE_LENGTH`) is enforced in
// `bridge.ts`, not here. This module is storage; the boundary is the boundary.

import { create, type StoreApi, type UseBoundStore } from "zustand"
import { persist } from "zustand/middleware"

import { durable } from "../app/persist.ts"
import { storageKey } from "../app/profile.ts"

export type PackKeys = Readonly<Record<string, string>>

export interface PackStorageState {
  /** `packId` → its own keys. Absent until the pack writes something. */
  readonly packs: Readonly<Record<string, PackKeys>>
  set: (packId: string, key: string, value: string) => void
  remove: (packId: string, key: string) => void
}

export type PackStorageStore = UseBoundStore<StoreApi<PackStorageState>>

const stores = new Map<string, PackStorageStore>()

function createPackStorage(profileId: string): PackStorageStore {
  return create<PackStorageState>()(
    persist(
      (set) => ({
        packs: {},
        set: (packId, key, value) =>
          set((state) => ({
            packs: { ...state.packs, [packId]: { ...(state.packs[packId] ?? {}), [key]: value } },
          })),
        remove: (packId, key) =>
          set((state) => {
            const existing = state.packs[packId]
            if (!existing || !(key in existing)) return state
            const next: Record<string, string> = { ...existing }
            delete next[key]
            return { packs: { ...state.packs, [packId]: next } }
          }),
      }),
      {
        name: storageKey(profileId, "packdata"),
        version: 1,
        storage: durable,
        partialize: ({ packs }) => ({ packs }),
        merge: (persisted, current) => {
          // Written by an older build, or half-written: every value has to be a
          // string, because that is what the pack will be handed back.
          const stored = (persisted as Partial<PackStorageState> | undefined)?.packs
          const packs: Record<string, PackKeys> = {}
          for (const [packId, keys] of Object.entries(stored ?? {})) {
            if (typeof keys !== "object" || keys === null) continue
            const clean: Record<string, string> = {}
            for (const [key, value] of Object.entries(keys)) {
              if (typeof value === "string") clean[key] = value
            }
            packs[packId] = clean
          }
          return { ...current, packs }
        },
      },
    ),
  )
}

/** One store per learner, made on first use and cached for the session. */
export function packStorageFor(profileId: string): PackStorageStore {
  const existing = stores.get(profileId)
  if (existing) return existing
  const made = createPackStorage(profileId)
  stores.set(profileId, made)
  return made
}

/** Drop the cache after storage was erased underneath it. */
export function forgetPackStorage(): void {
  stores.clear()
}
