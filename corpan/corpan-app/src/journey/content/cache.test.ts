// Per-session LRU cache tests (content-resolver.md §3.2 / §6 "Cache").

import { test } from "node:test"
import assert from "node:assert/strict"

import { LruCache, SharedBytePool } from "./cache.ts"

test("entry bound: insert 600 ⇒ ≤500 retained, LRU order", () => {
  const c = new LruCache<number>({ maxEntries: 500 })
  for (let i = 0; i < 600; i++) c.set(`k${i}`, i)
  assert.equal(c.size, 500)
  // The first 100 inserted (least recently used) were evicted.
  assert.equal(c.get("k0"), undefined)
  assert.equal(c.get("k99"), undefined)
  assert.equal(c.get("k100"), 100)
  assert.equal(c.get("k599"), 599)
})

test("get() refreshes recency", () => {
  const c = new LruCache<number>({ maxEntries: 3 })
  c.set("a", 1)
  c.set("b", 2)
  c.set("c", 3)
  c.get("a") // refresh: b is now oldest
  c.set("d", 4)
  assert.equal(c.get("b"), undefined)
  assert.equal(c.get("a"), 1)
})

test("byte bound: an oversized value evicts down to the pool cap", () => {
  const pool = new SharedBytePool(1000)
  const c = new LruCache<string>({ maxEntries: 100, pool })
  for (let i = 0; i < 8; i++) c.set(`k${i}`, "x".repeat(98)) // ~100 B each
  assert.equal(c.size, 8)
  c.set("big", "y".repeat(700)) // forces LRU eviction of small entries
  assert.ok(pool.used <= 1000, `pool used ${pool.used} > 1000`)
  assert.equal(c.get("big"), "y".repeat(700))
  assert.equal(c.get("k0"), undefined) // oldest went first
})

test("cross-cache pool: a big segment map evicts LRU items entries", () => {
  const pool = new SharedBytePool(1000)
  const items = new LruCache<string>({ maxEntries: 100, pool })
  const segmentMaps = new LruCache<string>({ maxEntries: 4, pool })
  for (let i = 0; i < 8; i++) items.set(`item${i}`, "x".repeat(98))
  segmentMaps.set("book1", "s".repeat(600))
  assert.ok(pool.used <= 1000)
  assert.equal(segmentMaps.get("book1"), "s".repeat(600))
  assert.ok(items.size < 8, "items cache should have shed LRU entries")
})

test("caches without a pool never charge it (stroke cache isolation)", () => {
  const pool = new SharedBytePool(100)
  const items = new LruCache<string>({ maxEntries: 10, pool })
  const strokes = new LruCache<string>({ maxEntries: 50 }) // NOT enrolled
  strokes.set("愛", "z".repeat(10_000)) // KBs of stroke JSON
  assert.equal(pool.used, 0)
  items.set("a", "x".repeat(20))
  assert.equal(items.get("a"), "x".repeat(20))
  assert.equal(strokes.get("愛"), "z".repeat(10_000))
})

test("clear() releases pooled bytes", () => {
  const pool = new SharedBytePool(1000)
  const c = new LruCache<string>({ maxEntries: 10, pool })
  c.set("a", "x".repeat(100))
  assert.ok(pool.used > 0)
  c.clear()
  assert.equal(pool.used, 0)
  assert.equal(c.size, 0)
})

test("overwrite replaces bytes instead of leaking them", () => {
  const pool = new SharedBytePool(1000)
  const c = new LruCache<string>({ maxEntries: 10, pool })
  c.set("a", "x".repeat(400))
  const afterFirst = pool.used
  c.set("a", "x".repeat(400))
  assert.equal(pool.used, afterFirst)
})
