/**
 * beatlounge — the SCORE MODEL: the pure brain behind the melody +/− "layer"
 * dial. It mirrors the proven GROOVE density dial (`grooves/grooveModel.ts`),
 * but for PITCHED melody driven by the melody corpus (`../../music/melody`):
 *
 *   • "+" (LAYER)  — lay ONE more probabilistic pass of melody into the SELECTED
 *                    degree rows. Onsets come from a `MetricProfile`, degree
 *                    choice from a `TransitionTable` (`generateMelody`), each note
 *                    constrained to the selected rows and resolved IN KEY via the
 *                    resolver's `degreeToPitch`. ADDITIVE (keeps what's there),
 *                    re-rolls a fresh layer each tap (seeded), gradually denser.
 *   • "−" (SPARSER)— remove a fraction of the current melody notes, lowest-weight
 *                    / off-beat first, down to nothing. Pure; a SMALLER bite than
 *                    "+" adds (asymmetric — "harder to take away than to add").
 *
 * Rows are SCALE DEGREES across a register window (`degreeRows`): each row is a
 * signed degree index (0 = tonic in the working octave) mapped to a concrete MIDI
 * via `degreeToPitch`, so the rows ARE the active harmony's pitches — change the
 * song's mode/chords and the rows re-derive. The dial's selection (a set of row
 * keys) targets exactly those degrees, exactly like the grooves scatter targets
 * selected drum lanes.
 *
 * Everything is built through EXISTING commands only (`addNote` / `removeNote`),
 * returned as ONE list the caller batches (single undo step). Applying only
 * WRITES the grid — it never plays sound ("setup, don't play"). Pure of React +
 * audio; the rng is injected so callers control reproducibility.
 */

import type { Command } from "../../model/command"
import type { BeatloungeDoc, NoteEvent } from "../../model/document"
import { findTrack, isInstrumentTrack } from "../../model/document"
import { PPQ, quantizeTick, stepsInLoop, tickForStep, type Grid, type Tick } from "../../model/timing"
import { activePitches, type ActivePitches } from "../../music/resolver"
import {
  degreeToPitch,
  generateMelody,
  type MelodyNote,
  type MetricProfile,
  type TransitionTable,
} from "../../music/melody"
import { ct } from "../../i18n/strings"

/** Ticks per one sixteenth note — the melody corpus's metric grain. The corpus
 *  expresses pos/dur in sixteenths; the track addresses ticks. PPQ/4 (= 240 at
 *  PPQ 960). Never hardcode the tick count — derive it from PPQ. */
export const SIXTEENTH_TICKS: Tick = PPQ / 4

/** Sixteenths → ticks (round defensively; always integer at PPQ 960). */
export const sixteenthsToTicks = (sixteenths: number): Tick =>
  Math.round(sixteenths * SIXTEENTH_TICKS)

/** Ticks → sixteenths (inverse; nearest). */
export const ticksToSixteenths = (tick: Tick): number =>
  Math.round(tick / SIXTEENTH_TICKS)

/** Per-"+"-tap layer density (fraction of the metric profile's onset chance).
 *  One tap drops a sparse, well-placed melodic layer; build with more taps. */
export const ADD_DENSITY_STEP = 0.5
/** Per-"−"-tap fraction of CURRENT notes removed — a SMALLER bite than "+" adds
 *  (gentle, asymmetric: it takes more "−" taps to undo a "+"). */
export const SPARSIFY_FRACTION = 0.3

/**
 * Bounded re-roll cap for the "+ always adds ≥1 note" guarantee. A layer whose
 * generated notes all collide with existing notes (occupied cells) is re-rolled
 * with a fresh seed up to this many times before a deterministic forced note, so
 * a "+" never reports "No room to layer" while there's open space. No unbounded
 * loop.
 */
export const PLUS_REROLL_CAP = 6

// ===================================================================== rows
/**
 * A degree ROW the score draws + selects on: a signed scale-degree index plus the
 * concrete MIDI it resolves to right now and a human label (the note name region).
 * Rows span a register window around the working tonic.
 */
export interface DegreeRow {
  /** Signed scale-degree index (0 = tonic in the working octave). */
  degree: number
  /** The 12-TET MIDI this row resolves to against the live harmony. */
  midi: number
  /** Residual detune in cents (maqam / just) — carried to the audio edge. */
  detuneCents: number
  /** Stable row key (selection key + React key) = the degree index as a string. */
  key: string
}

