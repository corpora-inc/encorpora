// src/lib/storage/idb.ts (re-homed from src/util/storage — Journey W1)
//
// Dependency-free Promise wrapper over IndexedDB. This is the LARGE-tier
// backing store for the unified storage service (see ./index.ts).
//
// Why IndexedDB and not localStorage:
//   - All packs + the app share ONE WebView origin's localStorage (~5 MB).
//     Heavy caches (the phrase-pack catalog, the game catalog, analytics
//     events) blow that budget and `localStorage.setItem` throws a SYNC
//     `QuotaExceededError`. IndexedDB has a far larger, async quota and
//     degrades gracefully under pressure.
//   - This module NEVER throws to callers on a quota/IO error: every op
//     resolves (with `undefined`/`false` on failure) and logs LOUDLY
//     (project rule: errors are noisy, never silently swallowed).
//
// One object store ("kv") holds every record, keyed by a fully-qualified
// `namespace::key` string. Each record carries metadata (size estimate,
// timestamps, TTL, volatility) so the storage layer can evict LRU/volatile
// entries when a write fails for lack of space.

export const IDB_DB_NAME = "corpan-store"
export const IDB_DB_VERSION = 1
export const IDB_KV_STORE = "kv"

/** A stored record. `v` is the caller's value (already JSON-safe for the
 *  JSON helpers, or any structured-clonable value for raw set). */
export type IdbRecord = {
  /** Fully-qualified key: `${namespace}::${key}`. */
  fqk: string
  /** The stored value. Structured-clonable. */
  v: unknown
  /** Approx byte size — used for eviction accounting. Best-effort. */
  size: number
  /** Epoch ms of creation. */
  createdAt: number
  /** Epoch ms of last read OR write — drives LRU eviction. */
  touchedAt: number
  /** Optional absolute expiry (epoch ms). Reads past this return undefined. */
  expiresAt?: number
  /** Schema version stamped by the caller. Mismatches are dropped on read. */
  schema?: number
  /** Volatile entries are the FIRST to be evicted under pressure, before
   *  LRU even kicks in. Caches mark themselves volatile; durable state
   *  (progress, identity that lives in the LARGE tier) does not. */
  volatile?: boolean
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null
  } catch {
    return false
  }
}

/** Open (and cache) the database. Resolves to null when IndexedDB is
 *  unavailable or the open itself fails — callers then degrade to memory. */
export function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  if (!hasIndexedDb()) {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false
    const done = (db: IDBDatabase | null) => {
      if (settled) return
      settled = true
      resolve(db)
    }
    try {
      const req = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(IDB_KV_STORE)) {
          const store = db.createObjectStore(IDB_KV_STORE, { keyPath: "fqk" })
          store.createIndex("touchedAt", "touchedAt", { unique: false })
          store.createIndex("volatile", "volatile", { unique: false })
        }
      }
      req.onsuccess = () => {
        const db = req.result
        // If the tab is told the connection is now obsolete (another tab
        // upgraded the schema), drop our cached handle so the next call
        // re-opens cleanly rather than throwing on a closed connection.
        db.onversionchange = () => {
          try {
            db.close()
          } catch {
            /* ignore */
          }
          dbPromise = null
        }
        done(db)
      }
      req.onerror = () => {
        console.error("[storage/idb] open failed:", req.error)
        done(null)
      }
      req.onblocked = () => {
        console.warn("[storage/idb] open blocked by another connection")
      }
    } catch (err) {
      console.error("[storage/idb] open threw:", err)
      done(null)
    }
  })
  return dbPromise
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(IDB_KV_STORE, mode).objectStore(IDB_KV_STORE)
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Read one record by fully-qualified key. Resolves undefined on miss/error. */
export async function idbGet(fqk: string): Promise<IdbRecord | undefined> {
  const db = await openDb()
  if (!db) return undefined
  try {
    const rec = await reqToPromise(tx(db, "readonly").get(fqk))
    return (rec as IdbRecord) ?? undefined
  } catch (err) {
    console.error("[storage/idb] get failed for", fqk, err)
    return undefined
  }
}

/** Write one record. Resolves true on success, false on (logged) error.
 *  IMPORTANT: a quota failure here rejects internally and we return false —
 *  it NEVER propagates as a throw to the caller. */
export async function idbPut(rec: IdbRecord): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  try {
    await reqToPromise(tx(db, "readwrite").put(rec))
    return true
  } catch (err) {
    // QuotaExceededError lands here too. Caller (storage/index.ts) reacts by
    // evicting + retrying; we just report the failure honestly.
    console.error("[storage/idb] put failed for", rec.fqk, err)
    return false
  }
}

/** Delete one record. Resolves true on success (or no-op), false on error. */
export async function idbDel(fqk: string): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  try {
    await reqToPromise(tx(db, "readwrite").delete(fqk))
    return true
  } catch (err) {
    console.error("[storage/idb] delete failed for", fqk, err)
    return false
  }
}

/** All fully-qualified keys (optionally filtered by namespace prefix). */
export async function idbKeys(prefix?: string): Promise<string[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const keys = (await reqToPromise(
      tx(db, "readonly").getAllKeys() as IDBRequest<IDBValidKey[]>,
    )) as string[]
    if (!prefix) return keys
    return keys.filter((k) => k.startsWith(prefix))
  } catch (err) {
    console.error("[storage/idb] getAllKeys failed:", err)
    return []
  }
}

/** All records (optionally filtered by namespace prefix). Used for eviction
 *  scans and the analytics ring-buffer. */
export async function idbAll(prefix?: string): Promise<IdbRecord[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const all = (await reqToPromise(
      tx(db, "readonly").getAll() as IDBRequest<IdbRecord[]>,
    )) as IdbRecord[]
    if (!prefix) return all
    return all.filter((r) => r.fqk.startsWith(prefix))
  } catch (err) {
    console.error("[storage/idb] getAll failed:", err)
    return []
  }
}

/** Bulk delete in a single transaction. Resolves the count actually removed. */
export async function idbDelMany(fqks: string[]): Promise<number> {
  if (fqks.length === 0) return 0
  const db = await openDb()
  if (!db) return 0
  try {
    const store = tx(db, "readwrite")
    await Promise.all(fqks.map((k) => reqToPromise(store.delete(k))))
    return fqks.length
  } catch (err) {
    console.error("[storage/idb] delMany failed:", err)
    return 0
  }
}

/** Estimate remaining quota via the StorageManager API, when available.
 *  Returns null when the browser/WebView doesn't expose it (older WKWebView). */
export async function idbEstimate(): Promise<{
  usage: number
  quota: number
} | null> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      typeof navigator.storage.estimate === "function"
    ) {
      const est = await navigator.storage.estimate()
      return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
    }
  } catch (err) {
    console.warn("[storage/idb] estimate failed:", err)
  }
  return null
}

/** Test-only: drop the cached connection so a fresh open() re-runs.
 *  Used by the verification harness between simulated reloads. */
export function __resetDbForTests(): void {
  dbPromise = null
}
