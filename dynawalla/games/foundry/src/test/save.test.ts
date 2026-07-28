// The belt has to survive the one environment it actually runs in: a pack
// frame, on an opaque origin, where every `localStorage` access throws.

import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import { loadBelt, recordBelt, resetBeltForTest } from "../game/save.ts"

const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage")

/** Take `localStorage` off the global entirely — a real environment for a pack. */
function removeStorage(): void {
  Reflect.deleteProperty(globalThis, "localStorage")
}

function installStorage(impl: unknown): void {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      return impl
    },
  })
}

function restore(): void {
  if (original) Object.defineProperty(globalThis, "localStorage", original)
  else removeStorage()
}

afterEach(() => {
  restore()
  resetBeltForTest()
})

/** A storage that throws on every access, the way a pack frame's does. */
function hostile(): unknown {
  return new Proxy(
    {},
    {
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError")
      },
    },
  )
}

function working(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k)
    },
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
  } as Storage
}

test("a storage that throws on every access never breaks the belt", () => {
  installStorage(hostile())
  assert.deepEqual(loadBelt(), { best: 0, beaten: 0 })
  assert.deepEqual(recordBelt(9, 2), { best: 9, beaten: 2 })
  // And the in-memory mirror is the source of truth for the rest of the
  // session, which is the whole point: inside a pack the disk is never there.
  assert.deepEqual(loadBelt(), { best: 9, beaten: 2 })
})

test("the belt is monotone — nothing can take a plate off it", () => {
  installStorage(working())
  recordBelt(12, 3)
  assert.deepEqual(recordBelt(4, 1), { best: 12, beaten: 3 })
  assert.deepEqual(recordBelt(0, 0), { best: 12, beaten: 3 })
  assert.deepEqual(recordBelt(13, 3), { best: 13, beaten: 3 })
})

test("a record written in one session is read back in the next", () => {
  const store = working()
  installStorage(store)
  recordBelt(7, 1)
  resetBeltForTest()
  assert.deepEqual(loadBelt(), { best: 7, beaten: 1 })
})

test("a corrupt record is ignored rather than trusted", () => {
  const store = working()
  store.setItem("dynawalla.foundry.belt.v1", "{not json")
  installStorage(store)
  assert.deepEqual(loadBelt(), { best: 0, beaten: 0 })

  resetBeltForTest()
  store.setItem("dynawalla.foundry.belt.v1", JSON.stringify({ best: "lots", beaten: 1.5 }))
  assert.deepEqual(loadBelt(), { best: 0, beaten: 0 })
})

test("no storage object at all is a supported environment", () => {
  removeStorage()
  assert.deepEqual(loadBelt(), { best: 0, beaten: 0 })
  assert.deepEqual(recordBelt(3, 0), { best: 3, beaten: 0 })
})
