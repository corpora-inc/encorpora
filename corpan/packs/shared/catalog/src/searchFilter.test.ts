// Tests for chooseNextBook (end-of-book "read next" selection).
//
// Pure-function tests. searchFilter.ts has only type-only imports, so this runs
// under either vitest or Node's built-in runner:
//
//   node --experimental-strip-types --test corpan/packs/shared/catalog/src/searchFilter.test.ts
//
// The vitest/node `describe`/`it`/expect surfaces overlap; we use node:test +
// node:assert to keep this runnable with zero deps.

import { test } from "node:test"
import assert from "node:assert/strict"
import { chooseNextBook } from "./searchFilter.ts"
import type { CatalogNarrationEntry } from "./types.ts"

/** Minimal narration factory — only the fields chooseNextBook reads. */
function n(
  bookId: string,
  language: string,
  extra: Partial<CatalogNarrationEntry> = {}
): CatalogNarrationEntry {
  return {
    id: `${bookId}__${language}`,
    bookId,
    bookTitle: extra.bookTitle ?? bookId.replace(/_/g, " "),
    language,
    voiceId: "ian",
    ...extra,
  } as CatalogNarrationEntry
}

test("prefers the next volume in the same series", () => {
  const catalog = [
    n("v1", "es", { series: "Saga", volume: 1 }),
    n("v2", "es", { series: "Saga", volume: 2 }),
    n("v3", "es", { series: "Saga", volume: 3 }),
    n("standalone", "es", { publishedAt: "2099-01-01" }),
  ]
  const next = chooseNextBook(catalog, "v1", "es")
  assert.equal(next?.book.bookId, "v2")
  assert.equal(next?.narration.language, "es")
})

test("skips to the next playable volume when one is missing the language", () => {
  const catalog = [
    n("v1", "es", { series: "Saga", volume: 1 }),
    n("v2", "fr", { series: "Saga", volume: 2 }), // not available in es
    n("v3", "es", { series: "Saga", volume: 3 }),
  ]
  const next = chooseNextBook(catalog, "v1", "es")
  assert.equal(next?.book.bookId, "v3")
})

test("never suggests the finished book", () => {
  const catalog = [
    n("only", "es", { series: "Saga", volume: 1 }),
  ]
  const next = chooseNextBook(catalog, "only", "es")
  assert.equal(next, null)
})

test("falls back to the newest other book when the series has no next volume", () => {
  const catalog = [
    n("last", "es", { series: "Saga", volume: 2 }),
    n("first", "es", { series: "Saga", volume: 1 }),
    n("fresh", "es", { publishedAt: "2099-06-01" }),
    n("older", "es", { publishedAt: "2000-01-01" }),
  ]
  // Finished the last volume of the series → no next volume → newest other book.
  const next = chooseNextBook(catalog, "last", "es")
  assert.equal(next?.book.bookId, "fresh")
})

test("falls back across series when finished book has no series", () => {
  const catalog = [
    n("done", "es", { publishedAt: "2010-01-01" }),
    n("newest", "es", { publishedAt: "2099-01-01" }),
    n("mid", "es", { publishedAt: "2050-01-01" }),
  ]
  const next = chooseNextBook(catalog, "done", "es")
  assert.equal(next?.book.bookId, "newest")
})

test("returns null when no other book is available in the language", () => {
  const catalog = [
    n("done", "es"),
    n("other", "fr"),
  ]
  const next = chooseNextBook(catalog, "done", "es")
  assert.equal(next, null)
})

test("returns the narration matching the requested language", () => {
  const catalog = [
    n("done", "es", { publishedAt: "2010-01-01" }),
    n("next", "es", { publishedAt: "2099-01-01" }),
    n("next", "fr", { publishedAt: "2099-01-01" }),
  ]
  const next = chooseNextBook(catalog, "done", "es")
  assert.equal(next?.book.bookId, "next")
  assert.equal(next?.narration.language, "es")
})
