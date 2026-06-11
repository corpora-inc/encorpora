/**
 * beatlounge — instrument-track creation (PURE, no React/Tone).
 *
 * Builds a valid `InstrumentTrack` stub for the `addTrack` command so the
 * Instruments browser can spawn MULTIPLE melodic synth voices. Mirrors the doc
 * model's instrument-track factory (sixteenth grid, sensible mix defaults, empty
 * note set) and voices the new track to a sensible default preset so it is
 * immediately audible — no silent/soundfont-collapsed track.
 *
 * We pre-seed a unique `id` (the reducer's `materializeTrack` honors an explicit
 * id) so the caller can bind the browser to the freshly-added track.
 */

import type { TrackInit } from "../../model/command"
import type { Grid } from "../../model/document"
import { newId } from "../../model/ids"
import { DEFAULT_PRESET_ID, instantiatePreset } from "../../instruments/presets"

/** A small, pleasant track-color cycle (matches the seed doc's accent hues). */
export const TRACK_COLORS = [
  "#c66bff",
  "#39e0ff",
  "#ffb454",
  "#6bffa0",
  "#ff6b9d",
  "#7c9bff",
] as const

/** Deterministic color for the Nth added track (cycles the palette). */
export const nextTrackColor = (index: number): string =>
  TRACK_COLORS[((index % TRACK_COLORS.length) + TRACK_COLORS.length) % TRACK_COLORS.length]

const SIXTEENTH: Grid = { denominator: 16 }

/**
 * A fresh instrument-track init, voiced to a default preset.
 * @param existingMelodicCount how many melodic tracks already exist (for naming
 *        + color); the new track is named "Synth N".
 * @param presetId which preset to voice it with (defaults to the corpus default).
 */
export const newInstrumentTrackInit = (
  existingMelodicCount: number,
  presetId: string = DEFAULT_PRESET_ID
): TrackInit => {
  const instrument = instantiatePreset(presetId) ?? instantiatePreset(DEFAULT_PRESET_ID)
  // The default preset always resolves; guard only to satisfy the type narrowing.
  if (!instrument || instrument.kind === "ttsFragment") {
    throw new Error(`[instruments] default preset ${presetId} is not an instrument voice`)
  }
  return {
    id: newId("trk"),
    kind: "instrument",
    name: `Synth ${existingMelodicCount + 1}`,
    color: nextTrackColor(existingMelodicCount),
    grid: SIXTEENTH,
    volume: 0.7,
    pan: 0,
    mute: false,
    solo: false,
    inserts: [],
    sends: [],
    automation: [],
    instrument,
    notes: [],
  }
}
