// src/lib/offlineCache/native.ts — invoke() wrappers for the offline_cache_*
// Tauri commands (src-tauri/src/offline_cache/). Mirrors the style of
// contentPacks/native.ts, but imports @tauri-apps/api/core dynamically (like
// lib/storage/blob.ts) so this module loads under the node test runner and
// in the plain-browser dev shell, where the Tauri API doesn't exist.

import type { OfflineCacheEntry, OfflineCachePutResult } from "./types.ts"

async function tauriInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<T>(cmd, args)
}

/** Download `url` into the on-device image cache (Rust reqwest — no CORS).
 *  Idempotent per URL; enforces the size ceiling; atomic tmp+rename. */
export async function offlineCachePut(
  url: string,
  maxBytes?: number,
): Promise<OfflineCachePutResult> {
  return tauriInvoke<OfflineCachePutResult>("offline_cache_put", {
    url,
    maxBytes: maxBytes ?? null,
  })
}

/** Delete cached files by rel path (LRU eviction / repair / orphan sweep).
 *  Missing files are not errors. Returns the number actually removed. */
export async function offlineCacheDelete(relPaths: string[]): Promise<number> {
  return tauriInvoke<number>("offline_cache_delete", { relPaths })
}

/** List committed cache files (orphan sweeps / budget audits). */
export async function offlineCacheList(): Promise<OfflineCacheEntry[]> {
  return tauriInvoke<OfflineCacheEntry[]>("offline_cache_list", {})
}
