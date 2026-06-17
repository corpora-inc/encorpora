/**
 * beatlounge — Western modes (12-TET cents).
 *
 * The diatonic modes, the minor variants + their useful modes, the pentatonics,
 * blues, whole-tone, octatonic, and chromatic — each a degree set of exact
 * cents-above-tonic. In 12-TET cents = 100 · semitone, so these are all
 * multiples of 100. The SAME semitone skeletons can be re-voiced through the
 * `just`/`pythagorean` TuningSystems in `../tuning.ts` later with no migration —
 * that's the payoff of the cents representation.
 */

import type { Mode, ModeDegree } from "./types"
import { CENTS_PER_SEMITONE } from "../tuning"

/** Interval labels by semitone offset (for degree labels). */
const SEMI_LABEL: Record<number, string> = {
  0: "1",
  1: "b2",
  2: "2",
  3: "b3",
  4: "3",
  5: "4",
  6: "b5",
  7: "5",
  8: "b6",
  9: "6",
  10: "b7",
  11: "7",
}

/** Build degrees from a semitone offset list (12-TET). */
const fromSemitones = (semis: readonly number[]): ModeDegree[] =>
  semis.map((s) => ({
    cents: s * CENTS_PER_SEMITONE,
    label: SEMI_LABEL[((s % 12) + 12) % 12] ?? String(s),
  }))

interface Spec {
  id: string
  name: string
  semis: readonly number[]
  aliases?: string[]
}

const SPECS: Spec[] = [
  // --- the 7 diatonic modes ---
  { id: "western.ionian", name: "Ionian (Major)", semis: [0, 2, 4, 5, 7, 9, 11], aliases: ["major"] },
  { id: "western.dorian", name: "Dorian", semis: [0, 2, 3, 5, 7, 9, 10] },
  { id: "western.phrygian", name: "Phrygian", semis: [0, 1, 3, 5, 7, 8, 10] },
  { id: "western.lydian", name: "Lydian", semis: [0, 2, 4, 6, 7, 9, 11] },
  { id: "western.mixolydian", name: "Mixolydian", semis: [0, 2, 4, 5, 7, 9, 10] },
  { id: "western.aeolian", name: "Aeolian (Natural Minor)", semis: [0, 2, 3, 5, 7, 8, 10], aliases: ["minor", "natural-minor"] },
  { id: "western.locrian", name: "Locrian", semis: [0, 1, 3, 5, 6, 8, 10] },

  // --- harmonic minor + its useful modes ---
  { id: "western.harmonicMinor", name: "Harmonic Minor", semis: [0, 2, 3, 5, 7, 8, 11] },
  { id: "western.phrygianDominant", name: "Phrygian Dominant", semis: [0, 1, 4, 5, 7, 8, 10], aliases: ["freygish", "hijaz-like", "5th mode harmonic minor"] },

  // --- melodic minor (ascending) + its useful modes ---
  { id: "western.melodicMinor", name: "Melodic Minor (Asc.)", semis: [0, 2, 3, 5, 7, 9, 11], aliases: ["jazz minor"] },
  { id: "western.lydianDominant", name: "Lydian Dominant", semis: [0, 2, 4, 6, 7, 9, 10], aliases: ["acoustic scale", "lydian b7", "4th mode melodic minor"] },
  { id: "western.altered", name: "Altered (Super Locrian)", semis: [0, 1, 3, 4, 6, 8, 10], aliases: ["super locrian", "7th mode melodic minor"] },

  // --- pentatonics + blues ---
  { id: "western.majorPentatonic", name: "Major Pentatonic", semis: [0, 2, 4, 7, 9] },
  { id: "western.minorPentatonic", name: "Minor Pentatonic", semis: [0, 3, 5, 7, 10] },
  { id: "western.blues", name: "Blues (Minor)", semis: [0, 3, 5, 6, 7, 10] },

  // --- symmetric scales ---
  { id: "western.wholeTone", name: "Whole Tone", semis: [0, 2, 4, 6, 8, 10] },
  { id: "western.octatonicHW", name: "Octatonic (Half-Whole)", semis: [0, 1, 3, 4, 6, 7, 9, 10], aliases: ["diminished half-whole", "dominant diminished"] },
  { id: "western.octatonicWH", name: "Octatonic (Whole-Half)", semis: [0, 2, 3, 5, 6, 8, 9, 11], aliases: ["diminished whole-half"] },
  { id: "western.chromatic", name: "Chromatic", semis: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
]

export const WESTERN_MODES: Mode[] = SPECS.map((s) => ({
  id: s.id,
  name: s.name,
  family: "western",
  degrees: fromSemitones(s.semis),
  aliases: s.aliases,
}))
