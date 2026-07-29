// The fullest bag so far.
//
// **`localStorage` is unreachable inside a pack frame.** The document is framed
// on an opaque origin, so every access — including the `typeof` probe people
// reach for — throws a `SecurityError`. A best score kept only in web storage
// therefore reads zero forever on the one platform that matters.
//
// So the in-memory value is the source of truth for the session and storage is a
// best-effort mirror for the dev harness. The game is correct with storage
// entirely absent.

// The storage slot. `gitleaks:allow` because the pinned scanner's
// `generic-api-key` rule reads `KEY = "<long dotted string>"` as a credential —
// a property of the string's length, not of what it holds. It is a storage path,
// it is on the client, and it is in a public repo on purpose.
// v2, not v1. v1 held the old score — how many correct calls a run made — and the
// score is now the BAG, in coins, which is a different and much larger number. A
// child's old "best 9" read against a bag would look like a target they had
// already beaten before their first flick.
const BEST_SLOT = "dynawalla.truedraw.best.v2" // gitleaks:allow

let inMemory = 0
let loaded = false

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // The opaque-origin case. Expected on device; not worth a console line
    // every launch.
    return null
  }
}

export function bestBag(): number {
  if (!loaded) {
    loaded = true
    try {
      const raw = storage()?.getItem(BEST_SLOT)
      const parsed = raw === null || raw === undefined ? 0 : Number.parseInt(raw, 10)
      if (Number.isFinite(parsed) && parsed > inMemory) inMemory = parsed
    } catch (error) {
      console.warn("[truedraw] the best run could not be read", error)
    }
  }
  return inMemory
}

/** Records `bag` if it beats the best. Returns true when it did. */
export function recordBag(bag: number): boolean {
  if (bag <= bestBag()) return false
  inMemory = bag
  try {
    storage()?.setItem(BEST_SLOT, String(bag))
  } catch (error) {
    console.warn("[truedraw] the best run could not be written", error)
  }
  return true
}

/** Tests only: the module-level cache would otherwise leak between cases. */
export function resetBestForTest(): void {
  inMemory = 0
  loaded = true
}
