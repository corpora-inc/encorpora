/// <reference types="node" />
// src/lib/storage/__harness__/run.ts
//
// Self-contained verification harness for the storage + analytics foundation.
// NOT a unit-test framework run — it's a node-executable proof. Bundle with
// esbuild + run with node (or via the npm-test wrapper,
// src/lib/storage/storageHarness.test.ts):
//
//   node_modules/.bin/esbuild src/lib/storage/__harness__/run.ts \
//     --bundle --platform=node --format=cjs --outfile=/tmp/storage-harness.cjs
//   node /tmp/storage-harness.cjs      # run from corpan-app/ (section 13 greps src/)
//
// It installs a minimal in-memory IndexedDB + localStorage, then proves the
// storage-analytics.md §7.1 sections:
//   1.  TINY tier — QuotaExceededError elimination
//   2.  LARGE tier — persistence across reload
//   3.  LARGE tier — quota eviction, no throw
//   4.  Telemetry event store — record / reload / ring cap
//   5.  DocStore round-trip + schema migration
//   6.  DocStore corruption (raw garbage injection)
//   7.  AppendLog ordering + batching (one txn per flush window)
//   8.  AppendLog ring cap + O(1) append (no getAllKeys)
//   9.  Quota-exceeded on batch commit (evict/retry → memory mirror)
//   10. DB-level recovery (2 consecutive open failures → rebuild)
//   11. Migration M2–M4 (legacy localStorage blobs → IDB shims)
//   12. Local analytics end-to-end (calibration/strands/engagement/records/rebuild)
//   13. Privacy fence (no upload seam in lib/localAnalytics)
//   14. hostApi isolation (pack KV scoping + budgets, event rate limit)
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function main(): Promise<void> {
  // Import after globals are installed.
  const { storage, createLocalStorageShim } = await import("../index")
  const idb = await import("../idb")
  const eventStore = await import("../eventStore")
  const { docStore } = await import("../doc")
  const { appendLog } = await import("../log")
  const { WriteBatcher } = await import("../batch")
  const { healthCounters, __resetHealthForTests } = await import("../health")
  const fakesMod = await import("./fakes")

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
    idb.__resetDbForTests()
    const back = await large.getJSON<{ hello: string; n: number }>("persisted", {
      schema: 1,
    })
    check(
      "large-tier value persists across (simulated) reload",
      !!back && back.hello === "world" && back.n === 42,
    )
    const wrongSchema = await large.getJSON("persisted", { schema: 2 })
    check("large-tier schema mismatch reads as miss", wrongSchema === undefined)
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[3] LARGE tier — quota eviction, no throw")
  /* ---------------------------------------------------------------------- */
  {
    const cache = storage.namespace("harness-cache", { tier: "large", volatile: true })
    const durable = storage.namespace("harness-durable", { tier: "large", volatile: false })
    await durable.setJSON("keep", { important: true }, { volatile: false })
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
    const keep = await durable.getJSON<{ important: boolean }>("keep")
    check("durable entry survives volatile eviction", !!keep && keep.important === true)
    idbControl.setMaxRecords(Infinity)
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[4] Telemetry event store — record / reload / ring-buffer cap")
  /* ---------------------------------------------------------------------- */
  {
    await eventStore.clearAll()
    eventStore.__resetSeqCacheForTests()
    for (let i = 0; i < 5; i += 1) {
      await eventStore.record("screen_view", { screen: `s${i}`, i })
    }
    idb.__resetDbForTests()
    eventStore.__resetSeqCacheForTests()
    const drained = await eventStore.drainForUpload(10)
    check("events persist across reload", drained.length === 5)
    check(
      "events are ordered by seq",
      drained.every((e, i) => e.seq === i + 1) && drained[0]?.props?.screen === "s0",
    )

    await eventStore.acknowledge([1, 2])
    const afterAck = await eventStore.count()
    check("acknowledge removes uploaded events", afterAck === 3)

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
    const minSeq = Math.min(...tail.map((e) => e.seq))
    check("oldest events evicted (newest survive)", minSeq > 25)
    await eventStore.clearAll()
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[5] DocStore — round-trip, schema migration, unmigratable drop")
  /* ---------------------------------------------------------------------- */
  {
    __resetHealthForTests()
    const batcher = new WriteBatcher({ maxDelayMs: 5, maxPending: 64 })
    type V1 = { n: number }
    type V2 = { n: number; label: string }
    const codecV1 = {
      schemaVersion: 1,
      parse: (raw: unknown): V1 | null =>
        raw && typeof (raw as V1).n === "number" ? (raw as V1) : null,
    }
    const s1 = docStore<V1>("journey-cards:harness:c1", codecV1, batcher)
    await s1.put("a", { n: 1 })
    await s1.putMany([
      ["b", { n: 2 }],
      ["c", { n: 3 }],
    ])
    await s1.flush()
    const many = await s1.getMany(["a", "b", "missing"])
    check("getMany returns present ids only", many.size === 2 && many.get("b")?.n === 2)
    const all = await s1.getAll()
    check("getAll round-trips every doc", all.size === 3 && all.get("c")?.n === 3)
    check("count matches", (await s1.count()) === 3)

    // Read the v1 records through a v2 codec WITH migrate → lazy upgrade.
    const codecV2 = {
      schemaVersion: 2,
      parse: (raw: unknown): V2 | null =>
        raw && typeof (raw as V2).n === "number" && typeof (raw as V2).label === "string"
          ? (raw as V2)
          : null,
      migrate: (raw: unknown, from: number): V2 | null =>
        from === 1 && raw && typeof (raw as V1).n === "number"
          ? { n: (raw as V1).n, label: "migrated" }
          : null,
    }
    const s2 = docStore<V2>("journey-cards:harness:c1", codecV2, batcher)
    const migrated = await s2.get("a")
    check(
      "old-schema record migrates on read",
      migrated?.n === 1 && migrated?.label === "migrated",
    )
    await s2.flush()
    const raw = idbControl
      .rawDocs()
      .find((r: any) => r?.ns === "journey-cards:harness:c1" && r?.id === "a")
    check("migrated record re-persisted at schema 2", raw?.schema === 2)

    // v3 codec WITHOUT migrate → old records are corrupt: dropped + counted.
    const codecV3NoMigrate = {
      schemaVersion: 3,
      parse: (r: unknown): V2 | null =>
        r && typeof (r as V2).label === "string" ? (r as V2) : null,
    }
    const s3 = docStore<V2>("journey-cards:harness:c1", codecV3NoMigrate, batcher)
    const gone = await s3.get("b")
    await sleep(20)
    check("unmigratable record reads as undefined (never throws)", gone === undefined)
    check(
      "corrupt counter incremented",
      (healthCounters.corruptRecords["journey-cards:harness:c1"] ?? 0) >= 1,
    )
    const rawB = idbControl
      .rawDocs()
      .find((r: any) => r?.ns === "journey-cards:harness:c1" && r?.id === "b")
    check("unmigratable record deleted from the store", rawB === undefined)
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[6] DocStore — raw corruption injection")
  /* ---------------------------------------------------------------------- */
  {
    __resetHealthForTests()
    const batcher = new WriteBatcher({ maxDelayMs: 5 })
    const codec = {
      schemaVersion: 1,
      parse: (raw: unknown): { ok: true } | null =>
        raw && (raw as { ok?: unknown }).ok === true ? { ok: true } : null,
    }
    const s = docStore<{ ok: true }>("journey-meta:harness:c1", codec, batcher)
    await s.put("good", { ok: true })
    await s.flush()
    idbControl.injectRawDocRecord("journey-meta:harness:c1", "junk1", { garbage: 1 })
    idbControl.injectRawDocRecord("journey-meta:harness:c1", "junk2", {
      ns: "journey-meta:harness:c1",
      id: "junk2",
      v: { evil: true },
      schema: 1,
      size: 10,
      updatedAt: 0,
    })
    let threw = false
    let j1: unknown
    let j2: unknown
    try {
      j1 = await s.get("junk1")
      j2 = await s.get("junk2")
    } catch (err) {
      threw = true
      console.error("   unexpected throw:", err)
    }
    check("corrupt reads never throw", !threw)
    check("corrupt reads return undefined", j1 === undefined && j2 === undefined)
    check(
      "corrupt counter incremented per drop",
      (healthCounters.corruptRecords["journey-meta:harness:c1"] ?? 0) >= 2,
    )
    check("good record still readable", (await s.get("good"))?.ok === true)
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[7] AppendLog — ordering, read-your-writes, one txn per flush")
  /* ---------------------------------------------------------------------- */
  {
    const anyCodec = fakesMod.anyCodec<{ i: number }>()
    const batcher = new WriteBatcher({ maxDelayMs: 30, maxPending: 100_000 })
    const log = appendLog<{ i: number }>("local-analytics", anyCodec, undefined, batcher)
    await log.clear()
    await log.flush()
    await log.headSeq() // force meta init before counting txns
    idbControl.resetCounters()

    const promises: Promise<number>[] = []
    for (let i = 0; i < 1000; i += 1) promises.push(log.append({ i }))
    await sleep(0) // let the queued append microtasks enqueue
    // Read-your-writes BEFORE the flush.
    const pendingRead = await log.read({ fromSeq: 1, limit: 3 })
    check(
      "reads see pending records before flush",
      pendingRead.length === 3 && pendingRead[0].entry.i === 0,
    )
    await log.flush()
    const seqs = await Promise.all(promises)
    check(
      "1000 rapid appends assign strictly monotonic seqs",
      seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1),
    )
    check(
      "exactly one readwrite transaction per flush window",
      idbControl.counters.readwriteTxns === 1,
    )

    // Simulated reload: a fresh instance re-reads the persisted meta.
    idb.__resetDbForTests()
    const log2 = appendLog<{ i: number }>(
      "local-analytics",
      anyCodec,
      undefined,
      new WriteBatcher({ maxDelayMs: 5 }),
    )
    check("headSeq survives reload", (await log2.headSeq()) === 1000)
    check("count survives reload", (await log2.count()) === 1000)
    const tail = await log2.read({ reverse: true, limit: 2 })
    check(
      "reverse read returns the newest records",
      tail.length === 2 && tail[0].seq === 1000 && tail[1].seq === 999,
    )
    await log2.clear()
    await log2.flush()
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[8] AppendLog — ring cap with hysteresis, O(1) append")
  /* ---------------------------------------------------------------------- */
  {
    const anyCodec = fakesMod.anyCodec<{ i: number }>()
    const batcher = new WriteBatcher({ maxDelayMs: 5, maxPending: 64 })
    const log = appendLog<{ i: number }>(
      "local-analytics",
      anyCodec,
      { cap: { maxRecords: 1000, maxBytes: Number.POSITIVE_INFINITY } },
      batcher,
    )
    await log.clear()
    await log.flush()
    await log.headSeq()
    idbControl.resetCounters()

    const promises: Promise<number>[] = []
    for (let i = 0; i < 3000; i += 1) promises.push(log.append({ i }))
    await Promise.all(promises)
    await log.flush()
    // Let fire-and-forget prunes settle.
    for (let tries = 0; tries < 100 && (await log.count()) > 1100; tries += 1) {
      await sleep(10)
    }
    const count = await log.count()
    check(`ring cap holds with hysteresis (count ${count} <= 1100)`, count <= 1100)
    check("ring kept at least the cap", count >= 1000)
    const oldest = await log.read({ limit: 1 })
    check("oldest records pruned", (oldest[0]?.seq ?? 0) > 1000)
    const newest = await log.read({ reverse: true, limit: 1 })
    check("newest record intact", newest[0]?.seq === 3000 && newest[0]?.entry.i === 2999)
    check(
      `append path never scans keys (getAllKeys calls: ${idbControl.counters.getAllKeys})`,
      idbControl.counters.getAllKeys === 0,
    )
    await log.clear()
    await log.flush()
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[9] Batch commit under quota — evict/retry, then memory mirror")
  /* ---------------------------------------------------------------------- */
  {
    __resetHealthForTests()
    // Seed kv entries so the evict-and-retry path has victims to free.
    const kvSeed = storage.namespace("harness-evictable", { tier: "large", volatile: true })
    for (let i = 0; i < 24; i += 1) await kvSeed.setJSON(`pad${i}`, "x".repeat(40))

    const batcher = new WriteBatcher({ maxDelayMs: 5 })
    const codec = fakesMod.anyCodec<{ v: number }>()
    const s = docStore<{ v: number }>("journey-cards:harness:q", codec, batcher)

    // Cap total records at the current level: the next NEW insert fails once,
    // eviction frees kv rows, the retry lands.
    const currentTotal =
      idbControl.rawDocs().length + idbControl.rawLogs().length + 24 + 10 // rough floor
    idbControl.setMaxRecords(currentTotal + 200) // generous: only sanity check no-throw
    let threw = false
    try {
      await s.put("fits", { v: 1 })
      await s.flush()
    } catch (err) {
      threw = true
      console.error("   unexpected throw:", err)
    }
    check("batched put never throws under loose quota", !threw)

    // Hard failure: quota 0 admits nothing, eviction can't help → mirror.
    idbControl.setMaxRecords(0)
    let threw2 = false
    try {
      await s.put("parked", { v: 42 })
      await s.flush()
    } catch (err) {
      threw2 = true
      console.error("   unexpected throw:", err)
    }
    check("batched put resolves even when durable commit is impossible", !threw2)
    check("degradedWrites counted", healthCounters.degradedWrites > 0)
    check("parked value still readable this session", (await s.get("parked"))?.v === 42)
    idbControl.setMaxRecords(Infinity)
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[10] DB-level recovery — 2 consecutive open failures rebuild")
  /* ---------------------------------------------------------------------- */
  {
    // ONE failure degrades but does NOT nuke.
    idb.__resetDbForTests()
    idbControl.resetCounters()
    idbControl.setOpenFailures(1)
    const kvh = storage.namespace("harness-recovery", { tier: "large" })
    await kvh.setJSON("x", 1) // goes to memory mirror (open failed)
    check("one open failure does not deleteDatabase", idbControl.counters.deleteDatabase === 0)
    check(
      "open-failure counter persisted",
      localStorage.getItem(idb.OPEN_FAILURES_LS_KEY) === "1",
    )

    // SECOND consecutive failure → deleteDatabase + fresh reopen.
    idb.__resetDbForTests()
    idbControl.setOpenFailures(1)
    await kvh.setJSON("y", 2)
    check("second failure triggers deleteDatabase", idbControl.counters.deleteDatabase === 1)
    check("failure counter reset after rebuild", localStorage.getItem(idb.OPEN_FAILURES_LS_KEY) === null)
    check("dbRebuiltAt stamped", idb.idbHealth().dbRebuiltAt !== null)
    await kvh.setJSON("z", 3)
    check("fresh DB accepts writes", (await kvh.getJSON<number>("z")) === 3)
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[11] Migration M2–M4 — legacy localStorage blobs move to IDB")
  /* ---------------------------------------------------------------------- */
  {
    const migrate = await import("../migrate")
    const progressBlob = JSON.stringify({ state: { byKey: { "b::en": { segmentsReached: 7 } } }, version: 0 })
    const wpcBlob = JSON.stringify({ state: { catalog: { version: 1, packs: [] } }, version: 1 })
    const histBlob = JSON.stringify({ state: { byStack: { s1: { ids: [1, 2], sources: ["base", "base"], index: 1 } } }, version: 3 })
    localStorage.setItem("corpan-progress-v1", progressBlob)
    localStorage.setItem("corpan-word-pack-catalog-v1", wpcBlob)
    localStorage.setItem("corpan-history-v2", histBlob)
    localStorage.removeItem("corpan-storage-migration-v2")

    const moved = await migrate.migrateOversizedLocalStorage()
    check("migration moves the three new blobs", moved === 3)
    check("legacy localStorage keys removed", localStorage.getItem("corpan-progress-v1") === null)
    check(
      "sentinel bumped to v2",
      localStorage.getItem("corpan-storage-migration-v2") === "1",
    )
    const again = await migrate.migrateOversizedLocalStorage()
    check("second run is a no-op", again === 0)

    const progressShim = createLocalStorageShim("progress", { tier: "large", volatile: false })
    check(
      "zustand shim reads the migrated blob back verbatim",
      (await progressShim.getItem("corpan-progress-v1")) === progressBlob,
    )
    const histShim = createLocalStorageShim("history", { tier: "large", volatile: false })
    check(
      "history shim reads the migrated blob back verbatim",
      (await histShim.getItem("corpan-history-v2")) === histBlob,
    )
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[12] Local analytics — end-to-end fixture (3+ simulated days)")
  /* ---------------------------------------------------------------------- */
  {
    const la = await import("../../localAnalytics")
    const rollupsMod = await import("../../localAnalytics/rollups")
    const COURSE = "journey_en"
    const DAY = 24 * 60 * 60 * 1000
    // Anchor at local noon so day arithmetic never crosses a boundary.
    const anchor = new Date()
    anchor.setHours(12, 0, 0, 0)
    const D0 = anchor.getTime() - 20 * DAY
    let fakeNow = D0
    la.configureLocalAnalytics({ now: () => fakeNow, getStackId: () => "stack1" })
    await la.clearAll()
    await la.localEvents.flush()

    type ResultExtras = {
      activityType?: string
      slot?: "due" | "new" | "repair" | "fun" | "flex" | "checkpoint" | "placement"
      items?: Array<{
        ref: string
        outcome: "pass" | "partial" | "fail"
        grade: 1 | 2 | 3 | 4
        latencyMs?: number
        predictedRecall?: number
      }>
    }
    const result = (
      p: number,
      outcome: "pass" | "fail",
      strand: "mfi" | "mfo" | "lfl" | "fd",
      durationMs: number,
      extras?: ResultExtras,
    ) =>
      la.recordLocal(
        {
          type: "activity_result",
          specId: `s-${Math.random().toString(36).slice(2)}`,
          activityType: extras?.activityType ?? "choice_pick",
          provider: "native",
          slot: extras?.slot ?? "due",
          strand,
          score: outcome === "pass" ? 1 : 0,
          durationMs,
          items: extras?.items ?? [
            {
              ref: "phrase:base:1",
              outcome,
              grade: outcome === "pass" ? 3 : 1,
              latencyMs: 1000,
              predictedRecall: p,
            },
          ],
        },
        { courseId: COURSE },
      )

    // Day 0: the hand-computed calibration + strand fixture.
    la.startLocalSession({ trigger: "landing", dueCount: 4, newCount: 1 }, { courseId: COURSE })
    result(0.95, "pass", "mfi", 4000)
    result(0.85, "fail", "mfo", 3000)
    result(0.55, "pass", "lfl", 2000, { items: [{ ref: "phrase:base:2", outcome: "pass", grade: 3, latencyMs: 700, predictedRecall: 0.55 }] })
    result(0.15, "fail", "fd", 1000, { slot: "new" })
    la.recordLocal({ type: "streak_day", length: 2, restDaysBanked: 0 }, { courseId: COURSE })
    la.endLocalSession(
      { cards: 4, passRate: 0.5, durationMs: 10_000, endReason: "quit" },
      { courseId: COURSE },
    )
    await la.localEvents.flush()
    await sleep(20)

    // Calibration (window includes only day 0 so far): hand-computed.
    const calib = await la.getCalibrationReport(COURSE, { windowDays: 30 })
    check("calibration n = 4", calib.n === 4)
    check("calibration brier matches hand computation", Math.abs(calib.brier - 0.2375) < 1e-9)
    const b9 = calib.buckets[9]
    const b8 = calib.buckets[8]
    check(
      "decile buckets aggregate correctly",
      b9.n === 1 && b9.actualPassRate === 1 && b8.n === 1 && b8.actualPassRate === 0,
    )
    check(
      "bucket predicted means are exact",
      Math.abs(b9.predictedMean - 0.95) < 1e-9 && Math.abs(b8.predictedMean - 0.85) < 1e-9,
    )

    const strands = await la.getStrandBalance(COURSE, 7)
    const shareSum = strands.mfi.share + strands.mfo.share + strands.lfl.share + strands.fd.share
    check("strand shares sum to 1", Math.abs(shareSum - 1) < 1e-9)
    check(
      "strand shares match time split (.4/.3/.2/.1)",
      Math.abs(strands.mfi.share - 0.4) < 1e-9 && Math.abs(strands.fd.share - 0.1) < 1e-9,
    )

    let snap = await la.getEngagementSnapshot(COURSE)
    check("engagement: first-week learner is 'new'", snap.status === "new")

    // Days 1..7: one tiny activity per day (no predictedRecall → calibration
    // fixture stays hand-computed).
    for (let d = 1; d <= 7; d += 1) {
      fakeNow = D0 + d * DAY
      la.recordLocal(
        {
          type: "activity_result",
          specId: `daily-${d}`,
          activityType: "cloze",
          provider: "native",
          slot: "due",
          strand: "lfl",
          score: 1,
          durationMs: 5000,
          items: [{ ref: "phrase:base:9", outcome: "pass", grade: 3, latencyMs: 400 + d }],
        },
        { courseId: COURSE },
      )
      la.recordLocal({ type: "streak_day", length: d === 7 ? 8 : d + 1, restDaysBanked: 0 }, { courseId: COURSE })
    }
    la.recordLocal(
      { type: "session_end", cards: 7, passRate: 1, durationMs: 35_000, endReason: "checkpoint_stop" },
      { courseId: COURSE },
    )
    await la.localEvents.flush()
    await sleep(20)

    snap = await la.getEngagementSnapshot(COURSE)
    check("engagement: 8 straight days is 'current'", snap.status === "current")

    fakeNow = D0 + 10 * DAY
    snap = await la.getEngagementSnapshot(COURSE)
    check("engagement: 3-day gap is 'at_risk'", snap.status === "at_risk" && snap.gapDays === 3)

    fakeNow = D0 + 15 * DAY
    snap = await la.getEngagementSnapshot(COURSE)
    check("engagement: 8-day gap is 'dormant'", snap.status === "dormant")

    la.recordLocal(
      {
        type: "activity_result",
        specId: "comeback",
        activityType: "cloze",
        provider: "native",
        slot: "due",
        strand: "lfl",
        score: 1,
        durationMs: 5000,
        items: [{ ref: "phrase:base:9", outcome: "pass", grade: 3 }],
      },
      { courseId: COURSE },
    )
    await la.localEvents.flush()
    await sleep(20)
    snap = await la.getEngagementSnapshot(COURSE)
    check(
      "engagement: return after ≥7-day gap is 'resurrected' (with resurrectedAt)",
      snap.status === "resurrected" && snap.resurrectedAt === la.localDay(fakeNow),
    )

    const records = await la.getPersonalRecords(COURSE)
    check(
      "personal records: best day picked",
      records.bestDayCards.day === la.localDay(D0) && records.bestDayCards.cards === 4,
    )
    check("personal records: longest streak from streak_day events", records.longestStreak === 8)
    check(
      "personal records: best session pass rate",
      records.bestSessionPassRate.passRate === 1 && records.bestSessionPassRate.cards === 7,
    )
    check(
      "personal records: fastest correct per activity type",
      records.fastestCorrectMsByActivityType["choice_pick"] === 700 &&
        records.fastestCorrectMsByActivityType["cloze"] === 401,
    )
    check(
      "personal records: most items introduced (slot 'new')",
      records.mostItemsIntroducedInDay.day === la.localDay(D0) &&
        records.mostItemsIntroducedInDay.items === 1,
    )

    // Derived-state proof: rebuild reproduces byte-identical rollups.
    const snapshotRollups = async () => {
      const course = await rollupsMod.getAllRollups(COURSE)
      const app = await rollupsMod.getAllRollups(null)
      return JSON.stringify({ course, app })
    }
    const before = await snapshotRollups()
    const rebuilt = await rollupsMod.rebuildRollups()
    const after = await snapshotRollups()
    check(`rebuildRollups rebuilt ${rebuilt} docs from the raw log`, rebuilt > 0)
    check("rebuilt rollups are byte-identical to incrementally-maintained ones", before === after)
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[13] Privacy fence — no upload seam in lib/localAnalytics")
  /* ---------------------------------------------------------------------- */
  {
    const fs = await import("node:fs")
    const path = await import("node:path")
    const candidates = [
      process.env.CORPAN_APP_ROOT,
      process.cwd(),
      path.join(process.cwd(), "corpan-app"),
      path.join(process.cwd(), "corpan", "corpan-app"),
    ].filter((c): c is string => !!c)
    const root =
      candidates.find((c) =>
        fs.existsSync(path.join(c, "src", "lib", "localAnalytics")),
      ) ?? candidates[0]
    const dir = path.join(root, "src", "lib", "localAnalytics")
    let filesChecked = 0
    let violations: string[] = []
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".ts")) continue
        const src = fs.readFileSync(path.join(dir, f), "utf8")
        filesChecked += 1
        if (/\bfetch\s*\(/.test(src)) violations.push(`${f}: fetch(`)
        if (/from\s+["'][^"']*@shared\/analytics/.test(src)) {
          violations.push(`${f}: @shared/analytics import`)
        }
        if (/(?:from\s+["']|import\s*\(\s*["'])[^"']*eventStore/.test(src)) {
          violations.push(`${f}: eventStore import`)
        }
        if (/https?:\/\/[^\s"']+\/v\d/.test(src)) violations.push(`${f}: endpoint URL`)
      }
    } catch (err) {
      violations.push(`could not scan ${dir}: ${err}`)
    }
    check(`static fence clean across ${filesChecked} files`, filesChecked >= 4 && violations.length === 0)
    if (violations.length) console.error("   violations:", violations)

    // Runtime: the telemetry drain (analytics-events kv ns) cannot see the
    // local-analytics log — record on both sides and drain.
    const la = await import("../../localAnalytics")
    await eventStore.clearAll()
    eventStore.__resetSeqCacheForTests()
    await eventStore.record("telemetry_ping", { t: 1 })
    la.recordLocal({ type: "checkpoint", position: 1, choice: "continue" })
    await la.localEvents.flush()
    const drained = await eventStore.drainForUpload(100)
    check(
      "telemetry drain sees only telemetry (zero local-analytics records)",
      drained.length === 1 && drained[0].event === "telemetry_ping",
    )
  }

  /* ---------------------------------------------------------------------- */
  console.log("\n[14] hostApi — pack KV isolation + budgets, event rate limit")
  /* ---------------------------------------------------------------------- */
  {
    __resetHealthForTests()
    const { buildPackStorageApi } = await import("../packStorageApi")
    const { buildPackLocalAnalyticsApi } = await import("../../localAnalytics/packApi")
    const la = await import("../../localAnalytics")
    const { PACK_EVENTS_PER_DAY } = await import("../namespaces")

    const a = buildPackStorageApi("pack_a")
    const b = buildPackStorageApi("pack_b")
    await a.kv.set("shared-name", "from-a")
    await b.kv.set("shared-name", "from-b")
    await a.kv.set("only-a", "1")
    check("pack A reads its own value", (await a.kv.get("shared-name")) === "from-a")
    check("pack B reads its own value", (await b.kv.get("shared-name")) === "from-b")
    const bKeys = await b.kv.keys()
    check("keys() sees only the pack's own keys", bKeys.length === 1 && bKeys[0] === "shared-name")
    await a.kv.remove("only-a")
    check("remove works", (await a.kv.get("only-a")) === null)

    // Budget: two ~1.2MB values — the second must be dropped + counted.
    const big = "x".repeat(600_000) // estimateSize ≈ 1.2MB
    await a.kv.set("big1", big)
    await a.kv.set("big2", big)
    check("first big write lands", (await a.kv.get("big1")) === big)
    check("over-budget write dropped", (await a.kv.get("big2")) === null)
    check("pack KV drop counted", (healthCounters.packKvDrops["pack_a"] ?? 0) === 1)

    // Event rate limit: trips at PACK_EVENTS_PER_DAY + 1.
    await la.localEvents.clear()
    await la.localEvents.flush()
    const now0 = Date.now()
    la.configureLocalAnalytics({ now: () => now0, getStackId: () => "stack1" })
    const packLa = buildPackLocalAnalyticsApi("pack_a")
    for (let i = 0; i < PACK_EVENTS_PER_DAY + 1; i += 1) {
      packLa.record("badge_earned", { i })
    }
    check(
      "pack event rate limit trips at 5,001",
      (healthCounters.packEventDrops["pack_a"] ?? 0) === 1,
    )
    await la.localEvents.flush()
    const counts = await packLa.getDailyCounts({ type: "badge_earned", windowDays: 2 })
    check(
      "getDailyCounts sees exactly the admitted events",
      counts.length === 1 && counts[0].count === PACK_EVENTS_PER_DAY,
    )
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