/** mulberry32 — the pack-standard deterministic stream from an integer seed. */
const makeRng = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Resolve the tonic MIDI for the working octave: the tonic pitch class nearest a
 * comfortable center (default middle C, MIDI 60). Degree 0 sits here; rows fan
 * out above/below. Octave-stable so the rows don't jump as harmony changes.
 */
export const workingTonicMidi = (ap: ActivePitches, centerMidi = 60): number => {
  const tonicPc = ((ap.tonicPc % 12) + 12) % 12
  const base = Math.round(centerMidi)
  // The tonic in the octave at or just below center, then snap to the nearest.
  const below = base - (((base - tonicPc) % 12) + 12) % 12
  const above = below + 12
  return Math.abs(above - base) < Math.abs(below - base) ? above : below
}

/**
 * The degree rows for the active harmony across `octaves` octaves centered on the
 * working tonic (default ~2 octaves: one below + one above + the center). Rows
 * are returned HIGH→LOW (top of the grid is the highest pitch, like a piano roll
 * / the drum grid's first row at the top). Each row resolves IN KEY via the
 * resolver, so the rows ARE the song's pitches.
 */
export const degreeRows = (
  doc: BeatloungeDoc,
  opts: { tick?: Tick; octaves?: number; centerMidi?: number } = {}
): DegreeRow[] => {
  const ap = activePitches(doc, opts.tick ?? 0)
  const size = ap.cents.length > 0 ? ap.cents.length : 7
  const octaves = Math.max(1, Math.floor(opts.octaves ?? 2))
  const tonicMidi = workingTonicMidi(ap, opts.centerMidi ?? 60)
  // Span: `octaves` above and (octaves-1) below the tonic, so the tonic sits a
  // little below center — a singable, mostly-ascending register.
  const lo = -((octaves - 1) * size)
  const hi = octaves * size
  const rows: DegreeRow[] = []
  for (let d = hi; d >= lo; d--) {
    const p = degreeToPitch(d, ap, tonicMidi)
    rows.push({ degree: d, midi: p.midi, detuneCents: p.detuneCents, key: String(d) })
  }
  return rows
}

// ============================================================ grid view
/** One score row = a degree row + its per-step on/off cells (a piano-roll row). */
export interface ScoreRow extends DegreeRow {
  /** The note label region for the head (e.g. "C4"). */
  label: string
  cells: { on: boolean; velocity: number }[]
}

export interface ScoreView {
  /** Visible step columns (from the track grid against the loop). */
  steps: number
  /** Steps per beat (downbeat accents). */
  stepsPerBeat: number
  /** Rows, HIGH pitch → LOW pitch. */
  rows: ScoreRow[]
}

/** Pitch-class names for row labels (sharps; no song/artist anywhere). */
const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const midiLabel = (midi: number): string => {
  const pc = ((Math.round(midi) % 12) + 12) % 12
  const oct = Math.floor(Math.round(midi) / 12) - 1
  return `${PC_NAMES[pc]}${oct}`
}

/**
 * Build the score's grid view: degree rows × step columns, cells lit where the
 * track has a note at (row MIDI, step tick). Rows resolve IN KEY via the
 * resolver. The same tick mapping the reducer uses (`tickForStep`), so painting
 * is round-trip-stable with the drum grid.
 */
export const buildScoreView = (
  doc: BeatloungeDoc,
  grid: Grid,
  opts: { octaves?: number; centerMidi?: number } = {}
): ScoreView => {
  const steps = stepsInLoop(doc.loopLengthTicks, grid)
  const stepsPerBeat = Math.max(1, Math.round(grid.denominator / 4))
  const rows = degreeRows(doc, opts)
  return { steps, stepsPerBeat, rows: rows.map((r) => ({ ...r, label: midiLabel(r.midi), cells: [] })) }
}

/**
 * Fill a ScoreView's cells from a track's notes (kept separate so the view +
 * the note projection are each pure + testable). Cells light where a note sits
 * at (row MIDI, step tick).
 */
export const fillScoreCells = (
  view: ScoreView,
  notes: readonly NoteEvent[],
  grid: Grid
): ScoreView => {
  const byTickPitch = new Map<string, number>()
  for (const n of notes) byTickPitch.set(`${n.tick}:${n.pitch}`, n.velocity)
  const rows = view.rows.map((r) => ({
    ...r,
    cells: Array.from({ length: view.steps }, (_, s) => {
      const tick = tickForStep(s, grid)
      const vel = byTickPitch.get(`${tick}:${r.midi}`)
      return { on: vel != null, velocity: vel ?? 0.85 }
    }),
  }))
  return { ...view, rows }
}

