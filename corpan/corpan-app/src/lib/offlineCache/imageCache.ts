// src/lib/offlineCache/imageCache.ts — the image half of the D12 offline
// cache (docs/journey/specs/offline-cache.md §3): immutable-by-URL fs blobs
// under corpan-packs/.offline-cache/img/, downloaded by Rust (no CORS, no
// IPC byte copies), served to <img src> by the existing corpan-pack://
// protocol, LRU-evicted against a byte budget. The index lives in the D13
// LARGE tier; an in-memory mirror gives React a synchronous fast path so
// warm lookups never flash.
//
// Contract: NOTHING here ever throws to a caller. Every failure degrades to
// "no cached copy" and the remote-URL / glyph-fallback path takes over.

import { singleflight } from "./singleflight.ts"
import type {
  CachedImageState,
  ImageIndexRecord,
  OfflineCacheEntry,
  OfflineCachePutResult,
} from "./types.ts"

export const IMAGE_CACHE_NS = "offline-cache-img"
export const IMAGE_CACHE_BUDGET_BYTES = 64 * 1024 * 1024
export const IMAGE_CACHE_MAX_ENTRIES = 512
/** Opportunistic orphan-sweep cadence (index rows vs files on disk). */
export const ORPHAN_SWEEP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

const SWEEP_META_KEY = "__meta:lastOrphanSweepAt"

/* ----------------------------- injectable deps ---------------------------- */

type IndexLike = {
  getJSON<T>(key: string): Promise<T | undefined>
  setJSON<T>(key: string, value: T, opts?: { volatile?: boolean }): Promise<void>
  del(key: string): Promise<void>
  keys(): Promise<string[]>
}

type ImageCacheDeps = {
  isTauri: () => boolean
  isOnline: () => boolean
  now: () => number
  nativePut: (url: string, maxBytes?: number) => Promise<OfflineCachePutResult>
  nativeDelete: (relPaths: string[]) => Promise<number>
  nativeList: () => Promise<OfflineCacheEntry[]>
  index: () => Promise<IndexLike>
}

let defaultIndex: IndexLike | undefined
const defaultDeps: ImageCacheDeps = {
  isTauri: () => {
    try {
      return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    } catch {
      return false
    }
  },
  isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
  now: () => Date.now(),
  nativePut: async (url, maxBytes) => {
    const { offlineCachePut } = await import("./native.ts")
    return offlineCachePut(url, maxBytes)
  },
  nativeDelete: async (relPaths) => {
    const { offlineCacheDelete } = await import("./native.ts")
    return offlineCacheDelete(relPaths)
  },
  nativeList: async () => {
    const { offlineCacheList } = await import("./native.ts")
    return offlineCacheList()
  },
  // Dynamic import: lib/storage touches browser-global machinery the node
  // test runner doesn't have; tests inject a fake index before this runs.
  // volatile:false — eviction is governed by OUR byte budget; letting the
  // generic KV LRU drop index rows would strand bytes on disk.
  index: async () => {
    if (!defaultIndex) {
      const { storage } = await import("../storage/index.ts")
      defaultIndex = storage.namespace(IMAGE_CACHE_NS, { tier: "large", volatile: false })
    }
    return defaultIndex
  },
}

let deps: ImageCacheDeps = { ...defaultDeps }

export function __setImageCacheDepsForTests(overrides: Partial<ImageCacheDeps>): void {
  deps = { ...defaultDeps, ...overrides }
}

/** Reset session state (mirror + hydration). Persisted index survives —
 *  exactly what a cold app start sees. Bumping the epoch invalidates any
 *  still-airborne background work from the previous "session" so it can't
 *  write into the new one (matters only under the test harness — the real
 *  app never resets). */
export function __resetImageCacheForTests(): void {
  deps = { ...defaultDeps }
  epoch += 1
  mirror.clear()
  hydrated = false
  hydrating = undefined
}

/** Session epoch — background closures compare against it after every await
 *  and quietly abandon their work when a reset happened mid-flight. */
let epoch = 0

/* ------------------------------ hashing helper ---------------------------- */

/** sha256 hex of a URL — the index key (same helper style as install.ts). */
export async function hashUrl(url: string): Promise<string> {
  const bytes = new TextEncoder().encode(url)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
}

/* ------------------------------ index + mirror ---------------------------- */

/** In-memory mirror of the persisted index, keyed by URL. Hydrated once per
 *  session so `peekCachedImage` is synchronous (no flash on warm renders). */
const mirror = new Map<string, ImageIndexRecord>()
let hydrated = false
let hydrating: Promise<void> | undefined

function isIndexRecord(v: unknown): v is ImageIndexRecord {
  if (!v || typeof v !== "object") return false
  const r = v as Record<string, unknown>
  return (
    typeof r.url === "string" &&
    typeof r.relPath === "string" &&
    typeof r.servedUrl === "string" &&
    typeof r.size === "number"
  )
}

