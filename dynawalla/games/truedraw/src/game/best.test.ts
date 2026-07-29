import assert from "node:assert/strict"
import { test } from "node:test"

import { bestBag, recordBag, resetBestForTest } from "./best.ts"

test("the fullest bag is kept in memory, not in web storage", () => {
  // `localStorage` is unreachable inside a pack frame: the document sits on an opaque
  // origin and every access throws. A best score that lived only in storage would read
  // zero forever on the one platform that matters, so the in-memory value is the
  // source of truth and this test runs with no storage at all.
  resetBestForTest()
  assert.equal(bestBag(), 0)
  assert.equal(recordBag(70), true)
  assert.equal(bestBag(), 70)
})

test("only a fuller bag replaces it, and it never goes back down", () => {
  resetBestForTest()
  recordBag(120)
  assert.equal(recordBag(120), false)
  assert.equal(recordBag(30), false)
  assert.equal(bestBag(), 120)
  assert.equal(recordBag(130), true)
  assert.equal(bestBag(), 130)
})