// ============================================================ the +/− dial
export type ScoreOp = "add" | "remove"

/** Parameters for the melody layer/sparsify. The host always knows the track. */
export interface ScoreBuildOpts {
  /** The melodic track to write (must be an instrument track). */
  trackId: string
  /** The +/− direction. "add" lays a layer; "remove" thins. Default "add". */
  op?: ScoreOp
  /** Selected degree-row keys (degree indices as strings). Empty ⇒ ALL rows of
   *  the working window are eligible (the whole melody, like grooves' natural
   *  voices when nothing is selected). */
  selectedRows?: ReadonlySet<string> | string[]
  /** The metric profile that drives WHEN notes land (onset weights). */
  metric: MetricProfile
  /** The transition table that drives WHICH degree comes next. */
  table: TransitionTable
  /** Per-tap layer density override (else ADD_DENSITY_STEP). */
  density?: number
  /** Register window (octaves around the tonic) — must match the rows shown. */
  octaves?: number
  /** Center MIDI for the working tonic (default 60). */
  centerMidi?: number
  /** Fresh per-tap seed (UI passes one each press → a different layer). */
  seed?: number
  /** Injected rng (used when `seed` is absent). */
  rng?: () => number
}

export interface ScoreBuildResult {
  /** The commands to batch (one undo step). Empty ⇒ nothing to do. */
  commands: Command[]
  /** Human summary for the toast / undo affordance. */
  summary: string
  /** Notes added (layer) or removed (sparsify) — for the summary / tests. */
  count: number
}

const resolveRng = (opts: ScoreBuildOpts): (() => number) =>
  opts.seed != null ? makeRng(opts.seed) : opts.rng ?? makeRng(1)

const toRowSet = (sel: ScoreBuildOpts["selectedRows"]): Set<string> =>
  sel == null ? new Set() : new Set(Array.isArray(sel) ? sel : [...sel])

/** Loop length in bars for the active metric profile. At least 1. */
const loopBars = (doc: BeatloungeDoc, metric: MetricProfile): number => {
  const barTicks = sixteenthsToTicks(metric.barSixteenths)
  if (barTicks <= 0) return 1
  return Math.max(1, Math.round(doc.loopLengthTicks / barTicks))
}

/**
 * The deterministic fallback note for the "+ always adds ≥1" guarantee: the
 * STRONGEST metric onset of the profile, on the first selected degree (or the
 * tonic), snapped to the track grid. Used only when every re-rolled layer
 * collided with existing notes — so a "+" never silently does nothing.
 */
const forcedLayerNote = (
  doc: BeatloungeDoc,
  ap: ActivePitches,
  tonicMidi: number,
  grid: Grid,
  opts: ScoreBuildOpts,
  snapToSelected: (degree: number) => number
): Omit<NoteEvent, "id"> | null => {
  const w = opts.metric.weights
  if (!w || w.length === 0) return null
  let best = 0
  for (let p = 1; p < w.length; p++) if ((w[p] ?? 0) > (w[best] ?? 0)) best = p
  const degree = snapToSelected(0)
  const pitch = degreeToPitch(degree, ap, tonicMidi)
  const dur = Math.max(1, sixteenthsToTicks(1))
  void doc
  return {
    tick: quantizeTick(sixteenthsToTicks(best), grid),
    duration: dur,
    pitch: Math.max(0, Math.min(127, pitch.midi)),
    velocity: clamp01(0.4 + 0.6 * (w[best] ?? 0.5)),
  }
}

/**
 * Build the commands for the score's +/− dial. Dispatches by `op`:
 *   • add    — generate a melody layer into the selected rows, additive.
 *   • remove — thin the current melody notes, lowest-weight / off-beat first.
 */
export const buildScoreCommands = (
  doc: BeatloungeDoc,
  opts: ScoreBuildOpts
): ScoreBuildResult => {
  const track = findTrack(doc, opts.trackId)
  if (!track || !isInstrumentTrack(track)) {
    return { commands: [], summary: ct("score.noTrackSummary"), count: 0 }
  }
  return opts.op === "remove"
    ? sparsifyMelody(doc, track.id, track.notes)
    : layerMelody(doc, track.id, track.notes, track.grid, opts)
}

/**
 * "+" — lay ONE more probabilistic melody layer into the selected rows. Walk
 * `generateMelody` across the loop's bars at the per-tap density; constrain each
 * note to a selected degree row (snapping to the nearest selected degree CLASS
 * when rows are selected); resolve IN KEY via `degreeToPitch`; map sixteenths →
 * ticks; merge ADDITIVELY with existing notes, de-duped by (tick, pitch).
 */
