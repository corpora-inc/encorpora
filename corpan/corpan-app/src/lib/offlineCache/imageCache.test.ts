// Tests for the image half of the D12 offline cache (offline-cache.md §8):
// passthrough rules, cache-first resolution, LRU byte/entry budget with
// exact victim sets, orphan sweeps, repair, and the <OfflineImage> state
// machine via peekImageDisplay/resolveImageDisplay (no DOM required).

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"

import {
  cachedImageSrc,
  enforceImageBudget,
  hashUrl,
  hydrateImageIndex,
  peekCachedImage,
  peekImageDisplay,
  prefetchImages,
  repairImage,
  resolveImageDisplay,
  IMAGE_CACHE_MAX_ENTRIES,
  __resetImageCacheForTests,
  __setImageCacheDepsForTests,
  __settleImageCacheForTests,
} from "./imageCache.ts"
import { __resetSingleflightForTests } from "./singleflight.ts"
import type { ImageIndexRecord, OfflineCacheEntry } from "./types.ts"

/* --------------------------------- fakes ---------------------------------- */

function makeFakeIndex(backing = new Map<string, unknown>()) {
  return {
    backing,
    async getJSON<T>(key: string): Promise<T | undefined> {
      return backing.get(key) as T | undefined
    },
    async setJSON<T>(key: string, value: T): Promise<void> {
      backing.set(key, value)
    },
    async del(key: string): Promise<void> {
      backing.delete(key)
    },
    async keys(): Promise<string[]> {
      return [...backing.keys()]
    },
  }
}

type Harness = {
  index: ReturnType<typeof makeFakeIndex>
  online: { value: boolean }
  clock: { now: number }
  puts: string[]
  deletes: string[][]
  disk: OfflineCacheEntry[]
  putShouldFail: { value: boolean }
}

function setup(backing?: Map<string, unknown>): Harness {
  const index = makeFakeIndex(backing)
  const online = { value: true }
  const clock = { now: 1_000_000 }
  const puts: string[] = []
  const deletes: string[][] = []
  const disk: OfflineCacheEntry[] = []
  const putShouldFail = { value: false }

  __resetImageCacheForTests()
  __resetSingleflightForTests()
  __setImageCacheDepsForTests({
    isTauri: () => true,
    isOnline: () => online.value,
    now: () => clock.now,
    nativePut: async (url) => {
      if (putShouldFail.value) throw new Error("scripted put failure")
      puts.push(url)
      const hash = await hashUrl(url)
      const relPath = `img/${hash}.png`
      disk.push({ relPath, size: 1000, modifiedMs: clock.now })
      return {
        relPath,
        servedUrl: `corpan-pack://localhost/.offline-cache/${relPath}`,
        size: 1000,
        contentType: "image/png",
      }
    },
    nativeDelete: async (relPaths) => {
      deletes.push([...relPaths])
      // Mimic the real command: the files leave the disk.
      for (const rel of relPaths) {
        const at = disk.findIndex((e) => e.relPath === rel)
        if (at >= 0) disk.splice(at, 1)
      }
      return relPaths.length
    },
    nativeList: async () => [...disk],
    index: async () => index,
  })
  return { index, online, clock, puts, deletes, disk, putShouldFail }
}

async function seedRecord(
  h: Harness,
  url: string,
  overrides?: Partial<ImageIndexRecord>,
): Promise<ImageIndexRecord> {
  const hash = await hashUrl(url)
  const record: ImageIndexRecord = {
    url,
    relPath: `img/${hash}.png`,
    servedUrl: `corpan-pack://localhost/.offline-cache/img/${hash}.png`,
    size: 1000,
    contentType: "image/png",
    cachedAt: 500_000,
    lastUsedAt: 500_000,
    ...overrides,
  }
  h.index.backing.set(hash, record)
  return record
}

const tick = () => new Promise<void>((r) => setTimeout(r, 5))

/** Deterministic wait: poll until `cond` holds (the background fills run on
 *  real promise chains whose latency varies under full-suite load). */
async function waitFor(cond: () => boolean, ms = 30_000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("waitFor timed out")
    await tick()
  }
}

beforeEach(async () => {
  // Drain any fire-and-forget background work the previous case left in flight
  // (against the previous deps) BEFORE resetting — otherwise a late LRU-touch
  // or fill can land in this case's freshly-reset singletons under CPU load
  // and flip a cache hit into a miss (the 1/300-ish CI flake).
  await __settleImageCacheForTests()
  __resetImageCacheForTests()
  __resetSingleflightForTests()
})

/* ---------------------------------- tests ---------------------------------- */

