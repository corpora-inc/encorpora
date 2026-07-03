// Upgrade-migration gate (offline-cache.md §6 phase 2, W12): a device
// upgrading from the legacy per-store persistence (zustand-persisted catalog
// + ETag/lastFetched fields) must have its offline-cache-json records SEEDED
// by the stores' `migrate` hooks so an offline COLD START after the upgrade
// renders the full catalog from cache — no refetch, no blank Home.
//
// The store `migrate` hooks are thin glue over `legacySeed.ts` +
// `seedJsonRecord` — this suite exercises those real modules end-to-end
// against the REAL resource definitions (catalogV3Resource et al.), through
// the same injected-deps seams the airplane-mode suite uses.
//
// `resources.ts` pulls in `contentPacks/catalog.ts`, which uses extensionless
// (bundler-resolution) imports the bare Node strip-types loader can't
// resolve — so we bundle through esbuild and exercise the real exports
// (the catalogFilter.test.ts / journeyPackCatalog.test.ts pattern).

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"

/* ------------------------------ bundled module ----------------------------- */

type AnyFn = (...args: never[]) => unknown
// Loose views of the bundled exports (the real types live in the modules).
let mod: {
  cachedFetch: (resource: unknown, opts?: unknown) => Promise<
    { data: { packs: Array<Record<string, unknown>> }; fetchedAt: number; stale: boolean; source: string } | undefined
  >
  seedJsonRecord: (resource: unknown, seed: unknown) => Promise<boolean>
  subscribeJson: (key: string, cb: (v: unknown) => void) => () => void
  __setJsonCacheDepsForTests: (o: Record<string, unknown>) => void
  __resetJsonCacheForTests: () => void
  __resetSingleflightForTests: () => void
  catalogV3Resource: { key: string; parse: AnyFn; policy: { ttlMs: number; schema?: number } }
  phrasePackCatalogResource: { key: string }
  visibleCatalog: (
    raw: unknown,
    appVersion: string,
    devMode: boolean,
  ) => Array<Record<string, unknown>>
  legacyCatalogGamesToRawV3: (games: unknown[]) => { version: 3; packs: unknown[] }
  seedGameCatalogFromLegacy: (state: Record<string, unknown>) => Promise<boolean>
  seedPhrasePackCatalogFromLegacy: (state: Record<string, unknown>) => Promise<boolean>
}

