/**
 * beatlounge — human label for any track instrument (tile + browser headers).
 * Soundfont voices read as their GM name; the synthesis engines read as their
 * kind so a track always shows what it currently is.
 */

import type { InstrumentConfig } from "../../model/document"
import { gmProgramName } from "../../instruments/gmPrograms"

export const instrumentSummary = (config: InstrumentConfig): string => {
  switch (config.kind) {
    case "soundfont":
      return gmProgramName(config.program, config.bank)
    case "synth":
      return `Synth (${config.osc})`
    case "fmSynth":
      return "FM Synth"
    case "drumSampler":
      return "Drum Kit"
    case "sampler":
      return "Sampler"
    case "wavetable":
      return "Wavetable"
    case "ttsFragment":
      return "Phrase Sampler"
    default:
      return "Instrument"
  }
}
