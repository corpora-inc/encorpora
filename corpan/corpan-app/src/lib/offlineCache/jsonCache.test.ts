// Tests for the JSON half of the D12 offline cache (offline-cache.md §8).
// Storage + network get tiny injectable seams: a Map-backed KV fake (with
// D13 schema semantics) and a scriptable fetchJsonFresh. The headline
// guarantees: fresh-within-TTL never touches the network, stale-while-
// revalidate serves NOW and notifies later, and NO failure mode ever
// deletes the last-good record.

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"

import {
  cachedFetch,
  registerResource,
  revalidateAll,
  subscribeJson,
  __resetJsonCacheForTests,
  __setJsonCacheDepsForTests,
  type KVLike,
} from "./jsonCache.ts"
import { __resetSingleflightForTests } from "./singleflight.ts"
import type { CachedJson, JsonResource } from "./types.ts"

/* --------------------------------- fakes ---------------------------------- */

type StoredCell = { value: unknown; schema?: number }

/** Map-backed KV honoring the storage schema contract (mismatch = miss). */
function makeFakeKV(backing = new Map<string, StoredCell>()) {
  const kv: KVLike & { backing: Map<string, StoredCell> } = {
    backing,
    async getJSON<T>(key: string, opts?: { schema?: number }): Promise<T | undefined> {
      const cell = backing.get(key)
      if (!cell) return undefined
      if (
        opts?.schema !== undefined &&
        cell.schema !== undefined &&
        cell.schema !== opts.schema
      ) {
        return undefined
      }
      return cell.value as T
    },
    async setJSON<T>(key: string, value: T, opts?: { schema?: number }): Promise<void> {
      backing.set(key, { value, schema: opts?.schema })
    },
    async del(key: string): Promise<void> {
      backing.delete(key)
    },
  }
  return kv
}

type ScriptedResponse =
  | { kind: "ok"; data: unknown; etag?: string }
  | { kind: "unchanged" }
  | { kind: "error" }

function makeFakeNet() {
  const calls: Array<{ url: string; validators?: unknown }> = []
  const queue: ScriptedResponse[] = []
  const fetchJsonFresh = async <T>(
    url: string,
    opts: { parse: (raw: unknown) => T | null; validators?: unknown },
  ) => {
    calls.push({ url, validators: opts.validators })
    const next = queue.shift() ?? { kind: "error" as const }
    if (next.kind === "error") throw new Error("scripted network failure")
    if (next.kind === "unchanged") {
      return { status: "unchanged" as const, validators: (opts.validators ?? {}) as never }
    }
    const parsed = opts.parse(next.data)
    if (parsed == null) throw new Error("scripted payload failed to parse")
    return {
      status: "ok" as const,
      data: parsed,
      validators: { etag: next.etag ?? '"e1"', lastModified: null },
    }
  }
  return { calls, queue, fetchJsonFresh }
}

type Doc = { items: string[] }
const parseDoc = (raw: unknown): Doc | null => {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as Doc).items)) return null
  return raw as Doc
}

function makeResource(overrides?: Partial<JsonResource<Doc>>): JsonResource<Doc> {
  return {
    key: "test-doc",
    url: () => "https://example.test/doc.json",
    parse: parseDoc,
    policy: { ttlMs: 300_000, schema: 1 },
    ...overrides,
  }
}

type Harness = {
  kv: ReturnType<typeof makeFakeKV>
  net: ReturnType<typeof makeFakeNet>
  clock: { now: number }
  online: { value: boolean }
}

function setup(backing?: Map<string, StoredCell>): Harness {
  const kv = makeFakeKV(backing)
  const net = makeFakeNet()
  const clock = { now: 1_000_000 }
  const online = { value: true }
  __resetJsonCacheForTests()
  __resetSingleflightForTests()
  __setJsonCacheDepsForTests({
    fetchJsonFresh: net.fetchJsonFresh as never,
    ns: async () => kv,
    now: () => clock.now,
    isOnline: () => online.value,
    staggerMs: () => 0,
  })
  return { kv, net, clock, online }
}

const tick = () => new Promise<void>((r) => setTimeout(r, 5))

/** Deterministic wait for background revalidations (latency varies under
 *  full-suite load). */
async function waitFor(cond: () => boolean, ms = 30_000): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("waitFor timed out")
    await tick()
  }
}

