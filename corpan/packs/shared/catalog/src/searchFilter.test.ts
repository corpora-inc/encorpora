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
  // random()=0 pins the diversify window to its newest (first) entry.
  const next = chooseNextBook(catalog, "last", "es", { random: () => 0 })
  assert.equal(next?.book.bookId, "fresh")
})

test("falls back across series when finished book has no series", () => {
  const catalog = [
    n("done", "es", { publishedAt: "2010-01-01" }),
    n("newest", "es", { publishedAt: "2099-01-01" }),
    n("mid", "es", { publishedAt: "2050-01-01" }),
  ]
  const next = chooseNextBook(catalog, "done", "es", { random: () => 0 })
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
  const next = chooseNextBook(catalog, "done", "es", { random: () => 0 })
  assert.equal(next?.book.bookId, "next")
  assert.equal(next?.narration.language, "es")
})

// --- Anti-loop heuristic (issue #381) -------------------------------------

test("never suggests a completed book", () => {
  const catalog = [
    n("med", "es", { publishedAt: "2026-01-01" }),
    n("aitw", "es", { publishedAt: "2026-02-01" }),
    n("fresh", "es", { publishedAt: "2026-03-01" }),
  ]
  // Finished aitw; med already completed → must pick the fresh, untouched book,
  // not bounce back to med.
  const next = chooseNextBook(catalog, "aitw", "es", {
    completedBookIds: ["med"],
  })
  assert.equal(next?.book.bookId, "fresh")
})

test("does not ping-pong between the only two items: returns null when the alternative is completed", () => {
  const catalog = [
    n("med", "es", { publishedAt: "2026-01-01" }),
    n("aitw", "es", { publishedAt: "2026-02-01" }),
  ]
  // Classic #381: finish med, get aitw; finish aitw → med is the only other and
  // it's already done, so suggest nothing rather than loop back to med.
  const next = chooseNextBook(catalog, "aitw", "es", {
    completedBookIds: ["med"],
  })
  assert.equal(next, null)
})

test("prefers a never-read book over a recently-read one", () => {
  const catalog = [
    n("recent", "es", { publishedAt: "2099-01-01" }), // newest, but just read
    n("never", "es", { publishedAt: "2026-01-01" }),
  ]
  const next = chooseNextBook(catalog, "done", "es", {
    recentBookIds: ["recent"],
  })
  assert.equal(next?.book.bookId, "never")
})

test("falls back to a recent book when nothing fresh remains", () => {
  const catalog = [
    n("recent", "es", { publishedAt: "2099-01-01" }),
  ]
  const next = chooseNextBook(catalog, "done", "es", {
    recentBookIds: ["recent"],
  })
  // Only candidate is recent — better to suggest it than dead-end.
  assert.equal(next?.book.bookId, "recent")
})

test("diversifies across the newest eligible candidates (no deterministic ping-pong)", () => {
  const catalog = [
    n("a", "es", { publishedAt: "2026-05-01" }),
    n("b", "es", { publishedAt: "2026-04-01" }),
    n("c", "es", { publishedAt: "2026-03-01" }),
    n("d", "es", { publishedAt: "2026-02-01" }),
  ]
  // With diversifyTop=3, picking random()=0 / 0.5 / 0.99 should reach the top-3
  // window (a, b, c) — proving the choice isn't pinned to the single newest.
  const seen = new Set<string>()
  for (const r of [0, 0.4, 0.99]) {
    const next = chooseNextBook(catalog, "done", "es", {
      diversifyTop: 3,
      random: () => r,
    })
    if (next) seen.add(next.book.bookId)
  }
  assert.deepEqual([...seen].sort(), ["a", "b", "c"])
})

test("series 'next volume' skips a completed volume", () => {
  const catalog = [
    n("v1", "es", { series: "Saga", volume: 1 }),
    n("v2", "es", { series: "Saga", volume: 2 }),
    n("v3", "es", { series: "Saga", volume: 3 }),
  ]
  // Finished v1, already completed v2 → should advance to v3, not re-push v2.
  const next = chooseNextBook(catalog, "v1", "es", {
    completedBookIds: ["v2"],
  })
  assert.equal(next?.book.bookId, "v3")
})
