/**
 * beatlounge — instrument factory. Maps an InstrumentConfig to a live
 * Instrument. Ships synth / fmSynth / drumSampler(synthKit) plus the Wave-2
 * engines: sampler, wavetable, soundfont (spessasynth). `ttsFragment` is owned
 * by the fragment team; the `default` stays a synth so a track is never silent.
 *
 * Sine/triangle synth presets with a slow attack (drones / pads) are routed to
 * the dedicated lush sine-pad engine; short synth voices use the plain
 * subtractive synth. Both consume the same "synth" config kind.
 */

import type { Instrument } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"
import { synthPreset } from "../model/document"
import { createSynthInstrument } from "./synth"
import { createFmInstrument } from "./fmSynth"
import { createDrumKitInstrument } from "./drumKit"
import { createSamplerInstrument } from "./sampler"
import { createWavetableInstrument } from "./wavetable"
import { createSoundfontInstrument } from "./soundfont"
import { createSinePadInstrument } from "./sinePad"

type SynthConfig = Extract<InstrumentConfig, { kind: "synth" }>

/** A sine/triangle synth with a slow attack reads as a pad/drone → sine-pad. */
const PAD_ATTACK_THRESHOLD = 0.4
const isPadVoice = (c: SynthConfig): boolean =>
  (c.osc === "sine" || c.osc === "triangle") && c.env.attack >= PAD_ATTACK_THRESHOLD

export const createInstrument = (config: InstrumentConfig): Instrument => {
  switch (config.kind) {
    case "synth":
      return isPadVoice(config)
        ? createSinePadInstrument(config)
        : createSynthInstrument(config)
    case "fmSynth":
      return createFmInstrument(config)
    case "drumSampler":
      return createDrumKitInstrument(config)
    case "sampler":
      return createSamplerInstrument(config)
    case "wavetable":
      return createWavetableInstrument(config)
    case "soundfont":
      return createSoundfontInstrument(config)
    default:
      // ttsFragment (owned by the fragment team) + any future kind → audible
      // synth fallback so a track is never silent.
      return createSynthInstrument(synthPreset("sawtooth"))
  }
}

/** True when a config change requires a full instrument rebuild (kind change)
 *  vs. an in-place `update()`. */
export const instrumentKindOf = (config: InstrumentConfig): string => config.kind
