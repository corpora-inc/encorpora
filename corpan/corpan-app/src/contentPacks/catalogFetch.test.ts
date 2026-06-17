// Tests for the resilient catalog-fetch layer. Run with the repo's native
// runner (no extra deps): `npm test` →
//   node --experimental-strip-types --test src/contentPacks/*.test.ts
//
// The headline guarantee these lock down is the one that caused the
// production "zombie": a hung request MUST settle (so the store's `finally`
// can clear `isFetching`), and an unchanged catalog MUST come back as a cheap
// `unchanged` (304) without re-downloading.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  backoffDelayMs,
  jitter,
  conditionalHeaders,
  isRetryableStatus,
  fetchJsonFresh,
  CatalogFetchError,
} from "./catalogFetch.ts"

/* ----------------------------- pure helpers ------------------------------ */

test("backoffDelayMs: jittered within [50%,100%] of exponential, clamped", () => {
  // rand=0 → 50% of exp; rand=1 → 100% of exp.
  assert.equal(backoffDelayMs(0, 500, 8000, () => 0), 250)
  assert.equal(backoffDelayMs(0, 500, 8000, () => 1), 500)
  assert.equal(backoffDelayMs(2, 500, 8000, () => 1), 2000) // 500*2^2
  assert.equal(backoffDelayMs(10, 500, 8000, () => 1), 8000) // clamped to cap
  assert.equal(backoffDelayMs(10, 500, 8000, () => 0), 4000) // 50% of cap
})

test("jitter: symmetric ±ratio around base", () => {
  assert.equal(jitter(1000, 0.2, () => 0), 800)
  assert.equal(jitter(1000, 0.2, () => 1), 1200)
  assert.equal(jitter(1000, 0.2, () => 0.5), 1000)
})

test("conditionalHeaders: prefers ETag, falls back to Last-Modified", () => {
  assert.deepEqual(conditionalHeaders({ etag: '"abc"' }), {
    "If-None-Match": '"abc"',
  })
  assert.deepEqual(conditionalHeaders({ lastModified: "Mon, 01 Jan 2026 00:00:00 GMT" }), {
    "If-Modified-Since": "Mon, 01 Jan 2026 00:00:00 GMT",
  })
  assert.deepEqual(conditionalHeaders({ etag: '"abc"', lastModified: "x" }), {
    "If-None-Match": '"abc"',
  })
  assert.deepEqual(conditionalHeaders(undefined), {})
})

test("isRetryableStatus: 5xx/408/429 retry, other 4xx do not", () => {
  assert.equal(isRetryableStatus(500), true)
  assert.equal(isRetryableStatus(503), true)
  assert.equal(isRetryableStatus(429), true)
  assert.equal(isRetryableStatus(408), true)
  assert.equal(isRetryableStatus(404), false)
  assert.equal(isRetryableStatus(403), false)
})

/* ------------------------------ fetchJsonFresh --------------------------- */

// Swap global.fetch for the duration of a test.
function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return fn().finally(() => {
    globalThis.fetch = original
  })
}

test("200 → ok with parsed data and captured validators", async () => {
  await withFetch(
    async () =>
      new Response(JSON.stringify({ n: 7 }), {
        status: 200,
        headers: { etag: '"v1"', "last-modified": "Mon, 01 Jan 2026 00:00:00 GMT" },
      }),
    async () => {
      const r = await fetchJsonFresh<{ n: number }>("https://x/cat.json", {
        parse: (raw) => raw as { n: number },
      })
      assert.equal(r.status, "ok")
      if (r.status === "ok") {
        assert.deepEqual(r.data, { n: 7 })
        assert.equal(r.validators.etag, '"v1"')
        assert.equal(r.validators.lastModified, "Mon, 01 Jan 2026 00:00:00 GMT")
      }
    },
  )
})

test("304 → unchanged, sends If-None-Match, keeps caller's catalog", async () => {
  let sentHeader: string | null = null
  await withFetch(
    async (_url, init) => {
      sentHeader = new Headers(init?.headers).get("If-None-Match")
      return new Response(null, { status: 304 })
    },
    async () => {
      const r = await fetchJsonFresh("https://x/cat.json", {
        parse: (raw) => raw,
        validators: { etag: '"v1"' },
      })
      assert.equal(r.status, "unchanged")
      assert.equal(sentHeader, '"v1"')
    },
  )
})

test("hung request times out, settles, and throws (the zombie fix)", async () => {
  // fetch never resolves on its own — only the AbortController can end it.
  // Before the timeout existed, this would hang forever and wedge the store.
  let attempts = 0
  await withFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        attempts++
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        )
      }),
    async () => {
      await assert.rejects(
        () =>
          fetchJsonFresh("https://x/cat.json", {
            parse: (raw) => raw,
            timeoutMs: 30,
            maxAttempts: 2,
          }),
        (err: unknown) => err instanceof CatalogFetchError,
      )
      assert.equal(attempts, 2, "should abort and retry up to maxAttempts")
    },
  )
})

test("transient failure then success → recovers without caller intervention", async () => {
  let calls = 0
  await withFetch(
    async () => {
      calls++
      if (calls < 3) return new Response("", { status: 503 })
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { etag: '"v2"' },
      })
    },
    async () => {
      const r = await fetchJsonFresh("https://x/cat.json", {
        parse: (raw) => raw,
        maxAttempts: 3,
      })
      assert.equal(r.status, "ok")
      assert.equal(calls, 3)
    },
  )
})

test("404 fails fast — no retry on a non-retryable client error", async () => {
  let calls = 0
  await withFetch(
    async () => {
      calls++
      return new Response("", { status: 404 })
    },
    async () => {
      await assert.rejects(() =>
        fetchJsonFresh("https://x/cat.json", { parse: (raw) => raw, maxAttempts: 3 }),
      )
      assert.equal(calls, 1, "client errors must not be retried")
    },
  )
})
