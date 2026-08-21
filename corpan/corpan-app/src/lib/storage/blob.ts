// src/lib/storage/blob.ts — BlobStore, the FS-BLOB tier (storage-analytics.md
// §3.6, absorbing the offline-cache substrate ruling).
//
// Under Tauri, bytes live on disk via the Rust `blob_store_*` commands at
// `app_data_dir/corpan-packs/.offline-cache/blob/<ns>/<hex(sha256(key))>`
// (+ `<hash>.meta.json` sidecars). That path is deliberately inside the
// corpan-packs root so every stored blob is SERVABLE to <img>/<audio> via the
// existing `corpan-pack://` protocol with zero protocol changes — the D12
// offline-image cache (specs/offline-cache.md) builds on this substrate.
// `.offline-cache` can never collide with a pack id (validate_pack_id rejects
// it as a reserved dir).
//
// Off Tauri (web dev, tests) the same interface degrades to an IDB-KV-backed
// fallback (volatile kv records holding the bytes) so packs and dev builds
// keep working. Selection is feature-detected once at first use.
//
// Contract: NEVER throws. On disk-full, put() prunes LRU within the ns budget
// and retries once; still-failing writes are logged + dropped (the caller's
// cache-miss path handles absence).

import { storage } from "./index"
import { resolveNsDecl, BLOB_STORE_TOTAL_BYTES } from "./namespaces"

export interface BlobStore {
  readonly ns: string
  get(key: string): Promise<Uint8Array | undefined>
  /** Never throws. On disk-full: prunes LRU within the ns budget, retries once. */
  put(key: string, bytes: Uint8Array, opts?: { ttlMs?: number }): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
  stats(): Promise<{ files: number; bytes: number }>
  clear(): Promise<void>
}

export type BlobNsStats = { ns: string; files: number; bytes: number }

function isTauriRuntime(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  } catch {
    return false
  }
}

function nsBudgetBytes(ns: string): number {
  return resolveNsDecl(ns)?.budget?.maxBytes ?? BLOB_STORE_TOTAL_BYTES
}

/* ------------------------------ Tauri (fs) ------------------------------- */

async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<T>(cmd, args)
}

function tauriFsBlobStore(ns: string): BlobStore {
  return {
    ns,
    async get(key) {
      try {
        const bytes = await tauriInvoke<number[] | null>("blob_store_read", { ns, key })
        return bytes ? new Uint8Array(bytes) : undefined
      } catch (err) {
        console.error(`[storage/blob] read failed for ${ns}/${key}:`, err)
        return undefined
      }
    },
    async put(key, bytes, opts) {
      const args = { ns, key, bytes: Array.from(bytes), ttlMs: opts?.ttlMs ?? null }
      try {
        await tauriInvoke("blob_store_write", args)
        return
      } catch (err) {
        console.error(`[storage/blob] write failed for ${ns}/${key} (will prune + retry):`, err)
      }
      try {
        await tauriInvoke("blob_store_prune", { ns, maxBytes: nsBudgetBytes(ns) })
        await tauriInvoke("blob_store_write", args)
      } catch (err2) {
        console.error(
          `[storage/blob] write for ${ns}/${key} failed after prune — dropping value.`,
          err2,
        )
      }
    },
    async delete(key) {
      try {
        await tauriInvoke("blob_store_delete", { ns, key })
      } catch (err) {
        console.error(`[storage/blob] delete failed for ${ns}/${key}:`, err)
      }
    },
    async has(key) {
      try {
        return await tauriInvoke<boolean>("blob_store_has", { ns, key })
      } catch (err) {
        console.error(`[storage/blob] has failed for ${ns}/${key}:`, err)
        return false
      }
    },
    async stats() {
      try {
        const all = await tauriInvoke<BlobNsStats[]>("blob_store_stats", { ns })
        const mine = all.find((s) => s.ns === ns)
        return { files: mine?.files ?? 0, bytes: mine?.bytes ?? 0 }
      } catch (err) {
        console.error(`[storage/blob] stats failed for ${ns}:`, err)
        return { files: 0, bytes: 0 }
      }
    },
    async clear() {
      try {
        await tauriInvoke("blob_store_prune", { ns, maxBytes: 0 })
      } catch (err) {
        console.error(`[storage/blob] clear failed for ${ns}:`, err)
      }
    },
  }
}

/** All blob namespaces on disk — doctor's fs panel. [] off Tauri. */
export async function blobFsStats(): Promise<BlobNsStats[]> {
  if (!isTauriRuntime()) return []
  try {
    return await tauriInvoke<BlobNsStats[]>("blob_store_stats", { ns: null })
  } catch (err) {
    console.error("[storage/blob] fs stats failed:", err)
    return []
  }
}

/** Platform-correct `corpan-pack://` URL for a stored blob, or undefined when
 *  the blob doesn't exist / not under Tauri. This is the substrate seam the
 *  D12 offline-image cache renders <img src> from. */
export async function blobServedUrl(ns: string, key: string): Promise<string | undefined> {
  if (!isTauriRuntime()) return undefined
  try {
    const url = await tauriInvoke<string | null>("blob_store_served_url", { ns, key })
    return url ?? undefined
  } catch (err) {
    console.error(`[storage/blob] servedUrl failed for ${ns}/${key}:`, err)
    return undefined
  }
}

/* ------------------------- IDB-KV fallback (web) ------------------------- */

function idbBlobStore(ns: string): BlobStore {
  // Bytes ≤ ~1MB that must work in web-dev: volatile kv records hold the
  // byte arrays (structured-clonable), sharing the LARGE-tier eviction.
  const h = storage.namespace(`blob:${ns}`, { tier: "large", volatile: true })
  return {
    ns,
    async get(key) {
      const arr = await h.getJSON<number[]>(key)
      return Array.isArray(arr) ? new Uint8Array(arr) : undefined
    },
    async put(key, bytes, opts) {
      await h.setJSON(key, Array.from(bytes), { ttlMs: opts?.ttlMs })
    },
    async delete(key) {
      await h.del(key)
    },
    async has(key) {
      return (await h.getJSON<number[]>(key)) !== undefined
    },
    async stats() {
      const keys = await h.keys()
      let bytes = 0
      for (const k of keys) {
        const arr = await h.getJSON<number[]>(k)
        if (Array.isArray(arr)) bytes += arr.length
      }
      return { files: keys.length, bytes }
    },
    async clear() {
      for (const k of await h.keys()) await h.del(k)
    },
  }
}

/* -------------------------------- factory -------------------------------- */

const blobStoreCache = new Map<string, BlobStore>()

/** Get (memoized) a blob namespace. Tauri → Rust fs commands; otherwise the
 *  IDB-KV fallback. Selected once per namespace by feature detection. */
export function blobStore(ns: string): BlobStore {
  const hit = blobStoreCache.get(ns)
  if (hit) return hit
  const store = isTauriRuntime() ? tauriFsBlobStore(ns) : idbBlobStore(ns)
  blobStoreCache.set(ns, store)
  return store
}