/** Load every index row into the mirror. Idempotent; coalesced. */
export function hydrateImageIndex(): Promise<void> {
  if (hydrated) return Promise.resolve()
  if (hydrating) return hydrating
  const myEpoch = epoch
  hydrating = (async () => {
    try {
      const index = await deps.index()
      const keys = await index.keys()
      for (const key of keys) {
        if (epoch !== myEpoch) return // session reset mid-hydration
        if (key.startsWith("__meta:")) continue
        const rec = await index.getJSON<ImageIndexRecord>(key)
        if (isIndexRecord(rec) && epoch === myEpoch) mirror.set(rec.url, rec)
      }
    } catch (err) {
      console.error("[offlineCache/img] index hydration failed:", err)
    } finally {
      if (epoch === myEpoch) {
        hydrated = true
        hydrating = undefined
      }
    }
  })()
  return hydrating
}

/** Synchronous mirror lookup (React fast path). undefined until hydrated. */
export function peekCachedImage(url: string): ImageIndexRecord | undefined {
  return mirror.get(url)
}

export function isImageIndexHydrated(): boolean {
  return hydrated
}

async function writeRecord(record: ImageIndexRecord): Promise<void> {
  const myEpoch = epoch
  mirror.set(record.url, record)
  try {
    const key = await hashUrl(record.url)
    const index = await deps.index()
    if (epoch !== myEpoch) return // session reset mid-write: don't persist
    await index.setJSON(key, record, { volatile: false })
  } catch (err) {
    console.error(`[offlineCache/img] index write failed for ${record.url}:`, err)
  }
}

async function dropRecord(url: string): Promise<void> {
  const myEpoch = epoch
  mirror.delete(url)
  try {
    const key = await hashUrl(url)
    const index = await deps.index()
    if (epoch !== myEpoch) return // session reset mid-delete
    await index.del(key)
  } catch (err) {
    console.error(`[offlineCache/img] index delete failed for ${url}:`, err)
  }
}

/* --------------------------------- caching -------------------------------- */

function isRemoteHttpUrl(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://")
}

/** Kick (or join) the background native download for a URL. Resolves to the
 *  new record, or undefined on failure. Never throws. */
function ensureCached(url: string): Promise<ImageIndexRecord | undefined> {
  const myEpoch = epoch
  return singleflight(`img:${url}`, async () => {
    const existing = mirror.get(url)
    if (existing) return existing
    try {
      const put = await deps.nativePut(url)
      if (epoch !== myEpoch) return undefined // session reset mid-download
      const now = deps.now()
      const record: ImageIndexRecord = {
        url,
        relPath: put.relPath,
        servedUrl: put.servedUrl,
        size: put.size,
        contentType: put.contentType,
        cachedAt: now,
        lastUsedAt: now,
      }
      await writeRecord(record)
      void enforceImageBudget().catch(() => undefined)
      return record
    } catch (err) {
      console.warn(`[offlineCache/img] cache fill failed for ${url}:`, err)
      return undefined
    }
  })
}

/**
 * Resolve a display URL for a remote image, cache-first (offline-cache.md §3):
 *  - Non-http(s) src (bundled import, data:, blob:, corpan-pack:) → as-is.
 *  - Cache hit → local corpan-pack URL, LRU touch.
 *  - Miss + online → kicks a background native download (single-flight per
 *    URL) and resolves to the REMOTE url now.
 *  - Miss + offline → undefined (caller shows its glyph fallback).
 * Never throws.
 */
export async function cachedImageSrc(url: string): Promise<string | undefined> {
  try {
    if (!isRemoteHttpUrl(url)) return url
    if (!deps.isTauri()) return url // dev browser: plain remote passthrough
    await hydrateImageIndex()

    const hit = mirror.get(url)
    if (hit) {
      // Touch the LRU clock (fire-and-forget persistence).
      hit.lastUsedAt = deps.now()
      void writeRecord(hit)
      return hit.servedUrl
    }

    if (!deps.isOnline()) return undefined

    // Background fill; serve the remote URL for THIS render (the WebView can
    // load it — we're online). Next render hits the cache.
    void ensureCached(url)
    return url
  } catch (err) {
    console.error(`[offlineCache/img] resolve failed for ${url}:`, err)
    return deps.isOnline() ? url : undefined
  }
}

/** Pre-warm covers for a catalog (call after each successful catalog
 *  revalidation with the visible entries' imageUrls). Serialized, low
 *  priority, skipped offline / outside Tauri. Never throws. */
