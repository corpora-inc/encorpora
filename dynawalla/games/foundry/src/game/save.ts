// The belt, across sessions.
//
// **`localStorage` is unreachable inside a pack frame.** The document sits on
// an opaque origin, so every property access on it throws rather than returning
// null — which is why the in-memory mirror below is not a cache but the actual
// source of truth for the running session. A game that trusted the read would
// show a belt of zero plates on every kick-out, forever, on the only surface
// that matters.
//
// Nothing here can regress the belt: `record` keeps the maximum it has ever
// seen. That is `P-04` — construction never goes backwards — and it is the
// child-safe version of loss aversion. Losing a fall costs the fall, never the
// belt.

// The storage slot, versioned so a schema change orphans an old record rather
// than mis-reading it. `gitleaks:allow` because the pinned scanner's
// `generic-api-key` rule reads `<NAME> = "<long dotted string>"` as a
// credential. It is a storage path, it is on the client, and this repository is
// public on purpose.
const BELT_SLOT = "dynawalla.foundry.belt.v1" // gitleaks:allow

export type Belt = {
  /** The most plates ever cast onto the belt in one session. */
  best: number
  /** Challengers put away, ever. */
  beaten: number
}

const memory: Belt = { best: 0, beaten: 0 }
let loaded = false

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage
    // Touching the object is not enough — an opaque origin throws on access to
    // the property itself in some engines and on the first read in others, so
    // the probe has to be a real read.
    s.getItem(BELT_SLOT)
    return s
  } catch {
    return null
  }
}

export function loadBelt(): Belt {
  if (loaded) return { ...memory }
  loaded = true
  const s = storage()
  if (!s) return { ...memory }
  try {
    const raw = s.getItem(BELT_SLOT)
    if (!raw) return { ...memory }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return { ...memory }
    const rec = parsed as Partial<Belt>
    if (Number.isInteger(rec.best) && (rec.best as number) > memory.best) {
      memory.best = rec.best as number
    }
    if (Number.isInteger(rec.beaten) && (rec.beaten as number) > memory.beaten) {
      memory.beaten = rec.beaten as number
    }
  } catch (error) {
    // Loud, never silent: a record that will not parse is a bug worth seeing.
    console.warn("[foundry] the belt record could not be read", error)
  }
  return { ...memory }
}

/** Record a session's totals. Monotone — nothing here can take a plate off. */
export function recordBelt(plates: number, beaten: number): Belt {
  if (Number.isInteger(plates) && plates > memory.best) memory.best = plates
  if (Number.isInteger(beaten) && beaten > memory.beaten) memory.beaten = beaten
  const s = storage()
  if (s) {
    try {
      s.setItem(BELT_SLOT, JSON.stringify(memory))
    } catch (error) {
      console.warn("[foundry] the belt record could not be written", error)
    }
  }
  return { ...memory }
}

/** Tests only: drop the in-memory mirror so each case starts clean. */
export function resetBeltForTest(): void {
  memory.best = 0
  memory.beaten = 0
  loaded = false
}
