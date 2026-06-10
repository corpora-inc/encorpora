/**
 * beatlounge — musical time divisions for time-based effects (delay).
 *
 * Lets the user lock a delay precisely to the beat — 1/4, dotted 1/8, 1/16,
 * triplets — instead of dialing a raw seconds knob. `beats` is the length in
 * QUARTER notes (1 beat = a quarter); seconds derive from the live tempo.
 */

export interface TimeDivision {
  id: string
  label: string
  /** Length in quarter notes (1 = quarter). */
  beats: number
}

export const TIME_DIVISIONS: readonly TimeDivision[] = [
  { id: "1/4", label: "1/4", beats: 1 },
  { id: "1/4.", label: "1/4.", beats: 1.5 },
  { id: "1/4t", label: "1/4T", beats: 2 / 3 },
  { id: "1/8", label: "1/8", beats: 0.5 },
  { id: "1/8.", label: "1/8.", beats: 0.75 },
  { id: "1/8t", label: "1/8T", beats: 1 / 3 },
  { id: "1/16", label: "1/16", beats: 0.25 },
  { id: "1/16.", label: "1/16.", beats: 0.375 },
  { id: "1/16t", label: "1/16T", beats: 1 / 6 },
] as const

/** Seconds for a division at a given tempo. */
export const divisionSeconds = (beats: number, bpm: number): number =>
  beats * (60 / Math.max(1, bpm))

/** The division id whose time matches `seconds` at `bpm` (within ~3ms), else
 *  null (a free/un-synced time). Used to highlight the active preset. */
export const closestDivisionId = (seconds: number, bpm: number): string | null => {
  let best: string | null = null
  let bestErr = Infinity
  for (const d of TIME_DIVISIONS) {
    const err = Math.abs(divisionSeconds(d.beats, bpm) - seconds)
    if (err < bestErr) {
      bestErr = err
      best = d.id
    }
  }
  return bestErr <= 0.003 ? best : null
}
