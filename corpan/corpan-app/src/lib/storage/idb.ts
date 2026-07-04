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
// Object stores (DB v2, storage-analytics.md §3.2):
//   "kv"   (v1) — one record per fully-qualified `namespace::key` string.
//                 Each record carries metadata (size estimate, timestamps,
//                 TTL, volatility) so the storage layer can evict
//                 LRU/volatile entries when a write fails for lack of space.
//   "docs" (v2) — keyed [ns, id]. Backing store for DocStore<T> (./doc.ts).
//   "log"  (v2) — keyed [ns, seq], index ns_ts on [ns, ts]. Backing store
//                 for AppendLog<T> (./log.ts).
// The v1→v2 upgrade is ADDITIVE: existing `kv` records are untouched, so
// catalogs/telemetry survive with zero migration.

export const IDB_DB_NAME = "corpan-store"
export const IDB_DB_VERSION = 2
export const IDB_KV_STORE = "kv"
export const IDB_DOC_STORE = "docs"
export const IDB_LOG_STORE = "log"

/** localStorage key counting CONSECUTIVE openDb failures (corruption ladder
 *  level 3, §3.10). At ≥2 consecutive boot failures we deleteDatabase and
 *  start fresh: a working empty app beats a permanently broken full one. */
export const OPEN_FAILURES_LS_KEY = "corpan-store:open-failures"

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

/** One document in the v2 `docs` store. Composite primary key [ns, id]. */
export type DocRecord = {
  /** Namespace, registered in ./namespaces.ts. */
  ns: string
  /** Document id within the namespace (e.g. a serialized ItemRef). */
  id: string
  /** The document (structured-clonable). */
  v: unknown
  /** Namespace schema version at write time (DocCodec.schemaVersion). */
  schema: number
  /** Best-effort bytes (estimateSize). */
  size: number
  /** Epoch ms of last write. */
  updatedAt: number
}

/** One entry in the v2 `log` store. Composite primary key [ns, seq]. */
export type LogRecordRaw = {
  ns: string
  /** Monotonic per ns, assigned synchronously at enqueue (log.ts §3.5). */
  seq: number
  /** Epoch ms. Indexed via ns_ts for time-ranged reads. */
  ts: number
  /** The entry payload (structured-clonable). */
  v: unknown
  size: number
}

let dbPromise: Promise<IDBDatabase | null> | null = null

/* ----------------------------------------------------------------------- */
/*  DB health (corruption ladder level 3 bookkeeping — doctor reads this)  */
/* ----------------------------------------------------------------------- */

let dbRebuiltAt: number | null = null

function readOpenFailures(): number {
  try {
    const raw = localStorage.getItem(OPEN_FAILURES_LS_KEY)
    const n = raw === null ? 0 : Number(raw)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

function writeOpenFailures(n: number): void {
  try {
    if (n <= 0) localStorage.removeItem(OPEN_FAILURES_LS_KEY)
    else localStorage.setItem(OPEN_FAILURES_LS_KEY, String(n))
  } catch {
    /* localStorage unavailable — the counter is best-effort */
  }
}

/** Doctor hook: last-resort DB rebuild stamp + current consecutive open
 *  failure count. */
export function idbHealth(): { dbRebuiltAt: number | null; openFailures: number } {
  return { dbRebuiltAt, openFailures: readOpenFailures() }
}

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null
  } catch {
    return false
  }
}

