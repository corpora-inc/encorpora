// src/lib/storage/kv.ts — KVStore (storage-analytics.md §3.3).
//
// Interface parity for the existing StorageNamespace handle: zero new
// machinery, it exists so hostApi and the engine hand out an INTERFACE, not
// the storage service itself. `docKvStore` is the same interface over a
// DocStore namespace (IDB-DOC tier) for small keyed state like the engine's
// `journey-meta:<stack>:<course>` (§3.7).

import { storage, type NamespaceOptions } from "./index"
import { docStore, type DocStore } from "./doc"
import { WriteBatcher } from "./batch"

export interface KVStore {
  get(key: string): Promise<string | undefined>
  getJSON<T>(key: string): Promise<T | undefined>
  set(key: string, value: string): Promise<void>
  setJSON<T>(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
}

/** Adapter over the existing StorageNamespace — zero new machinery. */
export function kvStore(ns: string, opts?: NamespaceOptions): KVStore {
  const h = storage.namespace(ns, opts)
  return {
    get: (key) => h.get(key),
    getJSON: (key) => h.getJSON(key),
    set: (key, value) => h.set(key, value),
    setJSON: (key, value) => h.setJSON(key, value),
    del: (key) => h.del(key),
    keys: () => h.keys(),
  }
}

/** KVStore over the IDB-DOC tier (batched, validated presence-only codec).
 *  Values are stored as-is; `null` is not a storable value (reads as
 *  absent — the DocCodec contract reserves it for corruption). */
export function docKvStore(ns: string, batcher?: WriteBatcher): KVStore {
  const store: DocStore<unknown> = docStore<unknown>(
    ns,
    { schemaVersion: 1, parse: (raw) => (raw === undefined ? null : raw) },
    batcher,
  )
  return {
    async get(key) {
      const v = await store.get(key)
      if (v === undefined || v === null) return undefined
      return typeof v === "string" ? v : JSON.stringify(v)
    },
    async getJSON<T>(key: string): Promise<T | undefined> {
      const v = await store.get(key)
      return v === undefined || v === null ? undefined : (v as T)
    },
    set: (key, value) => store.put(key, value),
    setJSON: (key, value) => store.put(key, value),
    del: (key) => store.delete(key),
    keys: async () => [...(await store.getAll()).keys()],
  }
}