const layerMelody = (
  doc: BeatloungeDoc,
  trackId: string,
  existing: readonly NoteEvent[],
  grid: Grid,
  opts: ScoreBuildOpts
): ScoreBuildResult => {
  const ap = activePitches(doc, 0)
  const size = ap.cents.length > 0 ? ap.cents.length : 7
  const octaves = Math.max(1, Math.floor(opts.octaves ?? 2))
  const tonicMidi = workingTonicMidi(ap, opts.centerMidi ?? 60)

  // The eligible degree window (matches degreeRows): hi … lo.
  const hi = octaves * size
  const lo = -((octaves - 1) * size)

  // The selected degrees (explicit row selection). Empty ⇒ the whole window.
  const selected = toRowSet(opts.selectedRows)
  const selectedDegrees = [...selected]
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
  const hasSelection = selectedDegrees.length > 0
  // For class-snapping: the selected degree CLASSES (mod scale size), so a melody
  // landing on degree d is pulled to the nearest selected row of the same idea.
  const snapToSelected = (degree: number): number => {
    if (!hasSelection) return clampDeg(degree, lo, hi)
    // Pick the selected degree closest to the generated degree (preserves contour
    // while honoring the row selection).
    let best = selectedDegrees[0]
    for (const s of selectedDegrees) {
      if (Math.abs(s - degree) < Math.abs(best - degree)) best = s
    }
    return best
  }

  const bars = loopBars(doc, opts.metric)
  const density = opts.density ?? ADD_DENSITY_STEP

  /**
   * Resolve a raw degree line into placeable notes, each SNAPPED to the track's
   * visible grid so a note is never dropped between the steps the score renders
   * (the corpus walks 16ths; a coarser track grid would otherwise hide notes as
   * phantom hits). Collisions from snapping are removed by the (tick,pitch) merge.
   */
  const resolveLayer = (rng: () => number): Omit<NoteEvent, "id">[] => {
    const raw: MelodyNote[] = generateMelody(
      { table: opts.table, metric: opts.metric, bars, density, startDegree: 0 },
      rng
    )
    return raw.map((n) => {
      const degree = snapToSelected(n.degree)
      const p = degreeToPitch(degree, ap, tonicMidi)
      return {
        tick: quantizeTick(sixteenthsToTicks(n.pos), grid),
        duration: Math.max(1, sixteenthsToTicks(n.dur)),
        pitch: Math.max(0, Math.min(127, p.midi)),
        velocity: clamp01(n.weight),
      }
    })
  }

  // Additive merge: keep existing notes, add fresh, de-dupe by (tick, pitch) —
  // keep the FIRST so a re-layer is idempotent on an occupied cell.
  const seen = new Set<string>()
  const merged: Omit<NoteEvent, "id">[] = []
  const carry = (n: Omit<NoteEvent, "id">) => {
    const key = `${n.tick}:${n.pitch}`
    if (seen.has(key)) return
    seen.add(key)
    merged.push(n)
  }
  for (const n of existing) {
    carry({
      tick: n.tick,
      duration: n.duration,
      pitch: n.pitch,
      velocity: n.velocity,
      ...(n.probability != null ? { probability: n.probability } : {}),
      ...(n.ratchet != null ? { ratchet: n.ratchet } : {}),
      ...(n.micro != null ? { micro: n.micro } : {}),
    })
  }
  const before = merged.length

  // "+" GUARANTEES ≥1 note: roll a layer; if every generated note collided with an
  // existing one, re-roll with a fresh seed up to PLUS_REROLL_CAP, then force the
  // tonic on the strongest open metric onset. Never a silent "No room to layer".
  for (const n of resolveLayer(resolveRng(opts))) carry(n)
  if (merged.length === before && opts.op !== "remove") {
    const baseSeed = opts.seed ?? 1
    for (let i = 1; i <= PLUS_REROLL_CAP && merged.length === before; i++) {
      for (const n of resolveLayer(makeRng((baseSeed + i * 0x9e3779b1) | 0))) carry(n)
    }
    if (merged.length === before) {
      const forced = forcedLayerNote(doc, ap, tonicMidi, grid, opts, snapToSelected)
      if (forced) carry(forced)
    }
  }

  const added = merged.length - before
  if (added === 0) {
    return { commands: [], summary: ct("score.noRoomToLayer"), count: 0 }
  }
  merged.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch)
  const commands: Command[] = [{ t: "setNotes", trackId, notes: merged }]
  return {
    commands,
    summary: added === 1
      ? ct("score.addedNoteOne", { n: String(added) })
      : ct("score.addedNotes", { n: String(added) }),
    count: added,
  }
}

