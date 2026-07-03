// src/lib/storage/index.ts (re-homed from src/util/storage — Journey W1)
//
// Unified, quota-safe storage service for the whole app (and, via
// `@shared/state`, for packs). It replaces direct `localStorage` access for
// anything that can grow, and is the single place where a `QuotaExceededError`
// is allowed to exist — it is CAUGHT here and never reaches a caller.
//
// ── Tiers ──────────────────────────────────────────────────────────────────
//   TINY  → localStorage. Settings, flags, identity, tokens, opt-out. Small,
//           critical, must be synchronously readable on first paint. Writes
//           are still guarded: on QuotaExceededError we trim our own volatile
//           keys + retry once, then degrade to memory.
//   LARGE → IndexedDB (./idb.ts). Phrase-pack catalog, game catalog,
//           translation/content blobs, analytics events. Async, big quota,
//           LRU + volatile eviction on pressure.
//
// ── Quota-safety contract ────────────────────────────────────────────────
//   set / setJSON ALWAYS resolve. On a quota failure the service:
//     1. logs loudly,
//     2. evicts volatile entries (then LRU entries) to free space,
//     3. retries the write once,
//     4. if it still fails, keeps the value in an in-memory mirror and
//        resolves — the app keeps running, the write is simply not durable.
//
// ── API ──────────────────────────────────────────────────────────────────
//   const ns = storage.namespace("phrase-pack-catalog", { tier: "large" })
//   await ns.setJSON("catalog", value, { ttlMs, schema, volatile })
//   const v  = await ns.getJSON<Catalog>("catalog", { schema })
//   await ns.del("catalog")
//
// A localStorage-compatible shim (`createLocalStorageShim`) eases migrating
// zustand `persist` stores: it exposes async getItem/setItem/removeItem.

import {
  idbAll,
  idbDel,
  idbDelMany,
  idbGet,
  idbKeys,
  idbPut,
  type IdbRecord,
} from "./idb"
import { estimateSize } from "./bytes"

export type StorageTier = "tiny" | "large"

export type SetOptions = {
  /** Relative TTL in ms. After this, reads return undefined and the entry
   *  is lazily reaped. */
  ttlMs?: number
  /** Schema version. A read with a mismatched `schema` returns undefined
   *  (treated as absent) so stale-shaped data never reaches the app. */
  schema?: number
  /** Mark this entry as first-to-evict under storage pressure. Caches
   *  should set this; durable state should not. Defaults vary by tier
   *  (large/cache namespaces default volatile=true). */
  volatile?: boolean
}

export type GetOptions = {
  /** If provided, a stored record whose schema differs is treated as a miss. */
  schema?: number
}

export type NamespaceOptions = {
  tier?: StorageTier
  /** Default volatility for every set in this namespace (overridable per-set). */
  volatile?: boolean
}

const SEP = "::"
const LS_PREFIX = "corpan-store:"

function fqk(ns: string, key: string): string {
  return `${ns}${SEP}${key}`
}

/* -------------------------------------------------------------------------- */
/*  In-memory fallback mirror                                                 */
/* -------------------------------------------------------------------------- */
// When durable writes fail (no IndexedDB, quota exhausted even after
// eviction), we keep the value here so the current session still behaves
// correctly. It is NOT persisted across reload — that's an acceptable,
// loudly-logged degradation, not data loss of anything we could have saved.
const memoryMirror = new Map<string, IdbRecord>()

/* -------------------------------------------------------------------------- */
/*  LARGE tier (IndexedDB)                                                    */
/* -------------------------------------------------------------------------- */

function recordIsLive(rec: IdbRecord, schema?: number): boolean {
  if (rec.expiresAt && Date.now() > rec.expiresAt) return false
  if (schema !== undefined && rec.schema !== undefined && rec.schema !== schema)
    return false
  return true
}

async function largeGet<T>(
  ns: string,
  key: string,
  opts?: GetOptions,
): Promise<T | undefined> {
  const k = fqk(ns, key)
  let rec = await idbGet(k)
  if (!rec) {
    const mem = memoryMirror.get(k)
    if (mem) rec = mem
  }
  if (!rec) return undefined
  if (!recordIsLive(rec, opts?.schema)) {
    // Lazy reap of expired / wrong-schema entries.
    void idbDel(k)
    memoryMirror.delete(k)
    return undefined
  }
  // Touch for LRU (best-effort, fire-and-forget — don't block the read).
  rec.touchedAt = Date.now()
  void idbPut(rec).catch(() => undefined)
  return rec.v as T
}

