// Airplane-mode simulation (the W2 exit gate, offline-cache.md §8 T1/T2):
// an online session populates the JSON cache + image cache; the app is
// "force-quit" (all in-memory module state reset — persisted backing maps
// survive, exactly like IndexedDB + fs across a cold start); then a COLD
// START in airplane mode (fetch stubbed to fail, navigator offline) must
// render the full catalog WITH cover art from cache — no broken images, no
// network calls, and a never-seen image degrades to the glyph fallback.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  cachedFetch,
  __resetJsonCacheForTests,
  __setJsonCacheDepsForTests,
  type KVLike,
} from "./jsonCache.ts"
import {
  cachedImageSrc,
  hashUrl,
  hydrateImageIndex,
  peekImageDisplay,
  prefetchImages,
  resolveImageDisplay,
  __resetImageCacheForTests,
  __setImageCacheDepsForTests,
} from "./imageCache.ts"
import { __resetSingleflightForTests } from "./singleflight.ts"
import type { JsonResource, OfflineCacheEntry } from "./types.ts"

/* ------------------------- persistent "device" state ----------------------- */
// These maps play the role of IndexedDB + the fs blob dir: they survive the
// simulated force-quit; only module-level memory is reset.

type StoredCell = { value: unknown; schema?: number }

function makeDevice() {
  return {
    jsonBacking: new Map<string, StoredCell>(),
    imgBacking: new Map<string, unknown>(),
    disk: [] as OfflineCacheEntry[],
  }
}

type Device = ReturnType<typeof makeDevice>

function kvOver(backing: Map<string, StoredCell>): KVLike {
  return {
    async getJSON<T>(key: string, opts?: { schema?: number }): Promise<T | undefined> {
      const cell = backing.get(key)
      if (!cell) return undefined
      if (opts?.schema !== undefined && cell.schema !== undefined && cell.schema !== opts.schema)
        return undefined
      return cell.value as T
    },
    async setJSON<T>(key: string, value: T, opts?: { schema?: number }): Promise<void> {
      backing.set(key, { value, schema: opts?.schema })
    },
    async del(key: string): Promise<void> {
      backing.delete(key)
    },
  }
}

/** Boot "the app": wire the cache layer onto the device state with the given
 *  connectivity. Network totally unreachable when offline (throws — the same
 *  shape a dead fetch produces through fetchJsonFresh). */
function bootSession(device: Device, opts: { online: boolean; catalogBody?: unknown }) {
  const networkCalls: string[] = []
  const nativePuts: string[] = []

  __resetJsonCacheForTests()
  __resetImageCacheForTests()
  __resetSingleflightForTests()

  __setJsonCacheDepsForTests({
    ns: async () => kvOver(device.jsonBacking),
    now: () => Date.now(),
    isOnline: () => opts.online,
    staggerMs: () => 0,
    fetchJsonFresh: (async (url: string, o: { parse: (raw: unknown) => unknown }) => {
      networkCalls.push(url)
      if (!opts.online) throw new Error("network unreachable (airplane mode)")
      const parsed = o.parse(opts.catalogBody)
      if (parsed == null) throw new Error("bad payload")
      return { status: "ok", data: parsed, validators: { etag: '"e1"', lastModified: null } }
    }) as never,
  })

  __setImageCacheDepsForTests({
    isTauri: () => true,
    isOnline: () => opts.online,
    now: () => Date.now(),
    index: async () => ({
      async getJSON<T>(key: string) {
        return device.imgBacking.get(key) as T | undefined
      },
      async setJSON<T>(key: string, value: T) {
        device.imgBacking.set(key, value)
      },
      async del(key: string) {
        device.imgBacking.delete(key)
      },
      async keys() {
        return [...device.imgBacking.keys()]
      },
    }),
    nativePut: async (url) => {
      if (!opts.online) throw new Error("network unreachable (airplane mode)")
      nativePuts.push(url)
      const hash = await hashUrl(url)
      const relPath = `img/${hash}.png`
      device.disk.push({ relPath, size: 1000, modifiedMs: Date.now() })
      return {
        relPath,
        servedUrl: `corpan-pack://localhost/.offline-cache/${relPath}`,
        size: 1000,
        contentType: "image/png",
      }
    },
    nativeDelete: async (relPaths) => {
      for (const rel of relPaths) {
        const at = device.disk.findIndex((e) => e.relPath === rel)
        if (at >= 0) device.disk.splice(at, 1)
      }
      return relPaths.length
    },
    nativeList: async () => [...device.disk],
  })

  return { networkCalls, nativePuts }
}

/* --------------------------------- fixture --------------------------------- */

type MiniCatalog = { packs: Array<{ id: string; imageUrl?: string }> }
const parseMini = (raw: unknown): MiniCatalog | null => {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as MiniCatalog).packs)) return null
  return raw as MiniCatalog
}
const catalogResource: JsonResource<MiniCatalog> = {
  key: "catalog-v3",
  url: () => "https://encorpora.io/corpan/packs/catalog-v3.json",
  parse: parseMini,
  policy: { ttlMs: 300_000, schema: 1 },
}

