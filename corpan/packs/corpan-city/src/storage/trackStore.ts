/**
 * trackStore — the per-Track namespaced storage seam (SEAM 1 producer).
 *
 * A tiny async `key → JSON` store over **IndexedDB** (quota-safe, tens of MB+),
 * with a **localStorage fallback** for standalone/SSR-less environments that lack
 * IndexedDB (noisy on fallback). It is the `{ namespace, store }` binding every
 * per-Track factory (`createInventory` / `createQuestEngine` / the badge store)
 * opts INTO instead of touching `localStorage` directly — their compact serialize
 * logic is UNCHANGED; only the key and the backing store are parameterized.
 *
 * STORAGE DISCIPLINE (LANGUAGE_PAIR_STATE §2 + the shared-localStorage memory):
 *   - The registry (`wp:tracks:index:v1`) and tiny globals (`wp:player:id`, intro
 *     flags) stay in localStorage — read once at boot, a few hundred bytes.
 *   - The HEAVY per-Track bodies (economy, quest, badges) live in IndexedDB,
 *     keyed `wp:track:{id}:{store}`. IndexedDB is quota-safe so thousands of
 *     Tracks never threaten the shared ~5 MB localStorage origin budget.
 *   - Only the active Track's stores are resident in memory.
 *
 * Contract (`src/contracts/runtime.ts`):
 *   read<T>(key): Promise<T | null>   // null if absent/corrupt (logs on corrupt)
 *   write(key, value): Promise<void>  // quota-safe, never throws into the caller
 *   remove(key): Promise<void>
 *   keys(prefix): Promise<string[]>   // archival/eviction/analytics
 *
 * Noisy, never silent (project rule): every corrupt read / failed write logs
 * loudly; a quota or transaction failure NEVER reaches the game loop.
 */

import type { TrackStore, TrackStoreBinding } from "../contracts/runtime"
import { trackNamespace } from "@corpan-city/contracts"

const LOG = "[wp/trackStore]"
const DB_NAME = "corpan-city"
const DB_VERSION = 1
const OBJECT_STORE = "kv"

/* --------------------------------------------------- IndexedDB availability */

/**
 * Is a usable IndexedDB present? `happy-dom`/jsdom and a few hardened WebViews
 * expose no IndexedDB (or a broken one). We feature-detect once and fall back to
 * localStorage there (noisy). `indexedDB` can also throw merely on access in some
 * sandboxed contexts, so the probe is wrapped.
 */
function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null
  } catch {
    return false
  }
}

/* ----------------------------------------------------- IndexedDB-backed store */

/**
 * Open (and lazily create) the single key→value object store. The promise is
 * memoized so concurrent stores share one connection. A failed open rejects so
 * the factory can fall back to localStorage (noisy).
 */
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (err) {
      reject(err)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(OBJECT_STORE)) {
        db.createObjectStore(OBJECT_STORE)
      }
    }
    req.onsuccess = () => {
      const db = req.result
      // If the connection is ever force-closed (e.g. a version change in another
      // tab), drop the memo so the next call re-opens cleanly.
      db.onversionchange = () => {
        db.close()
        if (dbPromise) dbPromise = null
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error("IndexedDB open blocked"))
  })
  // If opening fails, allow a later retry (don't cache a rejected promise forever).
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Stored value JSON-stringified (so corrupt/partial writes are detectable on read). */
function createIdbStore(): TrackStore {
  return {
    async read<T>(key: string): Promise<T | null> {
      try {
        const db = await openDb()
        const tx = db.transaction(OBJECT_STORE, "readonly")
        const raw = await idbRequest<unknown>(tx.objectStore(OBJECT_STORE).get(key))
        if (raw == null) return null
        if (typeof raw !== "string") {
          console.warn(`${LOG} non-string record at "${key}" — treating as absent`)
          return null
        }
        return JSON.parse(raw) as T
      } catch (err) {
        // Corrupt JSON or a read failure → null + loud log (noisy, never silent).
        console.warn(`${LOG} read("${key}") failed/corrupt — returning null:`, err)
        return null
      }
    },

    async write(key: string, value: unknown): Promise<void> {
      let body: string
      try {
        body = JSON.stringify(value)
      } catch (err) {
        console.error(`${LOG} write("${key}") — value is not serializable; dropped:`, err)
        return
      }
      try {
        const db = await openDb()
        const tx = db.transaction(OBJECT_STORE, "readwrite")
        const done = idbRequest(tx.objectStore(OBJECT_STORE).put(body, key))
        await done
      } catch (err) {
        // Quota or transaction failure — never throw into the game loop.
        console.error(`${LOG} write("${key}") failed (in-memory only this session):`, err)
      }
    },

    async remove(key: string): Promise<void> {
      try {
        const db = await openDb()
        const tx = db.transaction(OBJECT_STORE, "readwrite")
        await idbRequest(tx.objectStore(OBJECT_STORE).delete(key))
      } catch (err) {
        console.warn(`${LOG} remove("${key}") failed:`, err)
      }
    },

    async keys(prefix: string): Promise<string[]> {
      try {
        const db = await openDb()
        const tx = db.transaction(OBJECT_STORE, "readonly")
        const all = await idbRequest<IDBValidKey[]>(tx.objectStore(OBJECT_STORE).getAllKeys())
        return all
          .filter((k): k is string => typeof k === "string")
          .filter((k) => k.startsWith(prefix))
      } catch (err) {
        console.warn(`${LOG} keys("${prefix}") failed — returning []:`, err)
        return []
      }
    },
  }
}

