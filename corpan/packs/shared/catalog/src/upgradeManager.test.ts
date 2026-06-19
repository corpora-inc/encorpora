// Tests for the Corpán Plus preview→full upgrade manager.
//
//   node --experimental-strip-types --experimental-test-module-mocks \
//     --test corpan/packs/shared/catalog/src/upgradeManager.test.ts
//
// We mock the dependency modules (libraryStore, installManager, purchaseManager,
// catalogFetch) so the test exercises ONLY the upgrade orchestration —
// idempotency, the Plus gate, the unmetered/online sweep gate, concurrent-run
// guards, and the corpan:narration-upgraded event — with no zustand/Tauri.

// IMPORTANT: testGlobals MUST be the first import — its side effects install
// `window`/`navigator` (and `localStorage`) on globalThis before the module
// graph is evaluated.
import { navState, fakeWindow } from "./testGlobals.ts"
import { test, beforeEach, mock } from "node:test"
import assert from "node:assert/strict"
import type { CatalogNarrationEntry } from "./types.ts"

// --- controllable mock state ------------------------------------------------
let mockSubscribed = false
let installCalls: string[] = []
let installOk = true
let twoZipIds = new Set<string>()
let catalogEntries: CatalogNarrationEntry[] = []

// In-memory library mock (no zustand/localStorage in the unit). Mirrors the
// real libraryStore surface upgradeManager consumes.
type Rec = { narrationId: string; language: string; full?: boolean }
const libDb = new Map<string, Rec>()
const lib = {
  addInstalled(entryOrId: CatalogNarrationEntry | string, full?: boolean) {
    const id = typeof entryOrId === "string" ? entryOrId : entryOrId.id
    libDb.set(id, { narrationId: id, language: "es", ...(full === undefined ? {} : { full }) })
  },
  getInstalled(id: string) {
    return libDb.get(id) ?? null
  },
  setNarrationFullness(id: string, full: boolean) {
    const r = libDb.get(id)
    if (r) r.full = full
  },
  clear() {
    libDb.clear()
  },
}

mock.module("./libraryStore.ts", {
  namedExports: {
    isInstalled: (id: string) => libDb.has(id),
    getInstalled: (id: string) => lib.getInstalled(id),
    setNarrationFullness: (id: string, full: boolean) => lib.setNarrationFullness(id, full),
    listInstalled: () => [...libDb.values()],
    listPreviewNarrationIds: () =>
      [...libDb.values()].filter((r) => r.full === false).map((r) => r.narrationId),
    async isPreviewInstalled(id: string): Promise<boolean | "unknown"> {
      const r = libDb.get(id)
      if (!r) return "unknown"
      if (r.full === true) return false
      if (r.full === false) return true
      return "unknown"
    },
  },
})

mock.module("./installManager.ts", {
  namedExports: {
    isTwoZipEntry: (e: CatalogNarrationEntry) => twoZipIds.has(e.id),
    async installNarration(e: CatalogNarrationEntry) {
      installCalls.push(e.id)
      if (!installOk) return { ok: false, code: "DOWNLOAD_FAILED", message: "x" }
      // Simulate the atomic full install: flip the fullness flag like the real
      // installManager (addInstalled(entry, true)) does on the full path.
      lib.setNarrationFullness(e.id, true)
      return { ok: true }
    },
  },
})

mock.module("./purchaseManager.ts", {
  namedExports: {
    async isCurrentlySubscribed() {
      return { ok: true, entitled: mockSubscribed }
    },
  },
})

mock.module("./catalogFetch.ts", {
  namedExports: {
    async fetchCatalog() {
      return { version: 2, generatedAt: "", narrations: catalogEntries, gamePacks: [] }
    },
  },
})

const {
  upgradeNarration,
  upgradeActiveNarration,
  runUpgradeSweep,
  maybeUpgradeOnOpen,
  isLikelyUnmetered,
  isConfirmedUnmetered,
  canRunSweep,
  setUpgradeCatalogProvider,
  __resetUpgradeGuardsForTest,
} = await import("./upgradeManager.ts")

function entry(id: string): CatalogNarrationEntry {
  return {
    id,
    bookId: `book_${id}`,
    bookTitle: id,
    language: "es",
    voiceId: "ian",
    voiceName: "Ian",
    version: "1.0.0",
    sizeMb: 5,
  } as CatalogNarrationEntry
}

/** Install a preview narration (flag=false) + register it as a two-ZIP catalog entry. */
function seedPreview(id: string) {
  lib.addInstalled(entry(id), false)
  twoZipIds.add(id)
  catalogEntries.push(entry(id))
}

beforeEach(() => {
  lib.clear()
  mockSubscribed = false
  installCalls = []
  installOk = true
  twoZipIds = new Set()
  catalogEntries = []
  navState.online = true
  navState.connection = undefined
  setUpgradeCatalogProvider(() => catalogEntries)
  __resetUpgradeGuardsForTest()
})

