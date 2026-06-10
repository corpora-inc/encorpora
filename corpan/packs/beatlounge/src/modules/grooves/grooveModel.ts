/**
 * beatlounge — the GROOVE BRAIN model: turn an engine result into command-bus
 * inputs against WHATEVER GRID the host points it at. The same world-rhythm
 * corpus + apply/vary/evolve/randomize engine drives two grids today:
 *
 *   • DRUMS   — the rhythm's onsets become drum notes (role→pitch, or re-pointed
 *               at the selected kit voices via the 0/1/N targeting heuristic).
 *   • PHRASES — the rhythm's onsets become placements of SAVED bank snippets on
 *               a fragment track (distribute the bank across the groove).
 *
 * The HOST chooses the grid by passing a typed `GrooveTarget`; the model never
 * guesses. Pure of React + audio so it's unit-testable; the module's actions +
 * UI call it.
 *
 * Everything is built through EXISTING commands only (`setNotes`,
 * `placeFragment`/`removeFragment`, `addTrack`, `setLoopLength`). Applying a
 * groove only WRITES the grid — it never plays sound ("setup, don't play").
 */

import type { Command, TrackInit } from "../../model/command"
import type { BeatloungeDoc, Midi, NoteEvent, FragmentEvent } from "../../model/document"
import { isFragmentTrack, isInstrumentTrack } from "../../model/document"
import { newId } from "../../model/ids"
import { gridTicks, stepsInLoop } from "../../model/timing"
import {
  applyRhythm,
  applyRhythmToPhrases,
  rhythmTicks,
  type Rhythm,
} from "../../rhythm"
import { bankSnippets } from "../../phrase/bank"

/** Resolve the drum track id: the first drumSampler instrument track, else none. */
export const findDrumTrackId = (doc: BeatloungeDoc): string | undefined =>
  doc.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")?.id

/** Resolve the first fragment (phrase) track id, if any. */
export const findPhraseTrackId = (doc: BeatloungeDoc): string | undefined =>
  doc.tracks.find(isFragmentTrack)?.id

/** A fresh drum-sampler track (mirrors createDefaultDoc's drum track shape) so a
 *  doc that somehow has none still gets a groove. */
export const newDrumTrack = (): TrackInit => ({
  id: newId("trk"),
  kind: "instrument",
  name: "Drums",
  color: "#39e0ff",
  grid: { denominator: 16 },
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  inserts: [],
  sends: [],
  automation: [],
  instrument: { kind: "drumSampler", pads: [], fallback: "synthKit" },
  notes: [],
})

/**
 * GROOVE TARGET — the typed grid the brain drives. The host decides; the model
 * never guesses. A `trackId` may be supplied (the host already knows the bound
 * track); when omitted the model resolves/creates a sensible one.
 *
 *   • drums   — write the rhythm onto a drum track. `selectedPitches` carries
 *               the drum page's lane-head selection for the 0/1/N targeting
 *               heuristic; `laneLabels` is purely for the host's "applying to…"
 *               hint (the model ignores it).
 *   • phrases — distribute SAVED bank snippets onto the rhythm's onsets on a
 *               fragment track. NOTHING is written to drums.
 */
export type GrooveTarget =
  | {
      kind: "drums"
      /** The drum track to write; resolved/created when omitted. */
      trackId?: string
      /** Selected kit voices for 0/1/N re-pointing (empty ⇒ natural mapping). */
      selectedPitches?: Midi[]
      /** Human labels for the selected pitches (host hint only). */
      laneLabels?: string[]
    }
  | {
      kind: "phrases"
      /** The fragment track to place onto; resolved when omitted. */
      trackId?: string
    }

export interface GrooveBuildOpts {
  /**
   * Which grid this groove drives. REQUIRED — the host always knows. Defaults to
   * a drums target (resolve/create the drum track) so legacy callers keep their
   * behaviour.
   */
  target?: GrooveTarget
  /** 0..1 — scale all hit velocities. Default 1. */
  intensity?: number
  /**
   * If true and the rhythm's natural cycle is longer than the current loop,
   * grow the loop to one whole cycle so the groove isn't truncated mid-pattern
   * (used by Apply so a 16-matra teental gets room). Default true.
   */
  fitLoop?: boolean
  /**
   * LAYER mode. When true the groove is laid ADDITIVELY: its hits/placements are
   * UNIONED with the target track's existing content (de-duped by tick) instead
   * of replacing them — stack a clave over a backbeat, or add phrases without
   * clearing the held ones. Default false (Apply replaces).
   */
  layer?: boolean
  /** Phrase density (0..1) for a phrases target. Default 0.5. */
  phraseDensity?: number
  /** A seeded RNG (required for a phrases target — reproducible placement). */
  rng?: () => number
  /** Pitch ladder for phrase placement (semitones). Default a minor pentatonic. */
  phraseScale?: number[]
}

