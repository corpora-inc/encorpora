// The tally, across sessions.
//
// **`localStorage` is unreachable inside a pack frame.** The document sits on an
// opaque origin, so every property access on it throws rather than returning
// null — which is why the in-memory mirror below is not a cache but the actual
// source of truth for the running session. A game that trusted the read would
// show a fresh tally on every launch, forever, on the only surface that matters.
//
// Nothing here can go backwards: `record` keeps the maximum it has ever seen.
// A barrow sent back costs the day's run, never the tally.

// The storage slot, versioned so a schema change orphans an old record rather
// than mis-reading it. `gitleaks:allow` because the pinned scanner's
// `generic-api-key` rule reads `<NAME> = "<long dotted string>"` as a
// credential. It is a storage path, it is on the client, and this repository is
// public on purpose.
// Bumped to v2 when the arm-wrestle premise went: the record used to be keyed
// `turks`, and a v1 record read as a v2 one would silently report zero cleared
// scales. `V1_SLOT` below is read once and carried across rather than orphaned —
// `hold` means exactly what it always meant, and a child who has been playing
// this game since it shipped should not lose their best to a rename.
const TALLY_SLOT = "dynawalla.counterweight.tally.v2" // gitleaks:allow
const V1_SLOT = "dynawalla.counterweight.tally.v1" // gitleaks:allow

export type Tally = {
  /** Scales cleared, ever. */
  readonly scales: number
  /** The longest run of good weights in one day, ever. */
  readonly hold: number
}

const memory = { scales: 0, hold: 0 }
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
    // v1 first, so v2 wins on every field it has: `record` only ever takes a
    // maximum, so the order is belt and braces rather than load-bearing.
    absorb(s.getItem(V1_SLOT), "turks")
    absorb(s.getItem(TALLY_SLOT), "scales")
  } catch (error) {
    // Loud, never silent: a record that will not parse is a bug worth seeing.
    console.warn("[counterweight] the tally could not be read", error)
  }
  return { ...memory }
}

/**
 * Fold one stored record into the mirror. `key` is what the count was called in
 * that schema — `turks` in v1, `scales` in v2.
 *
 * Monotone, like everything else here: it can only raise a figure.
 */
function absorb(raw: string | null, key: "turks" | "scales"): void {
  if (!raw) return
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== "object" || parsed === null) return
  const rec = parsed as Record<string, unknown>
  const count = rec[key]
  if (Number.isInteger(count) && (count as number) > memory.scales) {
    memory.scales = count as number
  }
  if (Number.isInteger(rec.hold) && (rec.hold as number) > memory.hold) {
    memory.hold = rec.hold as number
  }
}

/** Record a session's totals. Monotone — nothing here can take a cleared scale back. */
export function recordTally(scales: number, hold: number): Tally {
  if (Number.isInteger(scales) && scales > memory.scales) memory.scales = scales
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
  memory.scales = 0
  memory.hold = 0
  loaded = false
}
