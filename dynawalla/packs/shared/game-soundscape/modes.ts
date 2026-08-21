/**
 * The pitch collections a soundscape can be in.
 *
 * Ported — not imported — from Corpán's beatlounge pack, whose corpus
 * (`corpan/packs/beatlounge/src/music/modes/`) holds 130 modes across six
 * families with every degree given as exact cents-above-tonic. Ported because a
 * Dynawalla pack must not have an edge into a Corpán pack: `packs/shared/` is
 * vendored into each pack at build time through the `@shared` alias, and a
 * cross-product import would put beatlounge's build graph inside a maths game's
 * bundle. The representation is deliberately identical, so widening this table
 * from that one is a copy rather than a translation.
 *
 * **What is here, and what is deliberately not yet.** Thirty-eight modes: the
 * Western modes worth being chill in, the ten Hindustani thaats (the parent
 * scales the ragas are drawn from), and twelve Arabic maqamat with their
 * neutral degrees intact. Not here: the 72 Carnatic melakartas, the Persian
 * dastgāh and the Turkish makamlar, which exist in beatlounge and are a data
 * change away. Thirty-eight already means a child who plays for an hour a day
 * for a month does not hear the same scale twice in the same key, which was the
 * point.
 *
 * **The maqam degrees are not on a 24-TET grid by accident.** Rast's third at
 * 350 cents and Saba's narrowed fourth are what make those maqamat themselves;
 * rounding them to the nearest semitone turns Rast into Ionian and Bayati into
 * Phrygian, which is the specific failure this representation exists to avoid.
 *
 * Every entry also carries two things beatlounge's schema does not, because a
 * *game* needs them and a DAW does not:
 *
 *   `rest`    the degrees a phrase may end on. This is what makes a run of
 *             taps a sentence rather than a list: the walker is pulled toward
 *             these and cadences onto one. Without it, eight ascending steps
 *             end wherever the eighth happened to land, which is the sound of
 *             a scale being practised rather than a tune.
 *   `colour`  the one degree whose presence is what makes the mode sound like
 *             itself — Lydian's sharp fourth, Phrygian's flat second, Hijaz's
 *             augmented second. Tension spends its budget here: a tense
 *             soundscape leans on the colour degree, a calm one avoids it.
 *             Both are still the same mode, which is why tension can rise
 *             without anything going out of tune.
 */

export type ModeFamily = "western" | "thaat" | "maqam"

export type Mode = {
  /** Stable, and the same id beatlounge uses where the mode exists in both. */
  readonly id: string
  readonly name: string
  readonly family: ModeFamily
  /**
   * Ascending degrees within one octave, exact cents above the tonic.
   * `degrees[0]` is 0 and the octave is implied, so a seven-note mode has
   * seven entries.
   */
  readonly degrees: readonly number[]
  /** Indices into `degrees` a phrase may come to rest on. Always contains 0. */
  readonly rest: readonly number[]
  /** The index that makes this mode sound like itself. */
  readonly colour: number
}

type Spec = {
  readonly id: string
  readonly name: string
  /** Semitone offsets, for the 12-TET families. Multiplied by 100. */
  readonly semis?: readonly number[]
  /** Exact cents, for anything that is not on the semitone grid. */
  readonly cents?: readonly number[]
  readonly rest: readonly number[]
  readonly colour: number
}

