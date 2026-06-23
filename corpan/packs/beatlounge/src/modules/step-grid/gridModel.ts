/**
 * beatlounge — derive the step-grid VIEW from a drum InstrumentTrack.
 *
 * Pure functions mapping the tick-addressed note set into lanes × steps for
 * rendering, and back via the timing helpers. The visible step count is
 * `stepsInLoop(loopLengthTicks, track.grid)` per the contract.
 *
 * LANE SOURCE — the FULL kit, not just kick/snare/hat/clap. The drum synth
 * (instruments/drumKit.ts) voices ~16 distinct pitches, the drum-pads PAD_BANK
 * exposes them, and the groove engine (rhythm/roles.ts) places hits across ALL
 * of them. So a groove's toms / ride / cowbell / congas must each have a visible
 * editable lane — otherwise the grid hides hits a groove just wrote. We build
 * the lane set from `KIT_LANES` below (every voice the kit triggers), ordered
 * musically (kick → snare → rim/clap → hats → cymbals → toms → percussion).
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

/**
 * THE FULL KIT, top→bottom in musical order. Every pitch the drum synth voices
 * (drumKit.ts `triggerForPitch`) and every role the groove corpus can resolve
 * to (roles.ts `KIT`) appears here exactly once, so no groove hit is invisible:
 *   kick → snare → rim → clap → closed/pedal/open hat → ride → crash →
 *   lo/hi tom → conga → cowbell → tambourine → shaker → claves.
 */
export const DRUM_LANES: { pitch: Midi; label: string }[] = [
  { pitch: DRUM_PITCH.kick, label: "Kick" }, // 36
  { pitch: DRUM_PITCH.snare, label: "Snare" }, // 38
  { pitch: 37, label: "Rim" },
  { pitch: DRUM_PITCH.clap, label: "Clap" }, // 39
  { pitch: DRUM_PITCH.hat, label: "Closed Hat" }, // 42
  { pitch: 44, label: "Pedal Hat" },
  { pitch: 46, label: "Open Hat" },
  { pitch: 51, label: "Ride" },
  { pitch: 49, label: "Crash" },
  { pitch: 45, label: "Hi Tom" },
  { pitch: 43, label: "Lo Tom" },
  { pitch: 64, label: "Conga" },
  { pitch: 56, label: "Cowbell" },
  { pitch: 54, label: "Tamb" },
  { pitch: 70, label: "Shaker" },
  { pitch: 75, label: "Claves" },
]

/** How many top lanes the calm tile mini-view shows (kick/snare/closed-hat). */
export const MINI_LANE_COUNT = 3

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

/**
 * The mini read-only view for the tile: the first `MINI_LANE_COUNT` lanes
 * (kick / snare / closed-hat) — a calm, glanceable subset of the full kit.
 */
export const buildMiniView = (
  doc: BeatloungeDoc,
  track: InstrumentTrack
): GridView => {
  const full = buildGridView(doc, track)
  return { ...full, lanes: full.lanes.slice(0, MINI_LANE_COUNT) }
}
