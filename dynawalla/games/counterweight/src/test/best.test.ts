// The tally has to survive a storage that is not there — which, inside a pack
// frame, is the normal case rather than the edge one.

import assert from "node:assert/strict"
import { test } from "node:test"

import { loadTally, recordTally, resetTallyForTest } from "../game/best.ts"

type Slot = { value: string | null; throwOnRead?: boolean; throwOnWrite?: boolean }

function withStorage(slot: Slot | null, body: () => void): void {
  const had = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  const fake =
    slot === null
      ? undefined
      : {
          getItem() {
            if (slot.throwOnRead) throw new Error("opaque origin")
            return slot.value
          },
          setItem(_key: string, value: string) {
            if (slot.throwOnWrite) throw new Error("quota")
            slot.value = value
          },
        }
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: fake,
  })
  try {
    body()
  } finally {
    if (had) Object.defineProperty(globalThis, "localStorage", had)
    else Reflect.deleteProperty(globalThis, "localStorage")
  }
}

/**
 * A storage that actually distinguishes its keys.
 *
 * `withStorage` above deliberately does not — it is testing the throw paths and
 * one slot is enough for those — but the v1→v2 carry-over is *about* two keys, so
 * it cannot be measured through a fake that answers both the same.
 */
function withKeyedStorage(entries: Record<string, string>, body: () => void): void {
  const had = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => entries[key] ?? null,
      setItem: (key: string, value: string) => {
        entries[key] = value
      },
    },
  })
  try {
    body()
  } finally {
    if (had) Object.defineProperty(globalThis, "localStorage", had)
    else Reflect.deleteProperty(globalThis, "localStorage")
  }
}

test("a record written before the rename is carried across, not orphaned", () => {
  // The slot went `v1` → `v2` because the count used to be keyed `turks`, and a v1
  // record read as a v2 one reports zero cleared scales. Bumping the version is
  // right; losing the child's best to it is not — `hold` means exactly what it
  // always meant, and packs deploy on merge, so every existing player would have
  // watched their `BEST 7` become `FIRST DAY`.
  resetTallyForTest()
  withKeyedStorage({ "dynawalla.counterweight.tally.v1": JSON.stringify({ turks: 7, hold: 12 }) }, () => {
    assert.deepEqual(loadTally(), { scales: 7, hold: 12 })
  })
})

test("and a v2 record wins over the v1 one it grew out of", () => {
  resetTallyForTest()
  withKeyedStorage(
    {
      "dynawalla.counterweight.tally.v1": JSON.stringify({ turks: 7, hold: 12 }),
      "dynawalla.counterweight.tally.v2": JSON.stringify({ scales: 9, hold: 4 }),
    },
    () => {
      // The maximum of each field, independently: nothing here can go backwards,
      // so an old record cannot pull a newer figure down and a newer one cannot
      // drop a figure it does not happen to beat.
      assert.deepEqual(loadTally(), { scales: 9, hold: 12 })
    },
  )
})

test("a v1 record is never read as a v2 one", () => {
  // The reason for the bump, stated as the failure it prevents: `turks` is not
  // `scales`, and a reader that did not know the difference would report a child
  // who has cleared seven scales as having cleared none.
  resetTallyForTest()
  withKeyedStorage({ "dynawalla.counterweight.tally.v2": JSON.stringify({ turks: 7, hold: 12 }) }, () => {
    assert.equal(loadTally().scales, 0, "a v1-shaped record was trusted as a v2 one")
  })
})

test("a storage that throws on the first read costs the session nothing", () => {
  // This is the pack frame: an opaque origin, and every touch of `localStorage`
  // throws. The in-memory mirror is the source of truth, not a cache.
  resetTallyForTest()
  withStorage({ value: null, throwOnRead: true }, () => {
    assert.deepEqual(loadTally(), { scales: 0, hold: 0 })
    assert.deepEqual(recordTally(3, 7), { scales: 3, hold: 7 })
    assert.deepEqual(recordTally(1, 2), { scales: 3, hold: 7 }, "the tally went backwards")
  })
})

test("no storage at all is the same story", () => {
  resetTallyForTest()
  withStorage(null, () => {
    assert.deepEqual(recordTally(2, 4), { scales: 2, hold: 4 })
    assert.deepEqual(loadTally(), { scales: 2, hold: 4 })
  })
})

test("a real storage round-trips, and never regresses", () => {
  const slot: Slot = { value: null }
  resetTallyForTest()
  withStorage(slot, () => {
    recordTally(5, 9)
    assert.ok(slot.value)
  })
  resetTallyForTest()
  withStorage(slot, () => {
    assert.deepEqual(loadTally(), { scales: 5, hold: 9 })
    assert.deepEqual(recordTally(4, 3), { scales: 5, hold: 9 })
  })
})

test("a record that will not parse is loud, and is not fatal", () => {
  resetTallyForTest()
  const warnings: unknown[] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    withStorage({ value: "{not json" }, () => {
      assert.deepEqual(loadTally(), { scales: 0, hold: 0 })
    })
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 1, "a broken record went by in silence")
})

test("a write that is refused is loud, and the session keeps its tally", () => {
  resetTallyForTest()
  const warnings: unknown[] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    withStorage({ value: null, throwOnWrite: true }, () => {
      assert.deepEqual(recordTally(6, 2), { scales: 6, hold: 2 })
    })
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 1)
})

test("nonsense in the record is ignored rather than trusted", () => {
  resetTallyForTest()
  withStorage({ value: JSON.stringify({ scales: "many", hold: 4.5 }) }, () => {
    assert.deepEqual(loadTally(), { scales: 0, hold: 0 })
  })
})
