// The one number worth remembering: the longest run of resonators opened back
// to back without a refusal. Not accuracy, not a percentage — a thing that
// happened.
//
// **`localStorage` throws inside a pack frame.** The document is on an opaque
// origin, so every access is guarded and the value is held in memory as well.
// A child who plays a whole sitting in a pack frame still sees their best rise;
// it just does not survive the app being closed, which is a far smaller loss
// than a game that will not start.

// gitleaks: a dotted string constant assigned to a `*_KEY` name reads as a
// credential to every secret scanner there is. It is a storage slot name.
const BEST_SLOT = "dw.lattice.best" // gitleaks:allow

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

/** The longest chain of resonators opened without a refusal. */
export function bestChain(): number {
  if (loaded) return memory
  loaded = true
  const slot = store()
  if (slot) {
    try {
      const raw = Number(slot.getItem(BEST_SLOT) ?? "0")
      if (Number.isFinite(raw) && raw > 0) memory = Math.floor(raw)
    } catch (error) {
      console.warn("[lattice] a best could not be read back", error)
    }
  }
  return memory
}

/** Record a chain. Returns true when it is a new best. */
export function recordChain(chain: number): boolean {
  const previous = bestChain()
  if (chain <= previous) return false
  memory = chain
  const slot = store()
  if (slot) {
    try {
      slot.setItem(BEST_SLOT, String(chain))
    } catch (error) {
      console.warn("[lattice] a best could not be written", error)
    }
  }
  return true
}

/** Tests own the module's state; nothing in the game calls this. */
export function resetBestForTest(): void {
  memory = 0
  loaded = false
}