beforeEach(() => {
  __resetJsonCacheForTests()
  __resetSingleflightForTests()
})

/* ---------------------------------- tests ---------------------------------- */

test("true miss + online: awaits the network, persists, returns network data", async () => {
  const h = setup()
  h.net.queue.push({ kind: "ok", data: { items: ["a"] } })

  const result = await cachedFetch(makeResource())
  assert.ok(result)
  assert.deepEqual(result.data, { items: ["a"] })
  assert.equal(result.source, "network")
  assert.equal(result.stale, false)
  assert.equal(h.net.calls.length, 1)
  assert.ok(h.kv.backing.has("test-doc"), "record persisted")
})

test("fresh within TTL: serves cache with ZERO network calls", async () => {
  const h = setup()
  h.net.queue.push({ kind: "ok", data: { items: ["a"] } })
  await cachedFetch(makeResource())
  assert.equal(h.net.calls.length, 1)

  h.clock.now += 100_000 // still inside the 300s TTL
  const result = await cachedFetch(makeResource())
  assert.ok(result)
  assert.equal(result.source, "cache")
  assert.equal(result.stale, false)
  assert.equal(h.net.calls.length, 1, "no second network call")
})

test("stale + online: returns stale IMMEDIATELY, notifies subscriber after background 200", async () => {
  const h = setup()
  h.net.queue.push({ kind: "ok", data: { items: ["v1"] } })
  await cachedFetch(makeResource())

  h.clock.now += 600_000 // past TTL
  h.net.queue.push({ kind: "ok", data: { items: ["v2"] } })

  const notified: Array<CachedJson<Doc>> = []
  subscribeJson<Doc>("test-doc", (v) => notified.push(v))

  const result = await cachedFetch(makeResource())
  assert.ok(result)
  assert.deepEqual(result.data, { items: ["v1"] }, "stale copy served now")
  assert.equal(result.stale, true)
  assert.equal(result.source, "cache")

  await waitFor(() => notified.length === 1) // background revalidation lands
  assert.equal(notified.length, 1, "subscriber notified once")
  assert.deepEqual(notified[0].data, { items: ["v2"] })
  assert.equal(notified[0].source, "network")

  // The NEXT read serves the refreshed record from cache.
  const after = await cachedFetch(makeResource())
  assert.ok(after)
  assert.deepEqual(after.data, { items: ["v2"] })
  assert.equal(after.source, "cache")
})

test("304 refreshes fetchedAt without data churn (no subscriber noise)", async () => {
  const h = setup()
  h.net.queue.push({ kind: "ok", data: { items: ["a"] }, etag: '"e1"' })
  const first = await cachedFetch(makeResource())
  assert.ok(first)

  h.clock.now += 600_000
  h.net.queue.push({ kind: "unchanged" })
  const notified: unknown[] = []
  subscribeJson("test-doc", (v) => notified.push(v))

  await cachedFetch(makeResource())
  await tick()
  assert.equal(notified.length, 0, "no churn on 304")
  assert.equal(
    h.net.calls[1]?.validators !== undefined,
    true,
    "conditional validators sent on revalidation",
  )

  // fetchedAt was refreshed: the record is fresh again, zero network.
  const callsBefore = h.net.calls.length
  const again = await cachedFetch(makeResource())
  assert.ok(again)
  assert.equal(again.stale, false)
  assert.equal(again.source, "cache")
  assert.equal(h.net.calls.length, callsBefore)
})

test("network error never deletes the record (stale keeps serving)", async () => {
  const h = setup()
  h.net.queue.push({ kind: "ok", data: { items: ["keep-me"] } })
  await cachedFetch(makeResource())

  h.clock.now += 600_000
  // background revalidation fails (queue empty -> scripted error)
  const result = await cachedFetch(makeResource())
  assert.ok(result)
  assert.deepEqual(result.data, { items: ["keep-me"] })
  await tick()
  assert.ok(h.kv.backing.has("test-doc"), "record survived the failure")

  // Foreground (background:false) failure ALSO returns the stale copy.
  const foreground = await cachedFetch(makeResource(), { background: false })
  assert.ok(foreground)
  assert.deepEqual(foreground.data, { items: ["keep-me"] })
  assert.equal(foreground.stale, true)
})

