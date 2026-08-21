// How much of this game this child has actually demonstrated.
//
// One integer, never shown to anybody, and it is the only thing `sim/opening.ts`
// reads. It is not a score, not an accuracy and not a claim about the child — it
// counts **cores read**, net, which is the only signal that tells "has never
// seen this" apart from "has played this before".
//
// ## Why it is not the clock
//
// `Director.pressure()` escalates on `elapsed / 90`. That is a clock, and a
// clock is the one thing the house rules forbid here: a child who has answered
// nothing in ninety seconds was being handed a board 65% of the way up the
// pressure curve — faster hulls, a shorter spawn gap, five automata alive
// instead of two, and a requested item difficulty of 7 instead of 2 — for
// having stayed in the room. The pacing audit found seventeen games doing a
// version of this. This is the channel that replaces it during the ramp: the
// board gets busier when the child shows they can read it, and at no other time.
//
// ## Both directions
//
// `+1` for a core read, `−1` for a wrong hand-in or a wave that reached the
// floor, floored at zero. It walks back DOWN, and that is the half that makes it
// a fit rather than a ratchet — a child having a bad afternoon is met with a
// calmer lattice inside two waves rather than being left on a board that is
// already too fast for them. Nothing about it is shown, said or scored.
//
// A wave that expired counts as a step down even though the game reports it to
// the host as nothing at all (`host.skip`). Those are two different questions:
// "what did this child demonstrate about arithmetic" is the host's, and the
// honest answer is silence; "was that board too fast for them" is this module's,
// and a candidate that reached the floor unanswered is a yes.
//
// **`localStorage` throws inside a pack frame.** The document is on an opaque
// origin, so every access is guarded and the value is held in memory too. When
// storage is unreachable a child gets the calm opening again next sitting, which
// is the right way round: an extra gentle first minute costs nothing and
// dropping a first-time child onto the full lattice is the report this came from.

// gitleaks: a dotted string constant assigned to a `*_KEY` name reads as a
// credential to every secret scanner there is. It is a storage slot name.
const READ_SLOT = "dw.beam.read" // gitleaks:allow

let memory = 0
let loaded = false

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch (error) {
    console.warn("[beam] localStorage is not reachable from this frame", error)
    return null
  }
}

function write(next: number): number {
  memory = next
  const slot = store()
  if (slot) {
    try {
      slot.setItem(READ_SLOT, String(next))
    } catch (error) {
      console.warn("[beam] the cores-read count could not be written", error)
    }
  }
  return next
}

/** Cores read, net, across every sitting this device remembers. Never negative. */
export function coresRead(): number {
  if (loaded) return memory
  loaded = true
  const slot = store()
  if (slot) {
    try {
      const raw = Number(slot.getItem(READ_SLOT) ?? "0")
      if (Number.isFinite(raw) && raw > 0) memory = Math.floor(raw)
    } catch (error) {
      console.warn("[beam] the cores-read count could not be read back", error)
    }
  }
  return memory
}

/** A core was read. Returns the new total. */
export function noteRead(): number {
  return write(coresRead() + 1)
}

/**
 * A wrong hand-in, or a wave that reached the floor with nothing handed in.
 *
 * Floored at zero, so the calmest board is a floor and not a hole a child can
 * fall through.
 */
export function noteMissed(): number {
  return write(Math.max(0, coresRead() - 1))
}

/** Tests own the module's state; nothing in the game calls this. */
export function resetReadForTest(): void {
  memory = 0
  loaded = false
}
