// src/lib/offlineCache/types.ts — shared types for the D12 offline-first
// cache layer (docs/journey/specs/offline-cache.md §3).

import type { Validators } from "../../contentPacks/catalogFetch"

/** Why a revalidation pass is running — used for logging + jitter decisions. */
export type CacheTrigger = "startup" | "foreground" | "online" | "interval" | "pull"

export type JsonCachePolicy = {
  /** Freshness window. Within it, cachedFetch serves cache and does NOT hit
   *  the network (except force). */
  ttlMs: number
  /** Forwarded to fetchJsonFresh. Defaults: 12_000 / 3 (catalogFetch.ts:26-27). */
  timeoutMs?: number
  maxAttempts?: number
  /** Schema stamp for the persisted record — bump to invalidate old shapes
   *  (storage semantics: mismatch reads as miss, lib/storage/index.ts). */
  schema?: number
}

export type JsonResource<T> = {
  /** Stable cache key, e.g. "catalog-v3". Also the single-flight key. */
  key: string
  /** Resolved at call time so VITE_* env overrides keep working. */
  url: () => string
  /** Wire-format gatekeeper. null = malformed (soft-fail, keep cache). */
  parse: (raw: unknown) => T | null
  policy: JsonCachePolicy
}

export type CachedJson<T> = {
  data: T
  /** Epoch ms of the last successful network confirmation (200 or 304). */
  fetchedAt: number
  /** True when fetchedAt is outside policy.ttlMs (we're serving stale). */
  stale: boolean
  /** Where this call's data came from. */
  source: "network" | "cache"
}

export type CachedImageState = "resolving" | "cached" | "remote" | "fallback"

/** Persisted shape of one JSON cache record (LARGE tier, key = resource.key). */
export type StoredJsonRecord = {
  data: unknown
  validators: Validators
  fetchedAt: number
}

/** Persisted shape of one image-index row (key = sha256(url) hex). */
export type ImageIndexRecord = {
  /** Original remote URL (identity — immutable-by-URL). */
  url: string
  /** "img/<sha256>.<ext>" under .offline-cache/ */
  relPath: string
  /** Platform-correct corpan-pack URL from Rust. */
  servedUrl: string
  /** Bytes on disk. */
  size: number
  contentType: string
  cachedAt: number
  /** LRU clock, touched on every resolve. */
  lastUsedAt: number
}

/** Wire shape of the Rust offline_cache_put result (serde camelCase). */
export type OfflineCachePutResult = {
  relPath: string
  servedUrl: string
  size: number
  contentType: string
}

/** Wire shape of one Rust offline_cache_list entry (serde camelCase). */
export type OfflineCacheEntry = {
  relPath: string
  size: number
  modifiedMs: number
}

/** Offline-first cache seam exposed to packs (D12, wired by W10). Additive +
 *  optional on HostApi — packs feature-detect `hostApi.offlineCache`. */
export type HostOfflineCacheApi = {
  /** Resolve a display URL for a remote image: local cached copy when
   *  available, the remote URL when online-and-uncached (caching kicks off
   *  in the background), undefined when offline with no cached copy. */
  imageSrc: (url: string) => Promise<string | undefined>
  /** Cache-first JSON GET for pack-owned remote indexes. Keys are namespaced
   *  `pack:<packId>:<key>` by the host. Returns undefined on a true miss. */
  fetchJson: (url: string, opts?: { key?: string; ttlMs?: number }) => Promise<unknown>
}
