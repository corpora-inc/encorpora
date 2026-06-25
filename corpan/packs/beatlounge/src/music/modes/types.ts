/**
 * beatlounge — world-modes corpus: the typed schema.
 *
 * THE CANONICAL pitch-set corpus the harmony engine will consume. Every mode is
 * a degree set expressed as EXACT cents-above-tonic (the universal currency from
 * `../tuning.ts`). 12-TET modes carry multiples of 100; maqam carries researched
 * non-12-TET cents for its neutral (three-quarter-tone) degrees. Because the
 * representation is cents (not 12-TET MIDI), refining a Western mode to a
 * just/Pythagorean tuning or a maqam to a regional intonation is a data change
 * with ZERO migration.
 *
 * This is NEW canonical data — it deliberately does NOT touch the three existing
 * divergent scale tables (harmony.ts / ribbonScales.ts / pitchModel.ts); a later
 * harmony-integration round reconciles those onto this corpus.
 */

/** Which musical system a mode belongs to. */
export type ModeFamily = "western" | "thaat" | "melakarta" | "maqam" | "persian" | "turkish"

/**
 * Optional rational derivation for a degree — the exact frequency ratio its
 * cents came from (e.g. just M3 = 5/4). Present where the mode is (or can be)
 * justly/Pythagorean-derived; absent for plain 12-TET multiples.
 */
export interface DegreeRatio {
  num: number
  den: number
}

/** One scale degree: its exact cents-above-tonic, a label, optional ratio. */
export interface ModeDegree {
  /** Cents above the tonic. degrees[0].cents === 0. Real number (may be non-100). */
  cents: number
  /**
   * The degree's label in its own system: a Western interval/solfège ("M3"),
   * a Hindustani swara ("Ga", "ga" komal), a Carnatic svara ("G3"), or a maqam
   * degree name. Purely informational — the cents are authoritative.
   */
  label: string
  /** The frequency ratio this cents value derives from, where applicable. */
  ratio?: DegreeRatio
}

/**
 * A jins (Arabic melodic cell, 3–5 notes) — the building block of a maqam.
 * Carried on maqam entries so the harmony engine can later reason about the
 * lower/upper ajnas and modulation, not just the flat scale.
 */
export interface Jins {
  id: string
  name: string
  /** Degrees of the jins as cents above ITS OWN root (root = 0). */
  degrees: ModeDegree[]
}

/** A complete mode/scale entry in the corpus. */
export interface Mode {
  /** Stable unique id, e.g. "western.dorian", "thaat.bhairav", "melakarta.15",
   *  "maqam.rast". */
  id: string
  /** Display name. */
  name: string
  family: ModeFamily
  /**
   * Ascending degrees within one octave, as exact cents-above-tonic. The octave
   * (1200¢) is implied, NOT included (so a 7-note scale has 7 degrees).
   */
  degrees: ModeDegree[]
  /** Alternative names / spellings (search + cross-system equivalence notes). */
  aliases?: string[]
  /** For maqam: the lower + upper ajnas it is built from. */
  ajnas?: { lower: Jins; upper?: Jins; upperRootCents: number }
  /** For melakarta: its catalog number 1..72. */
  melakartaNumber?: number
  /** Free-form provenance / tuning notes (esp. maqam intonation decisions). */
  notes?: string
}

/** Convenience: just the cents array (what `tuning.ts` ModeCents wants). */
export const modeCents = (m: Mode): number[] => m.degrees.map((d) => d.cents)
