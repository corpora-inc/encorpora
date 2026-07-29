// WHAT THE YARD ASKS FOR — the game's one difficulty knob.
//
// The game used to ask the host for nothing at all: `next({ domain: "add" })`,
// take whatever comes off the front of the pool. So the opening round of a
// session was whatever the scheduler happened to have stocked, which is how a
// child could meet a four-digit borrow across a zero on their first weight. The
// founder's word for it was "starts way too hard", and it was not a pacing
// problem — it was the game never having said what it wanted.
//
// It says now. Two rules, and they are the whole module:
//
//   1. **The opening rung is the bottom one.** Every session starts on the
//      easiest thing the curriculum will serve, with a ceiling that stops the
//      stream drifting above it.
//   2. **It moves on achievement, never on a clock.** A rung per Turk put over,
//      which costs five net holds — the same shape `siege` uses, where the wave
//      counter advances only on *clear*. Nothing in here reads elapsed time,
//      and there is no counter that only goes up.
//
// **And it comes back down.** A pinning drops the rung by one. That asymmetry
// is deliberate: `raiseFloor` is on the host and is not called here, because a
// permanent floor is exactly the thing that would stop a struggling child ever
// getting easier work again. A floor is the right primitive for a game whose
// waves cannot be un-cleared. This one is an arm-wrestle, and an arm-wrestle
// goes both ways.

/** The scale the host reads: `1` is the bottom of the ladder, `10` the top. */
export const OPENING_RUNG = 1
export const TOP_RUNG = 10

/** What the match has actually achieved. Both directions, both earned. */
export type Record = {
  /** Turks put over. */
  readonly won: number
  /** Times pinned. */
  readonly pinned: number
}

/**
 * The rung to ask for.
 *
 * `null` — nothing played yet — is the opening rung, which is what makes the
 * very first `next()` of a session an explicit request for the easiest item in
 * the product rather than a shrug.
 */
export function rungFor(record: Record | null | undefined): number {
  if (!record) return OPENING_RUNG
  const rung = OPENING_RUNG + record.won - record.pinned
  return Math.max(OPENING_RUNG, Math.min(TOP_RUNG, rung))
}

export type Request = {
  readonly domain: string
  readonly difficulty: number
  readonly maxDifficulty: number
}

/**
 * The whole request, ceiling included.
 *
 * The ceiling is the same rung and not a rung above it. Without it the host is
 * free to serve anything in the pool that is *near* the ask, and "near" at the
 * bottom of the ladder is the difference between `43 + 25` and a borrow across a
 * zero.
 */
export function requestFor(record: Record | null | undefined): Request {
  const rung = rungFor(record)
  return { domain: "add", difficulty: rung, maxDifficulty: rung }
}
