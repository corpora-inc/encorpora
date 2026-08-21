// One persistence adapter, shared by every store in the app.
//
// Four stores persist (theme, settings, profiles, packs) plus two per learner
// (the record and the construction). Each of them needs the same two lines of
// degradation: `localStorage` is absent under `node --test` and switchable off
// in a WebView, and neither is a reason to throw at a child. Six copies of that
// is six chances for one of them to be the copy that throws.
//
// The fallback is process lifetime, not a silent drop: a setting changed in a
// browsing mode that forbids storage still works for as long as the app is
// open, and is simply not there next launch.

import { createJSONStorage, type StateStorage } from "zustand/middleware"

/**
 * The stand-in store. Module level and exported so a test can read what a
 * store wrote without a DOM — which is how `profiles.test.ts` proves that two
 * learners wrote two keys.
 */
export const ephemeral = new Map<string, string>()

const memoryStorage: StateStorage = {
  getItem: (name) => ephemeral.get(name) ?? null,
  setItem: (name, value) => void ephemeral.set(name, value),
  removeItem: (name) => void ephemeral.delete(name),
}

/**
 * Resolved per call rather than captured: Safari can throw on the property
 * access itself, and a module-level read would take the app down at import.
 */
function web(): StateStorage {
  try {
    return typeof localStorage === "undefined" ? memoryStorage : localStorage
  } catch {
    return memoryStorage
  }
}

/** The `storage` option every `persist(...)` in this app passes. */
export const durable = createJSONStorage(web)