/** Free space by evicting volatile entries first, then LRU. Returns the
 *  number of records removed. `keepFqk` is never evicted (it's the write
 *  we're trying to land). */
async function evict(keepFqk: string, targetCount: number): Promise<number> {
  const all = await idbAll()
  if (all.length === 0) return 0
  const candidates = all.filter((r) => r.fqk !== keepFqk)
  // Volatile-first, then oldest-touched-first.
  candidates.sort((a, b) => {
    const av = a.volatile ? 0 : 1
    const bv = b.volatile ? 0 : 1
    if (av !== bv) return av - bv
    return a.touchedAt - b.touchedAt
  })
  const victims = candidates.slice(0, Math.max(targetCount, 1)).map((r) => r.fqk)
  if (victims.length === 0) return 0
  console.warn(
    `[storage] quota pressure — evicting ${victims.length} entr${victims.length === 1 ? "y" : "ies"} (volatile/LRU):`,
    victims,
  )
  return idbDelMany(victims)
}

async function largeSet(
  ns: string,
  key: string,
  value: unknown,
  defaultVolatile: boolean,
  opts?: SetOptions,
): Promise<void> {
  const k = fqk(ns, key)
  const now = Date.now()
  const existing = await idbGet(k)
  const rec: IdbRecord = {
    fqk: k,
    v: value,
    size: estimateSize(value),
    createdAt: existing?.createdAt ?? now,
    touchedAt: now,
    expiresAt: opts?.ttlMs ? now + opts.ttlMs : undefined,
    schema: opts?.schema,
    volatile: opts?.volatile ?? defaultVolatile,
  }

  if (await idbPut(rec)) {
    memoryMirror.delete(k)
    return
  }

  // First write failed (most likely QuotaExceededError). Evict and retry once.
  await evict(k, 8)
  if (await idbPut(rec)) {
    memoryMirror.delete(k)
    return
  }

  // Still failing. Degrade to the in-memory mirror and keep going. The app
  // never sees a throw; we've logged loudly in idbPut + evict.
  console.error(
    `[storage] durable write for "${k}" failed after eviction; ` +
      `keeping value in memory for this session only.`,
  )
  memoryMirror.set(k, rec)
}

async function largeDel(ns: string, key: string): Promise<void> {
  const k = fqk(ns, key)
  memoryMirror.delete(k)
  await idbDel(k)
}

async function largeKeys(ns: string): Promise<string[]> {
  const prefix = `${ns}${SEP}`
  const idbK = await idbKeys(prefix)
  const memK = [...memoryMirror.keys()].filter((k) => k.startsWith(prefix))
  const all = new Set([...idbK, ...memK])
  return [...all].map((k) => k.slice(prefix.length))
}

/* -------------------------------------------------------------------------- */
/*  TINY tier (localStorage, guarded)                                         */
/* -------------------------------------------------------------------------- */

function lsKey(ns: string, key: string): string {
  return `${LS_PREFIX}${ns}${SEP}${key}`
}

function tinyGetRaw(ns: string, key: string): string | null {
  try {
    return localStorage.getItem(lsKey(ns, key))
  } catch (err) {
    console.error("[storage] localStorage.getItem failed:", err)
    return null
  }
}

/** Trim our own (corpan-store-prefixed) localStorage entries to free room.
 *  We only touch keys we own — never another app/pack's keys. */
function trimLocalStorage(keepKey: string): number {
  let removed = 0
  try {
    const ours: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith(LS_PREFIX) && k !== keepKey) ours.push(k)
    }
    // Remove up to a quarter of our keys (oldest-insertion-order-ish). This
    // is a last resort for the TINY tier, which should hold only small data.
    const toRemove = ours.slice(0, Math.max(1, Math.ceil(ours.length / 4)))
    for (const k of toRemove) {
      localStorage.removeItem(k)
      removed += 1
    }
    if (removed > 0) {
      console.warn(`[storage] tiny-tier quota pressure — trimmed ${removed} key(s)`)
    }
  } catch (err) {
    console.error("[storage] trimLocalStorage failed:", err)
  }
  return removed
}