const WESTERN: readonly Spec[] = [
  { id: "western.ionian", name: "Ionian", semis: [0, 2, 4, 5, 7, 9, 11], rest: [0, 2, 4], colour: 6 },
  { id: "western.dorian", name: "Dorian", semis: [0, 2, 3, 5, 7, 9, 10], rest: [0, 2, 4], colour: 5 },
  { id: "western.phrygian", name: "Phrygian", semis: [0, 1, 3, 5, 7, 8, 10], rest: [0, 2, 4], colour: 1 },
  { id: "western.lydian", name: "Lydian", semis: [0, 2, 4, 6, 7, 9, 11], rest: [0, 2, 4], colour: 3 },
  { id: "western.mixolydian", name: "Mixolydian", semis: [0, 2, 4, 5, 7, 9, 10], rest: [0, 2, 4], colour: 6 },
  { id: "western.aeolian", name: "Aeolian", semis: [0, 2, 3, 5, 7, 8, 10], rest: [0, 2, 4], colour: 5 },
  { id: "western.harmonicMinor", name: "Harmonic Minor", semis: [0, 2, 3, 5, 7, 8, 11], rest: [0, 2, 4], colour: 6 },
  { id: "western.melodicMinor", name: "Melodic Minor", semis: [0, 2, 3, 5, 7, 9, 11], rest: [0, 2, 4], colour: 6 },
  { id: "western.phrygianDominant", name: "Phrygian Dominant", semis: [0, 1, 4, 5, 7, 8, 10], rest: [0, 2, 4], colour: 1 },
  { id: "western.lydianDominant", name: "Lydian Dominant", semis: [0, 2, 4, 6, 7, 9, 10], rest: [0, 2, 4], colour: 3 },
  { id: "western.majorPentatonic", name: "Major Pentatonic", semis: [0, 2, 4, 7, 9], rest: [0, 2, 3], colour: 4 },
  { id: "western.minorPentatonic", name: "Minor Pentatonic", semis: [0, 3, 5, 7, 10], rest: [0, 1, 3], colour: 4 },
  { id: "western.egyptianPentatonic", name: "Egyptian Pentatonic", semis: [0, 2, 5, 7, 10], rest: [0, 2, 3], colour: 4 },
  { id: "western.hirajoshi", name: "Hirajoshi", semis: [0, 2, 3, 7, 8], rest: [0, 2, 3], colour: 4 },
  { id: "western.blues", name: "Blues", semis: [0, 3, 5, 6, 7, 10], rest: [0, 1, 4], colour: 3 },
  { id: "western.wholeTone", name: "Whole Tone", semis: [0, 2, 4, 6, 8, 10], rest: [0, 2, 4], colour: 3 },
]

/**
 * The ten Hindustani thaats — the parent scales the ragas are classified under.
 *
 * A thaat is not a raga: a raga adds an ascent, a descent, a resting note and a
 * set of phrases on top of one. What this module's walker supplies is precisely
 * an ascent, a descent and a resting note, so a thaat plus a walk is much
 * closer to a raga than a thaat alone — which is the honest claim, and it is
 * why the ids say `thaat`.
 */
const THAATS: readonly Spec[] = [
  { id: "thaat.bilawal", name: "Bilawal", semis: [0, 2, 4, 5, 7, 9, 11], rest: [0, 2, 4], colour: 6 },
  { id: "thaat.khamaj", name: "Khamaj", semis: [0, 2, 4, 5, 7, 9, 10], rest: [0, 2, 4], colour: 6 },
  { id: "thaat.kafi", name: "Kafi", semis: [0, 2, 3, 5, 7, 9, 10], rest: [0, 2, 4], colour: 5 },
  { id: "thaat.asavari", name: "Asavari", semis: [0, 2, 3, 5, 7, 8, 10], rest: [0, 2, 4], colour: 5 },
  { id: "thaat.bhairav", name: "Bhairav", semis: [0, 1, 4, 5, 7, 8, 11], rest: [0, 2, 4], colour: 1 },
  { id: "thaat.bhairavi", name: "Bhairavi", semis: [0, 1, 3, 5, 7, 8, 10], rest: [0, 2, 4], colour: 1 },
  { id: "thaat.todi", name: "Todi", semis: [0, 1, 3, 6, 7, 8, 11], rest: [0, 2, 4], colour: 3 },
  { id: "thaat.purvi", name: "Purvi", semis: [0, 1, 4, 6, 7, 8, 11], rest: [0, 2, 4], colour: 3 },
  { id: "thaat.marwa", name: "Marwa", semis: [0, 1, 4, 6, 7, 9, 11], rest: [0, 2, 4], colour: 3 },
  { id: "thaat.kalyan", name: "Kalyan", semis: [0, 2, 4, 6, 7, 9, 11], rest: [0, 2, 4], colour: 3 },
]