test("force bypasses TTL and validators", async () => {
  const h = setup()
  h.net.queue.push({ kind: "ok", data: { items: ["v1"] } })
  await cachedFetch(makeResource())

  // Still fresh — but force refetches, without conditional validators.
  h.net.queue.push({ kind: "ok", data: { items: ["v2"] } })
  const result = await cachedFetch(makeResource(), { force: true })
  assert.ok(result)
  assert.deepEqual(result.data, { items: ["v2"] })
  assert.equal(result.source, "network")
  assert.equal(h.net.calls.length, 2)
  assert.equal(h.net.calls[1].validators, undefined, "forced refresh sends no validators")
})

test("schema bump reads as miss (old-shape record never reaches the app)", async () => {
  const h = setup()
  h.net.queue.push({ kind: "ok", data: { items: ["old-schema"] } })
  await cachedFetch(makeResource())

  const bumped = makeResource({ policy: { ttlMs: 300_000, schema: 2 } })
  h.online.value = false // offline: a miss must surface as undefined
  const result = await cachedFetch(bumped)
  assert.equal(result, undefined)
})

test("offline true miss returns undefined; offline stale returns stale", async () => {
  const h = setup()
  h.online.value = false
  assert.equal(await cachedFetch(makeResource()), undefined)
  assert.equal(h.net.calls.length, 0, "offline never hits the network")

  h.online.value = true
  h.net.queue.push({ kind: "ok", data: { items: ["cached"] } })
  await cachedFetch(makeResource())

  h.online.value = false
  h.clock.now += 900_000
  const stale = await cachedFetch(makeResource())
  assert.ok(stale)
  assert.deepEqual(stale.data, { items: ["cached"] })
  assert.equal(stale.stale, true)
  assert.equal(stale.source, "cache")
})

test("unparseable persisted record is purged and treated as a miss", async () => {
  const h = setup()
  h.kv.backing.set("test-doc", {
    value: { data: { totally: "wrong-shape" }, validators: {}, fetchedAt: 999_999 },
    schema: 1,
  })
  h.online.value = false
  const result = await cachedFetch(makeResource())
  assert.equal(result, undefined)
  assert.equal(h.kv.backing.has("test-doc"), false, "corrupt record purged")
})

test("concurrent cachedFetch for one key coalesce onto one network call", async () => {
  const h = setup()
  h.net.queue.push({ kind: "ok", data: { items: ["once"] } })
  const [a, b, c] = await Promise.all([
    cachedFetch(makeResource()),
    cachedFetch(makeResource()),
    cachedFetch(makeResource()),
  ])
  assert.equal(h.net.calls.length, 1, "single flight")
  assert.deepEqual(a?.data, { items: ["once"] })
  assert.deepEqual(b?.data, { items: ["once"] })
  assert.deepEqual(c?.data, { items: ["once"] })
})

test("revalidateAll refreshes only stale registered resources, skips offline", async () => {
  const h = setup()
  h.net.queue.push({ kind: "ok", data: { items: ["fresh"] } })
  const fresh = makeResource({ key: "fresh-doc", url: () => "https://example.test/fresh.json" })
  await cachedFetch(fresh)

  const stale = makeResource({ key: "stale-doc", url: () => "https://example.test/stale.json" })
  h.net.queue.push({ kind: "ok", data: { items: ["old"] } })
  await cachedFetch(stale)

  registerResource(fresh as JsonResource<unknown>)
  registerResource(stale as JsonResource<unknown>)

  // Only stale-doc is past its TTL now.
  h.clock.now += 400_000
  // fresh-doc is stale too at +400s... make fresh-doc freshly confirmed:
  h.net.queue.push({ kind: "ok", data: { items: ["fresh2"] } })
  await cachedFetch(fresh, { force: true })

  const callsBefore = h.net.calls.length
  h.net.queue.push({ kind: "ok", data: { items: ["new"] } })
  revalidateAll("interval")
  await waitFor(() => h.net.calls.length === callsBefore + 1)
  await tick() // settle: prove no FURTHER calls follow
  assert.equal(h.net.calls.length, callsBefore + 1, "exactly the stale resource refetched")
  assert.equal(h.net.calls[h.net.calls.length - 1]?.url, "https://example.test/stale.json")

  // Offline: a pass is a no-op.
  h.online.value = false
  revalidateAll("online")
  await tick()
  assert.equal(h.net.calls.length, callsBefore + 1)
})
