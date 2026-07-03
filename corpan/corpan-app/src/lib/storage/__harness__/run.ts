/// <reference types="node" />
// src/lib/storage/__harness__/run.ts
//
// Self-contained verification harness for the storage + analytics foundation.
// NOT a unit-test framework run — it's a node-executable proof. Bundle with
// esbuild + run with node (see ./README or the storage docs):
//
//   node_modules/.bin/esbuild src/lib/storage/__harness__/run.ts \
//     --bundle --platform=node --format=cjs --outfile=/tmp/storage-harness.cjs
//   node /tmp/storage-harness.cjs
//
// It installs a minimal in-memory IndexedDB + localStorage, then proves:
//   1. QuotaExceededError is eliminated — a localStorage-tier write past a
//      tight quota does NOT throw; trims + retries + degrades.
//   2. The LARGE (IndexedDB) tier persists across a simulated reload.
//   3. LARGE-tier writes past a tight IDB quota evict LRU/volatile + succeed,
//      never throwing.
//   4. The analytics event store records, survives reload, and respects the
//      ring-buffer cap (oldest evicted).
//
// Each section prints PASS/FAIL; the process exits non-zero on any failure.

import { installFakeIndexedDB, installFakeLocalStorage } from "./fakes"

// Install the browser globals BEFORE importing the modules under test (they
// capture `indexedDB` / `localStorage` lazily, but be safe).
installFakeLocalStorage()
const idbControl = installFakeIndexedDB()

let failures = 0
function check(name: string, cond: boolean): void {
  if (cond) {
    console.log(`  PASS  ${name}`)
  } else {
    console.error(`  FAIL  ${name}`)
    failures += 1
  }
}

async function main(): Promise<void> {
  // Import after globals are installed.
  const { storage } = await import("../index")
  const idb = await import("../idb")
  const eventStore = await import("../eventStore")

  /* ---------------------------------------------------------------------- */
  console.log("\n[1] TINY tier (localStorage) — QuotaExceededError elimination")
  /* ---------------------------------------------------------------------- */
  {
    const tiny = storage.namespace("harness-tiny", { tier: "tiny" })
    // Tighten the fake localStorage quota so a big write WOULD throw.
    ;(globalThis as any).__lsQuota = 2000 // ~1000 chars
    let threw = false
    try {
      // Pre-fill with volatile-ish keys we own so trim has something to drop.
      for (let i = 0; i < 5; i += 1) {
        await tiny.setJSON(`pad${i}`, "x".repeat(120))
      }
      // Now a write that pushes past quota — must NOT throw to us.
      await tiny.setJSON("big", "y".repeat(800))
    } catch (err) {
      threw = true
      console.error("   unexpected throw:", err)
    }
    check("tiny-tier set never throws under quota pressure", !threw)
    ;(globalThis as any).__lsQuota = Infinity
    // The latest write should be readable (either durable or memory-mirrored).
    const back = await tiny.getJSON<string>("big")
    check("tiny-tier value still readable after pressure", back === "y".repeat(800))
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[2] LARGE tier (IndexedDB) — persistence across reload")
  /* ---------------------------------------------------------------------- */
  {
    const large = storage.namespace("harness-large", { tier: "large" })
    await large.setJSON("persisted", { hello: "world", n: 42 }, { schema: 1 })
    // Simulate a reload: drop the cached DB connection + re-import a fresh
    // module graph is hard; instead we reset the idb connection cache and read
    // again — the fake IDB store survives (it's the "disk").
    idb.__resetDbForTests()
    const back = await large.getJSON<{ hello: string; n: number }>("persisted", {
      schema: 1,
    })
    check("large-tier value persists across (simulated) reload", !!back && back.hello === "world" && back.n === 42)
    // Schema mismatch → treated as absent.
    const wrongSchema = await large.getJSON("persisted", { schema: 2 })
    check("large-tier schema mismatch reads as miss", wrongSchema === undefined)
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[3] LARGE tier — quota eviction, no throw")
  /* ---------------------------------------------------------------------- */
  {
    const cache = storage.namespace("harness-cache", { tier: "large", volatile: true })
    const durable = storage.namespace("harness-durable", { tier: "large", volatile: false })
    // Write a durable entry we expect to SURVIVE eviction.
    await durable.setJSON("keep", { important: true }, { volatile: false })
    // Constrain the fake IDB so puts past N records fail (simulates quota).
    idbControl.setMaxRecords(12)
    let threw = false
    try {
      for (let i = 0; i < 40; i += 1) {
        await cache.setJSON(`vol${i}`, "z".repeat(50), { volatile: true })
      }
    } catch (err) {
      threw = true
      console.error("   unexpected throw:", err)
    }
    check("large-tier set never throws when IDB quota is hit", !threw)
    // The durable entry must still be present (volatile evicted first).
    const keep = await durable.getJSON<{ important: boolean }>("keep")
    check("durable entry survives volatile eviction", !!keep && keep.important === true)
    idbControl.setMaxRecords(Infinity)
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[4] Analytics event store — record / reload / ring-buffer cap")
  /* ---------------------------------------------------------------------- */
  {
    await eventStore.clearAll()
    eventStore.__resetSeqCacheForTests()
    // Record a handful, ensure they read back in order after a reload.
    for (let i = 0; i < 5; i += 1) {
      await eventStore.record("screen_view", { screen: `s${i}`, i })
    }
    idb.__resetDbForTests()
    eventStore.__resetSeqCacheForTests()
    const drained = await eventStore.drainForUpload(10)
    check("events persist across reload", drained.length === 5)
    check(
      "events are ordered by seq",
      drained.every((e, i) => e.seq === i + 1) && (drained[0]?.props?.screen === "s0"),
    )

    // Ack the first 2 → they should disappear.
    await eventStore.acknowledge([1, 2])
    const afterAck = await eventStore.count()
    check("acknowledge removes uploaded events", afterAck === 3)

    // Ring-buffer cap: monkeypatch a tiny cap by recording past it. We can't
    // change MAX_EVENTS at runtime, so prove the eviction PATH by checking that
    // count never exceeds MAX_EVENTS even after many records. Record a batch
    // and assert the count is bounded + newest survive.
    await eventStore.clearAll()
    eventStore.__resetSeqCacheForTests()
    const N = eventStore.MAX_EVENTS + 25
    for (let i = 0; i < N; i += 1) {
      await eventStore.record("ping", { i })
    }
    const finalCount = await eventStore.count()
    check(
      `ring-buffer cap holds (count ${finalCount} <= MAX ${eventStore.MAX_EVENTS})`,
      finalCount <= eventStore.MAX_EVENTS,
    )
    const tail = await eventStore.drainForUpload(eventStore.MAX_EVENTS)
    // The OLDEST should have been evicted: the smallest surviving seq > 25.
    const minSeq = Math.min(...tail.map((e) => e.seq))
    check("oldest events evicted (newest survive)", minSeq > 25)
  }

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error("harness crashed:", err)
  process.exit(2)
})