/* --------------------------------------------------- localStorage fallback */

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  )
}

/**
 * The fallback store for environments without IndexedDB (standalone dev w/o IDB,
 * happy-dom test env, hardened WebViews). Functionally identical surface; the
 * data lands in the shared localStorage budget instead, so it is announced once
 * (noisy) — heavy per-Track bodies SHOULD live in IndexedDB.
 */
function createLocalStorageStore(announce: boolean): TrackStore {
  if (announce) {
    console.warn(
      `${LOG} IndexedDB unavailable — falling back to localStorage. Heavy per-Track ` +
        `bodies will share the ~5 MB origin budget; this is fine for dev/tests, not for scale.`,
    )
  }
  return {
    async read<T>(key: string): Promise<T | null> {
      try {
        const raw = localStorage.getItem(key)
        if (raw == null) return null
        return JSON.parse(raw) as T
      } catch (err) {
        console.warn(`${LOG} (ls) read("${key}") failed/corrupt — returning null:`, err)
        return null
      }
    },
    async write(key: string, value: unknown): Promise<void> {
      let body: string
      try {
        body = JSON.stringify(value)
      } catch (err) {
        console.error(`${LOG} (ls) write("${key}") — not serializable; dropped:`, err)
        return
      }
      try {
        localStorage.setItem(key, body)
      } catch (err) {
        if (isQuotaError(err)) {
          console.error(`${LOG} (ls) quota exceeded writing "${key}" — kept in memory only:`, err)
        } else {
          console.error(`${LOG} (ls) write("${key}") failed:`, err)
        }
      }
    },
    async remove(key: string): Promise<void> {
      try {
        localStorage.removeItem(key)
      } catch (err) {
        console.warn(`${LOG} (ls) remove("${key}") failed:`, err)
      }
    },
    async keys(prefix: string): Promise<string[]> {
      try {
        const out: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && k.startsWith(prefix)) out.push(k)
        }
        return out
      } catch (err) {
        console.warn(`${LOG} (ls) keys("${prefix}") failed — returning []:`, err)
        return []
      }
    },
  }
}

/* ----------------------------------------------------------- factory + seam */

/**
 * Build a `TrackStore`. Prefers IndexedDB; falls back to localStorage when
 * IndexedDB is absent. The IndexedDB store self-heals to localStorage at runtime
 * is NOT attempted per-call (the feature-detect at construction is authoritative
 * and avoids split-brain writes); a genuinely broken IDB surfaces as loud
 * per-op logs and null reads, which the per-Track stores treat as "empty".
 */
export function createTrackStore(opts?: { forceLocalStorage?: boolean }): TrackStore {
  if (opts?.forceLocalStorage || !hasIndexedDb()) {
    return createLocalStorageStore(!opts?.forceLocalStorage)
  }
  return createIdbStore()
}

/* --------------------------------------------------------- process singleton */

let _store: TrackStore | null = null

/**
 * The process-wide `TrackStore` the Track manager + per-Track factories share.
 * One backing connection for the whole pack session.
 */
export function trackStore(): TrackStore {
  if (!_store) _store = createTrackStore()
  return _store
}

/** Reset the singleton (tests only). */
export function __resetTrackStoreForTests(): void {
  _store = null
  dbPromise = null
}

/**
 * Build the `{ namespace, store }` binding for one Track. This is the EXACT param
 * the orchestrator threads into `createInventory({ binding })` /
 * `createQuestEngine({ binding })` / the badge store: they key their record
 * `${namespace}:${suffix}` (e.g. `wp:track:en:es:economy`).
 */
export function bindingFor(trackId: string, store: TrackStore = trackStore()): TrackStoreBinding {
  return { namespace: trackNamespace(trackId), store }
}
