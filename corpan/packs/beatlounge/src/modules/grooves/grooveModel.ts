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
  const placements = applyRhythm(rhythm, { loopTicks, intensity: opts.intensity })
  const notes: Omit<NoteEvent, "id">[] = placements.map((p) => {
    // Duration: a touch under a cell so adjacent hits don't bleed. Use the
    // drum track's grid cell as the reference (it's a one-shot kit anyway).
    const refGrid = drumGrid && isInstrumentTrack(drumGrid) ? drumGrid.grid : { denominator: 16 as const }
    const dur = Math.max(1, Math.round(gridTicks(refGrid) / 2))
    return {
      tick: p.tick,
      duration: dur,
      pitch: p.pitch,
      velocity: p.velocity,
      ...(p.ratchet && p.ratchet > 1 ? { ratchet: p.ratchet } : {}),
    }
  })
  commands.push({ t: "setNotes", trackId: drumId, notes })

  // 4) Optionally lay phrases from the bank onto the groove onsets.
  let placedPhrases = false
  if (opts.withPhrases && opts.rng) {
    const phraseId = findPhraseTrackId(doc)
    const bank = bankSnippets(doc)
    if (phraseId && bank.length > 0) {
      const phraseTrack = doc.tracks.find((t) => t.id === phraseId)
      // Clear current placements first (Apply replaces, like the drum lane).
      if (phraseTrack && isFragmentTrack(phraseTrack)) {
        for (const ev of phraseTrack.fragments) {
          commands.push({ t: "removeFragment", trackId: phraseId, fragId: ev.id })
        }
      }
      const phrasePlacements = applyRhythmToPhrases(rhythm, bank.length, opts.rng, {
        loopTicks,
        density: opts.phraseDensity ?? 0.5,
        scale: opts.phraseScale ?? DEFAULT_PHRASE_SCALE,
      })
      for (const pp of phrasePlacements) {
        const ref = bank[pp.snippetIndex]
        if (!ref) continue
        const frag: Omit<FragmentEvent, "id"> = {
          tick: pp.tick,
          fragmentId: ref.id,
          gain: 0.9,
          pitchSemis: pp.pitchSemis,
        }
        commands.push({ t: "placeFragment", trackId: phraseId, frag })
      }
      placedPhrases = phrasePlacements.length > 0
    }
  }

  const hitWord = `${notes.length} hit${notes.length === 1 ? "" : "s"}`
  const phraseSuffix = placedPhrases ? " + phrases" : ""
  return {
    commands,
    summary: `${rhythm.name} · ${hitWord}${phraseSuffix}`,
    placedPhrases,
  }
}

/** Steps shown for a rhythm against the current loop (for the tile preview). */
export const previewSteps = (doc: BeatloungeDoc): number => {
  const drumId = findDrumTrackId(doc)
  const drum = doc.tracks.find((t) => t.id === drumId)
  const grid = drum && isInstrumentTrack(drum) ? drum.grid : { denominator: 16 as const }
  return Math.max(0, stepsInLoop(doc.loopLengthTicks, grid))
}
