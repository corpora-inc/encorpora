// The per-learner stores, one set per profile, made on first use.
//
// Two things persist per learner — the record and the construction — and both
// are factories over a storage namespace rather than singletons, because the
// profile is a dimension of the data and not a global. This module is the one
// place that turns "the current profile id" into "the stores to read", so
// switching learners is a change of one string and no remounting.
//
// Cached forever, deliberately: a zustand store is a closure over a few
// numbers, a family has a handful of learners, and re-creating one on every
// render would hand React a new subscription every frame.

import { createRecordStore, type RecordStore } from "../learner/record.ts"
import { createWorldStore, type WorldStore } from "../world/store.ts"
import { storageKey } from "./profile.ts"

const records = new Map<string, RecordStore>()
const worlds = new Map<string, WorldStore>()

export function recordFor(profileId: string): RecordStore {
  const existing = records.get(profileId)
  if (existing) return existing
  const made = createRecordStore(profileId)
  records.set(profileId, made)
  return made
}

export function worldFor(profileId: string): WorldStore {
  const existing = worlds.get(profileId)
  if (existing) return existing
  const made = createWorldStore(storageKey(profileId, "world"))
  worlds.set(profileId, made)
  return made
}

/**
 * Drop the cache after storage has been erased underneath it.
 *
 * Without this, "erase everything" clears the keys and leaves the *in-memory*
 * stores holding the numbers they had a moment ago — the screen would keep
 * showing a construction that no longer exists on disk until the next launch,
 * which is the worst possible answer to a parent asking whether the data is
 * gone. The caller re-creates them empty on the next read.
 */
export function forgetCachedStores(): void {
  records.clear()
  worlds.clear()
}
