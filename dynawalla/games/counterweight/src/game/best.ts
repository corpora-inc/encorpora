// The tally, across sessions.
//
// **`localStorage` is unreachable inside a pack frame.** The document sits on an
// opaque origin, so every property access on it throws rather than returning
// null — which is why the in-memory mirror below is not a cache but the actual
// source of truth for the running session. A game that trusted the read would
// show a fresh tally on every seat, forever, on the only surface that matters.
//
// Nothing here can go backwards: `record` keeps the maximum it has ever seen.
// Being pinned costs the arm, never the tally.

// The storage slot, versioned so a schema change orphans an old record rather
// than mis-reading it. `gitleaks:allow` because the pinned scanner's
// `generic-api-key` rule reads `<NAME> = "<long dotted string>"` as a
// credential. It is a storage path, it is on the client, and this repository is
// public on purpose.
const TALLY_SLOT = "dynawalla.counterweight.tally.v1" // gitleaks:allow

export type Tally = {
  /** Turks put over, ever. */
  readonly turks: number
  /** The longest run of rounds seated true in one bout, ever. */
  readonly hold: number
}

const memory = { turks: 0, hold: 0 }
let loaded = false

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage
    // Touching the object is not enough — an opaque origin throws on access to
    // the property itself in some engines and on the first read in others, so
    // the probe has to be a real read.
    s.getItem(TALLY_SLOT)
    return s
  } catch {
    // **The one deliberate silence in this package.** Inside a pack frame this
    // throw is not an error, it is the normal state of the world, and it would
    // fire on every launch on every device. Everything past the probe — a record
    // that will not parse, a write that is refused — is logged loudly below.
    return null
  }
}

export function loadTally(): Tally {
  if (loaded) return { ...memory }
  loaded = true
  const s = storage()
  if (!s) return { ...memory }
  try {
    const raw = s.getItem(TALLY_SLOT)
    if (!raw) return { ...memory }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return { ...memory }
    const rec = parsed as Partial<Tally>
    if (Number.isInteger(rec.turks) && (rec.turks as number) > memory.turks) {
      memory.turks = rec.turks as number
    }
    if (Number.isInteger(rec.hold) && (rec.hold as number) > memory.hold) {
      memory.hold = rec.hold as number
    }
  } catch (error) {
    // Loud, never silent: a record that will not parse is a bug worth seeing.
    console.warn("[counterweight] the tally could not be read", error)
  }
  return { ...memory }
}

/** Record a session's totals. Monotone — nothing here can take a Turk back. */
export function recordTally(turks: number, hold: number): Tally {
  if (Number.isInteger(turks) && turks > memory.turks) memory.turks = turks
  if (Number.isInteger(hold) && hold > memory.hold) memory.hold = hold
  const s = storage()
  if (s) {
    try {
      s.setItem(TALLY_SLOT, JSON.stringify(memory))
    } catch (error) {
      console.warn("[counterweight] the tally could not be written", error)
    }
  }
  return { ...memory }
}

/** Tests only: drop the in-memory mirror so each case starts clean. */
export function resetTallyForTest(): void {
  memory.turks = 0
  memory.hold = 0
  loaded = false
}