/**
 * "−" — thin the current melody. Remove ~SPARSIFY_FRACTION of the notes,
 * lowest-emphasis FIRST: rank by velocity (quiet first), tie-break by off-beat
 * position (further from a downbeat first). Each "−" peels back; the last "−"
 * removes the last note. Emits `removeNote` per dropped note.
 */
export const sparsifyMelody = (
  _doc: BeatloungeDoc,
  trackId: string,
  notes: readonly NoteEvent[]
): ScoreBuildResult => {
  if (notes.length === 0) {
    return { commands: [], summary: ct("score.nothingToThin"), count: 0 }
  }
  // Off-beat-ness: distance (in sixteenths) from the nearest beat (a quarter).
  // A downbeat → 0; deep off-beat → up to 2. Bigger = peeled first.
  const offBeat = (tick: Tick): number => {
    const sixteenth = ticksToSixteenths(tick)
    const within = ((sixteenth % 4) + 4) % 4
    return Math.min(within, 4 - within)
  }
  // Rank weakest first: lowest velocity, then most off-beat, then latest.
  const ranked = [...notes].sort((a, b) => {
    if (a.velocity !== b.velocity) return a.velocity - b.velocity
    const oa = offBeat(a.tick)
    const ob = offBeat(b.tick)
    if (oa !== ob) return ob - oa
    return b.tick - a.tick
  })
  // Remove a fraction (at least one) — a smaller bite than "+" adds.
  const n = Math.max(1, Math.round(notes.length * SPARSIFY_FRACTION))
  const toRemove = ranked.slice(0, n)
  const commands: Command[] = toRemove.map((note) => ({
    t: "removeNote",
    trackId,
    noteId: note.id,
  }))
  return {
    commands,
    summary: toRemove.length === 1
      ? ct("score.removedNoteOne", { n: String(toRemove.length) })
      : ct("score.removedNotes", { n: String(toRemove.length) }),
    count: toRemove.length,
  }
}

// ============================================================ auto-play fill
/**
 * Build the note set for ENDLESS auto-play: re-generate a continuous, non-
 * repeating melodic line that fills the WHOLE loop, IN KEY. Unlike the "+" layer
 * (additive, sparse), this REPLACES the track's notes with one freshly-walked
 * line per call — the auto-play loop calls it again on each loop wrap with a new
 * seed so the line never repeats. No LLM; pure `generateMelody`.
 */
export const buildAutoPlayNotes = (
  doc: BeatloungeDoc,
  opts: {
    metric: MetricProfile
    table: TransitionTable
    density?: number
    octaves?: number
    centerMidi?: number
    seed?: number
    rng?: () => number
    /** The destination track's grid — placements snap to it so the auto-play line
     *  the score paints never lands between visible steps. Omit ⇒ no snap. */
    grid?: Grid
  }
): Omit<NoteEvent, "id">[] => {
  const ap = activePitches(doc, 0)
  const tonicMidi = workingTonicMidi(ap, opts.centerMidi ?? 60)
  const rng = opts.seed != null ? makeRng(opts.seed) : opts.rng ?? makeRng(1)
  const bars = loopBars(doc, opts.metric)
  const raw = generateMelody(
    { table: opts.table, metric: opts.metric, bars, density: opts.density ?? 0.6, startDegree: 0 },
    rng
  )
  const snap = (tick: Tick): Tick => (opts.grid ? quantizeTick(tick, opts.grid) : tick)
  // De-dupe by (tick, pitch) — snapping can collide adjacent notes onto one cell.
  const seen = new Set<string>()
  const out: Omit<NoteEvent, "id">[] = []
  for (const n of raw) {
    const p = degreeToPitch(n.degree, ap, tonicMidi)
    const tick = snap(sixteenthsToTicks(n.pos))
    const pitch = Math.max(0, Math.min(127, p.midi))
    const key = `${tick}:${pitch}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      tick,
      duration: Math.max(1, sixteenthsToTicks(n.dur)),
      pitch,
      velocity: clamp01(n.weight),
    })
  }
  return out
}

// ----------------------------------------------------------------- helpers
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
const clampDeg = (d: number, lo: number, hi: number): number =>
  d < lo ? lo : d > hi ? hi : d
