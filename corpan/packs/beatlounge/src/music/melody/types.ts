/**
 * beatlounge — MELODY corpus: the KEY- and MODE-AGNOSTIC schema.
 *
 * The creation enabler. A melody here is never absolute pitch: it is a sequence
 * of SCALE-DEGREE indices read against `doc.harmony` through the global resolver
 * (`../resolver.ts`). Degree 0 = the tonic of the working octave; +1 = the next
 * scale step UP; -1 = one step DOWN; an index past the scale size wraps into the
 * next octave at resolve time. So the SAME datum sings in C-major, D-dorian, or
 * maqam rast — the resolver supplies the cents/MIDI for whatever scale is live.
 *
 * Two probability layers make generation ENDLESS and non-repeating without an
 * LLM (the founder's "our own specialized weights"):
 *   - a METRIC profile  — per-sixteenth onset weights within a bar (downbeat
 *     high, the pre-downbeat 32nd ~0), driving WHEN a note lands;
 *   - a TRANSITION table — degree→degree weights, driving WHICH scale step comes
 *     next (stepwise pull, resolution to chord tones, occasional leaps).
 *
 * Plus a bank of pre-baked CONTOUR CELLS (reusable melodic shapes) the score's
 * +/− "layer" dial drops onto selected rows. Nothing here is named after a song,
 * artist, or album — every datum is a generic, descriptively-tagged theory
 * object, generated combinatorially (see cells.ts), exactly like the chords
 * corpus (docs/CHORDS_CORPUS.md). Pure data + pure functions; no React/audio/doc.
 */

/** Sixteenth-note count (the corpus's metric grain; PPQ-independent). */
export type Sixteenths = number

/**
 * One melodic event inside a cell, KEY-AGNOSTIC.
 *  - `degree` is a SIGNED scale-degree index (0 = tonic; may exceed ±scaleSize;
 *    octaves wrap at resolve time). NOT a pitch class, NOT MIDI.
 *  - `pos`/`dur` are in sixteenths from the cell start.
 *  - `weight` is relative emphasis 0..1 (→ velocity at resolve time).
 */
export interface CellNote {
  degree: number
  pos: Sixteenths
  dur: Sixteenths
  weight: number
}

/** Coarse melodic-SHAPE family a cell belongs to (the contour taxonomy). */
export type ContourFamily =
  | "ascending"
  | "descending"
  | "arch"
  | "valley"
  | "static"
  | "zigzag"
  | "neighbor"
  | "enclosure"
  | "pendulum"
  | "leap-return"

/** The canonical contour-family list (also the order docs present them). */
export const CONTOUR_FAMILIES: ContourFamily[] = [
  "ascending",
  "descending",
  "arch",
  "valley",
  "static",
  "zigzag",
  "neighbor",
  "enclosure",
  "pendulum",
  "leap-return",
]

/**
 * A key-agnostic melodic CELL: a reusable contour fragment spanning a bar-ish
 * window. Notes are ascending by `pos`, degree-relative. The score's +/− dial
 * layers a cell by transposing its degrees onto a selected row range.
 */
export interface MelodicCell {
  /** Stable, generated, non-naming id, e.g. "contour:arch:len4:0-2-4-2". */
  id: string
  /** Events, ascending by `pos`, degree-relative. */
  notes: CellNote[]
  /** Total metric span in sixteenths (e.g. 16 = one 4/4 bar). */
  spanSixteenths: Sixteenths
  family: ContourFamily
  /** Descriptive THEORY tags (searchable). Never a song/artist/album. */
  tags: string[]
  /** The signed degree range the cell touches, [lo, hi] (cached; derivable). */
  range: [number, number]
}

/**
 * A METRIC-ONSET profile: the relative weight of a note onset at each sixteenth
 * position within a bar. `weights[0]` is the downbeat. Downbeats high, the
 * pre-downbeat 32nd ~0 (the founder's rule). The generator samples onsets from
 * this; the score reads it to place "+" hits at the strongest open slots first.
 */
export interface MetricProfile {
  /** Stable, generated, non-naming id, e.g. "metric:four-on-floor". */
  id: string
  /** Sixteenths per bar this profile covers (16 for 4/4). */
  barSixteenths: Sixteenths
  /** Per-position onset weight, length === barSixteenths, each in 0..1. */
  weights: number[]
  tags: string[]
}

/**
 * A DEGREE-TRANSITION table: given the current scale-degree CLASS (0..size-1),
 * the relative weight of moving to each next degree class. Not required to be
 * normalized (consumers normalize at use). Captures stepwise preference,
 * resolution pull toward chord tones (0/2/4 of a diatonic scale), and the rare
 * leap. The octave a step lands in is chosen separately via `octaveBias`.
 */
export interface TransitionTable {
  /** Stable, generated, non-naming id, e.g. "transition:stepwise". */
  id: string
  /** Scale-degree count the table is defined over (7 for diatonic). */
  scaleSize: number
  /** weights[from][to] ≥ 0; a scaleSize × scaleSize matrix. */
  weights: number[][]
  /**
   * Bias toward changing octave on a step: 0 = always nearest octave, 1 = strong
   * tendency to wander octaves. Drives melodic register drift. Default ~0.12.
   */
  octaveBias: number
  tags: string[]
}

/** The assembled corpus shape (cells + the two probability banks). */
export interface MelodyCorpus {
  cells: readonly MelodicCell[]
  metric: readonly MetricProfile[]
  transitions: readonly TransitionTable[]
}
