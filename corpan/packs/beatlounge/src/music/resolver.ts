/**
 * beatlounge — the GLOBAL HARMONY RESOLVER (HARMONY_VISION §3, §4.2).
 *
 * THE ONE API every melodic module calls. No module picks its own scale ever
 * again: the ribbon, piano-roll, composer/JAM, and generative fills all derive
 * their legal/preferred pitches from `doc.harmony` through these pure functions.
 *
 * Both editor modes resolve to the SAME shape so consumers never branch on
 * mode (HARMONY_VISION §3.3):
 *   - MODAL  → the chosen corpus scale (time-invariant).
 *   - CHORDAL→ the chord-of-the-moment (`harmonyAt`) AND the implied scale =
 *     the UNION of all chord tones across the loop ("the mode is implied by all
 *     the chords" — the founder's rule).
 *
 * Pitch math is the universal cents-from-tonic currency (`./tuning`). 12-TET is
 * the default and the detune at the audio edge is 0; non-12-TET tunings (and
 * maqam's exact cents) carry a real detune via `detuneForMidi`.
 *
 * Pure + dependency-free of React/audio/the doc write path. Exhaustively tested.
 */

import type { BeatloungeDoc, Harmony } from "../model/document"
import { docHarmony } from "../model/document"
import type { Tick } from "../model/timing"
import {
  CENTS_PER_SEMITONE,
  TUNING_SYSTEMS,
  detuneCentsForMidi,
  type ModeCents,
  type TuningSystem,
} from "./tuning"
import { MODE_BY_ID, toModeCents, WESTERN_MODES, maqamatForSchool, DEFAULT_SCHOOL } from "./modes"
import type { Mode } from "./modes"
import { parseChord, toPc, type Chord } from "./harmony"

/** Positive modulo. */
const fmod = (n: number, m: number): number => ((n % m) + m) % m

/** Default modal fallback when an unknown scale id is stored: C-major skeleton. */
const FALLBACK_MODE: Mode =
  MODE_BY_ID["western.ionian"] ?? WESTERN_MODES[0]

/** Resolve the corpus Mode for a harmony's modal scale (forgiving). For maqam the
 *  per-song regional `school` picks the right neutral-cents variant (same mode id,
 *  different sikah/Rast-3rd) so switching school re-tunes live. */
export const resolveMode = (h: Harmony): Mode => {
  if (h.scale.family === "maqam") {
    const m = maqamatForSchool(h.scale.school ?? DEFAULT_SCHOOL).find((x) => x.id === h.scale.id)
    if (m) return m
  }
  return MODE_BY_ID[h.scale.id] ?? FALLBACK_MODE
}

/** Resolve the TuningSystem for a harmony (defaults to equal12). */
export const resolveTuning = (h: Harmony): TuningSystem =>
  TUNING_SYSTEMS[h.scale.tuning] ?? TUNING_SYSTEMS.equal12

// ===================================================================== chords
/**
 * The active chord at a tick (chordal mode): the LAST chord whose tick ≤ the
 * query tick (it sustains until the next chord). Returns null in modal mode or
 * when the timeline is empty / the query precedes the first chord.
 */
export const chordAt = (doc: BeatloungeDoc, tick: Tick): Chord | null => {
  const h = docHarmony(doc)
  if (h.mode !== "chordal" || h.progression.length === 0) return null
  let active: (typeof h.progression)[number] | null = null
  for (const ev of h.progression) {
    if (ev.tick <= tick) active = ev
    else break // progression is tick-sorted
  }
  if (!active) return null
  return parseChord(active.symbol)
}

/**
 * The implied-scale pitch classes for chordal mode: the UNION of all chord
 * tones across the whole loop (globalUnion — HARMONY_VISION §3.2). Stable, so
 * a ribbon's frets never jump beat-to-beat. Empty timeline ⇒ empty set.
 */
export const impliedScalePcs = (h: Harmony): number[] => {
  const set = new Set<number>()
  for (const ev of h.progression) {
    const chord = parseChord(ev.symbol)
    if (!chord) continue
    for (const pc of chord.pcs) set.add(toPc(pc))
  }
  return [...set].sort((a, b) => a - b)
}

// ===================================================================== pitches
/**
 * The active pitch SET at a tick, as cents-above-the-global-tonic (the
 * universal currency) PLUS the equivalent pitch-class set (12-TET projection,
 * for fret/row drawing). Both modes resolve to this one shape:
 *   - modal:   the corpus scale's exact cents (time-invariant; honors tuning).
 *   - chordal: the implied scale = union of all chord tones (cents = 100·pc-
 *     offset-from-tonic, since chords are 12-TET).
 *
 * `cents` is ascending within one octave, cents[0] === 0 (the tonic). `pcs` are
 * the absolute pitch classes (0..11) the set occupies.
 */
