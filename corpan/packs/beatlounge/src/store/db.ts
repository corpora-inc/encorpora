/**
 * beatlounge — the ONE IndexedDB connection.
 *
 * Both the song persistence (store "songs") and the TTS audio cache (store
 * "tts-assets") live in the same "beatlounge" database. They MUST open it at the
 * same version with the same set of stores — opening one name at two different
 * versions makes the higher-version upgrade BLOCK forever on the lower-version
 * connection (that was the phrase "place" button spinning indefinitely). This
 * module is the single opener everyone shares.
 *
 * Defensive: the open is raced against a timeout so a future block degrades to
 * "no persistence / no cache" instead of hanging the UI. Failures are logged.
 */

import { openDB, type IDBPDatabase } from "idb"

const DB_NAME = "beatlounge"
const DB_VERSION = 2
export const SONGS_STORE = "songs"
export const TTS_STORE = "tts-assets"
const OPEN_TIMEOUT_MS = 4000

let dbPromise: Promise<IDBPDatabase | null> | null = null

const hasIndexedDB = (): boolean =>
  typeof indexedDB !== "undefined" && indexedDB != null

const openOnce = (): Promise<IDBPDatabase | null> =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SONGS_STORE)) db.createObjectStore(SONGS_STORE)
      if (!db.objectStoreNames.contains(TTS_STORE)) db.createObjectStore(TTS_STORE)
    },
    blocked() {
      console.warn("[beatlounge/db] open blocked by another connection")
    },
  }).then(
    (db) => {
      // Close our connection if another context needs to upgrade, so we never
      // block it — and drop the cache so the next call reopens cleanly.
      db.addEventListener("versionchange", () => {
        try {
          db.close()
        } catch {
          /* already closing */
        }
        dbPromise = null
      })
      return db
    },
    (err) => {
      console.warn("[beatlounge/db] openDB failed:", err)
      dbPromise = null // allow a retry on the next call
      return null
    }
  )

export const getBeatloungeDb = (): Promise<IDBPDatabase | null> => {
  if (!hasIndexedDB()) return Promise.resolve(null)
  if (!dbPromise) dbPromise = openOnce()
  // Race the (cached, never-abandoned) open against a timeout for THIS call only.
  // The real open keeps running; a slow first call degrades alone, and if the
  // open ultimately fails we reset the cache (above) so callers retry.
  const timeout = new Promise<IDBPDatabase | null>((resolve) =>
    setTimeout(() => {
      console.warn(`[beatlounge/db] open slow (>${OPEN_TIMEOUT_MS}ms) — degrading this call`)
      resolve(null)
    }, OPEN_TIMEOUT_MS)
  )
  return Promise.race([dbPromise, timeout])
}
