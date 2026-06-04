// packs/shared/state/safeStorage.ts
//
// Quota-safe shared storage for PACKS. Packs run inside the host app's WebView
// origin, so they share ONE ~5 MB localStorage budget with the app and every
// other pack (see the "Corpán Packs Share localStorage" project memory). A
// pack that rolls its own `localStorage.setItem` for anything growable can:
//   - throw an unhandled `QuotaExceededError` (the exact bug this foundation
//     fixes), and/or
//   - evict ANOTHER pack's / the app's critical keys when the browser trims.
//
// This util gives packs the same two-tier, quota-safe contract the app uses,
// in a self-contained form (packs are built as standalone bundles and can't
// import `corpan-app/src`). It opens the SAME IndexedDB database the app uses
// (`corpan-store`, store `kv`) so large pack data lives alongside app data with
// shared eviction — there is one storage substrate for the whole WebView.
//
// Contract (identical to the app's): writes NEVER throw; on quota pressure we
// log loudly, evict volatile/LRU entries, retry once, then degrade to an
// in-memory mirror and keep going.

const IDB_DB_NAME = "corpan-store"
const IDB_DB_VERSION = 1
const IDB_KV_STORE = "kv"
const SEP = "::"
const LS_PREFIX = "corpan-pack-store:"

type Rec = {
  fqk: string
  v: unknown
  size: number
  createdAt: number
  touchedAt: number
  expiresAt?: number
  schema?: number
  volatile?: boolean
}

let dbPromise: Promise<IDBDatabase | null> | null = null
const memoryMirror = new Map<string, Rec>()

function hasIdb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null
  } catch {
    return false
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  if (!hasIdb()) {
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
        console.error("[pack-storage] idb open failed:", req.error)
        done(null)
      }
    } catch (err) {
      console.error("[pack-storage] idb open threw:", err)
      done(null)
    }
  })
  return dbPromise
}

function reqP<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function store(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(IDB_KV_STORE, mode).objectStore(IDB_KV_STORE)
}

async function idbGet(fqk: string): Promise<Rec | undefined> {
  const db = await openDb()
  if (!db) return undefined
  try {
    return ((await reqP(store(db, "readonly").get(fqk))) as Rec) ?? undefined
  } catch (err) {
    console.error("[pack-storage] get failed:", fqk, err)
    return undefined
  }
}

async function idbPut(rec: Rec): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  try {
    await reqP(store(db, "readwrite").put(rec))
    return true
  } catch (err) {
    console.error("[pack-storage] put failed:", rec.fqk, err)
    return false
  }
}

async function idbDel(fqk: string): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  try {
    await reqP(store(db, "readwrite").delete(fqk))
    return true
  } catch (err) {
    console.error("[pack-storage] delete failed:", fqk, err)
    return false
  }
}

async function idbAll(): Promise<Rec[]> {
  const db = await openDb()
  if (!db) return []
  try {
    return ((await reqP(
      store(db, "readonly").getAll() as IDBRequest<Rec[]>,
    )) as Rec[]) ?? []
  } catch (err) {
    console.error("[pack-storage] getAll failed:", err)
    return []
  }
}

async function evict(keepFqk: string, targetCount: number): Promise<void> {
  const all = await idbAll()
  const candidates = all.filter((r) => r.fqk !== keepFqk)
  candidates.sort((a, b) => {
    const av = a.volatile ? 0 : 1
    const bv = b.volatile ? 0 : 1
    if (av !== bv) return av - bv
    return a.touchedAt - b.touchedAt
  })
  const victims = candidates.slice(0, Math.max(targetCount, 1))
  if (victims.length === 0) return
  console.warn(
    `[pack-storage] quota pressure — evicting ${victims.length} entr${victims.length === 1 ? "y" : "ies"}`,
  )
  for (const v of victims) await idbDel(v.fqk)
}

function estimateSize(v: unknown): number {
  try {
    return typeof v === "string" ? v.length * 2 : JSON.stringify(v).length * 2
  } catch {
    return 0
  }
}

export type PackStoreOptions = {
  /** "large" → IndexedDB (default for this util). "tiny" → guarded localStorage
   *  for small, critical, synchronously-needed flags. */
  tier?: "tiny" | "large"
  /** Per-namespace default volatility (large tier defaults to true). */
  volatile?: boolean
}

export type SetOpts = { ttlMs?: number; schema?: number; volatile?: boolean }
export type GetOpts = { schema?: number }

export type PackStore = {
  readonly name: string
  getJSON<T>(key: string, opts?: GetOpts): Promise<T | undefined>
  setJSON<T>(key: string, value: T, opts?: SetOpts): Promise<void>
  del(key: string): Promise<void>
}

