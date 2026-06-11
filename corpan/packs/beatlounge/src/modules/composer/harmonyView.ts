/**
 * beatlounge — pure view-model for the HARMONY BAR (the top-level harmony UI).
 *
 * "Both in one Harmony bar": a tonic + EITHER a mode OR a chord progression,
 * both feeding the one resolver every melodic module reads. This module is the
 * REACT-FREE logic behind that surface — the family/scale lists, the note row,
 * the visual chord grid over the loop's beats, and the corpus→harmony bridge —
 * so it is unit-tested without a DOM.
 */

import type { BeatloungeDoc, HarmonyScaleFamily } from "../../model/document"
import { docHarmony } from "../../model/document"
import { PPQ, type Tick } from "../../model/timing"
import { FLAT_NAMES, SHARP_NAMES, parseChord } from "../../music/harmony"
import { MODES_BY_FAMILY, type Mode } from "../../music/modes"
import { activePitches } from "../../music/resolver"
import {
  progressionToChordEvents,
  type CorpusProgression,
} from "../../music/chords"

// --------------------------------------------------------------- tonic / keys
/** The 12 tonic options, sharp-spelled (index = pitch class). */
export const TONIC_NAMES = SHARP_NAMES

/** Spell a pitch class for display (sharps by default). */
export const tonicLabel = (pc: number, preferFlat = false): string =>
  (preferFlat ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12]

// --------------------------------------------------------------- families
export const HARMONY_FAMILIES: { id: HarmonyScaleFamily; label: string }[] = [
  { id: "western", label: "Western" },
  { id: "thaat", label: "Thaat" },
  { id: "melakarta", label: "Melakarta" },
  { id: "maqam", label: "Maqam" },
]

/** The selectable scales of a family, as { id, name }. */
export interface ScaleOption {
  id: string
  name: string
}

export const scalesForFamily = (family: HarmonyScaleFamily): ScaleOption[] =>
  MODES_BY_FAMILY[family].map((m) => ({ id: m.id, name: m.name }))

/** Resolve a corpus Mode for display (undefined if the id is unknown). */
export const modeById = (family: HarmonyScaleFamily, id: string): Mode | undefined =>
  MODES_BY_FAMILY[family].find((m) => m.id === id)

/** Is this family microtonal in practice (any neutral/non-12-TET degree)? */
export const familyIsMicrotonal = (family: HarmonyScaleFamily): boolean =>
  family === "maqam"

/** Does the SPECIFIC scale carry a non-12-TET degree (true microtonal)? */
export const scaleIsMicrotonal = (mode: Mode | undefined): boolean =>
  !!mode &&
  mode.degrees.some(
    (d) => Math.abs(d.cents - Math.round(d.cents / 100) * 100) > 1
  )

// --------------------------------------------------------------- note row
/** A single note in the resolved scale row (for the "show the notes" strip). */
export interface NoteCell {
  /** Pitch class 0..11. */
  pc: number
  /** Display label (the tonic spelled by name; others sharp-spelled). */
  label: string
  /** This is the tonic. */
  tonic: boolean
  /** The degree's own-system label (e.g. "b3", a swara), informational. */
  degree: string
}

/**
 * The active scale as a display row of notes (the "resulting note row" the
 * Harmony bar shows under the mode picker). Reads the resolver so it is the
 * SAME set the ribbon/piano-roll lock to.
 */
export const noteRow = (doc: BeatloungeDoc): NoteCell[] => {
  const h = docHarmony(doc)
  const ap = activePitches(doc, 0)
  const mode = MODES_BY_FAMILY[h.scale.family].find((m) => m.id === h.scale.id)
  // Order the row by DEGREE (ascending cents-from-tonic), so it reads tonic-first
  // — the musical reading, not absolute pitch-class order.
  return ap.cents.map((cents, i) => {
    const pc = ((ap.tonicPc + Math.round(cents / 100)) % 12 + 12) % 12
    return {
      pc,
      label: tonicLabel(pc),
      tonic: pc === ap.tonicPc,
      degree: mode?.degrees[i]?.label ?? "",
    }
  })
}

// --------------------------------------------------------------- chord grid
/** One beat-slot on the visual chord grid across the loop. */
export interface BeatSlot {
  /** Slot index (0-based beat). */
  index: number
  /** Tick of the beat (PPQ-aligned). */
  tick: Tick
  /** Bar number this beat belongs to (0-based). */
  bar: number
  /** Beat within the bar (0-based). */
  beatInBar: number
  /** The chord symbol placed AT this exact beat, or null (empty slot). */
  symbol: string | null
  /** True if a chord starting on an earlier beat sustains over this slot. */
  sustained: boolean
}

/** Beats per bar from the doc's first meter (default 4). */
export const beatsPerBar = (doc: BeatloungeDoc): number =>
  Math.max(1, doc.meterMap[0]?.sig.numerator ?? 4)

/** Total beats in the loop (rounded up to the next whole beat). */
export const loopBeats = (doc: BeatloungeDoc): number =>
  Math.max(1, Math.round(doc.loopLengthTicks / PPQ))

