// Tests for the preview/full classifier + preview enumeration in libraryStore.
//
//   node --experimental-strip-types --test corpan/packs/shared/catalog/src/libraryStore.test.ts
//
// libraryStore persists via zustand + localStorage, so we install a minimal
// in-memory localStorage shim before importing the module.

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"

// --- minimal browser shims (must exist before the store module loads) -------
class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v))
  }
  removeItem(k: string): void {
    this.m.delete(k)
  }
  clear(): void {
    this.m.clear()
  }
}
;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
  new MemoryStorage()
;(globalThis as unknown as { window: unknown }).window = globalThis

const {
  libraryStore,
  addInstalled,
  getInstalled,
  isPreviewInstalled,
  listPreviewNarrationIds,
  setNarrationFullness,
} = await import("./libraryStore.ts")

import type { CatalogNarrationEntry } from "./types.ts"
import type { SegmentsData } from "../../core/types.ts"

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

function segs(total: number, count: number, isPreview?: boolean): SegmentsData {
  return {
    version: "1",
    book_id: "b",
    total_segments: total,
    segments: Array.from({ length: count }, (_, i) => ({ id: String(i) })) as never,
    ...(isPreview === undefined ? {} : { is_preview: isPreview }),
  }
}

beforeEach(() => {
  libraryStore.setState({ narrations: {} })
})

test("addInstalled records the full flag", () => {
  addInstalled(entry("a"), true)
  addInstalled(entry("b"), false)
  addInstalled(entry("c")) // undefined
  assert.equal(getInstalled("a")?.full, true)
  assert.equal(getInstalled("b")?.full, false)
  assert.equal(getInstalled("c")?.full, undefined)
})

test("isPreviewInstalled fast-path uses the recorded flag (no disk read)", async () => {
  addInstalled(entry("full"), true)
  addInstalled(entry("prev"), false)
  let reads = 0
  const loader = async () => {
    reads++
    return segs(100, 100)
  }
  assert.equal(await isPreviewInstalled("full", loader), false)
  assert.equal(await isPreviewInstalled("prev", loader), true)
  assert.equal(reads, 0, "flagged records must not read segments.json")
})

test("legacy record (no flag) classifies via segments.json and backfills", async () => {
  addInstalled(entry("legacyPrev")) // no flag
  addInstalled(entry("legacyFull")) // no flag
  const result1 = await isPreviewInstalled("legacyPrev", async () =>
    segs(300, 100)
  ) // count < total → preview
  const result2 = await isPreviewInstalled("legacyFull", async () =>
    segs(100, 100)
  ) // count == total → full
  assert.equal(result1, true)
  assert.equal(result2, false)
  // Backfilled so a second call needs no read.
  assert.equal(getInstalled("legacyPrev")?.full, false)
  assert.equal(getInstalled("legacyFull")?.full, true)
})

test("is_preview flag in segments.json wins even when counts match", async () => {
  addInstalled(entry("flagged"))
  const r = await isPreviewInstalled("flagged", async () => segs(100, 100, true))
  assert.equal(r, true)
})

test("unreadable legacy pack returns 'unknown' and does not backfill", async () => {
  addInstalled(entry("broken"))
  const r = await isPreviewInstalled("broken", async () => {
    throw new Error("no tauri")
  })
  assert.equal(r, "unknown")
  assert.equal(getInstalled("broken")?.full, undefined)
})

test("isPreviewInstalled returns 'unknown' for a non-installed id", async () => {
  assert.equal(await isPreviewInstalled("ghost", async () => segs(1, 1)), "unknown")
})

test("listPreviewNarrationIds returns only flag=false records", () => {
  addInstalled(entry("p1"), false)
  addInstalled(entry("p2"), false)
  addInstalled(entry("f1"), true)
  addInstalled(entry("legacy")) // undefined — excluded (unknown without disk read)
  assert.deepEqual(listPreviewNarrationIds().sort(), ["p1", "p2"])
})

test("setNarrationFullness patches an existing record only", () => {
  addInstalled(entry("x"), false)
  setNarrationFullness("x", true)
  assert.equal(getInstalled("x")?.full, true)
  setNarrationFullness("missing", true) // no-op, no throw
  assert.equal(getInstalled("missing"), null)
})