// --- unmetered detection ----------------------------------------------------
// `isLikelyUnmetered` is the OPTIMISTIC read (unknown → true). It is NOT the
// sweep gate — the sweep gate is `isConfirmedUnmetered` (positive confirmation
// required; unknown → false → defer).

test("isLikelyUnmetered: API unavailable is optimistically true (not the sweep gate)", () => {
  navState.connection = undefined
  assert.equal(isLikelyUnmetered(), true)
})

test("isLikelyUnmetered: false on saveData / cellular / 2g / 3g", () => {
  navState.connection = { saveData: true }
  assert.equal(isLikelyUnmetered(), false)
  navState.connection = { type: "cellular" }
  assert.equal(isLikelyUnmetered(), false)
  navState.connection = { effectiveType: "2g" }
  assert.equal(isLikelyUnmetered(), false)
  navState.connection = { effectiveType: "3g" }
  assert.equal(isLikelyUnmetered(), false)
})

test("isLikelyUnmetered: true on wifi / 4g", () => {
  navState.connection = { type: "wifi", effectiveType: "4g" }
  assert.equal(isLikelyUnmetered(), true)
})

// --- positive-confirmation sweep gate ---------------------------------------

test("isConfirmedUnmetered: UNKNOWN link (connection undefined, e.g. iOS) → false (defer)", () => {
  navState.connection = undefined
  assert.equal(isConfirmedUnmetered(), false)
})

test("isConfirmedUnmetered: true only on a present, unmetered link (wifi/4g)", () => {
  navState.connection = { type: "wifi", effectiveType: "4g" }
  assert.equal(isConfirmedUnmetered(), true)
  navState.connection = { effectiveType: "4g" }
  assert.equal(isConfirmedUnmetered(), true)
})

test("isConfirmedUnmetered: false on saveData / cellular / 2g / slow-2g / 3g", () => {
  navState.connection = { saveData: true }
  assert.equal(isConfirmedUnmetered(), false)
  navState.connection = { type: "cellular" }
  assert.equal(isConfirmedUnmetered(), false)
  navState.connection = { effectiveType: "2g" }
  assert.equal(isConfirmedUnmetered(), false)
  navState.connection = { effectiveType: "slow-2g" }
  assert.equal(isConfirmedUnmetered(), false)
  navState.connection = { effectiveType: "3g" }
  assert.equal(isConfirmedUnmetered(), false)
})

test("canRunSweep matrix: run only when online + confirmed unmetered", () => {
  // confirmed unmetered + online → run
  navState.online = true
  navState.connection = { type: "wifi", effectiveType: "4g" }
  assert.equal(canRunSweep(), true)
  // cellular → defer
  navState.connection = { type: "cellular" }
  assert.equal(canRunSweep(), false)
  // saveData → defer
  navState.connection = { saveData: true }
  assert.equal(canRunSweep(), false)
  // 2g / 3g → defer
  navState.connection = { effectiveType: "2g" }
  assert.equal(canRunSweep(), false)
  navState.connection = { effectiveType: "3g" }
  assert.equal(canRunSweep(), false)
  // UNKNOWN link (no Network Info API) → defer (was the bug: used to run)
  navState.connection = undefined
  assert.equal(canRunSweep(), false)
  // offline even on confirmed wifi → defer
  navState.online = false
  navState.connection = { type: "wifi", effectiveType: "4g" }
  assert.equal(canRunSweep(), false)
})

// --- upgradeNarration idempotency + gating ----------------------------------

test("upgradeNarration: no-op when not subscribed", async () => {
  seedPreview("a")
  mockSubscribed = false
  const r = await upgradeNarration("a")
  assert.equal(r, false)
  assert.deepEqual(installCalls, [])
})

test("upgradeNarration: upgrades a preview when Plus, fires event, flips flag", async () => {
  seedPreview("a")
  mockSubscribed = true
  let fired: { narrationId?: string } | null = null
  fakeWindow.addEventListener("corpan:narration-upgraded", (e) => {
    fired = (e as CustomEvent).detail
  })
  const r = await upgradeNarration("a")
  assert.equal(r, true)
  assert.deepEqual(installCalls, ["a"])
  assert.equal(lib.getInstalled("a")?.full, true)
  assert.equal((fired as { narrationId?: string } | null)?.narrationId, "a")
})

test("upgradeNarration: idempotent no-op when already full", async () => {
  lib.addInstalled(entry("a"), true) // already full
  twoZipIds.add("a")
  catalogEntries.push(entry("a"))
  mockSubscribed = true
  const r = await upgradeNarration("a")
  assert.equal(r, false)
  assert.deepEqual(installCalls, [])
})

test("upgradeNarration: failed install leaves preview intact + no event", async () => {
  seedPreview("a")
  mockSubscribed = true
  installOk = false
  let fired = false
  fakeWindow.addEventListener("corpan:narration-upgraded", () => {
    fired = true
  })
  const r = await upgradeNarration("a")
  assert.equal(r, false)
  assert.equal(lib.getInstalled("a")?.full, false, "still a preview")
  assert.equal(fired, false)
})

