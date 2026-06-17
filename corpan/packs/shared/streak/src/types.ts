// Shared per-pack visit-streak types.
//
// A "visit streak" = consecutive local days the user opened a given pack. It is
// a RETENTION signal shown to ALL users (subscribed or not) — never a gate.
//
// Distinct from the global reading-segment streak in
// corpan-app/src/store/progress.ts (that counts reading segments app-wide). This
// is one independent streak PER pack id, keyed in its own localStorage namespace.

/** A single pack's visit-streak snapshot. */
export type StreakState = {
  /** Consecutive local days visited, ending today (or the last visit day). */
  current: number
  /** The longest `current` ever reached for this pack. */
  longest: number
  /** Local `YYYY-MM-DD` of the most recent recorded visit ("" if never). */
  lastDay: string
}

/** Detail carried in the `corpan:streak-changed` CustomEvent. */
export type StreakChangedDetail = {
  packId: string
  current: number
  longest: number
}
