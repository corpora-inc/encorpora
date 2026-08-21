// The one number worth remembering: how many colossi the child has put on the
// ground back to back. Not accuracy, not a percentage — a thing that happened.
//
// **`localStorage` throws inside a pack frame.** The document is on an opaque
// origin, so every access is guarded and the value is held in memory as well.
// A child who plays a whole sitting in a pack frame still sees their best rise;
// it just does not survive the app being closed, which is a smaller loss than
// a game that will not start.

// gitleaks: a dotted string constant assigned to a `*_KEY` name reads as a
// credential to every secret scanner there is. It is a storage slot name.
const BEST_SLOT = "dw.colossus.best" // gitleaks:allow

let memory = 0
let loaded = false

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch (error) {
    console.warn("[colossus] localStorage is not reachable from this frame", error)
    return null
  }
}

/** The longest run of towers brought all the way down. */
export function bestStreak(): number {
  if (loaded) return memory
  loaded = true
  const slot = store()
  if (slot) {
    try {
      const raw = Number(slot.getItem(BEST_SLOT) ?? "0")
      if (Number.isFinite(raw) && raw > 0) memory = Math.floor(raw)
    } catch (error) {
      console.warn("[colossus] a best could not be read back", error)
    }
  }
  return memory
}

/** Record a run of toppled towers. Returns true when it is a new best. */
export function recordStreak(towers: number): boolean {
  const previous = bestStreak()
  if (towers <= previous) return false
  memory = towers
  const slot = store()
  if (slot) {
    try {
      slot.setItem(BEST_SLOT, String(towers))
    } catch (error) {
      console.warn("[colossus] a best could not be written", error)
    }
  }
  return true
}

/** Tests own the module's state; nothing in the game calls this. */
export function resetBestForTest(): void {
  memory = 0
  loaded = false
}