test("upgradeNarration: not-installed id is a no-op", async () => {
  mockSubscribed = true
  assert.equal(await upgradeNarration("ghost"), false)
  assert.deepEqual(installCalls, [])
})

// --- sweep ------------------------------------------------------------------

test("runUpgradeSweep: upgrades all previews when Plus + wifi", async () => {
  seedPreview("a")
  seedPreview("b")
  lib.addInstalled(entry("c"), true) // already full — skipped
  mockSubscribed = true
  navState.connection = { type: "wifi" }
  await runUpgradeSweep()
  assert.deepEqual(installCalls.sort(), ["a", "b"])
})

test("runUpgradeSweep: defers (no installs, no throw) when cellular", async () => {
  seedPreview("a")
  mockSubscribed = true
  navState.connection = { type: "cellular" }
  await runUpgradeSweep()
  assert.deepEqual(installCalls, [], "cellular → deferred")
})

test("runUpgradeSweep: defers when saveData (Data Saver) is on", async () => {
  seedPreview("a")
  mockSubscribed = true
  navState.connection = { saveData: true }
  await runUpgradeSweep()
  assert.deepEqual(installCalls, [], "saveData → deferred")
})

test("runUpgradeSweep: defers on 2g / 3g", async () => {
  seedPreview("a")
  mockSubscribed = true
  navState.connection = { effectiveType: "2g" }
  await runUpgradeSweep()
  assert.deepEqual(installCalls, [], "2g → deferred")
  navState.connection = { effectiveType: "3g" }
  await runUpgradeSweep()
  assert.deepEqual(installCalls, [], "3g → deferred")
})

test("runUpgradeSweep: DEFERS when metering unknown (connection undefined, e.g. iOS)", async () => {
  // The reviewer bug: previously the sweep PROCEEDED here, bulk-downloading
  // every preview on iOS even on cellular. It must now defer to the JIT layer.
  seedPreview("a")
  seedPreview("b")
  mockSubscribed = true
  navState.connection = undefined
  await runUpgradeSweep()
  assert.deepEqual(installCalls, [], "unknown link → deferred (no background pre-fetch)")
})

test("runUpgradeSweep: defers when offline", async () => {
  seedPreview("a")
  mockSubscribed = true
  navState.online = false
  await runUpgradeSweep()
  assert.deepEqual(installCalls, [])
})

test("runUpgradeSweep: no-op when not subscribed", async () => {
  seedPreview("a")
  mockSubscribed = false
  await runUpgradeSweep()
  assert.deepEqual(installCalls, [])
})

test("runUpgradeSweep: concurrent runs don't double-download", async () => {
  seedPreview("a")
  seedPreview("b")
  mockSubscribed = true
  navState.connection = { type: "wifi" }
  await Promise.all([runUpgradeSweep(), runUpgradeSweep()])
  assert.deepEqual(installCalls.sort(), ["a", "b"], "each upgraded exactly once")
})

// --- Layer 1: active-book upgrade (any connection, no sweep gate) -----------

test("upgradeActiveNarration: upgrades the active book even on cellular (any connection)", async () => {
  seedPreview("a")
  mockSubscribed = true
  navState.connection = { type: "cellular" } // the sweep gate would defer here
  const r = await upgradeActiveNarration("a")
  assert.equal(r, true, "active book upgrades regardless of metering")
  assert.deepEqual(installCalls, ["a"])
})

test("upgradeActiveNarration: upgrades when metering is unknown (iOS)", async () => {
  seedPreview("a")
  mockSubscribed = true
  navState.connection = undefined
  const r = await upgradeActiveNarration("a")
  assert.equal(r, true)
  assert.deepEqual(installCalls, ["a"])
})

// --- Layer 3: JIT on open (any connection, no sweep gate) -------------------

test("maybeUpgradeOnOpen: upgrades a just-opened preview when Plus", async () => {
  seedPreview("a")
  mockSubscribed = true
  const r = await maybeUpgradeOnOpen("a")
  assert.equal(r, true)
  assert.deepEqual(installCalls, ["a"])
})

test("maybeUpgradeOnOpen: upgrades on cellular / unknown link (any connection)", async () => {
  seedPreview("a")
  mockSubscribed = true
  navState.connection = { type: "cellular" }
  assert.equal(await maybeUpgradeOnOpen("a"), true, "JIT ignores the sweep gate")
  assert.deepEqual(installCalls, ["a"])

  // and on an unknown link (iOS) too
  installCalls = []
  seedPreview("b")
  navState.connection = undefined
  assert.equal(await maybeUpgradeOnOpen("b"), true)
  assert.deepEqual(installCalls, ["b"])
})

test("maybeUpgradeOnOpen: no-op for a full narration", async () => {
  lib.addInstalled(entry("a"), true)
  twoZipIds.add("a")
  catalogEntries.push(entry("a"))
  mockSubscribed = true
  assert.equal(await maybeUpgradeOnOpen("a"), false)
  assert.deepEqual(installCalls, [])
})
