/**
 * beatlounge — instrument factory. Maps an InstrumentConfig to a live
 * Instrument. Wave 1 ships synth / fmSynth / drumSampler(synthKit). Not-yet-
 * implemented engines (sampler, wavetable, soundfont, ttsFragment) fall back to
 * a synth so a track is never silent — the Wave-2 instrument team fills these in
 * behind this same factory + the frozen Instrument output.
 */

import type { Instrument } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"
import { synthPreset } from "../model/document"
import { createSynthInstrument } from "./synth"
import { createFmInstrument } from "./fmSynth"
import { createDrumKitInstrument } from "./drumKit"

export const createInstrument = (config: InstrumentConfig): Instrument => {
  switch (config.kind) {
    case "synth":
      return createSynthInstrument(config)
    case "fmSynth":
      return createFmInstrument(config)
    case "drumSampler":
      return createDrumKitInstrument(config)
    default:
      // Wave-2 placeholders → audible synth fallback.
      return createSynthInstrument(synthPreset("sawtooth"))
  }
}

/** True when a config change requires a full instrument rebuild (kind change)
 *  vs. an in-place `update()`. */
export const instrumentKindOf = (config: InstrumentConfig): string => config.kind
