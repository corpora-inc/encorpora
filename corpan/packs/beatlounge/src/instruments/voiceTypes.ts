/**
 * beatlounge — instrument VOICE TYPES (pure, no React/Tone).
 *
 * The Instruments page groups every melodic engine into three player-facing
 * voice types:
 *   • analog  — the premium subtractive analog synth (analogSynth).
 *   • preset  — a real General-MIDI soundfont voice (the family browser).
 *   • osc     — a raw oscillator (sine/saw/tri/sqr) via synthPreset().
 *
 * The active tab is DERIVED from the bound track's `instrument.kind`; switching
 * tabs voices the track to that type's default config (one setInstrument = one
 * undo step). All of that mapping is pure here so it unit-tests without a DOM.
 */

import type { InstrumentConfig } from "../model/document"
import { analogSynthPreset, synthPreset } from "../model/document"
import { resolveAnalogPreset } from "./analogSynth"
import { GM_SOUNDFONT_ID } from "./gmSoundbank"

export type VoiceType = "analog" | "preset" | "osc"

export const VOICE_TYPES: readonly VoiceType[] = ["analog", "preset", "osc"]

export const VOICE_TYPE_LABEL: Record<VoiceType, string> = {
  analog: "Analog",
  preset: "Preset",
  osc: "Osc",
}

/** The raw oscillator waveforms the Osc tab offers. */
export const OSC_WAVES = ["sine", "sawtooth", "triangle", "square"] as const
export type OscWave = (typeof OSC_WAVES)[number]

/**
 * Which voice TYPE owns a given instrument kind. Analog → analog; soundfont →
 * preset; the raw `synth` engine → osc; everything else (fm / wavetable / …)
 * shows under "preset" (the browser is the place to re-voice them).
 */
export const voiceTypeForKind = (kind: InstrumentConfig["kind"]): VoiceType => {
  switch (kind) {
    case "analogSynth":
      return "analog"
    case "synth":
      return "osc"
    case "soundfont":
      return "preset"
    default:
      return "preset"
  }
}

/** The active voice type for a config (drives the tab highlight). */
export const voiceTypeOf = (config: InstrumentConfig): VoiceType =>
  voiceTypeForKind(config.kind)

/**
 * The default config when SWITCHING to a voice type. Analog → init patch; preset
 * → GM Grand Piano (the family browser then re-voices it); osc → a warm triangle
 * raw oscillator. `oscWave` lets the Osc tab pick the waveform directly.
 */
export const configForVoiceType = (
  type: VoiceType,
  oscWave: OscWave = "triangle"
): InstrumentConfig => {
  switch (type) {
    case "analog":
      return { kind: "analogSynth", preset: "init", params: resolveAnalogPreset("init") }
    case "osc":
      return synthPreset(oscWave)
    case "preset":
    default:
      return { kind: "soundfont", soundfontId: GM_SOUNDFONT_ID, program: 0, bank: 0 }
  }
}

/** Re-export the model factories so callers have one import surface. */
export { analogSynthPreset, synthPreset }
