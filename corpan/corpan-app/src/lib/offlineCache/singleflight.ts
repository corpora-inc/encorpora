// src/lib/offlineCache/singleflight.ts — in-flight coalescing shared by both
// cache halves (offline-cache.md §3.4). At most one promise per key;
// concurrent callers share it; settlement (resolve OR reject) releases the
// slot so a failed fetch can be retried by the next trigger.
//
// This is stampede control WITHIN one device (triggers firing together:
// online + foreground + interval). Fleet-scale stampede protection stays
// where it lives today — full-jitter backoff + interval jitter in
// contentPacks/catalogFetch.ts.

const inFlight = new Map<string, Promise<unknown>>()

/** At most one in-flight promise per key; concurrent callers share it. */
export function singleflight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key)
  if (existing) return existing as Promise<T>
  const p = (async () => run())().finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, p)
  return p
}

/** Whether a call for `key` is currently in flight (tests + diagnostics). */
export function isInFlight(key: string): boolean {
  return inFlight.has(key)
}

/** Test hook: forget all in-flight slots (simulates a cold start). */
export function __resetSingleflightForTests(): void {
  inFlight.clear()
}