test("non-http src passes through untouched (bundled/data/blob/corpan-pack)", async () => {
  const h = setup()
  for (const src of [
    "/assets/corpan-mark.png",
    "data:image/png;base64,AAA",
    "blob:tauri://x",
    "corpan-pack://localhost/pack/cover.png",
  ]) {
    assert.equal(await cachedImageSrc(src), src)
  }
  assert.equal(h.puts.length, 0, "no native traffic for local sources")
})

test("miss + offline resolves undefined (caller shows glyph fallback)", async () => {
  const h = setup()
  h.online.value = false
  assert.equal(await cachedImageSrc("https://cdn.test/cover.png"), undefined)
  assert.equal(h.puts.length, 0)
})

test("miss + online: resolves to the REMOTE url now + exactly one background put", async () => {
  const h = setup()
  const url = "https://cdn.test/cover.png"
  const [a, b] = await Promise.all([cachedImageSrc(url), cachedImageSrc(url)])
  assert.equal(a, url, "remote served for this render")
  assert.equal(b, url)
  await waitFor(() => peekCachedImage(url) !== undefined)
  assert.deepEqual(h.puts, [url], "single-flight: one native put")

  // The index gained the entry for the NEXT render.
  const next = await cachedImageSrc(url)
  assert.ok(next?.startsWith("corpan-pack://localhost/.offline-cache/img/"))
})

test("hit: serves the local corpan-pack URL and touches lastUsedAt (LRU clock)", async () => {
  const h = setup()
  const url = "https://cdn.test/cover.png"
  const seeded = await seedRecord(h, url, { lastUsedAt: 111 })
  await hydrateImageIndex()

  h.clock.now = 2_000_000
  const resolved = await cachedImageSrc(url)
  assert.equal(resolved, seeded.servedUrl)
  assert.equal(h.puts.length, 0, "no network on a hit")
  assert.equal(peekCachedImage(url)?.lastUsedAt, 2_000_000, "LRU clock touched")
  const hash = await hashUrl(url)
  await waitFor(
    () => (h.index.backing.get(hash) as ImageIndexRecord | undefined)?.lastUsedAt === 2_000_000,
  )
})

test("failed native put degrades quietly: remote now, no index row, retry possible", async () => {
  const h = setup()
  h.putShouldFail.value = true
  const url = "https://cdn.test/cover.png"
  assert.equal(await cachedImageSrc(url), url)
  await tick()
  assert.equal(peekCachedImage(url), undefined, "no phantom index row")

  h.putShouldFail.value = false
  __resetSingleflightForTests()
  assert.equal(await cachedImageSrc(url), url)
  await waitFor(() => h.puts.length === 1)
  assert.deepEqual(h.puts, [url], "retry succeeded after the failure")
})

test("LRU eviction: drops oldest-used until under budget, deletes EXACTLY those relPaths", async () => {
  const h = setup()
  // Three records whose sizes overflow the 64 MiB budget; distinct LRU ages.
  const mib = 1024 * 1024
  const old = await seedRecord(h, "https://cdn.test/old.png", {
    size: 40 * mib,
    lastUsedAt: 100,
  })
  const mid = await seedRecord(h, "https://cdn.test/mid.png", {
    size: 40 * mib,
    lastUsedAt: 200,
  })
  const fresh = await seedRecord(h, "https://cdn.test/new.png", {
    size: 40 * mib,
    lastUsedAt: 300,
  })
  // Matching files on disk so the orphan sweep (also exercised) is a no-op.
  h.disk.push(
    { relPath: old.relPath, size: old.size, modifiedMs: 100 },
    { relPath: mid.relPath, size: mid.size, modifiedMs: 200 },
    { relPath: fresh.relPath, size: fresh.size, modifiedMs: 300 },
  )

  await enforceImageBudget()

  // 120 MiB total -> evict `old` (80 left), still over -> evict `mid` (40 left).
  assert.equal(h.deletes.length, 1)
  assert.deepEqual(h.deletes[0], [old.relPath, mid.relPath], "exact LRU victim set, oldest first")
  assert.equal(peekCachedImage(old.url), undefined)
  assert.equal(peekCachedImage(mid.url), undefined)
  assert.ok(peekCachedImage(fresh.url), "newest survives")
})