export function prefetchImages(urls: string[]): void {
  if (!deps.isTauri() || !deps.isOnline()) return
  const myEpoch = epoch
  void (async () => {
    await hydrateImageIndex()
    for (const url of urls) {
      if (epoch !== myEpoch) return // session reset mid-batch
      if (!url || !isRemoteHttpUrl(url) || mirror.has(url)) continue
      if (!deps.isOnline()) return // connectivity lost mid-batch: stop quietly
      await ensureCached(url) // serialized on purpose — low priority
    }
  })().catch((err) => console.warn("[offlineCache/img] prefetch failed:", err))
}

/** Remove a broken index row (file missing on disk) and, when online,
 *  re-fetch in the background. Called from <OfflineImage> onError. */
export async function repairImage(url: string): Promise<void> {
  if (!isRemoteHttpUrl(url)) return
  const record = mirror.get(url)
  await dropRecord(url)
  if (record) {
    try {
      await deps.nativeDelete([record.relPath])
    } catch {
      // Missing files are expected here (that's why we're repairing).
    }
  }
  if (deps.isTauri() && deps.isOnline()) void ensureCached(url)
}

/* ------------------------------ budget + sweep ----------------------------- */

/** Drop least-recently-used entries until the cache fits the byte budget and
 *  entry ceiling; opportunistically reconcile index-vs-disk drift (orphans).
 *  Volatile-safe to call anytime; never throws. */
export async function enforceImageBudget(): Promise<void> {
  if (!deps.isTauri()) return
  const myEpoch = epoch
  try {
    await hydrateImageIndex()
    if (epoch !== myEpoch) return // session reset mid-flight
    const records = [...mirror.values()]
    const totalBytes = records.reduce((sum, r) => sum + r.size, 0)

    if (totalBytes > IMAGE_CACHE_BUDGET_BYTES || records.length > IMAGE_CACHE_MAX_ENTRIES) {
      // Oldest-used first until BOTH constraints hold.
      const byLru = [...records].sort((a, b) => a.lastUsedAt - b.lastUsedAt)
      const victims: ImageIndexRecord[] = []
      let bytes = totalBytes
      let count = records.length
      for (const record of byLru) {
        if (bytes <= IMAGE_CACHE_BUDGET_BYTES && count <= IMAGE_CACHE_MAX_ENTRIES) break
        victims.push(record)
        bytes -= record.size
        count -= 1
      }
      if (victims.length > 0) {
        console.warn(
          `[offlineCache/img] budget pressure — evicting ${victims.length} image(s) (LRU)`,
        )
        await deps.nativeDelete(victims.map((v) => v.relPath))
        for (const victim of victims) await dropRecord(victim.url)
      }
    }

    if (epoch !== myEpoch) return
    await maybeSweepOrphans(myEpoch)
  } catch (err) {
    console.error("[offlineCache/img] budget enforcement failed:", err)
  }
}

/** Files on disk with no index row (index evicted/corrupted) are reclaimed
 *  on a slow cadence. */
async function maybeSweepOrphans(myEpoch: number): Promise<void> {
  const index = await deps.index()
  const last = await index.getJSON<number>(SWEEP_META_KEY)
  const now = deps.now()
  if (typeof last === "number" && now - last < ORPHAN_SWEEP_INTERVAL_MS) return
  if (epoch !== myEpoch) return // session reset mid-flight
  await index.setJSON(SWEEP_META_KEY, now, { volatile: false })

  const onDisk = await deps.nativeList()
  const indexed = new Set([...mirror.values()].map((r) => r.relPath))
  const orphans = onDisk.filter((e) => !indexed.has(e.relPath)).map((e) => e.relPath)
  if (orphans.length > 0) {
    console.warn(`[offlineCache/img] sweeping ${orphans.length} orphaned cache file(s)`)
    await deps.nativeDelete(orphans)
  }
}

/* --------------------------- display resolution ---------------------------- */

export type ImageDisplay = { src?: string; state: CachedImageState }

/** Synchronous first-render answer for a URL (React fast path):
 *  bundled/data/blob URLs render immediately; a warm mirror hit renders the
 *  local copy immediately; anything else starts at "resolving". */
export function peekImageDisplay(url?: string): ImageDisplay {
  if (!url) return { state: "fallback" }
  if (!isRemoteHttpUrl(url)) return { src: url, state: "cached" }
  const hit = hydrated ? mirror.get(url) : undefined
  if (hit) return { src: hit.servedUrl, state: "cached" }
  return { state: "resolving" }
}

/** Full async resolution per the §4 state machine. Never rejects. */
export async function resolveImageDisplay(url?: string): Promise<ImageDisplay> {
  if (!url) return { state: "fallback" }
  if (!isRemoteHttpUrl(url)) return { src: url, state: "cached" }
  const resolved = await cachedImageSrc(url)
  if (resolved === undefined) return { state: "fallback" }
  if (resolved === url) return { src: url, state: "remote" }
  return { src: resolved, state: "cached" }
}