/** One raw open attempt. Resolves null on failure (logged). */
function openOnce(): Promise<IDBDatabase | null> {
  return new Promise<IDBDatabase | null>((resolve) => {
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
        // v1 store — unchanged.
        if (!db.objectStoreNames.contains(IDB_KV_STORE)) {
          const store = db.createObjectStore(IDB_KV_STORE, { keyPath: "fqk" })
          store.createIndex("touchedAt", "touchedAt", { unique: false })
          store.createIndex("volatile", "volatile", { unique: false })
        }
        // v2 stores (additive — existing kv records untouched).
        if (!db.objectStoreNames.contains(IDB_DOC_STORE)) {
          const docs = db.createObjectStore(IDB_DOC_STORE, { keyPath: ["ns", "id"] })
          docs.createIndex("ns", "ns", { unique: false })
        }
        if (!db.objectStoreNames.contains(IDB_LOG_STORE)) {
          const log = db.createObjectStore(IDB_LOG_STORE, { keyPath: ["ns", "seq"] })
          log.createIndex("ns", "ns", { unique: false })
          log.createIndex("ns_ts", ["ns", "ts"], { unique: false })
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
}

function deleteDb(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(IDB_DB_NAME)
      req.onsuccess = () => resolve(true)
      req.onerror = () => {
        console.error("[storage/idb] deleteDatabase failed:", req.error)
        resolve(false)
      }
      req.onblocked = () => {
        console.warn("[storage/idb] deleteDatabase blocked by another connection")
      }
    } catch (err) {
      console.error("[storage/idb] deleteDatabase threw:", err)
      resolve(false)
    }
  })
}

/** Open (and cache) the database. Resolves to null when IndexedDB is
 *  unavailable or the open itself fails — callers then degrade to memory.
 *
 *  Corruption ladder level 3 (§3.10): consecutive open failures are counted
 *  in localStorage. ONE failure only degrades the session (null). At ≥2
 *  consecutive failures the database is deleted and reopened fresh —
 *  catalogs re-fetch, telemetry restarts, the learner re-places. This is the
 *  disaster floor, not the plan. */
export function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  if (!hasIndexedDb()) {
    dbPromise = Promise.resolve(null)
    return dbPromise
  }
  dbPromise = (async () => {
    const db = await openOnce()
    if (db) {
      writeOpenFailures(0)
      return db
    }
    const failures = readOpenFailures() + 1
    writeOpenFailures(failures)
    if (failures < 2) return null
    console.error(
      `[storage/idb] ${failures} consecutive open failures — deleting the ` +
        "database and starting fresh (corruption ladder level 3).",
    )
    if (!(await deleteDb())) return null
    const fresh = await openOnce()
    if (!fresh) return null
    writeOpenFailures(0)
    dbRebuiltAt = Date.now()
    return fresh
  })()
  return dbPromise
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  storeName: string = IDB_KV_STORE,
): IDBObjectStore {
  return db.transaction(storeName, mode).objectStore(storeName)
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

/* -------------------------------------------------------------------------- */
/*  v2 primitives — docs store (DocStore backing, ./doc.ts)                    */
/* -------------------------------------------------------------------------- */
// Same never-throw contract as the v1 helpers: every op resolves
// (undefined/[]/0/false on failure) and logs loudly.

/** Full [ns, *] key range over a composite-keyed store. Arrays sort after
 *  strings in IDB key order, so [ns, []] is an upper bound over every string
 *  id; numbers sort before strings, so -Infinity/Infinity bound every seq. */
function docRange(ns: string): IDBKeyRange {
  return IDBKeyRange.bound([ns, ""], [ns, []])
}
function logRange(ns: string, fromSeq = -Infinity, toSeq = Infinity): IDBKeyRange {
  return IDBKeyRange.bound([ns, fromSeq], [ns, toSeq])
}

function txDone(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error ?? new Error("transaction aborted"))
  })
}

export async function idbDocGet(ns: string, id: string): Promise<DocRecord | undefined> {
  const db = await openDb()
  if (!db) return undefined
  try {
    const rec = await reqToPromise(tx(db, "readonly", IDB_DOC_STORE).get([ns, id]))
    return (rec as DocRecord) ?? undefined
  } catch (err) {
    console.error("[storage/idb] docGet failed for", ns, id, err)
    return undefined
  }
}