test("entry ceiling: more than IMAGE_CACHE_MAX_ENTRIES rows evicts down to the cap", async () => {
  const h = setup()
  const total = IMAGE_CACHE_MAX_ENTRIES + 3
  for (let i = 0; i < total; i += 1) {
    await seedRecord(h, `https://cdn.test/c${i}.png`, { size: 10, lastUsedAt: i })
  }
  await enforceImageBudget()
  assert.equal(h.deletes.length, 1)
  assert.equal(h.deletes[0].length, 3, "exactly the overflow evicted")
  // The three oldest-used (i = 0,1,2) are the victims.
  for (let i = 0; i < 3; i += 1) {
    assert.equal(peekCachedImage(`https://cdn.test/c${i}.png`), undefined)
  }
  assert.ok(peekCachedImage(`https://cdn.test/c3.png`))
})

test("orphan sweep: fs-only files (no index row) are deleted on the slow cadence", async () => {
  const h = setup()
  const kept = await seedRecord(h, "https://cdn.test/kept.png")
  h.disk.push(
    { relPath: kept.relPath, size: 1000, modifiedMs: 1 },
    { relPath: "img/deadbeef.png", size: 777, modifiedMs: 1 }, // orphan
  )

  await enforceImageBudget()
  assert.equal(h.deletes.length, 1)
  assert.deepEqual(h.deletes[0], ["img/deadbeef.png"], "only the orphan deleted")

  // Second pass inside the sweep interval: throttled, no repeat listing.
  h.disk.push({ relPath: "img/cafebabe.png", size: 1, modifiedMs: 2 })
  await enforceImageBudget()
  assert.equal(h.deletes.length, 1, "sweep throttled within the interval")
})

test("repairImage drops the broken row, deletes the file, and re-fetches when online", async () => {
  const h = setup()
  const url = "https://cdn.test/cover.png"
  const seeded = await seedRecord(h, url)
  await hydrateImageIndex()
  assert.ok(peekCachedImage(url))

  await repairImage(url)
  assert.equal(peekCachedImage(url), undefined, "row dropped")
  const hash = await hashUrl(url)
  assert.equal(h.index.backing.has(hash), false, "persisted row dropped")
  assert.deepEqual(h.deletes[0], [seeded.relPath])
  await waitFor(() => h.puts.length === 1)
  assert.deepEqual(h.puts, [url], "online repair re-downloads")
})

test("repairImage offline: row dropped, NO re-fetch", async () => {
  const h = setup()
  const url = "https://cdn.test/cover.png"
  await seedRecord(h, url)
  await hydrateImageIndex()
  h.online.value = false
  await repairImage(url)
  await tick()
  assert.equal(peekCachedImage(url), undefined)
  assert.equal(h.puts.length, 0)
})

test("prefetchImages: serialized fills for unseen urls only, skipped offline", async () => {
  const h = setup()
  await seedRecord(h, "https://cdn.test/already.png")
  prefetchImages([
    "https://cdn.test/already.png", // cached — skipped
    "https://cdn.test/one.png",
    "/bundled.png", // non-http — skipped
    "https://cdn.test/two.png",
  ])
  await waitFor(() => h.puts.length === 2)
  assert.deepEqual(h.puts, ["https://cdn.test/one.png", "https://cdn.test/two.png"])

  h.online.value = false
  prefetchImages(["https://cdn.test/three.png"])
  await tick()
  assert.equal(h.puts.length, 2, "offline prefetch is a no-op")
})

/* ---------------------- <OfflineImage> state machine ---------------------- */

test("state machine: undefined url -> fallback; bundled -> cached passthrough", async () => {
  setup()
  assert.deepEqual(peekImageDisplay(undefined), { state: "fallback" })
  assert.deepEqual(await resolveImageDisplay(undefined), { state: "fallback" })
  assert.deepEqual(peekImageDisplay("/bundled.png"), { src: "/bundled.png", state: "cached" })
})

test("state machine: cold lookup starts 'resolving', settles 'remote' online", async () => {
  setup()
  const url = "https://cdn.test/cover.png"
  assert.deepEqual(peekImageDisplay(url), { state: "resolving" })
  const resolved = await resolveImageDisplay(url)
  assert.deepEqual(resolved, { src: url, state: "remote" })
})

test("state machine: warm mirror hit is synchronously 'cached' (no flash)", async () => {
  const h = setup()
  const url = "https://cdn.test/cover.png"
  const seeded = await seedRecord(h, url)
  await hydrateImageIndex()
  assert.deepEqual(peekImageDisplay(url), { src: seeded.servedUrl, state: "cached" })
})

test("state machine: offline miss settles 'fallback' (glyph, never blank)", async () => {
  const h = setup()
  h.online.value = false
  const resolved = await resolveImageDisplay("https://cdn.test/cover.png")
  assert.deepEqual(resolved, { state: "fallback" })
})