function live(rec: Rec, schema?: number): boolean {
  if (rec.expiresAt && Date.now() > rec.expiresAt) return false
  if (schema !== undefined && rec.schema !== undefined && rec.schema !== schema)
    return false
  return true
}

function lsKey(ns: string, key: string): string {
  return `${LS_PREFIX}${ns}${SEP}${key}`
}

/**
 * Create a quota-safe, namespaced store for a pack. Namespace your pack's
 * data (e.g. `createPackStore("hanzipan")`) so it never collides with the app
 * or another pack.
 *
 *   const s = createPackStore("my-pack")
 *   await s.setJSON("progress", { level: 3 })       // → IndexedDB, quota-safe
 *   const p = await s.getJSON<{level:number}>("progress")
 */
export function createPackStore(
  namespace: string,
  opts?: PackStoreOptions,
): PackStore {
  const tier = opts?.tier ?? "large"
  const defaultVolatile = opts?.volatile ?? tier === "large"
  const fqk = (key: string) => `${namespace}${SEP}${key}`

  if (tier === "tiny") {
    return {
      name: namespace,
      async getJSON<T>(key: string, getOpts?: GetOpts): Promise<T | undefined> {
        try {
          const raw = localStorage.getItem(lsKey(namespace, key))
          if (raw === null) return undefined
          const parsed = JSON.parse(raw) as { __s?: number; v?: T }
          if (parsed && typeof parsed === "object" && "v" in parsed) {
            if (
              getOpts?.schema !== undefined &&
              parsed.__s !== undefined &&
              parsed.__s !== getOpts.schema
            )
              return undefined
            return parsed.v
          }
          return parsed as unknown as T
        } catch (err) {
          console.error("[pack-storage] tiny getJSON failed:", err)
          return undefined
        }
      },
      async setJSON<T>(key: string, value: T, setOpts?: SetOpts): Promise<void> {
        const k = lsKey(namespace, key)
        const raw = JSON.stringify({ __s: setOpts?.schema, v: value })
        try {
          localStorage.setItem(k, raw)
          return
        } catch (err) {
          console.error("[pack-storage] tiny set failed (will retry):", err)
        }
        // Trim our own pack-store keys then retry once.
        try {
          for (let i = 0; i < localStorage.length; i += 1) {
            const lk = localStorage.key(i)
            if (lk && lk.startsWith(LS_PREFIX) && lk !== k) {
              localStorage.removeItem(lk)
              break
            }
          }
          localStorage.setItem(k, raw)
        } catch (err2) {
          console.error(
            "[pack-storage] tiny set failed after trim; kept in memory:",
            err2,
          )
          memoryMirror.set(`ls:${k}`, {
            fqk: `ls:${k}`,
            v: raw,
            size: raw.length * 2,
            createdAt: Date.now(),
            touchedAt: Date.now(),
            volatile: true,
          })
        }
      },
      async del(key: string): Promise<void> {
        try {
          localStorage.removeItem(lsKey(namespace, key))
        } catch (err) {
          console.error("[pack-storage] tiny del failed:", err)
        }
      },
    }
  }

  // LARGE tier (IndexedDB)
  return {
    name: namespace,
    async getJSON<T>(key: string, getOpts?: GetOpts): Promise<T | undefined> {
      const k = fqk(key)
      let rec = await idbGet(k)
      if (!rec) rec = memoryMirror.get(k)
      if (!rec) return undefined
      if (!live(rec, getOpts?.schema)) {
        void idbDel(k)
        memoryMirror.delete(k)
        return undefined
      }
      rec.touchedAt = Date.now()
      void idbPut(rec).catch(() => undefined)
      return rec.v as T
    },
    async setJSON<T>(key: string, value: T, setOpts?: SetOpts): Promise<void> {
      const k = fqk(key)
      const now = Date.now()
      const existing = await idbGet(k)
      const rec: Rec = {
        fqk: k,
        v: value,
        size: estimateSize(value),
        createdAt: existing?.createdAt ?? now,
        touchedAt: now,
        expiresAt: setOpts?.ttlMs ? now + setOpts.ttlMs : undefined,
        schema: setOpts?.schema,
        volatile: setOpts?.volatile ?? defaultVolatile,
      }
      if (await idbPut(rec)) {
        memoryMirror.delete(k)
        return
      }
      await evict(k, 8)
      if (await idbPut(rec)) {
        memoryMirror.delete(k)
        return
      }
      console.error(
        `[pack-storage] durable write for "${k}" failed after eviction; kept in memory for this session.`,
      )
      memoryMirror.set(k, rec)
    },
    async del(key: string): Promise<void> {
      const k = fqk(key)
      memoryMirror.delete(k)
      await idbDel(k)
    },
  }
}