const DEFAULT_PHRASE_SCALE = [0, 3, 5, 7, 10, 12]

export interface GrooveBuildResult {
  commands: Command[]
  /** Human summary for the toast / undo affordance. */
  summary: string
  /** True if a phrase track received placements. */
  placedPhrases: boolean
  /**
   * True when a PHRASES target couldn't be satisfied because the doc has no
   * fragment track or an empty bank. Lets the caller surface a visible hint /
   * disable Apply instead of a silent no-op.
   */
  phrasesUnavailable: boolean
}

/**
 * Build the command list to apply `rhythm` to the host-chosen grid. Returns ONE
 * coherent list the caller wraps in a batch (single undo step). Dispatches to
 * the drums path or the phrases path by `opts.target.kind`.
 */
export const buildGrooveCommands = (
  doc: BeatloungeDoc,
  rhythm: Rhythm,
  opts: GrooveBuildOpts = {}
): GrooveBuildResult => {
  const target: GrooveTarget = opts.target ?? { kind: "drums" }
  return target.kind === "phrases"
    ? buildPhraseGroove(doc, rhythm, target, opts)
    : buildDrumGroove(doc, rhythm, target, opts)
}

/** Grow the loop (and emit `setLoopLength`) so a long cycle fits. */
const fitLoopTicks = (
  doc: BeatloungeDoc,
  rhythm: Rhythm,
  fitLoop: boolean,
  commands: Command[]
): number => {
  const cycle = rhythmTicks(rhythm)
  const loopTicks = fitLoop ? Math.max(doc.loopLengthTicks, cycle) : doc.loopLengthTicks
  if (fitLoop && loopTicks !== doc.loopLengthTicks) {
    commands.push({ t: "setLoopLength", ticks: loopTicks })
  }
  return loopTicks
}

/** DRUMS grid — the rhythm's onsets become drum notes (Apply replaces, Layer unions). */
const buildDrumGroove = (
  doc: BeatloungeDoc,
  rhythm: Rhythm,
  target: Extract<GrooveTarget, { kind: "drums" }>,
  opts: GrooveBuildOpts
): GrooveBuildResult => {
  const commands: Command[] = []

  // 1) Resolve the drum track. Prefer the host-supplied id; else find one; else
  //    create one and target it.
  let drumId = target.trackId ?? findDrumTrackId(doc)
  if (!drumId || !doc.tracks.some((t) => t.id === drumId)) {
    const track = newDrumTrack()
    commands.push({ t: "addTrack", track })
    drumId = track.id as string
  }
  const drumGrid = doc.tracks.find((t) => t.id === drumId)

  // 2) Optionally grow the loop to one whole cycle so long rhythms fit.
  const loopTicks = fitLoopTicks(doc, rhythm, opts.fitLoop ?? true, commands)

  // 3) Concrete notes, tiled across the (possibly grown) loop.
  const refGrid = drumGrid && isInstrumentTrack(drumGrid) ? drumGrid.grid : { denominator: 16 as const }
  // Duration: a touch under a cell so adjacent hits don't bleed.
  const dur = Math.max(1, Math.round(gridTicks(refGrid) / 2))
  const selected = (target.selectedPitches ?? []).filter((p) => Number.isFinite(p))
  const placements = applyRhythm(rhythm, {
    loopTicks,
    intensity: opts.intensity,
    targetPitches: selected.length > 0 ? selected : undefined,
  })
  const grooveNotes: Omit<NoteEvent, "id">[] = placements.map((p) => ({
    tick: p.tick,
    duration: dur,
    pitch: p.pitch,
    velocity: p.velocity,
    ...(p.ratchet && p.ratchet > 1 ? { ratchet: p.ratchet } : {}),
  }))

  // LAYER mode: union the groove's hits with the track's EXISTING notes, de-duped
  // by (tick, pitch) so re-applying the same groove is idempotent and a clave can
  // sit over a backbeat. Apply mode replaces (just the groove's notes).
  const existing: Omit<NoteEvent, "id">[] =
    opts.layer && drumGrid && isInstrumentTrack(drumGrid)
      ? drumGrid.notes.map(({ tick, duration, pitch, velocity, probability, ratchet, micro }) => ({
          tick,
          duration,
          pitch,
          velocity,
          ...(probability != null ? { probability } : {}),
          ...(ratchet != null ? { ratchet } : {}),
          ...(micro != null ? { micro } : {}),
        }))
      : []
  const seen = new Set<string>()
  const notes: Omit<NoteEvent, "id">[] = []
  for (const n of [...existing, ...grooveNotes]) {
    const key = `${n.tick}:${n.pitch}`
    if (seen.has(key)) continue // keep the FIRST (existing wins) — idempotent layer
    seen.add(key)
    notes.push(n)
  }
  notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch)
  commands.push({ t: "setNotes", trackId: drumId, notes })

  const hitWord = `${notes.length} hit${notes.length === 1 ? "" : "s"}`
  const verb = opts.layer ? "layered " : ""
  return {
    commands,
    summary: `${rhythm.name} · ${verb}${hitWord}`,
    placedPhrases: false,
    phrasesUnavailable: false,
  }
}

