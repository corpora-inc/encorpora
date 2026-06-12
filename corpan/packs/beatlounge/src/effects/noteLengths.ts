/**
 * beatlounge — tempo-synced NOTE-LENGTH presets for time-based effects (delay).
 *
 * A curated, tasteful set of quick-set chips that lock a delay's `delayTime`
 * (seconds) to a musical note length at the song tempo, instead of dialing a raw
 * seconds knob. `fraction` is the note value as a FRACTION OF A WHOLE NOTE
 * (1/4 = a quarter = one beat in 4/4), so the math is the textbook one:
 *
 *     seconds = (60 / bpm) × (fraction × 4)
 *
 * i.e. a quarter (1/4) = 60/bpm, an eighth (1/8) = 0.5 × 60/bpm, a dotted
 * quarter = 1.5 × 60/bpm, an eighth triplet = (1/3) × 60/bpm.
 *
 * Pure + UI-free so it drives the shared delay card AND is unit-testable.
 */

export interface NoteLengthPreset {
  id: string
  label: string
  /** Note value as a fraction of a whole note (1/4 = quarter = one beat). */
  fraction: number
}

/**
 * The quick-set chips for the delay card, ordered short → long: a tight 1/16
 * stutter up to a whole-note wash, with the common triplet + dotted flavours.
 * (dotted = ×1.5, triplet = ×2/3.) At slow tempos the longest values can exceed
 * the delay's maxDelay — the card dims/clamps those (see `MAX_DELAY_SECONDS`).
 */
export const NOTE_LENGTH_PRESETS: readonly NoteLengthPreset[] = [
  { id: "1/16", label: "1/16", fraction: 1 / 16 },
  { id: "1/8t", label: "1/8T", fraction: (1 / 8) * (2 / 3) },
  { id: "1/8", label: "1/8", fraction: 1 / 8 },
  { id: "1/4", label: "1/4", fraction: 1 / 4 },
  { id: "1/2t", label: "1/2T", fraction: (1 / 2) * (2 / 3) },
  { id: "1/4.", label: "1/4·", fraction: (1 / 4) * 1.5 },
  { id: "1/2", label: "1/2", fraction: 1 / 2 },
  { id: "1/2.", label: "1/2·", fraction: (1 / 2) * 1.5 },
  { id: "1/1", label: "1/1", fraction: 1 },
] as const

/** The delay's maxDelay headroom (seconds) — longer note lengths clamp to this. */
export const MAX_DELAY_SECONDS = 3

/** Seconds for a note length (fraction of a whole note) at a given tempo. */
export const noteLengthSeconds = (fraction: number, bpm: number): number =>
  fraction * 4 * (60 / Math.max(1, bpm))

/** True when a note length would exceed the delay's max at this tempo. */
export const exceedsMaxDelay = (fraction: number, bpm: number, max = MAX_DELAY_SECONDS): boolean =>
  noteLengthSeconds(fraction, bpm) > max + 1e-9

/**
 * The preset id whose time matches `seconds` at `bpm` (within ~3ms), else null
 * (a free / un-synced time). Used to highlight the active chip; the free seconds
 * slider stays the source of truth for fine control.
 */
export const closestNoteLengthId = (seconds: number, bpm: number): string | null => {
  let best: string | null = null
  let bestErr = Infinity
  for (const p of NOTE_LENGTH_PRESETS) {
    const err = Math.abs(noteLengthSeconds(p.fraction, bpm) - seconds)
    if (err < bestErr) {
      bestErr = err
      best = p.id
    }
  }
  return bestErr <= 0.003 ? best : null
}
