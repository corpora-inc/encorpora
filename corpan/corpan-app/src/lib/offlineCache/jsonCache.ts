// src/lib/offlineCache/jsonCache.ts — the JSON half of the D12 offline-first
// cache (docs/journey/specs/offline-cache.md §3). One philosophy for every
// catalog/index/config read: cache-first render, policy-driven background
// revalidate, and a network failure NEVER clobbers the last-good record.
//
// The network layer is the proven contentPacks/catalogFetch.fetchJsonFresh
// (timeout + abort, conditional GET, bounded jittered retry) — reused as-is,
// not rewritten. Persistence is the W1 storage service (LARGE tier,
// volatile). Concurrency is the shared single-flight map.

import {
  backoffDelayMs,
  fetchJsonFresh as realFetchJsonFresh,
  jitter,
  type FreshnessResult,
  type Validators,
} from "../../contentPacks/catalogFetch.ts"
import { singleflight } from "./singleflight.ts"
import type { CachedJson, CacheTrigger, JsonResource, StoredJsonRecord } from "./types.ts"

export const JSON_CACHE_NS = "offline-cache-json"

/* ----------------------------- injectable deps ---------------------------- */
// Tiny seams so node tests drive the cache without IndexedDB or sockets.

export type KVLike = {
  getJSON<T>(key: string, opts?: { schema?: number }): Promise<T | undefined>
  setJSON<T>(key: string, value: T, opts?: { schema?: number; volatile?: boolean }): Promise<void>
  del(key: string): Promise<void>
}

type FetchJsonFreshFn = <T>(
  url: string,
  opts: {
    parse: (raw: unknown) => T | null
    validators?: Validators
    timeoutMs?: number
    maxAttempts?: number
  },
) => Promise<FreshnessResult<T>>

type JsonCacheDeps = {
  fetchJsonFresh: FetchJsonFreshFn
  ns: () => Promise<KVLike>
  now: () => number
  isOnline: () => boolean
  /** Per-resource stagger for revalidateAll (fleet kindness). */
  staggerMs: () => number
  /** Cooldown (ms) before another revalidation is allowed after `failures`
   *  consecutive failures. Full-jitter exponential with a cap — see
   *  `JSON_REVALIDATE_BACKOFF_*`. Injected in tests for a deterministic
   *  schedule. */
  backoffMs: (failures: number) => number
}

/** Failure-cooldown base/cap for catalog revalidation. WHY: `revalidate` has
 *  no memory of consecutive failures, so a persistently-failing catalog paired
 *  with frequent triggers (interval + foreground + a flapping `online` event
 *  storm) re-enters a fresh `fetchJsonFresh` burst on every signal — each burst
 *  is up to 3 attempts at ~500 ms backoff, i.e. the ~2 requests/second hammering
 *  observed in the field. The cooldown bounds the NEXT burst to an
 *  exponentially-growing, jittered, capped window; a success resets it. Cache
 *  semantics are untouched — a cooldown skip serves cache exactly like a failed
 *  revalidation (the record is never clobbered). */
export const JSON_REVALIDATE_BACKOFF_BASE_MS = 2_000
export const JSON_REVALIDATE_BACKOFF_CAP_MS = 300_000

/** Per-key consecutive-failure cooldown state. Reset on any HTTP response
 *  (200/304 both prove the origin is reachable). */
type BackoffState = { failures: number; nextAttemptAt: number }
const backoff = new Map<string, BackoffState>()

let defaultNs: KVLike | undefined
const defaultDeps: JsonCacheDeps = {
  fetchJsonFresh: realFetchJsonFresh,
  // Dynamic import: lib/storage touches browser-global machinery the node
  // test runner doesn't have; tests inject a fake ns before this ever runs.
  ns: async () => {
    if (!defaultNs) {
      const { storage } = await import("../storage/index.ts")
      defaultNs = storage.namespace(JSON_CACHE_NS, { tier: "large" })
    }
    return defaultNs
  },
  now: () => Date.now(),
  isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
  staggerMs: () => jitter(600, 0.8),
  backoffMs: (failures) =>
    // Reuse the proven full-jitter backoff; `failures` is 1-based here.
    backoffDelayMs(
      failures - 1,
      JSON_REVALIDATE_BACKOFF_BASE_MS,
      JSON_REVALIDATE_BACKOFF_CAP_MS,
    ),
}

let deps: JsonCacheDeps = { ...defaultDeps }

export function __setJsonCacheDepsForTests(overrides: Partial<JsonCacheDeps>): void {
  deps = { ...defaultDeps, ...overrides }
}

export function __resetJsonCacheForTests(): void {
  deps = { ...defaultDeps }
  subscribers.clear()
  registry.clear()
  backoff.clear()
}

/* ------------------------------- subscribers ------------------------------ */

type Subscriber = (value: CachedJson<unknown>) => void
const subscribers = new Map<string, Set<Subscriber>>()