/**
 * The maqamat, at beatlounge's default (Cairo-Congress grid) intonation.
 *
 * The neutral degrees — 150, 350, 450, 550, 850, 1050 — are the whole point.
 * They are not typos and they must not be rounded.
 */
const MAQAMAT: readonly Spec[] = [
  { id: "maqam.rast", name: "Rast", cents: [0, 204, 350, 498, 702, 906, 1050], rest: [0, 2, 4], colour: 2 },
  { id: "maqam.bayati", name: "Bayati", cents: [0, 150, 294, 498, 702, 792, 996], rest: [0, 2, 4], colour: 1 },
  { id: "maqam.hijaz", name: "Hijaz", cents: [0, 128, 386, 498, 702, 792, 996], rest: [0, 2, 4], colour: 1 },
  { id: "maqam.hijazkar", name: "Hijazkar", cents: [0, 128, 386, 498, 702, 830, 1088], rest: [0, 2, 4], colour: 1 },
  { id: "maqam.saba", name: "Saba", cents: [0, 150, 300, 400, 700, 800, 1000], rest: [0, 2, 4], colour: 3 },
  { id: "maqam.sikah", name: "Sikah", cents: [0, 150, 350, 550, 700, 850, 1050], rest: [0, 2, 4], colour: 3 },
  { id: "maqam.huzam", name: "Huzam", cents: [0, 150, 350, 450, 750, 850, 1050], rest: [0, 2, 4], colour: 3 },
  { id: "maqam.nahawand", name: "Nahawand", cents: [0, 204, 294, 498, 702, 792, 1088], rest: [0, 2, 4], colour: 6 },
  { id: "maqam.kurd", name: "Kurd", cents: [0, 90, 294, 498, 702, 792, 996], rest: [0, 2, 4], colour: 1 },
  { id: "maqam.ajam", name: "Ajam", cents: [0, 204, 408, 498, 702, 906, 1110], rest: [0, 2, 4], colour: 6 },
  { id: "maqam.nikriz", name: "Nikriz", cents: [0, 204, 294, 594, 702, 906, 996], rest: [0, 2, 4], colour: 3 },
  { id: "maqam.suznak", name: "Suznak", cents: [0, 204, 350, 498, 702, 830, 1088], rest: [0, 2, 4], colour: 5 },
]

function build(spec: Spec, family: ModeFamily): Mode {
  const degrees = spec.cents ?? (spec.semis ?? []).map((s) => s * 100)
  return {
    id: spec.id,
    name: spec.name,
    family,
    degrees,
    rest: spec.rest,
    colour: spec.colour,
  }
}

/** Every mode this module knows, in a stable order. */
export const MODES: readonly Mode[] = [
  ...WESTERN.map((s) => build(s, "western")),
  ...THAATS.map((s) => build(s, "thaat")),
  ...MAQAMAT.map((s) => build(s, "maqam")),
]

const BY_ID = new Map<string, Mode>(MODES.map((m) => [m.id, m]))

export const MODE_IDS: readonly string[] = MODES.map((m) => m.id)

/**
 * A mode by id, or `null`.
 *
 * `null` rather than a throw, and rather than a silent fallback to Ionian: the
 * id can arrive from the host over a `MessagePort`, so an unknown one is an
 * ordinary runtime event and not a bug in the caller. The caller decides — and
 * `soundscape.ts` decides to keep whatever it already had, which is the only
 * choice that cannot make a game go silent.
 */
export function modeById(id: string): Mode | null {
  return BY_ID.get(id) ?? null
}
