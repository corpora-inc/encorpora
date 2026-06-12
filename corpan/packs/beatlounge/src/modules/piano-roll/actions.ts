/**
 * beatlounge — piano-roll module actions. Pure, deterministic-given-rng, and
 * LLM-callable. Each returns commands the bus applies in one undo step plus a
 * human summary. These back the immersive header buttons AND the (future)
 * command bar's natural-language surface.
 *
 * Bound to the melodic "Synth" track — the first non-drumSampler instrument
 * track. Kept free of React so they're unit-testable in isolation.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import type { Command } from "../../model/command"
import type { Midi, NoteEvent } from "../../model/document"
import { findTrack, isInstrumentTrack } from "../../model/document"
import { gridTicks, stepsInLoop, tickForStep } from "../../model/timing"
import { euclidIndices } from "../../music/euclid"
import { MAJOR_SCALE } from "./pitchModel"

/** Resolve the melodic track: the bound track, else the first non-drum synth. */
export const melodicTrackId = (ctx: ActionContext): string | undefined => {
  if (ctx.targetTrackId) return ctx.targetTrackId
  const synth = ctx.doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
  )
  return synth?.id
}

/** clear — wipe every note from the bound melodic track. Destructive (confirm). */
export const clearAction: ModuleAction = {
  name: "clear",
  describe: "Clear every note in the piano roll.",
  params: {},
  impact: "destructive",
  run(ctx): ActionResult {
    const trackId = melodicTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No melodic track" }
    const track = findTrack(ctx.doc, trackId)
    const count = track && isInstrumentTrack(track) ? track.notes.length : 0
    return {
      commands: [{ t: "clearTrack", trackId }],
      summary: count ? `Cleared ${count} notes` : "Already empty",
    }
  },
}

/**
 * arpeggiate — replace the track with a Euclidean arpeggio: spread `pulses`
 * notes evenly across the loop (Bjorklund), walking up the major scale rooted
 * at the lowest existing note (or C4). Stochastic only in its octave shimmer.
 */
export const arpeggiateAction: ModuleAction = {
  name: "arpeggiate",
  describe: "Lay a Euclidean arpeggio up the scale across the loop.",
  params: {
    pulses: {
      type: "int",
      min: 1,
      max: 32,
      default: 8,
      describe: "How many arpeggio notes to spread across the loop.",
    },
    rotate: {
      type: "int",
      min: 0,
      max: 31,
      default: 0,
      describe: "Rotate the Euclidean pattern by this many steps.",
    },
  },
  stochastic: true,
  impact: "mutate",
  run(ctx, params): ActionResult {
    const trackId = melodicTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No melodic track" }
    const track = findTrack(ctx.doc, trackId)
    if (!track || !isInstrumentTrack(track))
      return { commands: [], summary: "No melodic track" }

    const steps = stepsInLoop(ctx.doc.loopLengthTicks, track.grid)
    if (steps <= 0) return { commands: [], summary: "Empty loop" }

    const pulses = Math.max(1, Math.min(steps, Math.round(Number(params.pulses ?? 8))))
    const rotate = Math.max(0, Math.round(Number(params.rotate ?? 0)))

    // Root = the lowest existing note, snapped to C, else middle C.
    const root: Midi =
      track.notes.length > 0
        ? track.notes.reduce((m, n) => Math.min(m, n.pitch), Infinity)
        : 60
    const tonic = root - (((root % 12) + 12) % 12) // nearest C at/below the root

    const hits = euclidIndices(pulses, steps, rotate)
    const dur = gridTicks(track.grid)
    const notes: Omit<NoteEvent, "id">[] = hits.map((step, i) => {
      // Walk up the scale; the rng nudges the octave for gentle variation.
      const degree = i % MAJOR_SCALE.length
      const octave = Math.floor(i / MAJOR_SCALE.length) + (ctx.rng() > 0.82 ? 1 : 0)
      const pitch = tonic + 12 * octave + MAJOR_SCALE[degree]
      return {
        tick: tickForStep(step, track.grid),
        duration: dur,
        pitch: Math.max(0, Math.min(127, pitch)),
        velocity: 0.62 + (i % 2 === 0 ? 0.12 : 0),
      }
    })

    const commands: Command[] = [{ t: "setNotes", trackId, notes }]
    return { commands, summary: `Arpeggio · ${notes.length} notes` }
  },
}

/** transpose — shift every note by `semitones`, clamped to MIDI range. */
export const transposeAction: ModuleAction = {
  name: "transpose",
  describe: "Transpose every note up or down by N semitones.",
  params: {
    semitones: {
      type: "int",
      min: -24,
      max: 24,
      default: 12,
      unit: "st",
      describe: "Signed semitone shift (e.g. 12 = up one octave).",
    },
  },
  impact: "mutate",
  run(ctx, params): ActionResult {
    const trackId = melodicTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No melodic track" }
    const track = findTrack(ctx.doc, trackId)
    if (!track || !isInstrumentTrack(track))
      return { commands: [], summary: "No melodic track" }
    if (track.notes.length === 0) return { commands: [], summary: "Nothing to transpose" }

    const semis = Math.round(Number(params.semitones ?? 12))
    if (semis === 0) return { commands: [], summary: "No shift" }

    const commands: Command[] = track.notes.map((n) => ({
      t: "editNote",
      trackId,
      noteId: n.id,
      patch: { pitch: Math.max(0, Math.min(127, n.pitch + semis)) },
    }))
    const dir = semis > 0 ? "+" : ""
    return {
      commands: [{ t: "batch", commands, label: "Transpose" }],
      summary: `Transposed ${dir}${semis} st`,
    }
  },
}

export const pianoRollActions: ReadonlyArray<ModuleAction> = [
  clearAction,
  arpeggiateAction,
  transposeAction,
]