/**
 * The visual chord grid: one slot per beat across the whole loop, each carrying
 * the chord placed on it (if any) and whether a prior chord sustains over it.
 * This is the "fill the beats with chords" surface — tap a slot, choose a chord.
 */
export const buildChordGrid = (doc: BeatloungeDoc): BeatSlot[] => {
  const h = docHarmony(doc)
  const bpb = beatsPerBar(doc)
  const beats = loopBeats(doc)
  const byTick = new Map<number, string>()
  for (const c of h.progression) byTick.set(c.tick, c.symbol)

  const slots: BeatSlot[] = []
  let lastSymbol: string | null = null
  for (let i = 0; i < beats; i++) {
    const tick = i * PPQ
    const symbol = byTick.get(tick) ?? null
    if (symbol) lastSymbol = symbol
    slots.push({
      index: i,
      tick,
      bar: Math.floor(i / bpb),
      beatInBar: i % bpb,
      symbol,
      sustained: symbol == null && lastSymbol != null,
    })
  }
  return slots
}

/** A friendly display of a chord symbol (normalized via the parser). */
export const displayChord = (symbol: string): string => {
  const c = parseChord(symbol)
  return c ? c.symbol : symbol
}

// --------------------------------------------------------------- chord palette
/**
 * The chord-quality palette offered for a slot — "choose a chord from a palette
 * of qualities/degrees". Combined with a root from `paletteRoots`, a tap builds
 * a 12-TET chord symbol the resolver parses.
 */
const PALETTE_QUALITIES: { suffix: string; label: string }[] = [
  { suffix: "", label: "maj" },
  { suffix: "m", label: "min" },
  { suffix: "7", label: "7" },
  { suffix: "maj7", label: "maj7" },
  { suffix: "m7", label: "m7" },
  { suffix: "sus4", label: "sus4" },
  { suffix: "dim", label: "dim" },
  { suffix: "aug", label: "aug" },
]

/**
 * The 12 roots in TONIC-RELATIVE order (the tonic first, then up by semitone) —
 * a compact root picker where the in-key roots cluster near the front.
 */
export const paletteRoots = (doc: BeatloungeDoc): string[] => {
  const h = docHarmony(doc)
  return Array.from({ length: 12 }, (_, pc) => tonicLabel((h.tonic + pc) % 12))
}

/** Build a chord symbol from a chosen root label + quality suffix. */
export const buildChordSymbol = (root: string, suffix: string): string =>
  `${root}${suffix}`

export const PALETTE_QUALITY_OPTIONS = PALETTE_QUALITIES

// --------------------------------------------------------------- corpus bridge
/**
 * Convert a 994-corpus progression into harmony ChordEvents at the global
 * tonic, aligned to the loop from tick 0. Returns BOTH the chord events (for
 * `setProgression`) AND the loop length the progression needs — so dropping a
 * ready-made progression resizes the loop to fit (like the old composer did).
 */
export const corpusProgressionToHarmony = (
  prog: CorpusProgression,
  tonicPc: number
): { chords: { tick: Tick; symbol: string; durationTicks: Tick }[]; loopTicks: Tick } => {
  const events = progressionToChordEvents(prog, { keyRoot: tonicPc, ppq: PPQ })
  const chords = events.map((e) => ({
    tick: e.startTick,
    symbol: chordSymbolFromRoman(e, tonicPc),
    durationTicks: e.durationTicks,
  }))
  const loopTicks =
    events.length > 0
      ? events[events.length - 1].startTick + events[events.length - 1].durationTicks
      : PPQ * 4
  return { chords, loopTicks }
}

/**
 * A concrete chord SYMBOL ("Gm7") from a resolved corpus chord event, in the
 * given key. We derive the root pitch-class from the event's lowest voiced note
 * and the quality suffix from the corpus chord's quality.
 */
const QUALITY_SUFFIX: Record<string, string> = {
  maj: "",
  min: "m",
  dim: "dim",
  aug: "aug",
  sus2: "sus2",
  sus4: "sus4",
  maj7: "maj7",
  min7: "m7",
  dom7: "7",
  dim7: "dim7",
  m7b5: "m7b5",
  minMaj7: "mMaj7",
  maj6: "6",
  min6: "m6",
  six9: "6",
  dom9: "9",
  maj9: "maj9",
  min9: "m9",
  dom11: "11",
  min11: "m11",
  dom13: "13",
  maj13: "maj13",
  add9: "add9",
  altered: "7",
  five: "5",
}

const chordSymbolFromRoman = (
  e: ReturnType<typeof progressionToChordEvents>[number],
  tonicPc: number
): string => {
  void tonicPc
  // The lowest voiced note's pitch class is the chord root (close voicings start
  // on the root; inversions are reflected in the symbol's quality, not root).
  const rootMidi = Math.min(...e.notes)
  const rootPc = ((rootMidi % 12) + 12) % 12
  const suffix = QUALITY_SUFFIX[e.chord.quality] ?? ""
  return `${tonicLabel(rootPc)}${suffix}`
}

export type { CorpusProgression } from "../../music/chords"
