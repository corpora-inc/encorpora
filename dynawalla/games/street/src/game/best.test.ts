import assert from "node:assert/strict"
import { test } from "node:test"

import { blocksCleared, recordBlocks, resetBlocks } from "./best.ts"

type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void }

function withStorage(store: Store | null, body: () => void): void {
  const g = globalThis as { localStorage?: unknown }
  const had = Object.prototype.hasOwnProperty.call(g, "localStorage")
  const before = g.localStorage
  Object.defineProperty(g, "localStorage", { value: store, configurable: true, writable: true })
  try {
    body()
  } finally {
    if (had) Object.defineProperty(g, "localStorage", { value: before, configurable: true, writable: true })
    else delete g.localStorage
  }
}

function memoryStore(): Store & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
  }
}

/** A pack frame: an opaque origin, and a `localStorage` that *raises*. */
function refusingStore(): Store {
  return {
    getItem() {
      throw new DOMException("The operation is insecure.", "SecurityError")
    },
    setItem() {
      throw new DOMException("The operation is insecure.", "SecurityError")
    },
  }
}

test("the count never goes down", () => {
  resetBlocks()
  withStorage(memoryStore(), () => {
    assert.equal(recordBlocks(4), true)
    assert.equal(blocksCleared(), 4)
    assert.equal(recordBlocks(2), false, "a smaller number replaced the record")
    assert.equal(blocksCleared(), 4)
    assert.equal(recordBlocks(4), false)
    assert.equal(recordBlocks(5), true)
    assert.equal(blocksCleared(), 5)
  })
  resetBlocks()
})

test("a refusing store costs the session, not the pack", () => {
  // `localStorage` throws inside a pack frame. The record has to survive that
  // in memory, because a pack that crashed on the first block cleared would
  // show the child nothing ever again.
  resetBlocks()
  withStorage(refusingStore(), () => {
    assert.equal(blocksCleared(), 0)
    assert.equal(recordBlocks(3), true)
    assert.equal(blocksCleared(), 3, "the record was lost when the store refused")
    assert.equal(recordBlocks(1), false)
    assert.equal(blocksCleared(), 3)
  })
  resetBlocks()
})

test("no store at all is not an error either", () => {
  resetBlocks()
  withStorage(null, () => {
    assert.equal(blocksCleared(), 0)
    assert.equal(recordBlocks(2), true)
    assert.equal(blocksCleared(), 2)
  })
  resetBlocks()
})

test("a stored value is read back, and rubbish in the slot is not", () => {
  const store = memoryStore()
  store.map.set("dynawalla.street.blocks.v1", "7")
  resetBlocks()
  withStorage(store, () => {
    assert.equal(blocksCleared(), 7)
  })
  store.map.set("dynawalla.street.blocks.v1", "not a number")
  resetBlocks()
  withStorage(store, () => {
    assert.equal(blocksCleared(), 0)
  })
  store.map.set("dynawalla.street.blocks.v1", "-4")
  resetBlocks()
  withStorage(store, () => {
    assert.equal(blocksCleared(), 0)
  })
  resetBlocks()
})

test("only whole blocks are recorded", () => {
  resetBlocks()
  withStorage(memoryStore(), () => {
    assert.equal(recordBlocks(2.7), true)
    assert.equal(blocksCleared(), 2)
    assert.equal(recordBlocks(Number.NaN), false)
    assert.equal(blocksCleared(), 2)
  })
  resetBlocks()
})
