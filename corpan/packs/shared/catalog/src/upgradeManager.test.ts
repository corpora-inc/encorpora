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
  runUpgradeSweep,
  maybeUpgradeOnOpen,
  isLikelyUnmetered,
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

test("isLikelyUnmetered: API unavailable (iOS) proceeds best-effort", () => {
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

test("canRunSweep: false when offline even on wifi", () => {
  navState.online = false
  navState.connection = { type: "wifi" }
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

test("runUpgradeSweep: defers (no installs, no throw) when metered", async () => {
  seedPreview("a")
  mockSubscribed = true
  navState.connection = { type: "cellular" }
  await runUpgradeSweep()
  assert.deepEqual(installCalls, [], "metered → deferred")
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

// --- JIT --------------------------------------------------------------------

test("maybeUpgradeOnOpen: upgrades a just-opened preview when Plus", async () => {
  seedPreview("a")
  mockSubscribed = true
  const r = await maybeUpgradeOnOpen("a")
  assert.equal(r, true)
  assert.deepEqual(installCalls, ["a"])
})

test("maybeUpgradeOnOpen: no-op for a full narration", async () => {
  lib.addInstalled(entry("a"), true)
  twoZipIds.add("a")
  catalogEntries.push(entry("a"))
  mockSubscribed = true
  assert.equal(await maybeUpgradeOnOpen("a"), false)
  assert.deepEqual(installCalls, [])
})
