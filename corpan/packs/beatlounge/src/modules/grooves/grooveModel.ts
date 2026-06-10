/**
 * beatlounge — Grooves module model: turn an engine result into command-bus
 * inputs against the doc's drum track (and, optionally, a phrase track). Pure
 * of React + audio so it's unit-testable; the module's actions + UI call it.
 *
 * Everything is built through EXISTING commands only (`setNotes`,
 * `placeFragment`/`removeFragment`, `addTrack`, `setLoopLength`). Applying a
 * groove only WRITES the grid — it never plays sound ("setup, don't play").
 */

import type { Command, TrackInit } from "../../model/command"
import type { BeatloungeDoc, NoteEvent, FragmentEvent } from "../../model/document"
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

export interface GrooveBuildOpts {
  /** 0..1 — scale all hit velocities. Default 1. */
  intensity?: number
  /**
   * If true and the rhythm's natural cycle is longer than the current loop,
   * grow the loop to one whole cycle so the groove isn't truncated mid-pattern
   * (used by Apply so a 16-matra teental gets room). Default true.
   */
  fitLoop?: boolean
  /**
   * LAYER mode. When true the groove is laid ADDITIVELY: its hits are UNIONED
   * with the drum track's existing notes (de-duped by tick+pitch) instead of
   * replacing them — so you can stack a clave over a backbeat. Default false
   * (Apply replaces). Phrases, when laid, are likewise unioned in layer mode.
   */
  layer?: boolean
  /** Also lay phrases from the bank onto the groove onsets. Default false. */
  withPhrases?: boolean
  /** Phrase density (0..1) when withPhrases. Default 0.5. */
  phraseDensity?: number
  /** A seeded RNG (required when withPhrases — reproducible placement). */
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
   * True when phrases were REQUESTED (`withPhrases`) but couldn't be laid
   * because the doc has no phrase track or an empty bank. Lets the caller
   * surface a visible hint instead of a silent no-op.
   */
  phrasesUnavailable: boolean
}

/**
 * Build the command list to apply `rhythm` to the doc's drum track. Returns ONE
 * coherent list the caller wraps in a batch (single undo step). Creates a drum
 * track if none exists; optionally grows the loop and lays phrases.
 */
export const buildGrooveCommands = (
  doc: BeatloungeDoc,
  rhythm: Rhythm,
  opts: GrooveBuildOpts = {}
): GrooveBuildResult => {
  const commands: Command[] = []

  // 1) Ensure a drum track. If absent, add one and target it.
  let drumId = findDrumTrackId(doc)
  let drumGrid = doc.tracks.find((t) => t.id === drumId)
  if (!drumId) {
    const track = newDrumTrack()
    commands.push({ t: "addTrack", track })
    drumId = track.id as string
  }

  // 2) Optionally grow the loop to one whole cycle so long rhythms fit.
  const cycle = rhythmTicks(rhythm)
  const fitLoop = opts.fitLoop ?? true
  const loopTicks = fitLoop ? Math.max(doc.loopLengthTicks, cycle) : doc.loopLengthTicks
  if (fitLoop && loopTicks !== doc.loopLengthTicks) {
    commands.push({ t: "setLoopLength", ticks: loopTicks })
  }

  // 3) Concrete notes, tiled across the (possibly grown) loop.
  const refGrid = drumGrid && isInstrumentTrack(drumGrid) ? drumGrid.grid : { denominator: 16 as const }
  // Duration: a touch under a cell so adjacent hits don't bleed. Use the drum
  // track's grid cell as the reference (it's a one-shot kit anyway).
  const dur = Math.max(1, Math.round(gridTicks(refGrid) / 2))
  const placements = applyRhythm(rhythm, { loopTicks, intensity: opts.intensity })
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

  // 4) Optionally lay phrases from the bank onto the groove onsets.
  let placedPhrases = false
  let phrasesUnavailable = false
  if (opts.withPhrases) {
    const phraseId = findPhraseTrackId(doc)
    const bank = bankSnippets(doc)
    // Phrases need a fragment track AND a non-empty bank AND a seeded RNG.
    if (phraseId && bank.length > 0 && opts.rng) {
      const phraseTrack = doc.tracks.find((t) => t.id === phraseId)
      // Apply replaces existing placements; Layer keeps them and adds on top.
      if (!opts.layer && phraseTrack && isFragmentTrack(phraseTrack)) {
        for (const ev of phraseTrack.fragments) {
          commands.push({ t: "removeFragment", trackId: phraseId, fragId: ev.id })
        }
      }
      const occupied =
        opts.layer && phraseTrack && isFragmentTrack(phraseTrack)
          ? new Set(phraseTrack.fragments.map((f) => f.tick))
          : new Set<number>()
      const phrasePlacements = applyRhythmToPhrases(rhythm, bank.length, opts.rng, {
        loopTicks,
        density: opts.phraseDensity ?? 0.5,
        scale: opts.phraseScale ?? DEFAULT_PHRASE_SCALE,
      })
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
        placedPhrases = true
      }
    } else {
      // Requested but impossible — the caller surfaces a visible hint.
      phrasesUnavailable = true
    }
  }

  const hitWord = `${notes.length} hit${notes.length === 1 ? "" : "s"}`
  const verb = opts.layer ? "layered" : ""
  const phraseSuffix = placedPhrases ? " + phrases" : ""
  return {
    commands,
    summary: `${rhythm.name} · ${verb ? verb + " " : ""}${hitWord}${phraseSuffix}`,
    placedPhrases,
    phrasesUnavailable,
  }
}

/** Steps shown for a rhythm against the current loop (for the tile preview). */
export const previewSteps = (doc: BeatloungeDoc): number => {
  const drumId = findDrumTrackId(doc)
  const drum = doc.tracks.find((t) => t.id === drumId)
  const grid = drum && isInstrumentTrack(drum) ? drum.grid : { denominator: 16 as const }
  return Math.max(0, stepsInLoop(doc.loopLengthTicks, grid))
}
