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

test("a storage that throws on the first read costs the session nothing", () => {
  // This is the pack frame: an opaque origin, and every touch of `localStorage`
  // throws. The in-memory mirror is the source of truth, not a cache.
  resetTallyForTest()
  withStorage({ value: null, throwOnRead: true }, () => {
    assert.deepEqual(loadTally(), { turks: 0, hold: 0 })
    assert.deepEqual(recordTally(3, 7), { turks: 3, hold: 7 })
    assert.deepEqual(recordTally(1, 2), { turks: 3, hold: 7 }, "the tally went backwards")
  })
})

test("no storage at all is the same story", () => {
  resetTallyForTest()
  withStorage(null, () => {
    assert.deepEqual(recordTally(2, 4), { turks: 2, hold: 4 })
    assert.deepEqual(loadTally(), { turks: 2, hold: 4 })
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
    assert.deepEqual(loadTally(), { turks: 5, hold: 9 })
    assert.deepEqual(recordTally(4, 3), { turks: 5, hold: 9 })
  })
})

test("a record that will not parse is loud, and is not fatal", () => {
  resetTallyForTest()
  const warnings: unknown[] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    withStorage({ value: "{not json" }, () => {
      assert.deepEqual(loadTally(), { turks: 0, hold: 0 })
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
      assert.deepEqual(recordTally(6, 2), { turks: 6, hold: 2 })
    })
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 1)
})

test("nonsense in the record is ignored rather than trusted", () => {
  resetTallyForTest()
  withStorage({ value: JSON.stringify({ turks: "many", hold: 4.5 }) }, () => {
    assert.deepEqual(loadTally(), { turks: 0, hold: 0 })
  })
})
