// src/contentPacks/catalogFetch.ts
//
// Resilient fetch layer for the pack catalogs. Born from a production
// "zombie" incident on a ChromeOS/ARC WebView: a catalog `fetch()` hung on a
// half-open socket with no timeout, so the store's `isFetching` flag stuck
// `true` forever and blocked every retry — the app sat wedged for ~10 minutes
// until the OS finally tore the socket down. Uninstall/reinstall did NOT help
// (the wedged connection lives in the shared system WebView, not app storage).
//
// Three guarantees this layer adds on top of a bare `fetch()`:
//
//   1. TIMEOUT + ABORT — every attempt is bounded by an AbortController, so a
//      dead socket aborts in seconds instead of hanging indefinitely.
//   2. CONDITIONAL GET — we send `If-None-Match` (ETag) / `If-Modified-Since`
//      so an unchanged catalog comes back as a 0-byte `304` straight off the
//      CDN edge. Polling is then nearly free: millions of devices can revalidate
//      every few minutes without re-downloading the full payload.
//   3. BOUNDED RETRY w/ JITTERED BACKOFF — one transient blip recovers on its
//      own without waiting for the next poll tick, and the jitter keeps a fleet
//      of devices from stampeding the origin in lockstep.
//
// The store layer is responsible for ALWAYS clearing `isFetching` in a
// `finally` (see store/catalog.ts, store/phrasePackCatalog.ts) — this module
// just makes sure the promise it returns actually settles.

export const DEFAULT_TIMEOUT_MS = 12_000
export const DEFAULT_MAX_ATTEMPTS = 3

/** HTTP validators we persist between fetches to enable conditional GETs. */
export type Validators = {
  etag?: string | null
  lastModified?: string | null
}

export type FreshnessResult<T> =
  /** Server replied 304: our cached copy is still current. */
  | { status: "unchanged"; validators: Validators }
  /** Fresh body fetched and parsed. */
  | { status: "ok"; data: T; validators: Validators }

export class CatalogFetchError extends Error {
  readonly reason?: unknown
  constructor(message: string, reason?: unknown) {
    super(message)
    this.name = "CatalogFetchError"
    this.reason = reason
  }
}

/* -------------------------------------------------------------------------- */
/*  Pure helpers (exported for unit tests)                                     */
/* -------------------------------------------------------------------------- */

/**
 * Full-jitter exponential backoff for retry `attempt` (0-based): a random
 * delay in `[base·2^attempt / 2, base·2^attempt]`, clamped to `capMs`. Jitter
 * is essential at fleet scale — without it, every device that failed at the
 * same instant (e.g. a brief CDN blip) would retry at the same instant.
 */
export function backoffDelayMs(
  attempt: number,
  baseMs = 500,
  capMs = 8_000,
  rand: () => number = Math.random,
): number {
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt))
  return Math.round(exp * (0.5 + 0.5 * rand()))
}

/**
 * Symmetric jitter around `baseMs` by ±`ratio`. Used to spread the poll
 * interval across devices so the catalog hosts never see a synchronized wave.
 */
export function jitter(
  baseMs: number,
  ratio = 0.2,
  rand: () => number = Math.random,
): number {
  const delta = baseMs * ratio
  return Math.round(baseMs - delta + 2 * delta * rand())
}

/** Build the conditional-request headers from stored validators. */
export function conditionalHeaders(v?: Validators): Record<string, string> {
  const headers: Record<string, string> = {}
  if (v?.etag) headers["If-None-Match"] = v.etag
  else if (v?.lastModified) headers["If-Modified-Since"] = v.lastModified
  return headers
}

/** 4xx (except 304) won't fix on retry — fail fast on client errors. */
export function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429
}

/* -------------------------------------------------------------------------- */
/*  Fetch with timeout                                                         */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fetch JSON with a hard timeout, conditional revalidation, and bounded
 * retry. Resolves to `unchanged` on a 304, `ok` with parsed data on a 200.
 * Throws `CatalogFetchError` only after exhausting retries (or on a
 * non-retryable client error) — callers MUST treat a throw as "keep the
 * cached copy", never as "wipe it".
 *
 * `parse` returning `null` is treated as a soft failure (malformed payload)
 * and retried; if it never parses, the final attempt throws.
 */
export async function fetchJsonFresh<T>(
  url: string,
  opts: {
    parse: (raw: unknown) => T | null
    validators?: Validators
    timeoutMs?: number
    maxAttempts?: number
  },
): Promise<FreshnessResult<T>> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  let lastErr: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(backoffDelayMs(attempt - 1))
    try {
      const res = await fetchWithTimeout(
        url,
        {
          // `no-store` keeps the WebView's own HTTP cache out of the loop — we
          // manage freshness explicitly via the validators below, which dodges
          // the stale-cache class of bugs entirely.
          cache: "no-store",
          headers: conditionalHeaders(opts.validators),
        },
        timeoutMs,
      )

      if (res.status === 304) {
        return { status: "unchanged", validators: opts.validators ?? {} }
      }
      if (!res.ok) {
        const err = new CatalogFetchError(`HTTP ${res.status}`)
        if (!isRetryableStatus(res.status)) throw err
        lastErr = err
        continue
      }

      const validators: Validators = {
        etag: res.headers.get("etag"),
        lastModified: res.headers.get("last-modified"),
      }
      const raw = (await res.json()) as unknown
      const data = opts.parse(raw)
      if (data == null) {
        lastErr = new CatalogFetchError("catalog payload failed to parse")
        continue
      }
      return { status: "ok", data, validators }
    } catch (err) {
      // A non-retryable client error rethrown above must not loop.
      if (err instanceof CatalogFetchError && /HTTP 4\d\d/.test(err.message)) {
        throw err
      }
      lastErr = err
    }
  }

  throw new CatalogFetchError(
    `catalog fetch failed after ${maxAttempts} attempt(s): ${url}`,
    lastErr,
  )
}