export interface ActivePitches {
  /** The global tonic pitch class 0..11. */
  tonicPc: number
  /** Ascending cents-above-tonic within one octave (cents[0] === 0). */
  cents: number[]
  /** Absolute pitch classes (0..11) the set occupies, ascending. */
  pcs: number[]
}

export const activePitches = (doc: BeatloungeDoc, tick: Tick): ActivePitches => {
  // `tick` is part of the stable API (a future local-window scope reads it);
  // the default globalUnion / modal scale is time-invariant, so it's unused now.
  void tick
  const h = docHarmony(doc)
  const tonicPc = toPc(h.tonic)

  if (h.mode === "chordal") {
    const impliedPcs = impliedScalePcs(h)
    // Express each pc as cents-above-tonic within one octave (12-TET).
    const cents = impliedPcs
      .map((pc) => fmod(pc - tonicPc, 12) * CENTS_PER_SEMITONE)
      .sort((a, b) => a - b)
    // De-dup (multiple chords can land on the same cents) + ensure the tonic
    // leads when present.
    const uniqueCents = [...new Set(cents)]
    // pcs sorted ascending absolute.
    const pcs = [...new Set(impliedPcs.map(toPc))].sort((a, b) => a - b)
    // If the timeline is empty, fall through to an empty (but valid) set.
    return { tonicPc, cents: uniqueCents, pcs }
  }

  // Modal: the corpus scale's exact cents (already cents-above-tonic).
  const mode = resolveMode(h)
  const tuning = resolveTuning(h)
  const cents = scaleCents(mode, tuning)
  const pcs = cents
    .map((c) => toPc(tonicPc + Math.round(c / CENTS_PER_SEMITONE)))
    // de-dup pcs that collapse under 12-TET rounding (maqam neutral tones)
    .filter((pc, i, arr) => arr.indexOf(pc) === i)
    .sort((a, b) => a - b)
  return { tonicPc, cents, pcs }
}

/**
 * A modal scale's exact cents-above-tonic, honoring the tuning. For equal12 the
 * corpus cents pass through unchanged (and maqam's exact neutral cents survive);
 * for just/pythagorean the 12-TET semitone skeleton is re-voiced through the
 * tuning (the payoff of the cents representation — same mode, different cents).
 */
export const scaleCents = (mode: Mode, tuning: TuningSystem): number[] => {
  if (tuning.id === "equal12") return mode.degrees.map((d) => d.cents)
  return mode.degrees.map((d) => {
    // The degree's nearest 12-TET semitone class is what the tuning intonates.
    const semitone = Math.round(d.cents / CENTS_PER_SEMITONE)
    return tuning.degreeToCents(semitone)
  })
}

// ============================================================ membership / snap
/**
 * Adapt the active pitch set at a tick into the `ModeCents` shape `tuning.ts`
 * consumes (cents-above-tonic, one octave). Used by quantize/membership/detune.
 */
const activeModeCents = (doc: BeatloungeDoc, tick: Tick): ModeCents => {
  const ap = activePitches(doc, tick)
  // Guarantee a non-empty set so quantize never divides by nothing (a chordal
  // doc with no chords falls back to the chromatic-free tonic-only set).
  const cents = ap.cents.length > 0 ? ap.cents : [0]
  // Ensure the tonic (0) is present and the list is sorted ascending.
  const withTonic = cents.includes(0) ? cents : [0, ...cents]
  return { degrees: [...new Set(withTonic)].sort((a, b) => a - b) }
}

/** Is the 12-TET MIDI note in the active harmony's pitch-class set at `tick`? */
export const inHarmony = (
  midi: number,
  doc: BeatloungeDoc,
  tick: Tick
): boolean => {
  const ap = activePitches(doc, tick)
  if (ap.pcs.length === 0) return false
  return ap.pcs.includes(toPc(Math.round(midi)))
}

/**
 * The nearest in-harmony 12-TET MIDI note to `midi` at `tick` (fret/lock). Ties
 * resolve DOWN (the lower note), which feels musically stable. Octave-preserving
 * within a small search window; always returns a pitch genuinely in the set.
 * Falls back to the input if the set is empty (chordal with no chords).
 */
export const quantizeToHarmony = (
  midi: number,
  doc: BeatloungeDoc,
  tick: Tick
): number => {
  const ap = activePitches(doc, tick)
  if (ap.pcs.length === 0) return Math.round(midi)
  const base = Math.round(midi)
  for (let d = 0; d <= 6; d++) {
    if (ap.pcs.includes(toPc(base - d))) return base - d
    if (d > 0 && ap.pcs.includes(toPc(base + d))) return base + d
  }
  return base
}

