// How many resonators this child has ever opened.
//
// The one thing the calm opening reads, and it is never shown to anybody. It is
// not a score, it is not accuracy, and it is not a claim about how good the
// child is — it counts rings they finished, which is the only signal that
// distinguishes "has never seen this game" from "has played it before". A child
// coming back to their fifth resonator does not get walked through the first one
// again; see `game/opening.ts`.
//
// **`localStorage` throws inside a pack frame.** The document is on an opaque
// origin, so every access is guarded and the value is held in memory as well,
// exactly as `best.ts` does. The failure mode when storage is unreachable is
// that a child gets the calm opening again next sitting, which is the right way
// round: the cost of an extra gentle first minute is nothing, and the cost of
// dropping a first-time child into the full field is the report this work came
// from.

// gitleaks: a dotted string constant assigned to a `*_KEY` name reads as a
// credential to every secret scanner there is. It is a storage slot name.
const OPENS_SLOT = "dw.lattice.opens" // gitleaks:allow

let memory = 0
let loaded = false

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch (error) {
    console.warn("[lattice] localStorage is not reachable from this frame", error)
    return null
  }
}

/** Resonators opened, ever, across every sitting this device remembers. */
export function opensEver(): number {
  if (loaded) return memory
  loaded = true
  const slot = store()
  if (slot) {
    try {
      const raw = Number(slot.getItem(OPENS_SLOT) ?? "0")
      if (Number.isFinite(raw) && raw > 0) memory = Math.floor(raw)
    } catch (error) {
      console.warn("[lattice] the opened count could not be read back", error)
    }
  }
  return memory
}

/** One more. Returns the new total. */
export function noteOpen(): number {
  const next = opensEver() + 1
  memory = next
  const slot = store()
  if (slot) {
    try {
      slot.setItem(OPENS_SLOT, String(next))
    } catch (error) {
      console.warn("[lattice] the opened count could not be written", error)
    }
  }
  return next
}

/** Tests own the module's state; nothing in the game calls this. */
export function resetOpensForTest(): void {
  memory = 0
  loaded = false
}