export async function idbDocGetAll(ns: string): Promise<DocRecord[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const all = await reqToPromise(
      tx(db, "readonly", IDB_DOC_STORE).getAll(docRange(ns)) as IDBRequest<DocRecord[]>,
    )
    return all ?? []
  } catch (err) {
    console.error("[storage/idb] docGetAll failed for", ns, err)
    return []
  }
}

export async function idbDocCount(ns: string): Promise<number> {
  const db = await openDb()
  if (!db) return 0
  try {
    return await reqToPromise(tx(db, "readonly", IDB_DOC_STORE).count(docRange(ns)))
  } catch (err) {
    console.error("[storage/idb] docCount failed for", ns, err)
    return 0
  }
}

export async function idbDocPut(rec: DocRecord): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  try {
    await reqToPromise(tx(db, "readwrite", IDB_DOC_STORE).put(rec))
    return true
  } catch (err) {
    console.error("[storage/idb] docPut failed for", rec.ns, rec.id, err)
    return false
  }
}

export async function idbDocDelete(ns: string, id: string): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  try {
    await reqToPromise(tx(db, "readwrite", IDB_DOC_STORE).delete([ns, id]))
    return true
  } catch (err) {
    console.error("[storage/idb] docDelete failed for", ns, id, err)
    return false
  }
}

/** Drop every record in a doc namespace. Resolves the number removed. */
export async function idbDocClear(ns: string): Promise<number> {
  const db = await openDb()
  if (!db) return 0
  try {
    const store = tx(db, "readwrite", IDB_DOC_STORE)
    const keys = await reqToPromise(
      store.getAllKeys(docRange(ns)) as IDBRequest<IDBValidKey[]>,
    )
    for (const k of keys) void store.delete(k)
    await txDone(store.transaction)
    return keys.length
  } catch (err) {
    console.error("[storage/idb] docClear failed for", ns, err)
    return 0
  }
}

/** Every doc record in the store — DOCTOR/DEV ONLY (full scan). */
export async function idbDocAll(): Promise<DocRecord[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const all = await reqToPromise(
      tx(db, "readonly", IDB_DOC_STORE).getAll() as IDBRequest<DocRecord[]>,
    )
    return all ?? []
  } catch (err) {
    console.error("[storage/idb] docAll failed:", err)
    return []
  }
}

/* -------------------------------------------------------------------------- */
/*  v2 primitives — log store (AppendLog backing, ./log.ts)                    */
/* -------------------------------------------------------------------------- */

/** Forward seq-ranged read, bounded by `limit`. Never loads the whole log —
 *  callers page with `fromSeq = last.seq + 1`. (Reverse reads are computed by
 *  ./log.ts from the known headSeq, so no cursor direction is needed here.) */
export async function idbLogRange(
  ns: string,
  fromSeq: number,
  toSeq: number,
  limit: number,
): Promise<LogRecordRaw[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const recs = await reqToPromise(
      tx(db, "readonly", IDB_LOG_STORE).getAll(
        logRange(ns, fromSeq, toSeq),
        limit,
      ) as IDBRequest<LogRecordRaw[]>,
    )
    return recs ?? []
  } catch (err) {
    console.error("[storage/idb] logRange failed for", ns, err)
    return []
  }
}

/** Time-ranged read via the ns_ts index, bounded by `limit`. */
export async function idbLogRangeByTs(
  ns: string,
  fromTs: number,
  toTs: number,
  limit: number,
): Promise<LogRecordRaw[]> {
  const db = await openDb()
  if (!db) return []
  try {
    const idx = tx(db, "readonly", IDB_LOG_STORE).index("ns_ts")
    const recs = await reqToPromise(
      idx.getAll(
        IDBKeyRange.bound([ns, fromTs], [ns, toTs]),
        limit,
      ) as IDBRequest<LogRecordRaw[]>,
    )
    return recs ?? []
  } catch (err) {
    console.error("[storage/idb] logRangeByTs failed for", ns, err)
    return []
  }
}