before(async () => {
  const { build } = await import("esbuild")
  const here = path.dirname(fileURLToPath(import.meta.url))
  const res = await build({
    stdin: {
      contents: `
        export {
          cachedFetch, seedJsonRecord, subscribeJson,
          __setJsonCacheDepsForTests, __resetJsonCacheForTests,
        } from "./jsonCache.ts"
        export { __resetSingleflightForTests } from "./singleflight.ts"
        export { catalogV3Resource, phrasePackCatalogResource, visibleCatalog } from "./resources.ts"
        export {
          legacyCatalogGamesToRawV3,
          seedGameCatalogFromLegacy,
          seedPhrasePackCatalogFromLegacy,
        } from "./legacySeed.ts"
      `,
      resolveDir: here,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    define: { "import.meta.env": "{}" },
    tsconfig: path.join(here, "../../../tsconfig.json"),
  })
  const code = res.outputFiles[0].text
  mod = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"))
})

/* --------------------------- device + session seams ------------------------ */
// Same shape as offlineAirplane.test.ts: the backing map plays IndexedDB and
// survives the simulated force-quit; module memory resets per session.

type StoredCell = { value: unknown; schema?: number }

function kvOver(backing: Map<string, StoredCell>) {
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

function bootSession(
  backing: Map<string, StoredCell>,
  opts: {
    online: boolean
    now?: number
    respond?: (url: string, o: { validators?: { etag?: string | null } }) =>
      | { status: "ok"; data: unknown; validators: Record<string, unknown> }
      | { status: "unchanged"; validators: Record<string, unknown> }
  },
) {
  const networkCalls: Array<{ url: string; validators?: { etag?: string | null } }> = []
  mod.__resetJsonCacheForTests()
  mod.__resetSingleflightForTests()
  mod.__setJsonCacheDepsForTests({
    ns: async () => kvOver(backing),
    now: () => opts.now ?? Date.now(),
    isOnline: () => opts.online,
    staggerMs: () => 0,
    fetchJsonFresh: async (url: string, o: { validators?: { etag?: string | null }; parse: (raw: unknown) => unknown }) => {
      networkCalls.push({ url, validators: o.validators })
      if (!opts.online || !opts.respond) throw new Error("network unreachable")
      const r = opts.respond(url, o)
      if (r.status === "ok") {
        const parsed = o.parse(r.data)
        if (parsed == null) throw new Error("bad payload")
        return { status: "ok", data: parsed, validators: r.validators }
      }
      return r
    },
  })
  return { networkCalls }
}

/* ---------------------------------- fixtures -------------------------------- */
// A legacy `corpan-catalog-v2` persisted snapshot: the FILTERED CatalogGame[]
// (what pre-upgrade builds persisted), plus its freshness/validator fields.

const LEGACY_GAMES = [
  {
    id: "lingo_hero",
    name: "Lingo Hero",
    version: "0.2.0",
    manifestUrl: "https://encorpora.io/corpan/packs/lingo-hero.zip",
    imageUrl: "https://encorpora.io/assets/lingo_hero-avatar.png",
    purchase: { type: "free", priceLabel: "Free" },
    categories: ["games"],
    recommendOrder: 2,
  },
  {
    id: "earthgate_reader",
    name: "Earthgate",
    version: "1.4.0",
    manifestUrl: "https://encorpora.io/corpan/packs/earthgate.zip",
    imageUrl: "https://encorpora.io/assets/earthgate-avatar.png",
    systemPack: true,
    minAppVersion: "0.15.0",
  },
]

const LEGACY_PERSISTED = {
  catalog: LEGACY_GAMES,
  lastFetched: 1_700_000_000_000,
  lastChecked: 1_700_000_000_000,
  etag: '"legacy-etag"',
  lastModified: "Tue, 01 Jul 2026 00:00:00 GMT",
}

const PHRASE_BODY = {
  version: 1,
  generatedAt: "2026-07-01T00:00:00Z",
  packs: [
    {
      id: "phrase-travel-basics",
      version: "0.1.0",
      zipUrl: "https://cdn.example/phrase-travel-basics-0.1.0.zip",
      name: "Travel Basics",
      sizeMb: 1.2,
      entryCount: 100,
    },
  ],
}

/* ----------------------------------- tests ---------------------------------- */

test("upgrade: legacy game catalog seeds the cache; offline cold start renders WITHOUT refetch", async () => {
  const backing = new Map<string, StoredCell>()

  // -- Upgrade launch: the store's migrate hook runs (may be offline!). --
  bootSession(backing, { online: false })
  assert.equal(await mod.seedGameCatalogFromLegacy(LEGACY_PERSISTED), true)

  // The stored record is the RAW-shaped synthetic v3 body, parse-gated…
  const cell = backing.get("catalog-v3")
  assert.ok(cell, "record written under the catalog-v3 key")
  const record = cell.value as { data: unknown; validators: Record<string, unknown>; fetchedAt: number }
  assert.equal(record.fetchedAt, LEGACY_PERSISTED.lastFetched)
  // …and the legacy validators are DROPPED (they describe the raw CDN body;
  // a 304 must never confirm our synthetic filtered body as current).
  assert.deepEqual(record.validators, {})

  // -- Force-quit → airplane-mode COLD START. --
  const cold = bootSession(backing, { online: false })
  const result = await mod.cachedFetch(mod.catalogV3Resource)
  assert.ok(result, "seeded catalog renders offline")
  assert.equal(result.source, "cache")
  assert.equal(cold.networkCalls.length, 0, "no refetch — the seed IS the cache")

  // Read-time filtering over the seeded body reproduces the exact catalog
  // the device showed before the upgrade.
  const visible = mod.visibleCatalog(result.data, "0.19.2", false)
  assert.deepEqual(
    visible.map((g) => g.id),
    ["lingo_hero", "earthgate_reader"],
  )
  const lingo = visible.find((g) => g.id === "lingo_hero")!
  assert.equal(lingo.manifestUrl, LEGACY_GAMES[0].manifestUrl)
  assert.equal(lingo.imageUrl, LEGACY_GAMES[0].imageUrl)
  assert.equal(lingo.version, "0.2.0")
  const earthgate = visible.find((g) => g.id === "earthgate_reader")!
  assert.equal(earthgate.systemPack, true, "systemPack survives the round-trip")
})

test("upgrade seed is idempotent and never clobbers an existing record", async () => {
  const backing = new Map<string, StoredCell>()
  bootSession(backing, { online: false })

  assert.equal(await mod.seedGameCatalogFromLegacy(LEGACY_PERSISTED), true)
  // Re-running migrate (e.g. main.tsx's post-storage-migration rehydrate)
  // must be a no-op.
  assert.equal(await mod.seedGameCatalogFromLegacy(LEGACY_PERSISTED), false)

  // A record that arrived from the NETWORK is never overwritten by a seed.
  const fresh = backing.get("catalog-v3")!.value
  assert.equal(await mod.seedGameCatalogFromLegacy(LEGACY_PERSISTED), false)
  assert.equal(backing.get("catalog-v3")!.value, fresh)
})

test("upgrade seed is parse-gated: garbage legacy state writes nothing", async () => {
  const backing = new Map<string, StoredCell>()
  bootSession(backing, { online: false })

  assert.equal(await mod.seedGameCatalogFromLegacy({}), false)
  assert.equal(await mod.seedGameCatalogFromLegacy({ catalog: [] }), false)
  assert.equal(await mod.seedGameCatalogFromLegacy({ catalog: "nonsense" }), false)
  assert.equal(
    await mod.seedGameCatalogFromLegacy({ catalog: [{ noId: true }] }),
    false,
    "entries without an id are dropped; an all-dropped list is refused",
  )
  assert.equal(backing.size, 0, "nothing persisted")
})

test("seed notifies subscribers — a store that raced ahead of migrate still hydrates", async () => {
  const backing = new Map<string, StoredCell>()
  bootSession(backing, { online: false })

  const seen: unknown[] = []
  const unsub = mod.subscribeJson("catalog-v3", (v) => seen.push(v))
  assert.equal(await mod.seedGameCatalogFromLegacy(LEGACY_PERSISTED), true)
  unsub()

  assert.equal(seen.length, 1)
  const value = seen[0] as { source: string; stale: boolean; fetchedAt: number }
  assert.equal(value.source, "cache")
  assert.equal(value.fetchedAt, LEGACY_PERSISTED.lastFetched)
  assert.equal(value.stale, true, "an old lastFetched reads as stale (revalidates when online)")
})

test("phrase-pack upgrade: raw body seeds VERBATIM with validators; first online revalidation can 304", async () => {
  const backing = new Map<string, StoredCell>()
  bootSession(backing, { online: false })

  assert.equal(
    await mod.seedPhrasePackCatalogFromLegacy({
      catalog: PHRASE_BODY,
      lastFetched: 1_700_000_000_000,
      etag: '"phrase-etag"',
      lastModified: "Tue, 01 Jul 2026 00:00:00 GMT",
    }),
    true,
  )
  const record = backing.get("phrase-pack-catalog")!.value as {
    validators: { etag?: string; lastModified?: string }
  }
  // The legacy validators describe exactly this body — carried over so the
  // first post-upgrade revalidation is a 0-byte 304.
  assert.equal(record.validators.etag, '"phrase-etag"')

  // Offline cold start: the body renders from the seed (normalized through
  // the real parser — parse-gated on write AND on read).
  bootSession(backing, { online: false })
  const cold = await mod.cachedFetch(mod.phrasePackCatalogResource)
  assert.ok(cold)
  assert.equal(cold.source, "cache")
  assert.equal(cold.data.packs.length, 1)
  const pack = cold.data.packs[0]
  assert.equal(pack.id, "phrase-travel-basics")
  assert.equal(pack.version, "0.1.0")
  assert.equal(pack.zipUrl, PHRASE_BODY.packs[0].zipUrl)

  // Back online, stale → background revalidation FORWARDS the seeded
  // validators and a 304 refreshes fetchedAt without data churn.
  const NOW = 1_700_009_999_999
  const online = bootSession(backing, {
    online: true,
    now: NOW,
    respond: () => ({ status: "unchanged", validators: { etag: '"phrase-etag"' } }),
  })
  const served = await mod.cachedFetch(mod.phrasePackCatalogResource)
  assert.ok(served)
  assert.equal(served.source, "cache")
  assert.equal(served.stale, true, "stale served immediately (revalidate runs in background)")
  // Wait for the background revalidation to land.
  const deadline = Date.now() + 30_000
  while (online.networkCalls.length === 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5))
  }
  assert.equal(online.networkCalls.length, 1)
  assert.equal(online.networkCalls[0].validators?.etag, '"phrase-etag"')
  // 304 path persists the refreshed fetchedAt.
  while (
    (backing.get("phrase-pack-catalog")!.value as { fetchedAt: number }).fetchedAt !== NOW &&
    Date.now() < deadline
  ) {
    await new Promise((r) => setTimeout(r, 5))
  }
  assert.equal(
    (backing.get("phrase-pack-catalog")!.value as { fetchedAt: number }).fetchedAt,
    NOW,
  )
})