/**
 * PHRASES grid — distribute SAVED bank snippets onto the rhythm's onsets on a
 * fragment track. Apply replaces the track's current placements; Layer keeps
 * them and adds onto free onsets. NOTHING is written to drums. When there's no
 * fragment track or an empty bank, returns `phrasesUnavailable` (no silent
 * no-op) so the host disables Apply with a visible hint.
 */
const buildPhraseGroove = (
  doc: BeatloungeDoc,
  rhythm: Rhythm,
  target: Extract<GrooveTarget, { kind: "phrases" }>,
  opts: GrooveBuildOpts
): GrooveBuildResult => {
  const phraseId = target.trackId ?? findPhraseTrackId(doc)
  const bank = bankSnippets(doc)
  const phraseTrack = phraseId ? doc.tracks.find((t) => t.id === phraseId) : undefined
  const rng = opts.rng

  // A phrases target needs a real fragment track AND a non-empty bank AND a seeded
  // RNG. Without them we DON'T touch the doc — surface a visible hint instead.
  if (!phraseId || !phraseTrack || !isFragmentTrack(phraseTrack) || bank.length === 0 || !rng) {
    return {
      commands: [],
      summary: bank.length === 0 ? "Save some phrases first" : "No phrase track yet",
      placedPhrases: false,
      phrasesUnavailable: true,
    }
  }

  const commands: Command[] = []
  // Grow the loop so a long cycle isn't truncated, exactly like the drums path.
  const loopTicks = fitLoopTicks(doc, rhythm, opts.fitLoop ?? true, commands)

  // Apply replaces existing placements; Layer keeps them and adds on top.
  if (!opts.layer) {
    for (const ev of phraseTrack.fragments) {
      commands.push({ t: "removeFragment", trackId: phraseId, fragId: ev.id })
    }
  }
  const occupied = opts.layer
    ? new Set(phraseTrack.fragments.map((f) => f.tick))
    : new Set<number>()

  const phrasePlacements = applyRhythmToPhrases(rhythm, bank.length, rng, {
    loopTicks,
    density: opts.phraseDensity ?? 0.5,
    scale: opts.phraseScale ?? DEFAULT_PHRASE_SCALE,
  })
  let placed = 0
  for (const pp of phrasePlacements) {
    if (occupied.has(pp.tick)) continue // don't double-stack a phrase on a held tick
    const ref = bank[pp.snippetIndex]
    if (!ref) continue
    const frag: Omit<FragmentEvent, "id"> = {
      tick: pp.tick,
      fragmentId: ref.id,
      gain: 0.9,
      pitchSemis: pp.pitchSemis,
    }
    commands.push({ t: "placeFragment", trackId: phraseId, frag })
    placed++
  }

  // No onsets landed (e.g. every onset already occupied in layer mode): emit no
  // command so the caller can warn rather than dispatch an empty batch.
  if (placed === 0) {
    return {
      commands: [],
      summary: "No onsets to place phrases on",
      placedPhrases: false,
      phrasesUnavailable: false,
    }
  }

  const word = `${placed} phrase${placed === 1 ? "" : "s"}`
  const verb = opts.layer ? "layered " : ""
  return {
    commands,
    summary: `${rhythm.name} · ${verb}${word}`,
    placedPhrases: true,
    phrasesUnavailable: false,
  }
}

/** Steps shown for a rhythm against the current loop (for the tile preview). */
export const previewSteps = (doc: BeatloungeDoc): number => {
  const drumId = findDrumTrackId(doc)
  const drum = doc.tracks.find((t) => t.id === drumId)
  const grid = drum && isInstrumentTrack(drum) ? drum.grid : { denominator: 16 as const }
  return Math.max(0, stepsInLoop(doc.loopLengthTicks, grid))
}