export async function idbLogCount(ns: string): Promise<number> {
  const db = await openDb()
  if (!db) return 0
  try {
    return await reqToPromise(tx(db, "readonly", IDB_LOG_STORE).count(logRange(ns)))
  } catch (err) {
    console.error("[storage/idb] logCount failed for", ns, err)
    return 0
  }
}

/**
 * Delete log records with fromSeq <= seq <= toSeq. Because seqs are DENSE
 * integers assigned by the log's in-memory counter, this iterates the seq
 * range directly (bounded by the range size) instead of scanning keys — the
 * eventStore `getAllKeys`-per-append mistake stays dead. Returns the count
 * and best-effort bytes removed.
 */
export async function idbLogDeleteRange(
  ns: string,
  fromSeq: number,
  toSeq: number,
): Promise<{ removed: number; bytes: number }> {
  if (toSeq < fromSeq) return { removed: 0, bytes: 0 }
  const db = await openDb()
  if (!db) return { removed: 0, bytes: 0 }
  try {
    const store = tx(db, "readwrite", IDB_LOG_STORE)
    let removed = 0
    let bytes = 0
    for (let seq = fromSeq; seq <= toSeq; seq += 1) {
      const key = [ns, seq]
      const g = store.get(key)
      g.onsuccess = () => {
        const rec = g.result as LogRecordRaw | undefined
        if (rec) {
          removed += 1
          bytes += rec.size ?? 0
          void store.delete(key)
        }
      }
    }
    await txDone(store.transaction)
    return { removed, bytes }
  } catch (err) {
    console.error("[storage/idb] logDeleteRange failed for", ns, err)
    return { removed: 0, bytes: 0 }
  }
}

/** Drop every record in a log namespace. Resolves the number removed. */
export async function idbLogClear(ns: string): Promise<number> {
  const db = await openDb()
  if (!db) return 0
  try {
    const store = tx(db, "readwrite", IDB_LOG_STORE)
    const keys = await reqToPromise(
      store.getAllKeys(logRange(ns)) as IDBRequest<IDBValidKey[]>,
    )
    for (const k of keys) void store.delete(k)
    await txDone(store.transaction)
    return keys.length
  } catch (err) {
    console.error("[storage/idb] logClear failed for", ns, err)
    return 0
  }
}

/* -------------------------------------------------------------------------- */
/*  Batched commit — ONE readwrite transaction over docs + log (§3.9)          */
/* -------------------------------------------------------------------------- */

/**
 * The WriteBatcher's commit path: all doc puts, doc deletes, and log appends
 * land in a single readwrite transaction spanning both v2 stores, so a log's
 * meta doc can never diverge from its records. Resolves true only when the
 * transaction COMMITS. Quota failures resolve false (the batcher evicts +
 * retries, then degrades to the memory mirror) — never a throw.
 */
export async function idbBatchWrite(
  docs: DocRecord[],
  logs: LogRecordRaw[],
  docDeletes: Array<{ ns: string; id: string }> = [],
): Promise<boolean> {
  if (docs.length === 0 && logs.length === 0 && docDeletes.length === 0) return true
  const db = await openDb()
  if (!db) return false
  try {
    const t = db.transaction([IDB_DOC_STORE, IDB_LOG_STORE], "readwrite")
    const docStore = t.objectStore(IDB_DOC_STORE)
    const logStore = t.objectStore(IDB_LOG_STORE)
    for (const d of docs) void docStore.put(d)
    for (const del of docDeletes) void docStore.delete([del.ns, del.id])
    for (const l of logs) void logStore.put(l)
    await txDone(t)
    return true
  } catch (err) {
    console.error("[storage/idb] batchWrite failed:", err)
    return false
  }
}

/** Test-only: drop the cached connection so a fresh open() re-runs.
 *  Used by the verification harness between simulated reloads. */
export function __resetDbForTests(): void {
  dbPromise = null
}