const COVER_A = "https://encorpora.io/assets/atom-avatar.png"
const COVER_B = "https://encorpora.io/assets/zheng-avatar.png"
const CATALOG_BODY: MiniCatalog = {
  packs: [
    { id: "atom", imageUrl: COVER_A },
    { id: "zheng", imageUrl: COVER_B },
  ],
}

const tick = () => new Promise<void>((r) => setTimeout(r, 10))

/** Deterministic wait for background fills (latency varies under load). */
async function waitFor(cond: () => boolean, ms = 5_000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("waitFor timed out")
    await new Promise<void>((r) => setTimeout(r, 5))
  }
}

/* ---------------------------------- tests ---------------------------------- */

test("airplane-mode cold start: catalog AND covers render from cache, zero network", async () => {
  const device = makeDevice()

  // ---- Session 1: online. Catalog fetched, covers pre-warmed. ----
  const online = bootSession(device, { online: true, catalogBody: CATALOG_BODY })
  const live = await cachedFetch(catalogResource)
  assert.ok(live)
  assert.equal(live.data.packs.length, 2)

  prefetchImages(live.data.packs.map((p) => p.imageUrl!).filter(Boolean))
  // Wait for the PERSISTED index rows (not just the downloads) — that's what
  // must survive the force-quit.
  const hashA = await hashUrl(COVER_A)
  const hashB = await hashUrl(COVER_B)
  await waitFor(() => device.imgBacking.has(hashA) && device.imgBacking.has(hashB))
  assert.deepEqual(online.nativePuts, [COVER_A, COVER_B], "covers cached on device")

  // ---- Force-quit + airplane mode + COLD START. ----
  const offline = bootSession(device, { online: false })

  // The catalog renders from the persisted record — stale beats empty.
  const cold = await cachedFetch(catalogResource)
  assert.ok(cold, "persisted catalog renders offline")
  assert.deepEqual(
    cold.data.packs.map((p) => p.id),
    ["atom", "zheng"],
  )
  assert.equal(cold.source, "cache")
  assert.equal(offline.networkCalls.length, 0, "offline: fetch never attempted")

  // Cover art resolves to the LOCAL corpan-pack URLs (the named-bug fix).
  await hydrateImageIndex()
  for (const cover of [COVER_A, COVER_B]) {
    const src = await cachedImageSrc(cover)
    assert.ok(
      src?.startsWith("corpan-pack://localhost/.offline-cache/img/"),
      `cover served from disk offline: ${src}`,
    )
    // The <OfflineImage> state machine agrees — synchronously (no flash).
    assert.deepEqual(peekImageDisplay(cover), { src, state: "cached" })
  }

  // A never-seen image shows the glyph fallback — never a broken <img>.
  const missing = await resolveImageDisplay("https://encorpora.io/assets/never-seen.png")
  assert.deepEqual(missing, { state: "fallback" })
  assert.equal(offline.nativePuts.length, 0, "no download attempts offline")
})

test("offline FIRST run (fresh install, airplane from the start): miss + fallbacks, no wedge", async () => {
  const device = makeDevice()
  const session = bootSession(device, { online: false })

  // True catalog miss returns undefined — the caller seeds its built-in
  // defaults (store behavior); the cache layer never throws or hangs.
  assert.equal(await cachedFetch(catalogResource), undefined)
  assert.equal(session.networkCalls.length, 0)

  // Every image resolves to the glyph fallback, never a broken box.
  assert.deepEqual(await resolveImageDisplay(COVER_A), { state: "fallback" })

  // Prefetch is a quiet no-op offline.
  prefetchImages([COVER_A, COVER_B])
  await tick()
  assert.equal(session.nativePuts.length, 0)
})

test("connectivity regained after offline start: caches fill quietly in place", async () => {
  const device = makeDevice()

  // Cold offline start (nothing cached).
  bootSession(device, { online: false })
  assert.equal(await cachedFetch(catalogResource), undefined)

  // Radio back on (same session state is fine for this transition).
  const online = bootSession(device, { online: true, catalogBody: CATALOG_BODY })
  const result = await cachedFetch(catalogResource)
  assert.ok(result, "true miss + online awaits the network")
  assert.equal(result.source, "network")
  prefetchImages([COVER_A])
  const hashA2 = await hashUrl(COVER_A)
  await waitFor(() => device.imgBacking.has(hashA2))
  assert.deepEqual(online.nativePuts, [COVER_A])

  // And the NEXT offline session has everything.
  bootSession(device, { online: false })
  const cold = await cachedFetch(catalogResource)
  assert.ok(cold)
  await hydrateImageIndex()
  const src = await cachedImageSrc(COVER_A)
  assert.ok(src?.startsWith("corpan-pack://localhost/.offline-cache/img/"))
})
