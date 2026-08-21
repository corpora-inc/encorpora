// How many stars this child has ever logged — marked, correctly.
//
// The one thing the calm opening reads, and it is never shown to anybody. It is
// not a score and it is not accuracy: it counts assertions the child made that
// were true, which is the only signal that distinguishes "has never worked a
// ledger line" from "has done a hundred of them". A child coming back to a
// second sitting does not get walked through the first minute again.
//
// It is deliberately NOT `best.ts`'s longest chain. A chain is a rhythm, and a
// child can be entirely fluent at column addition and never run one; what the
// board opening up has to be paid for with is right answers.
//
// **`localStorage` throws inside a pack frame.** The document is on an opaque
// origin, so every access is guarded and the value is held in memory as well,
// exactly as `best.ts` does. When storage is unreachable the failure mode is
// that a child gets the calm opening again next sitting, which is the right way
// round: an extra gentle first minute costs nothing, and dropping a first-time
// child into four sums at once is the report this work came from.

// gitleaks: a dotted string constant assigned to a `*_KEY` name reads as a
// credential to every secret scanner there is. It is a storage slot name.
const LOGGED_SLOT = "dw.skyledger.logged" // gitleaks:allow

let memory = 0
let loaded = false

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch (error) {
    console.warn("[skyledger] localStorage is not reachable from this frame", error)
    return null
  }
}

/** Stars logged, ever, across every sitting this device remembers. */
export function loggedEver(): number {
  if (loaded) return memory
  loaded = true
  const slot = store()
  if (slot) {
    try {
      const raw = Number(slot.getItem(LOGGED_SLOT) ?? "0")
      if (Number.isFinite(raw) && raw > 0) memory = Math.floor(raw)
    } catch (error) {
      console.warn("[skyledger] the logged count could not be read back", error)
    }
  }
  return memory
}

/** One more. Returns the new total. */
export function noteLogged(): number {
  const next = loggedEver() + 1
  memory = next
  const slot = store()
  if (slot) {
    try {
      slot.setItem(LOGGED_SLOT, String(next))
    } catch (error) {
      console.warn("[skyledger] the logged count could not be written", error)
    }
  }
  return next
}

/** Tests own the module's state; nothing in the game calls this. */
export function resetLoggedForTest(): void {
  memory = 0
  loaded = false
}
