/**
 * beatlounge — derive the step-grid VIEW from a drum InstrumentTrack.
 *
 * Pure functions mapping the tick-addressed note set into lanes × steps for
 * rendering, and back via the timing helpers. The visible step count is
 * `stepsInLoop(loopLengthTicks, track.grid)` per the contract. One lane per
 * drum pitch in DRUM_PITCH (kick / snare / hat / clap).
 */

import type { BeatloungeDoc, InstrumentTrack, Midi } from "../../model/document"
import { DRUM_PITCH } from "../../model/document"
import { stepsInLoop, tickForStep } from "../../model/timing"

export interface Lane {
  pitch: Midi
  label: string
  /** Per-step on/off + velocity for the lit cells. */
  cells: { on: boolean; velocity: number }[]
}

export interface GridView {
  steps: number
  /** Steps per beat on this grid (for downbeat accents). */
  stepsPerBeat: number
  lanes: Lane[]
}

/** Lane order top→bottom and human labels. */
export const DRUM_LANES: { pitch: Midi; label: string }[] = [
  { pitch: DRUM_PITCH.kick, label: "Kick" },
  { pitch: DRUM_PITCH.snare, label: "Snare" },
  { pitch: DRUM_PITCH.hat, label: "Hat" },
  { pitch: DRUM_PITCH.clap, label: "Clap" },
]

export const buildGridView = (
  doc: BeatloungeDoc,
  track: InstrumentTrack
): GridView => {
  const steps = stepsInLoop(doc.loopLengthTicks, track.grid)
  // One beat = a quarter note = denominator/4 steps on this grid.
  const stepsPerBeat = Math.max(1, Math.round(track.grid.denominator / 4))

  // Index notes by (tick → pitch → velocity) for O(1) cell lookup.
  const byTickPitch = new Map<string, number>()
  for (const n of track.notes) byTickPitch.set(`${n.tick}:${n.pitch}`, n.velocity)

  const lanes: Lane[] = DRUM_LANES.map(({ pitch, label }) => {
    const cells = Array.from({ length: steps }, (_, s) => {
      const tick = tickForStep(s, track.grid)
      const vel = byTickPitch.get(`${tick}:${pitch}`)
      return { on: vel != null, velocity: vel ?? 0.9 }
    })
    return { pitch, label, cells }
  })

  return { steps, stepsPerBeat, lanes }
}

/** The mini read-only view for the tile: the kick + snare + hat lanes only. */
export const buildMiniView = (
  doc: BeatloungeDoc,
  track: InstrumentTrack
): GridView => {
  const full = buildGridView(doc, track)
  return { ...full, lanes: full.lanes.slice(0, 3) }
}