/** Subscribe to updates for a key (background revalidations land here).
 *  Returns an unsubscribe fn. */
export function subscribeJson<T>(key: string, cb: (value: CachedJson<T>) => void): () => void {
  let set = subscribers.get(key)
  if (!set) {
    set = new Set()
    subscribers.set(key, set)
  }
  set.add(cb as Subscriber)
  return () => {
    set.delete(cb as Subscriber)
    if (set.size === 0) subscribers.delete(key)
  }
}

function notify(key: string, value: CachedJson<unknown>): void {
  const set = subscribers.get(key)
  if (!set) return
  for (const cb of [...set]) {
    try {
      cb(value)
    } catch (err) {
      console.error(`[offlineCache] subscriber for "${key}" threw:`, err)
    }
  }
}

/* --------------------------------- registry ------------------------------- */

const registry = new Map<string, JsonResource<unknown>>()

/** Register a resource for trigger-driven revalidation (revalidateAll). */
export function registerResource(resource: JsonResource<unknown>): void {
  registry.set(resource.key, resource)
}

/* ---------------------------------- core ---------------------------------- */

function isFresh(record: StoredJsonRecord, ttlMs: number, now: number): boolean {
  return now - record.fetchedAt < ttlMs
}

async function loadRecord<T>(resource: JsonResource<T>): Promise<
  { record: StoredJsonRecord; data: T } | undefined
> {
  const ns = await deps.ns()
  const record = await ns.getJSON<StoredJsonRecord>(resource.key, {
    schema: resource.policy.schema,
  })
  if (!record || typeof record !== "object" || typeof record.fetchedAt !== "number") {
    return undefined
  }
  // Corruption guard: a persisted record that no longer parses is deleted
  // and treated as a miss — stale-shaped data never reaches the app.
  const data = resource.parse(record.data)
  if (data == null) {
    console.warn(`[offlineCache] purging unparseable record "${resource.key}"`)
    await ns.del(resource.key)
    return undefined
  }
  return { record, data }
}

async function persistRecord(
  resource: JsonResource<unknown>,
  record: StoredJsonRecord,
): Promise<void> {
  const ns = await deps.ns()
  await ns.setJSON(resource.key, record, {
    schema: resource.policy.schema,
    volatile: true,
  })
}

/** One network revalidation for a resource. Coalesced per key. Resolves to
 *  the updated CachedJson on success (200 or 304), undefined on failure —
 *  the persisted record is NEVER removed on failure. */
async function revalidate<T>(
  resource: JsonResource<T>,
  existing: { record: StoredJsonRecord; data: T } | undefined,
  opts: { force?: boolean },
): Promise<CachedJson<T> | undefined> {
  // Failure cooldown: after consecutive failures, skip the network until the
  // backoff window elapses (an explicit `force` — user pull — always tries).
  // This is what bounds the retry rate: without it, every trigger re-enters a
  // fresh fetch burst on a persistently-failing catalog. A skip serves cache
  // exactly like a failed revalidation would, so cache semantics are preserved.
  const state = backoff.get(resource.key)
  if (!opts.force && state && deps.now() < state.nextAttemptAt) {
    return undefined
  }
  return singleflight(`json:${resource.key}`, async () => {
    // Conditional validators only when we hold a body to 304 against; a
    // forced refresh always re-fetches the full body. Also withheld when the
    // resource's origin is known not to answer CORS preflight (see
    // `skipConditionalGet` in types.ts) — sending them there just buys a
    // guaranteed-to-fail OPTIONS round trip before the plain-GET retry.
    const validators =
      !opts.force && existing && !resource.policy.skipConditionalGet
        ? existing.record.validators
        : undefined
    try {
      const result = await deps.fetchJsonFresh<T>(resource.url(), {
        parse: resource.parse,
        validators,
        timeoutMs: resource.policy.timeoutMs,
        maxAttempts: resource.policy.maxAttempts,
      })
      // A FreshnessResult (200 or 304) means the origin answered — clear any
      // consecutive-failure cooldown so we return to normal cadence.
      backoff.delete(resource.key)
      const now = deps.now()
      if (result.status === "unchanged") {
        if (!existing) return undefined // stray 304 against no cache: treat as failure
        const record: StoredJsonRecord = { ...existing.record, fetchedAt: now }
        await persistRecord(resource, record)
        // Data unchanged — subscribers are not notified (no churn).
        return { data: existing.data, fetchedAt: now, stale: false, source: "network" }
      }
      const record: StoredJsonRecord = {
        data: result.data as unknown,
        validators: result.validators,
        fetchedAt: now,
      }
      await persistRecord(resource, record)
      const value: CachedJson<T> = {
        data: result.data,
        fetchedAt: now,
        stale: false,
        source: "network",
      }
      notify(resource.key, value as CachedJson<unknown>)
      return value
    } catch (err) {
      // A throw means KEEP THE CACHE (catalogFetch contract). Loud log,
      // silent UI (offline-cache.md §7.3). Record the failure so the next
      // revalidation is held off by an exponentially-growing, capped, jittered
      // cooldown — this is the backoff that stops the ~2×/s retry storm.
      const failures = (backoff.get(resource.key)?.failures ?? 0) + 1
      backoff.set(resource.key, {
        failures,
        nextAttemptAt: deps.now() + deps.backoffMs(failures),
      })
      console.warn(`[offlineCache] revalidation failed for "${resource.key}":`, err)
      return undefined
    }
  })
}

