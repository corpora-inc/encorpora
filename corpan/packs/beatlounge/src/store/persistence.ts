/**
 * beatlounge — IndexedDB persistence for the active song.
 *
 * Mirrors melopan's projectStore shape: one DB ("beatlounge"), one object
 * store ("songs"), the active doc under the key "active". The BeatloungeDoc is
 * already plain JSON (document.ts rule #1), so it serializes losslessly with
 * no migration needed yet. Writes are debounced by the store; this module only
 * owns the raw load/save primitives and degrades gracefully when IDB is absent
 * (SSR / private-mode / tests) — noisy, not silent, on real failures.
 */

import type { BeatloungeDoc } from "../model/document"
import { getBeatloungeDb, SONGS_STORE as STORE } from "./db"

const ACTIVE_KEY = "active"

const getDb = getBeatloungeDb

/** Load the persisted active doc, or null if none / unavailable. */
export const loadActiveDoc = async (): Promise<BeatloungeDoc | null> => {
  try {
    const db = await getDb()
    if (!db) return null
    const doc = (await db.get(STORE, ACTIVE_KEY)) as BeatloungeDoc | undefined
    return doc ?? null
  } catch (err) {
    console.warn("[beatlounge/persistence] load failed:", err)
    return null
  }
}

/** Persist the active doc. Caller debounces. */
export const saveActiveDoc = async (doc: BeatloungeDoc): Promise<void> => {
  try {
    const db = await getDb()
    if (!db) return
    await db.put(STORE, doc, ACTIVE_KEY)
  } catch (err) {
    console.warn("[beatlounge/persistence] save failed:", err)
  }
}

/** Clear the persisted doc (used by "new song" flows / tests). */
export const clearActiveDoc = async (): Promise<void> => {
  try {
    const db = await getDb()
    if (!db) return
    await db.delete(STORE, ACTIVE_KEY)
  } catch (err) {
    console.warn("[beatlounge/persistence] clear failed:", err)
  }
}
