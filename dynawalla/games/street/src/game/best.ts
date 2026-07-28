// Blocks cleared, remembered.
//
// **`localStorage` throws inside a pack frame.** The document is on an opaque
// origin, and a WebKit that refuses the property does it by raising rather than
// by returning `null`. So the record lives in memory first and the store is a
// best-effort mirror: a pack that could not persist still shows the child the
// right number for the length of the session, and a pack that *crashed* on the
// first block cleared would show them nothing ever again.
//
// Nothing here ever goes down. `record()` keeps the larger of the two, which is
// the whole of `P-04` in one line: construction does not regress.

// A storage slot, versioned so a schema change orphans an old value rather than
// mis-reading it. `gitleaks:allow` because the pinned scanner's
// `generic-api-key` rule reads `KEY = "<long dotted string>"` as a credential.
// It is a storage path, it is on the client, and it is in a public repo on
// purpose.
const BEST_SLOT = "dynawalla.street.blocks.v1" // gitleaks:allow

let memory = 0
let loaded = false

function read(): number {
  try {
    const raw = globalThis.localStorage?.getItem(BEST_SLOT)
    const n = raw === null || raw === undefined ? 0 : Number.parseInt(raw, 10)
    return Number.isInteger(n) && n > 0 ? n : 0
  } catch (error) {
    // Noisy, never silent: a storage that refuses is a real fact about the
    // frame and the next person debugging it should be able to see it.
    console.warn("[street] blocks cleared could not be read", error)
    return 0
  }
}

export function blocksCleared(): number {
  if (!loaded) {
    loaded = true
    memory = Math.max(memory, read())
  }
  return memory
}

/** Returns true when this beat the record. */
export function recordBlocks(blocks: number): boolean {
  const n = Math.trunc(blocks)
  if (!Number.isInteger(n) || n <= blocksCleared()) return false
  memory = n
  try {
    globalThis.localStorage?.setItem(BEST_SLOT, String(n))
  } catch (error) {
    console.warn("[street] blocks cleared could not be written", error)
  }
  return true
}

/** Tests only: forget everything, including whether the store was consulted. */
export function resetBlocks(): void {
  memory = 0
  loaded = false
}
