/**
 * beatlounge — instrument presets. PURE DATA over the generic engines
 * (synth / fmSynth / wavetable / sampler / drumSampler). Tamburas, tablas,
 * drones and sine pads are presets here — NOT new engine kinds (see the
 * document.ts contract note).
 *
 * Each preset is an `InstrumentConfig` plus display metadata so the UI can list
 * them. Engine factories (./createInstrument) route these to the right runtime
 * (e.g. a sine/triangle-pad synth preset → the sine-pad engine).
 */

import type { InstrumentConfig, SampleZone } from "../model/document"
import { newId } from "../model/ids"

export type PresetCategory = "drone" | "pad" | "bass" | "pluck" | "keys" | "percussion"

export interface InstrumentPreset {
  /** Stable preset key (e.g. "tambura"). */
  id: string
  /** Human label for the picker. */
  label: string
  /** Short blurb for the UI. */
  description: string
  category: PresetCategory
  /** The frozen engine config this preset materializes. */
  config: InstrumentConfig
}

/** A multi-zone chromatic map across a sample set, repitched from `roots`. */
const chromaticZones = (sampleSetId: string, roots: number[]): SampleZone[] => {
  const sorted = [...roots].sort((a, b) => a - b)
  return sorted.map((root, i) => {
    const lo = i === 0 ? 0 : Math.floor((sorted[i - 1] + root) / 2) + 1
    const hi = i === sorted.length - 1 ? 127 : Math.floor((root + sorted[i + 1]) / 2)
    return {
      sampleId: `${sampleSetId}:${root}`,
      rootNote: root,
      loNote: lo,
      hiNote: hi,
    }
  })
}

// ---------------------------------------------------------------- presets

/** Tambura drone — long, droning saw-ish synth tuned for a sustained pad bed. */
const tambura: InstrumentPreset = {
  id: "tambura",
  label: "Tambura",
  description: "Sustained Indian drone — long release, slow swell.",
  category: "drone",
  config: {
    kind: "synth",
    osc: "sawtooth",
    filter: { type: "lowpass", frequency: 1400, q: 2.0 },
    env: { attack: 0.6, decay: 1.2, sustain: 0.9, release: 3.0 },
  },
}

/** Sine drone — pure, glassy sustained tone (routed to the sine-pad engine). */
const sineDrone: InstrumentPreset = {
  id: "sine-drone",
  label: "Sine Drone",
  description: "Pure detuned sine bed — endless, calm.",
  category: "drone",
  config: {
    kind: "synth",
    osc: "sine",
    filter: { type: "lowpass", frequency: 2200, q: 0.7 },
    env: { attack: 1.2, decay: 1.0, sustain: 1.0, release: 4.0 },
  },
}

/** Warm pad — triangle sine-pad with a soft attack and lush release. */
const warmPad: InstrumentPreset = {
  id: "warm-pad",
  label: "Warm Pad",
  description: "Lush detuned triangle pad — slow attack.",
  category: "pad",
  config: {
    kind: "synth",
    osc: "triangle",
    filter: { type: "lowpass", frequency: 3000, q: 0.9 },
    env: { attack: 0.8, decay: 1.4, sustain: 0.8, release: 2.4 },
  },
}

/** Sub bass — deep, round FM bass with a fast attack. */
const subBass: InstrumentPreset = {
  id: "sub-bass",
  label: "Sub Bass",
  description: "Deep round FM sub — fast attack, tight tail.",
  category: "bass",
  config: {
    kind: "fmSynth",
    harmonicity: 1,
    modIndex: 2.5,
    env: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.3 },
  },
}

/** Pluck — short percussive sampler voice (placeholder until pluck samples). */
const pluck: InstrumentPreset = {
  id: "pluck",
  label: "Pluck",
  description: "Short plucked string — bright, decaying.",
  category: "pluck",
  config: {
    kind: "sampler",
    sampleSetId: "pluck",
    mode: "repitch",
    zones: chromaticZones("pluck", [48, 55, 60, 67, 72]),
  },
}

/** Bell — glassy wavetable with a long ring. */
const bell: InstrumentPreset = {
  id: "bell",
  label: "Bell",
  description: "Glassy struck bell — bright wavetable, long ring.",
  category: "keys",
  config: {
    kind: "wavetable",
    tableId: "glass",
    env: { attack: 0.002, decay: 1.6, sustain: 0.0, release: 1.8 },
    filter: { type: "lowpass", frequency: 6000, q: 0.6 },
  },
}

/** Tabla — pitched percussion sample kit (tabla/baya zones via sampler). */
const tabla: InstrumentPreset = {
  id: "tabla",
  label: "Tabla",
  description: "Indian tabla & baya hits — repitched sampler kit.",
  category: "percussion",
  config: {
    kind: "sampler",
    sampleSetId: "tabla",
    mode: "repitch",
    // Low baya (left drum) + higher dayan (right drum) zones.
    zones: chromaticZones("tabla", [43, 50, 57, 62, 67]),
  },
}

export const INSTRUMENT_PRESETS: readonly InstrumentPreset[] = [
  tambura,
  sineDrone,
  warmPad,
  subBass,
  pluck,
  bell,
  tabla,
] as const

const PRESET_BY_ID: Readonly<Record<string, InstrumentPreset>> = Object.freeze(
  Object.fromEntries(INSTRUMENT_PRESETS.map((p) => [p.id, p]))
)

export const getPreset = (id: string): InstrumentPreset | undefined => PRESET_BY_ID[id]

/** A fresh, deep copy of a preset's config (so document mutation never aliases
 *  the shared frozen preset data). `sampleSetId`s stay stable, but per-track
 *  ids that need uniqueness can be re-seeded by the caller. */
export const instantiatePreset = (id: string): InstrumentConfig | undefined => {
  const preset = PRESET_BY_ID[id]
  if (!preset) return undefined
  return structuredClone(preset.config)
}

/** Convenience for callers that want a unique sample-set id per instance. */
export const instantiatePresetWithFreshSet = (id: string): InstrumentConfig | undefined => {
  const cfg = instantiatePreset(id)
  if (cfg && cfg.kind === "sampler") {
    return { ...cfg, sampleSetId: `${cfg.sampleSetId}-${newId()}` }
  }
  return cfg
}