/**
 * The cents offset to apply to a played 12-TET MIDI note so it lands on the
 * active harmony's EXACT pitch (microtonal detune at the audio edge). 0 in pure
 * 12-TET; non-zero for just/pythagorean tunings and maqam neutral degrees.
 *
 * Anchored at the tonic MIDI nearest the played note's octave, so the detune is
 * consistent across the keyboard. In modal mode the corpus scale + tuning drive
 * it (via `tuning.ts`'s detune bridge); in chordal mode the implied scale is
 * 12-TET so the detune is 0.
 */
export const detuneForMidi = (
  midi: number,
  doc: BeatloungeDoc,
  tick: Tick
): number => {
  const h = docHarmony(doc)
  // Chordal implied scales are 12-TET → no detune.
  if (h.mode === "chordal") return 0
  // Only notes that BELONG to the active scale bend to their exact cents. An
  // out-of-scale authored note — e.g. a sequencer pitch stranded after a live
  // mode switch — must play 12-TET as placed, NOT snap onto the nearest degree:
  // snapping collapses distinct pitches onto a unison (in Hijaz, MIDI 61→+28¢ and
  // 62→−72¢ both land on 61.28), which loses the user's note AND sums amplitude
  // (the "volume jumps on scale switch" bug). Ribbon/live play already quantizes
  // to in-scale frets before playing, so it is unaffected by this guard.
  if (!inHarmony(midi, doc, tick)) return 0
  const tuning = resolveTuning(h)
  if (tuning.id === "equal12") {
    // 12-TET-multiple Western modes ⇒ 0; maqam neutral cents ⇒ real detune.
    const mode = resolveMode(h)
    if (!hasMicrotonalDegree(mode)) return 0
    return detuneCentsForMidi(midi, toModeCents(mode), tuning, tonicMidiNear(h, midi))
  }
  const mode = resolveMode(h)
  return detuneCentsForMidi(midi, toModeCents(mode), tuning, tonicMidiNear(h, midi))
}

/** Does any degree of the mode deviate from a 12-TET semitone (maqam neutral)? */
const hasMicrotonalDegree = (mode: Mode): boolean =>
  mode.degrees.some(
    (d) => Math.abs(d.cents - Math.round(d.cents / CENTS_PER_SEMITONE) * CENTS_PER_SEMITONE) > 1
  )

/** A tonic MIDI near a played note (same octave region), anchored to the ref. */
const tonicMidiNear = (h: Harmony, midi: number): number => {
  const tonicPc = toPc(h.tonic)
  // The tonic in the octave at or just below `midi`.
  const base = Math.round(midi)
  const below = base - fmod(base - tonicPc, 12)
  return below
}

// ============================================================== convenience
/**
 * Every in-harmony 12-TET MIDI note in [loMidi, hiMidi] inclusive, ascending —
 * the set of "frets"/rows the ribbon + piano-roll draw and snap to. Pure
 * projection of `activePitches` across the register window.
 */
export const activeMidiInRange = (
  doc: BeatloungeDoc,
  tick: Tick,
  loMidi: number,
  hiMidi: number
): number[] => {
  const ap = activePitches(doc, tick)
  if (ap.pcs.length === 0) return []
  const lo = Math.ceil(loMidi)
  const hi = Math.floor(hiMidi)
  const out: number[] = []
  for (let p = lo; p <= hi; p++) {
    if (ap.pcs.includes(toPc(p))) out.push(p)
  }
  return out
}

/**
 * `harmonyAt` — the founder's "harmony of the moment": the active chord (chordal
 * mode) plus the active pitch set + tonic. The one call a comping/arp consumer
 * makes ("what's sounding now"). Modal mode has chord === null.
 */
export interface HarmonyAt {
  /** The vertical chord at this tick (chordal), or null (pure modal). */
  chord: Chord | null
  /** The active pitch set (same as `activePitches`). */
  active: ActivePitches
  /** The global tonic pitch class. */
  tonicPc: number
  /** The editor mode the resolver branched on. */
  mode: Harmony["mode"]
}

export const harmonyAt = (doc: BeatloungeDoc, tick: Tick): HarmonyAt => {
  const h = docHarmony(doc)
  return {
    chord: chordAt(doc, tick),
    active: activePitches(doc, tick),
    tonicPc: toPc(h.tonic),
    mode: h.mode,
  }
}

/** Re-export the active mode-cents helper for any consumer needing the octave set. */
export { activeModeCents }