function tinySetRaw(ns: string, key: string, raw: string): void {
  const k = lsKey(ns, key)
  try {
    localStorage.setItem(k, raw)
    return
  } catch (err) {
    // QuotaExceededError (or Safari private-mode pseudo-quota). Trim + retry.
    console.error("[storage] localStorage.setItem failed (will trim + retry):", err)
  }
  trimLocalStorage(k)
  try {
    localStorage.setItem(k, raw)
    return
  } catch (err2) {
    console.error(
      `[storage] tiny-tier write for "${k}" failed after trim; ` +
        `value kept in memory for this session only.`,
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
}

function tinyDelRaw(ns: string, key: string): void {
  const k = lsKey(ns, key)
  memoryMirror.delete(`ls:${k}`)
  try {
    localStorage.removeItem(k)
  } catch (err) {
    console.error("[storage] localStorage.removeItem failed:", err)
  }
}

function tinyGetMemFallback(ns: string, key: string): string | null {
  const mem = memoryMirror.get(`ls:${lsKey(ns, key)}`)
  return mem ? (mem.v as string) : null
}

/* -------------------------------------------------------------------------- */
/*  Namespace handle                                                          */
/* -------------------------------------------------------------------------- */

export type StorageNamespace = {
  readonly name: string
  readonly tier: StorageTier
  /** Raw string get. Large tier returns a string only if a string was set. */
  get(key: string, opts?: GetOptions): Promise<string | undefined>
  set(key: string, value: string, opts?: SetOptions): Promise<void>
  getJSON<T>(key: string, opts?: GetOptions): Promise<T | undefined>
  setJSON<T>(key: string, value: T, opts?: SetOptions): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
}

function makeNamespace(name: string, nsOpts?: NamespaceOptions): StorageNamespace {
  const tier: StorageTier = nsOpts?.tier ?? "large"
  // Large-tier namespaces default to volatile (they're caches); tiny-tier
  // defaults to durable. Per-namespace + per-set overrides win.
  const defaultVolatile = nsOpts?.volatile ?? (tier === "large")

  if (tier === "tiny") {
    return {
      name,
      tier,
      async get(key, opts) {
        const raw = tinyGetRaw(name, key) ?? tinyGetMemFallback(name, key)
        if (raw === null) return undefined
        // Schema check for tiny tier is done at the JSON layer; raw get
        // doesn't carry schema metadata.
        void opts
        return raw
      },
      async set(key, value, opts) {
        void opts
        tinySetRaw(name, key, value)
      },
      async getJSON<T>(key: string, opts?: GetOptions): Promise<T | undefined> {
        const raw = tinyGetRaw(name, key) ?? tinyGetMemFallback(name, key)
        if (raw === null) return undefined
        try {
          const parsed = JSON.parse(raw) as { __s?: number; v?: T }
          // We wrap tiny JSON values to carry schema + ttl metadata.
          if (parsed && typeof parsed === "object" && "v" in parsed) {
            if (
              opts?.schema !== undefined &&
              parsed.__s !== undefined &&
              parsed.__s !== opts.schema
            ) {
              return undefined
            }
            return parsed.v
          }
          // Bare value (not wrapped) — return as-is for forward compat.
          return parsed as unknown as T
        } catch (err) {
          console.error(`[storage] tiny getJSON parse failed for ${name}::${key}:`, err)
          return undefined
        }
      },
      async setJSON<T>(key: string, value: T, opts?: SetOptions): Promise<void> {
        try {
          const wrapped = JSON.stringify({ __s: opts?.schema, v: value })
          tinySetRaw(name, key, wrapped)
        } catch (err) {
          console.error(`[storage] tiny setJSON stringify failed for ${name}::${key}:`, err)
        }
      },
      async del(key) {
        tinyDelRaw(name, key)
      },
      async keys() {
        const out: string[] = []
        const prefix = lsKey(name, "")
        try {
          for (let i = 0; i < localStorage.length; i += 1) {
            const k = localStorage.key(i)
            if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length))
          }
        } catch (err) {
          console.error("[storage] tiny keys() failed:", err)
        }
        return out
      },
    }
  }

  // LARGE tier
  return {
    name,
    tier,
    async get(key, opts) {
      const v = await largeGet<unknown>(name, key, opts)
      if (v === undefined) return undefined
      return typeof v === "string" ? v : JSON.stringify(v)
    },
    async set(key, value, opts) {
      await largeSet(name, key, value, defaultVolatile, opts)
    },
    async getJSON<T>(key: string, opts?: GetOptions): Promise<T | undefined> {
      return largeGet<T>(name, key, opts)
    },
    async setJSON<T>(key: string, value: T, opts?: SetOptions): Promise<void> {
      await largeSet(name, key, value, defaultVolatile, opts)
    },
    async del(key) {
      await largeDel(name, key)
    },
    async keys() {
      return largeKeys(name)
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Public surface                                                            */
/* -------------------------------------------------------------------------- */

const namespaceCache = new Map<string, StorageNamespace>()

export const storage = {
  /** Get (memoized) a namespace handle. */
  namespace(name: string, opts?: NamespaceOptions): StorageNamespace {
    const cacheKey = `${name}|${opts?.tier ?? "large"}`
    const hit = namespaceCache.get(cacheKey)
    if (hit) return hit
    const ns = makeNamespace(name, opts)
    namespaceCache.set(cacheKey, ns)
    return ns
  },

  /** Manually free space (e.g. on a low-memory warning). Evicts volatile
   *  then LRU entries from the LARGE tier. */
  async evictLargeTier(count = 16): Promise<number> {
    return evict("", count)
  },
}

/* -------------------------------------------------------------------------- */
/*  localStorage-compatible async shim (eases zustand `persist` migration)    */
/* -------------------------------------------------------------------------- */

/** A `StateStorage`-shaped object (zustand's async storage interface) backed
 *  by a single storage namespace. Drop into `createJSONStorage(() => shim)`.
 *
 *  zustand's persist middleware tolerates async getItem/setItem/removeItem,
 *  so a LARGE-tier shim moves a heavy persisted store off localStorage with
 *  a one-line change at the store's call site. */
export function createLocalStorageShim(
  namespace: string,
  opts?: NamespaceOptions & { volatile?: boolean; ttlMs?: number },
): {
  getItem: (name: string) => Promise<string | null>
  setItem: (name: string, value: string) => Promise<void>
  removeItem: (name: string) => Promise<void>
} {
  const ns = storage.namespace(namespace, opts)
  return {
    async getItem(name) {
      const v = await ns.get(name)
      return v ?? null
    },
    async setItem(name, value) {
      // zustand hands us an already-serialized string; store it raw so we
      // don't double-encode. Quota-safety happens inside `set`.
      await ns.set(name, value, {
        volatile: opts?.volatile,
        ttlMs: opts?.ttlMs,
      })
    },
    async removeItem(name) {
      await ns.del(name)
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Doctor hook                                                               */
/* -------------------------------------------------------------------------- */

/** Number of kv/tiny records currently parked in the in-memory mirror
 *  (degraded-write fallbacks). Doctor/dev only. */
export function __memoryMirrorSize(): number {
  return memoryMirror.size
}

/* -------------------------------------------------------------------------- */
/*  Public surface — the typed adapter layer (storage-analytics.md §3.11)     */
/* -------------------------------------------------------------------------- */

export { kvStore, docKvStore, type KVStore } from "./kv"
export { docStore, type DocStore, type DocCodec } from "./doc"
export { appendLog, type AppendLog, type LogRecord } from "./log"
export { blobStore, blobServedUrl, type BlobStore, type BlobNsStats } from "./blob"
export { WriteBatcher, appBatcher } from "./batch"
export {
  NAMESPACES,
  resolveNsDecl,
  registerPackNamespace,
  type NsDecl,
  type NsKind,
} from "./namespaces"
export { storageDoctor, installStorageDoctorDebug, type StorageDoctorReport } from "./doctor"
export { healthCounters } from "./health"
export { estimateSize } from "./bytes"
export {
  createEnginePersistence,
  journeyCardsNs,
  journeyMetaNs,
  type EnginePersistence,
} from "./enginePersistence"
export { buildPackStorageApi, type PackStorageApi } from "./packStorageApi"
