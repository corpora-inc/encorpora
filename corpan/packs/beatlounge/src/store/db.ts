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
const DB_VERSION = 3
export const SONGS_STORE = "songs"
export const TTS_STORE = "tts-assets"
/** Saved Scenes (named complete-state checkpoints), keyed by `scenes:<docId>`. */
export const SCENES_STORE = "scenes"
const OPEN_TIMEOUT_MS = 4000

let dbPromise: Promise<IDBPDatabase | null> | null = null

const hasIndexedDB = (): boolean =>
  typeof indexedDB !== "undefined" && indexedDB != null

const openOnce = (): Promise<IDBPDatabase | null> =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(SONGS_STORE)) db.createObjectStore(SONGS_STORE)
      if (!db.objectStoreNames.contains(TTS_STORE)) db.createObjectStore(TTS_STORE)
      // v3: per-song saved Scenes. Additive — a pre-v3 DB just gains the store.
      if (!db.objectStoreNames.contains(SCENES_STORE)) db.createObjectStore(SCENES_STORE)
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

/** Marker so the timeout branch is distinguishable from a real null open. */
const TIMED_OUT = Symbol("idb-timeout")

export const getBeatloungeDb = (): Promise<IDBPDatabase | null> => {
  if (!hasIndexedDB()) return Promise.resolve(null)
  // Capture the open we're about to race so the timeout handler clears EXACTLY
  // this attempt (and never a newer one a later caller may have started).
  const pending = dbPromise ?? (dbPromise = openOnce())
  // Race the cached open against a timeout for THIS call only. The real open
  // keeps running; a slow first call degrades alone (callers fall back to the
  // in-memory default doc) instead of blocking first paint.
  const timeout = new Promise<typeof TIMED_OUT>((resolve) =>
    setTimeout(
      () => resolve(TIMED_OUT),
      // Jitter so concurrent callers don't all give up on the same frame.
      OPEN_TIMEOUT_MS + Math.floor(Math.random() * 500)
    )
  )
  return Promise.race([pending, timeout]).then((result) => {
    if (result === TIMED_OUT) {
      console.warn(
        `[beatlounge/db] open slow (>${OPEN_TIMEOUT_MS}ms) — degrading this call`
      )
      // Don't permanently cache a hung/slow open: drop the cache so the NEXT
      // call starts a fresh attempt instead of re-racing the same stuck promise.
      // (Only clear if it's still the one we raced — a newer caller may have
      // already replaced it after a versionchange/failure reset.)
      if (dbPromise === pending) dbPromise = null
      return null
    }
    return result
  })
}
