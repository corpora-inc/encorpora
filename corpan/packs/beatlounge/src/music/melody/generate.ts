/**
 * beatlounge — pure MELODY generation + the degree→pitch bridge.
 *
 * `generateMelody` walks beats forever (well, for N bars) from a transition
 * table + a metric profile, emitting degree-relative notes — no LLM, fully
 * deterministic given an rng. This is the engine behind the score's +/− "layer"
 * dial and the endless auto-play mode.
 *
 * `degreeToPitch` is the ONLY place a degree index becomes sound: it reads the
 * active harmony's pitch set (`ActivePitches` from the resolver) and returns a
 * 12-TET MIDI note plus the residual detune in cents (so maqam/just tunings
 * survive). Consumers schedule `midi` and apply `detuneCents` at the audio edge,
 * exactly like the rest of the harmony-aware modules.
 *
 * Pure: no React/audio/doc; rng is injected so callers control reproducibility.
 */

import type { ActivePitches } from "../resolver"
import type {
  MelodicCell,
  MetricProfile,
  Sixteenths,
  TransitionTable,
} from "./types"

/** A generated/laid melodic note, degree-relative + metric-positioned. */
export interface MelodyNote {
  /** Signed scale-degree index (0 = tonic; octave wraps at resolve time). */
  degree: number
  /** Absolute onset in sixteenths from the phrase start. */
  pos: Sixteenths
  /** Duration in sixteenths (≥1). */
  dur: Sixteenths
  /** Emphasis 0..1 (→ velocity). */
  weight: number
}

/** A degree resolved against live harmony into a playable pitch. */
export interface ResolvedPitch {
  /** Nearest 12-TET MIDI note. */
  midi: number
  /** Residual detune in cents to apply at the audio edge (0 for 12-TET). */
  detuneCents: number
  /** Exact cents above the global tonic (the universal currency). */
  centsAboveTonic: number
}

const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n

const posMod = (n: number, m: number): number => ((n % m) + m) % m

/**
 * Resolve a signed scale-degree index to a pitch against the active harmony.
 * `tonicMidi` is the MIDI note chosen for degree 0 (the consumer picks the
 * register). Octaves wrap through the scale; tunings carry via the cents table.
 */
export const degreeToPitch = (
  degree: number,
  ap: ActivePitches,
  tonicMidi: number
): ResolvedPitch => {
  const size = ap.cents.length > 0 ? ap.cents.length : 1
  const octave = Math.floor(degree / size)
  const idx = posMod(degree, size)
  // cents within the octave (fallback to an even 100¢/step if the set is bare).
  const within = ap.cents[idx] ?? idx * 100
  const centsAboveTonic = within + 1200 * octave
  const exactMidi = tonicMidi + centsAboveTonic / 100
  const midi = Math.round(exactMidi)
  return { midi, detuneCents: (exactMidi - midi) * 100, centsAboveTonic }
}

/** Weighted index pick from a non-negative row; uniform fallback if all zero. */
const weightedPick = (row: number[], rng: () => number): number => {
  let sum = 0
  for (const w of row) sum += w > 0 ? w : 0
  if (sum <= 0) return Math.floor(rng() * row.length)
  let r = rng() * sum
  for (let i = 0; i < row.length; i++) {
    r -= row[i] > 0 ? row[i] : 0
    if (r <= 0) return i
  }
  return row.length - 1
}

/** Choose the next signed degree given the previous one and the table. */
const nextDegree = (prev: number, table: TransitionTable, rng: () => number): number => {
  const size = table.scaleSize
  const fromClass = posMod(prev, size)
  const toClass = weightedPick(table.weights[fromClass] ?? [], rng)
  const prevOctave = Math.floor(prev / size)
  // Pick the octave register that makes the step smallest (voice-leading).
  let best = prevOctave * size + toClass
  for (const oc of [prevOctave - 1, prevOctave, prevOctave + 1]) {
    const cand = oc * size + toClass
    if (Math.abs(cand - prev) < Math.abs(best - prev)) best = cand
  }
  // Occasional deliberate octave drift keeps long lines from flatlining.
  if (rng() < table.octaveBias) best += rng() < 0.5 ? size : -size
  // Keep the line within ~2 octaves of the tonic so it stays singable/in-range.
  return clamp(best, -2 * size, 2 * size)
}

/** Options for `generateMelody`. */
export interface GenerateOpts {
  table: TransitionTable
  metric: MetricProfile
  /** How many bars to generate (≥1). */
  bars: number
  /** Scales the per-position onset probability 0..1 (sparser ↔ denser). Default 0.55. */
  density?: number
  /** Starting degree (default 0 = tonic). */
  startDegree?: number
}

/**
 * Walk the metric profile across `bars` bars, emitting a degree note wherever an
 * onset fires (probability = metricWeight × density). The first downbeat always
 * fires (so output is never empty) and lands on `startDegree`; each subsequent
 * onset's degree is drawn from the transition table. Deterministic given `rng`.
 */
export const generateMelody = (opts: GenerateOpts, rng: () => number): MelodyNote[] => {
  const { table, metric } = opts
  const bars = Math.max(1, Math.floor(opts.bars))
  const density = clamp(opts.density ?? 0.55, 0, 1)
  const bar = metric.barSixteenths

  // 1) Decide onset positions across the whole phrase.
  const onsets: Sixteenths[] = []
  for (let b = 0; b < bars; b++) {
    for (let p = 0; p < bar; p++) {
      const w = metric.weights[p] ?? 0
      const force = b === 0 && p === 0 // always seed the first downbeat
      if (force || rng() < w * density) onsets.push(b * bar + p)
    }
  }
  if (onsets.length === 0) onsets.push(0)

  // 2) Walk degrees across the onsets; fill durations to the next onset.
  const phraseEnd = bars * bar
  const notes: MelodyNote[] = []
  let degree = opts.startDegree ?? 0
  for (let i = 0; i < onsets.length; i++) {
    const pos = onsets[i]
    if (i > 0) degree = nextDegree(degree, table, rng)
    const next = i + 1 < onsets.length ? onsets[i + 1] : phraseEnd
    const w = metric.weights[posMod(pos, bar)] ?? 0.5
    notes.push({
      degree,
      pos,
      dur: Math.max(1, next - pos),
      weight: clamp(0.4 + 0.6 * w, 0, 1),
    })
  }
  return notes
}

/**
 * Transpose a contour cell by a degree `offset` (for the score's layer dial:
 * drop a cell onto a chosen row range). Returns a fresh cell; ids gain the
 * offset suffix so layered copies stay distinct.
 */
export const transposeCell = (cell: MelodicCell, offset: number): MelodicCell => {
  if (offset === 0) return cell
  return {
    ...cell,
    id: `${cell.id}+${offset}`,
    notes: cell.notes.map((n) => ({ ...n, degree: n.degree + offset })),
    range: [cell.range[0] + offset, cell.range[1] + offset],
  }
}

/** Expand a cell into MelodyNotes at an absolute bar offset (sixteenths). */
export const cellToNotes = (cell: MelodicCell, barOffset: Sixteenths = 0): MelodyNote[] =>
  cell.notes.map((n) => ({
    degree: n.degree,
    pos: n.pos + barOffset,
    dur: n.dur,
    weight: n.weight,
  }))
