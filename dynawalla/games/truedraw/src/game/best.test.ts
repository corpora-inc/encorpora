import assert from "node:assert/strict"
import { test } from "node:test"

import { bestCalls, recordCalls, resetBestForTest } from "./best.ts"

test("the best run is kept in memory, not in web storage", () => {
  // `localStorage` is unreachable inside a pack frame: the document sits on an
  // opaque origin and every access throws. A best score that lived only in
  // storage would read zero forever on the one platform that matters, so the
  // in-memory value is the source of truth and this test runs with no storage
  // at all.
  resetBestForTest()
  assert.equal(bestCalls(), 0)
  assert.equal(recordCalls(7), true)
  assert.equal(bestCalls(), 7)
})

test("only a longer run replaces it, and it never goes back down", () => {
  resetBestForTest()
  recordCalls(12)
  assert.equal(recordCalls(12), false)
  assert.equal(recordCalls(3), false)
  assert.equal(bestCalls(), 12)
  assert.equal(recordCalls(13), true)
  assert.equal(bestCalls(), 13)
})