/**
 * Cache-first JSON read (offline-cache.md §3). Resolution order:
 *   1. Load the persisted record for `resource.key` (LARGE tier).
 *   2. Fresh (within ttlMs) and !force → return it, no network.
 *   3. Stale/missing + offline → return the stale record (undefined on a
 *      true miss).
 *   4. Stale/missing + online → if a record exists and opts.background !==
 *      false, RETURN THE STALE RECORD IMMEDIATELY and revalidate in the
 *      background (subscribers notified on change). On a true miss, await
 *      the network.
 * Network errors NEVER remove the persisted record. Concurrent calls for
 * one key coalesce onto a single in-flight promise.
 */
export async function cachedFetch<T>(
  resource: JsonResource<T>,
  opts?: { force?: boolean; background?: boolean },
): Promise<CachedJson<T> | undefined> {
  const existing = await loadRecord(resource)
  const now = deps.now()

  if (existing && !opts?.force && isFresh(existing.record, resource.policy.ttlMs, now)) {
    return {
      data: existing.data,
      fetchedAt: existing.record.fetchedAt,
      stale: false,
      source: "cache",
    }
  }

  const staleValue: CachedJson<T> | undefined = existing
    ? {
        data: existing.data,
        fetchedAt: existing.record.fetchedAt,
        stale: true,
        source: "cache",
      }
    : undefined

  if (!deps.isOnline()) return staleValue

  if (staleValue && opts?.background !== false && !opts?.force) {
    // Stale-while-revalidate: serve now, refresh quietly.
    void revalidate(resource, existing, { force: false })
    return staleValue
  }

  // True miss (or explicit force / foreground request): await the network,
  // fall back to whatever we had on failure.
  const fresh = await revalidate(resource, existing, { force: opts?.force ?? false })
  return fresh ?? staleValue
}

/**
 * Seed the persisted record for `resource.key` from a LEGACY per-store
 * persistence (offline-cache.md §6 phase 2: the zustand `migrate` hooks call
 * this on version bump so no device cold-refetches after upgrade).
 *
 *  - Parse-gated: an unparseable legacy body is refused (returns false) —
 *    stale-shaped data never enters the cache.
 *  - Never overwrites an existing record: once the cache layer owns a key,
 *    it is the source of truth (also makes a re-run migrate idempotent).
 *  - Notifies subscribers on success, so a store whose first cachedFetch
 *    raced ahead of the (async) migrate still receives the seeded value.
 *
 * Returns true when the record was written.
 */
export async function seedJsonRecord<T>(
  resource: JsonResource<T>,
  seed: { data: unknown; validators?: Validators; fetchedAt?: number | null },
): Promise<boolean> {
  const data = resource.parse(seed.data)
  if (data == null) return false
  const ns = await deps.ns()
  const existing = await ns.getJSON<StoredJsonRecord>(resource.key, {
    schema: resource.policy.schema,
  })
  if (existing && typeof existing === "object" && typeof existing.fetchedAt === "number") {
    return false
  }
  const record: StoredJsonRecord = {
    data,
    validators: seed.validators ?? {},
    fetchedAt: seed.fetchedAt ?? 0,
  }
  await persistRecord(resource, record)
  const value: CachedJson<T> = {
    data,
    fetchedAt: record.fetchedAt,
    stale: !isFresh(record, resource.policy.ttlMs, deps.now()),
    source: "cache",
  }
  notify(resource.key, value as CachedJson<unknown>)
  return true
}

/** Revalidate every registered resource whose record is stale. Fire-and-
 *  forget; coalesced; staggered per resource so a fleet never stampedes
 *  (interval-level jitter lives in the trigger loop). */
export function revalidateAll(trigger: CacheTrigger): void {
  if (!deps.isOnline()) return
  for (const resource of registry.values()) {
    const delay = trigger === "startup" || trigger === "pull" ? 0 : deps.staggerMs()
    setTimeout(() => {
      void (async () => {
        const existing = await loadRecord(resource)
        if (existing && isFresh(existing.record, resource.policy.ttlMs, deps.now())) return
        if (!deps.isOnline()) return
        await revalidate(resource, existing, { force: false })
      })().catch((err) => {
        console.warn(`[offlineCache] revalidateAll(${trigger}) "${resource.key}":`, err)
      })
    }, delay)
  }
}
