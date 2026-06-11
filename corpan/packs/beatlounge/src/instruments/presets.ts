/**
 * beatlounge — the SOFTWARE-INSTRUMENT preset corpus. PURE DATA over the
 * pack's existing synthesis engines (synth / sinePad / fmSynth / wavetable /
 * analogSynth). Every preset is a named, well-tuned `InstrumentConfig` plus
 * display metadata; NO sample/soundfont assets are needed, so each one is a
 * fully-synthesized, distinct, recognizable voice that works offline.
 *
 * This is the working instrument content. Real multisampled soundfonts remain a
 * FUTURE downloadable/paid path via the catalog (see SOUNDFONTS.md) — the
 * soundfont engine stays, it is just no longer the default that collapses every
 * program to one triangle voice.
 *
 * Structured like the pack's other corpora (rhythms / kits / modes / chords): a
 * typed schema + a frozen index + lookups (`getPreset`, `listPresets`,
 * `presetsByFamily`). Engine routing is handled by ./createInstrument:
 *   • a `synth` config whose osc is sine/triangle AND attack ≥ 0.4 routes to the
 *     lush sine-pad engine (so the "pad" family reads as a pad, not a beep);
 *   • short `synth` configs use the plain subtractive synth;
 *   • `analogSynth` configs carry a FULL param bag (so the engine never has to
 *     reach for a preset name) and own filter-envelope timbres (bass / lead /
 *     brass / pluck);
 *   • `fmSynth` / `wavetable` route to their own engines.
 */

import type { InstrumentConfig } from "../model/document"
import {
  defaultAnalogParams,
  resolveAnalogPreset,
  type AnalogParams,
} from "./analogSynth"

/** The instrument families the browser groups by (ordered for the UI). */
export const PRESET_FAMILIES = [
  "keys",
  "bass",
  "lead",
  "pad",
  "pluck",
  "brass",
  "fx",
] as const
export type PresetFamily = (typeof PRESET_FAMILIES)[number]

/** Human labels for each family (UI section headers). */
export const FAMILY_LABEL: Record<PresetFamily, string> = {
  keys: "Keys",
  bass: "Bass",
  lead: "Leads",
  pad: "Pads",
  pluck: "Plucks & Mallets",
  brass: "Brass & Wind",
  fx: "FX & Other",
}

export interface InstrumentPreset {
  /** Stable preset key (e.g. "grand-piano"). */
  id: string
  /** Human label for the picker. */
  name: string
  /** Which family this preset lives in. */
  family: PresetFamily
  /** Short blurb for the UI. */
  description: string
  /** The frozen engine config this preset materializes. */
  config: InstrumentConfig
}

// ---------------------------------------------------------------- builders
/** A subtractive `synth` config (routes to the plain or pad engine by attack). */
const synth = (
  osc: "sine" | "triangle" | "sawtooth" | "square",
  filter: { frequency: number; q: number; type?: "lowpass" | "highpass" | "bandpass" },
  env: { attack: number; decay: number; sustain: number; release: number }
): InstrumentConfig => ({
  kind: "synth",
  osc,
  filter: { type: filter.type ?? "lowpass", frequency: filter.frequency, q: filter.q },
  env,
})

/** An `fmSynth` config (harmonicity / modulation index / amp env). */
const fm = (
  harmonicity: number,
  modIndex: number,
  env: { attack: number; decay: number; sustain: number; release: number }
): InstrumentConfig => ({ kind: "fmSynth", harmonicity, modIndex, env })

/** A `wavetable` config over one of the built-in tables. */
const wavetable = (
  tableId: string,
  env: { attack: number; decay: number; sustain: number; release: number },
  filter: { frequency: number; q: number; type?: "lowpass" | "highpass" | "bandpass" }
): InstrumentConfig => ({
  kind: "wavetable",
  tableId,
  env,
  filter: { type: filter.type ?? "lowpass", frequency: filter.frequency, q: filter.q },
})

/**
 * An `analogSynth` config carrying a FULL param bag. We start from a named
 * engine preset (or the defaults) and layer sparse overrides, then FREEZE the
 * resolved bag into the config so the document is self-describing (the engine
 * never has to resolve a preset name — params win).
 */
const analog = (base: string | null, overrides: AnalogParams = {}): InstrumentConfig => {
  const params: AnalogParams = {
    ...(base ? resolveAnalogPreset(base) : defaultAnalogParams()),
    ...overrides,
  }
  return { kind: "analogSynth", preset: base ?? "init", params }
}

// ================================================================ presets
//
// Each preset is tuned so the FAMILY is clearly audible and distinct from the
// others: oscillator/table choice, filter cutoff/Q + (analog) filter envelope,
// amp ADSR, FM harmonicity/index. Comments note the engine each one rides.

const PRESETS: InstrumentPreset[] = [
  // ----------------------------------------------------------------- keys
  {
    id: "grand-piano",
    name: "Grand Piano",
    family: "keys",
    description: "Bright struck acoustic — fast attack, natural decay.",
    // analog: square+triangle, open filter w/ env, percussive amp decay.
    config: analog(null, {
      osc1Wave: "triangle",
      osc2Wave: "square",
      osc2Semi: 0,
      osc2Detune: 3,
      oscMix: 0.32,
      subLevel: 0.1,
      cutoff: 5200,
      resonance: 1.2,
      filterEnvAmount: 0.4,
      keyTracking: 0.6,
      filterAttack: 0.002,
      filterDecay: 0.6,
      filterSustain: 0.15,
      filterRelease: 0.4,
      ampAttack: 0.002,
      ampDecay: 1.0,
      ampSustain: 0.0,
      ampRelease: 0.5,
      drive: 0.08,
      voiceMode: "poly",
    }),
  },
  {
    id: "electric-piano",
    name: "Electric Piano",
    family: "keys",
    description: "Rhodes-ish tine EP — bell-tinged, warm, vibey.",
    // FM gives the classic tine bark + body; gentle decay.
    config: fm(3, 4.2, { attack: 0.003, decay: 0.9, sustain: 0.28, release: 0.7 }),
  },
  {
    id: "clav",
    name: "Clav",
    family: "keys",
    description: "Funky clavinet — tight, biting, plucked envelope.",
    config: analog("pluck", {
      osc1Wave: "square",
      osc2Wave: "sawtooth",
      osc2Semi: 0,
      oscMix: 0.45,
      cutoff: 2600,
      resonance: 6,
      filterEnvAmount: 0.7,
      filterDecay: 0.12,
      filterSustain: 0.0,
      ampAttack: 0.001,
      ampDecay: 0.22,
      ampSustain: 0.0,
      ampRelease: 0.1,
      drive: 0.3,
      voiceMode: "poly",
    }),
  },
  {
    id: "drawbar-organ",
    name: "Drawbar Organ",
    family: "keys",
    description: "Tonewheel organ — drawbar harmonics, instant on/off.",
    // wavetable "organ" recipe = drawbar harmonics; flat sustain, no attack.
    config: wavetable(
      "organ",
      { attack: 0.005, decay: 0.05, sustain: 1.0, release: 0.08 },
      { frequency: 4200, q: 0.6 }
    ),
  },
  {
    id: "harpsichord",
    name: "Harpsichord",
    family: "keys",
    description: "Plucked baroque keys — bright, jangly, quick decay.",
    config: wavetable(
      "saw",
      { attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.25 },
      { frequency: 6500, q: 1.0, type: "highpass" }
    ),
  },
  {
    id: "fm-epiano",
    name: "DX Piano",
    family: "keys",
    description: "Glassy digital EP — crisp FM bell over a soft body.",
    config: fm(2, 3.2, { attack: 0.002, decay: 1.1, sustain: 0.22, release: 0.9 }),
  },
  {
    id: "wurli",
    name: "Wurli",
    family: "keys",
    description: "Reedy electric piano — barky midrange, vintage growl.",
    config: analog("pluck", {
      osc1Wave: "triangle",
      osc2Wave: "square",
      osc2Semi: 12,
      oscMix: 0.4,
      cutoff: 2200,
      resonance: 2.2,
      filterEnvAmount: 0.5,
      filterDecay: 0.5,
      filterSustain: 0.18,
      ampAttack: 0.003,
      ampDecay: 1.0,
      ampSustain: 0.12,
      ampRelease: 0.5,
      drive: 0.22,
      voiceMode: "poly",
    }),
  },

  // ----------------------------------------------------------------- bass
  {
    id: "sub-bass",
    name: "Sub Bass",
    family: "bass",
    description: "Deep round sine sub — fast attack, tight tail.",
    config: fm(1, 1.2, { attack: 0.004, decay: 0.2, sustain: 0.7, release: 0.18 }),
  },
  {
    id: "acid-bass",
    name: "Acid Bass",
    family: "bass",
    description: "Squelchy 303-style — high resonance, filter-env zap.",
    config: analog("acid lead", {
      osc2Semi: -12,
      cutoff: 480,
      resonance: 18,
      filterEnvAmount: 0.9,
      filterDecay: 0.22,
      ampSustain: 0.6,
      voiceMode: "mono",
      glide: 0.05,
    }),
  },
  {
    id: "fm-bass",
    name: "FM Bass",
    family: "bass",
    description: "Metallic FM growl — punchy, harmonically rich.",
    config: fm(2, 6, { attack: 0.003, decay: 0.3, sustain: 0.5, release: 0.2 }),
  },
  {
    id: "pluck-bass",
    name: "Pluck Bass",
    family: "bass",
    description: "Short stabby bass — percussive, no sustain.",
    config: analog("fat bass", {
      cutoff: 700,
      resonance: 5,
      filterEnvAmount: 0.6,
      filterDecay: 0.14,
      ampDecay: 0.2,
      ampSustain: 0.0,
      ampRelease: 0.12,
      voiceMode: "mono",
    }),
  },
  {
    id: "upright-bass",
    name: "Upright Bass",
    family: "bass",
    description: "Round acoustic-ish upright — soft attack, woody.",
    config: synth(
      "triangle",
      { frequency: 900, q: 1.4 },
      { attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.25 }
    ),
  },
  {
    id: "reese-bass",
    name: "Reese Bass",
    family: "bass",
    description: "Detuned growling sub — wide, menacing, modulated.",
    config: analog("fat bass", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "fatsawtooth",
      osc2Detune: 30,
      osc2Semi: 0,
      oscMix: 0.5,
      subLevel: 0.35,
      cutoff: 420,
      resonance: 6,
      filterEnvAmount: 0.4,
      filterDecay: 0.4,
      ampSustain: 0.9,
      ampRelease: 0.2,
      lfoRate: 0.5,
      lfoDepth: 0.3,
      lfoTarget: "filter",
      drive: 0.4,
      voiceMode: "mono",
      glide: 0.04,
    }),
  },
  {
    id: "synth-bass",
    name: "Synth Bass",
    family: "bass",
    description: "Tight punchy square bass — classic, rubbery, clean.",
    config: analog(null, {
      osc1Wave: "square",
      osc2Wave: "sawtooth",
      osc2Semi: 0,
      oscMix: 0.3,
      subLevel: 0.5,
      cutoff: 900,
      resonance: 4,
      filterEnvAmount: 0.55,
      filterDecay: 0.18,
      filterSustain: 0.1,
      ampAttack: 0.002,
      ampDecay: 0.3,
      ampSustain: 0.7,
      ampRelease: 0.14,
      drive: 0.2,
      voiceMode: "mono",
      glide: 0.02,
    }),
  },

  // ----------------------------------------------------------------- leads
  {
    id: "saw-lead",
    name: "Saw Lead",
    family: "lead",
    description: "Classic bright sawtooth lead — cutting, expressive.",
    config: synth(
      "sawtooth",
      { frequency: 4000, q: 2.0 },
      { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.25 }
    ),
  },
  {
    id: "square-lead",
    name: "Square Lead",
    family: "lead",
    description: "Hollow square lead — woody, chiptune-leaning.",
    config: synth(
      "square",
      { frequency: 3200, q: 1.6 },
      { attack: 0.008, decay: 0.18, sustain: 0.65, release: 0.2 }
    ),
  },
  {
    id: "fm-lead",
    name: "FM Lead",
    family: "lead",
    description: "Glassy FM lead — sparkly upper harmonics.",
    config: fm(2.5, 5, { attack: 0.005, decay: 0.25, sustain: 0.6, release: 0.3 }),
  },
  {
    id: "supersaw",
    name: "Supersaw",
    family: "lead",
    description: "Huge detuned saw stack — anthemic, wide.",
    config: analog("init", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "fatsawtooth",
      osc2Detune: 28,
      osc2Semi: 0,
      oscMix: 0.5,
      subLevel: 0.1,
      cutoff: 6000,
      resonance: 1.5,
      filterEnvAmount: 0.25,
      ampAttack: 0.01,
      ampDecay: 0.3,
      ampSustain: 0.8,
      ampRelease: 0.4,
      drive: 0.12,
      voiceMode: "poly",
    }),
  },
  {
    id: "mono-lead",
    name: "Mono Lead",
    family: "lead",
    description: "Expressive solo lead — mono with glide, vocal vibrato.",
    config: analog("acid lead", {
      osc1Wave: "sawtooth",
      osc2Wave: "pulse",
      osc2Detune: 6,
      oscMix: 0.35,
      cutoff: 2400,
      resonance: 3,
      filterEnvAmount: 0.4,
      ampSustain: 0.8,
      ampRelease: 0.25,
      lfoRate: 5.5,
      lfoDepth: 0.18,
      lfoTarget: "pitch",
      glide: 0.08,
      voiceMode: "mono",
      drive: 0.2,
    }),
  },
  {
    id: "chip-lead",
    name: "Chip Lead",
    family: "lead",
    description: "8-bit pulse lead — bright, retro, arcade.",
    config: wavetable(
      "square",
      { attack: 0.001, decay: 0.08, sustain: 0.85, release: 0.06 },
      { frequency: 5000, q: 0.8 }
    ),
  },

  // ------------------------------------------------------------------ pads
  {
    id: "warm-pad",
    name: "Warm Pad",
    family: "pad",
    description: "Lush detuned triangle pad — slow swell. (sine-pad engine)",
    // triangle + slow attack ⇒ routes to the lush sine-pad engine.
    config: synth(
      "triangle",
      { frequency: 3000, q: 0.9 },
      { attack: 0.8, decay: 1.4, sustain: 0.8, release: 2.4 }
    ),
  },
  {
    id: "glass-pad",
    name: "Glass Pad",
    family: "pad",
    description: "Pure detuned sine bed — glassy, calm. (sine-pad engine)",
    config: synth(
      "sine",
      { frequency: 2400, q: 0.7 },
      { attack: 1.1, decay: 1.2, sustain: 0.9, release: 3.2 }
    ),
  },
  {
    id: "string-ensemble",
    name: "String Ensemble",
    family: "pad",
    description: "Bowed string section — fat saws, slow attack.",
    config: analog("warm pad", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "fatsawtooth",
      osc2Detune: 16,
      cutoff: 2600,
      resonance: 1.0,
      filterAttack: 0.4,
      ampAttack: 0.35,
      ampDecay: 1.0,
      ampSustain: 0.85,
      ampRelease: 1.8,
      drive: 0.08,
    }),
  },
  {
    id: "choir-pad",
    name: "Choir",
    family: "pad",
    description: "Vowel-formant voices — breathy 'aah' ensemble.",
    // wavetable "vocal" recipe = two formant bumps.
    config: wavetable(
      "vocal",
      { attack: 0.4, decay: 1.0, sustain: 0.85, release: 2.2 },
      { frequency: 2800, q: 0.8 }
    ),
  },
  {
    id: "sweep-pad",
    name: "Sweep Pad",
    family: "pad",
    description: "Evolving filter sweep — slow LFO wobble, motion.",
    config: analog("warm pad", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "square",
      cutoff: 900,
      resonance: 5,
      filterEnvAmount: 0.6,
      filterAttack: 1.6,
      filterDecay: 2.0,
      filterSustain: 0.7,
      ampAttack: 0.6,
      ampRelease: 2.4,
      lfoRate: 0.18,
      lfoDepth: 0.5,
      lfoTarget: "filter",
    }),
  },
  {
    id: "warm-saw-pad",
    name: "Analog Pad",
    family: "pad",
    description: "Classic warm poly pad — soft saws, gentle chorus motion.",
    config: analog("warm pad", {}),
  },
  {
    id: "halo-pad",
    name: "Halo",
    family: "pad",
    description: "Airy vowel halo — breathy, shimmering, weightless.",
    config: wavetable(
      "vocal",
      { attack: 1.4, decay: 1.6, sustain: 0.7, release: 3.4 },
      { frequency: 3600, q: 1.2, type: "bandpass" }
    ),
  },

  // ------------------------------------------------------- plucks & mallets
  {
    id: "synth-pluck",
    name: "Synth Pluck",
    family: "pluck",
    description: "Bright resonant pluck — snappy filter-env decay.",
    config: analog("pluck", {}),
  },
  {
    id: "marimba",
    name: "Marimba",
    family: "pluck",
    description: "Wooden mallet — soft sine-ish tone, quick decay.",
    config: fm(1, 1, { attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.4 }),
  },
  {
    id: "bell-mallet",
    name: "Bell",
    family: "pluck",
    description: "Struck bell — inharmonic FM clang, long ring.",
    config: fm(3.5, 8, { attack: 0.001, decay: 1.6, sustain: 0.0, release: 1.8 }),
  },
  {
    id: "kalimba",
    name: "Kalimba",
    family: "pluck",
    description: "Thumb-piano tine — bright ping, short bloom.",
    config: fm(2, 2.5, { attack: 0.001, decay: 0.35, sustain: 0.0, release: 0.3 }),
  },
  {
    id: "music-box",
    name: "Music Box",
    family: "pluck",
    description: "Tinkling glass comb — sparkly, fragile, decaying.",
    config: wavetable(
      "glass",
      { attack: 0.001, decay: 1.2, sustain: 0.0, release: 1.4 },
      { frequency: 7000, q: 0.7 }
    ),
  },
  {
    id: "harp",
    name: "Harp",
    family: "pluck",
    description: "Plucked nylon harp — warm, rounded, ringing tail.",
    config: analog("pluck", {
      osc1Wave: "triangle",
      osc2Wave: "sine",
      osc2Semi: 12,
      oscMix: 0.3,
      cutoff: 4200,
      resonance: 1.6,
      filterEnvAmount: 0.45,
      filterDecay: 0.8,
      ampDecay: 1.4,
      ampSustain: 0.0,
      ampRelease: 1.0,
      drive: 0.05,
    }),
  },
  {
    id: "vibraphone",
    name: "Vibraphone",
    family: "pluck",
    description: "Struck metal bars — mellow FM shimmer, soft mallet.",
    config: fm(4, 3, { attack: 0.002, decay: 1.4, sustain: 0.0, release: 1.2 }),
  },

  // ------------------------------------------------------------ brass & wind
  {
    id: "brass-section",
    name: "Brass Section",
    family: "brass",
    description: "Punchy saw brass — filter-env bite, ensemble body.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "sawtooth",
      osc2Detune: 9,
      oscMix: 0.5,
      cutoff: 1100,
      resonance: 2.5,
      filterEnvAmount: 0.7,
      filterAttack: 0.06,
      filterDecay: 0.3,
      filterSustain: 0.5,
      ampAttack: 0.04,
      ampDecay: 0.2,
      ampSustain: 0.8,
      ampRelease: 0.25,
      drive: 0.2,
      voiceMode: "poly",
    }),
  },
  {
    id: "synth-brass",
    name: "Synth Brass",
    family: "brass",
    description: "Fat 80s synth-brass stab — bold, resonant.",
    config: analog(null, {
      osc1Wave: "fatsawtooth",
      osc2Wave: "square",
      osc2Detune: 12,
      oscMix: 0.4,
      cutoff: 1400,
      resonance: 4,
      filterEnvAmount: 0.75,
      filterAttack: 0.03,
      filterDecay: 0.25,
      filterSustain: 0.45,
      ampAttack: 0.02,
      ampSustain: 0.85,
      ampRelease: 0.2,
      drive: 0.28,
    }),
  },
  {
    id: "reed",
    name: "Reed",
    family: "brass",
    description: "Hollow reed/wind — soft square, breathy attack.",
    config: synth(
      "square",
      { frequency: 1800, q: 1.2 },
      { attack: 0.06, decay: 0.2, sustain: 0.7, release: 0.3 }
    ),
  },
  {
    id: "flute",
    name: "Flute",
    family: "brass",
    description: "Breathy sine flute — pure tone with a touch of air.",
    config: analog(null, {
      osc1Wave: "sine",
      osc2Wave: "triangle",
      oscMix: 0.25,
      noiseLevel: 0.06,
      cutoff: 2600,
      resonance: 0.8,
      filterEnvAmount: 0.1,
      ampAttack: 0.08,
      ampDecay: 0.2,
      ampSustain: 0.85,
      ampRelease: 0.3,
      lfoRate: 5,
      lfoDepth: 0.08,
      lfoTarget: "pitch",
      drive: 0.02,
      voiceMode: "poly",
    }),
  },
  {
    id: "french-horn",
    name: "French Horn",
    family: "brass",
    description: "Mellow rounded horn — soft attack, noble body.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "triangle",
      osc2Detune: 5,
      oscMix: 0.35,
      cutoff: 1000,
      resonance: 1.4,
      filterEnvAmount: 0.5,
      filterAttack: 0.12,
      filterDecay: 0.5,
      filterSustain: 0.6,
      ampAttack: 0.09,
      ampDecay: 0.3,
      ampSustain: 0.8,
      ampRelease: 0.4,
      drive: 0.12,
      voiceMode: "poly",
    }),
  },

  // ------------------------------------------------------------- fx & other
  {
    id: "glass-bell",
    name: "Glass Bell",
    family: "fx",
    description: "Crystalline struck glass — bright wavetable ring.",
    config: wavetable(
      "glass",
      { attack: 0.002, decay: 1.8, sustain: 0.0, release: 2.0 },
      { frequency: 6000, q: 0.6 }
    ),
  },
  {
    id: "drone",
    name: "Drone",
    family: "fx",
    description: "Endless sustained bed — slow swell, long tail. (sine-pad)",
    config: synth(
      "sine",
      { frequency: 2200, q: 0.7 },
      { attack: 1.2, decay: 1.0, sustain: 1.0, release: 4.0 }
    ),
  },
  {
    id: "stab",
    name: "Stab",
    family: "fx",
    description: "Arp-friendly resonant stab — short, sharp, rhythmic.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      osc2Semi: 12,
      oscMix: 0.45,
      cutoff: 1600,
      resonance: 8,
      filterEnvAmount: 0.8,
      filterDecay: 0.12,
      filterSustain: 0.0,
      ampAttack: 0.002,
      ampDecay: 0.16,
      ampSustain: 0.0,
      ampRelease: 0.1,
      drive: 0.25,
      voiceMode: "poly",
    }),
  },
  {
    id: "metallic-fm",
    name: "Metallic",
    family: "fx",
    description: "Clangorous inharmonic FM — alien, ringing, tense.",
    config: fm(5.5, 12, { attack: 0.002, decay: 0.8, sustain: 0.2, release: 1.0 }),
  },
  {
    id: "noise-sweep",
    name: "Riser",
    family: "fx",
    description: "Filtered noise riser — tension build, slow open.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      oscMix: 0.0,
      subLevel: 0.0,
      noiseLevel: 0.9,
      cutoff: 300,
      resonance: 8,
      filterEnvAmount: 0.95,
      filterAttack: 2.4,
      filterDecay: 1.0,
      filterSustain: 0.9,
      ampAttack: 0.8,
      ampDecay: 1.0,
      ampSustain: 0.9,
      ampRelease: 0.6,
      drive: 0.1,
      voiceMode: "poly",
    }),
  },
  {
    id: "pulse-pluck",
    name: "Plink",
    family: "fx",
    description: "Tiny resonant blip — UI-style ping, super short.",
    config: synth(
      "square",
      { frequency: 4000, q: 6, type: "bandpass" },
      { attack: 0.001, decay: 0.1, sustain: 0.0, release: 0.08 }
    ),
  },
]

export const INSTRUMENT_PRESETS: readonly InstrumentPreset[] = Object.freeze(PRESETS)

const PRESET_BY_ID: Readonly<Record<string, InstrumentPreset>> = Object.freeze(
  Object.fromEntries(INSTRUMENT_PRESETS.map((p) => [p.id, p]))
)

// ---------------------------------------------------------------- lookups
/** All presets, in corpus order. */
export const listPresets = (): readonly InstrumentPreset[] => INSTRUMENT_PRESETS

/** A single preset by id, or undefined. */
export const getPreset = (id: string): InstrumentPreset | undefined => PRESET_BY_ID[id]

/** Presets grouped by family, in `PRESET_FAMILIES` order (only non-empty
 *  families with their members in corpus order). */
export const presetsByFamily = (): { family: PresetFamily; presets: InstrumentPreset[] }[] =>
  PRESET_FAMILIES.map((family) => ({
    family,
    presets: INSTRUMENT_PRESETS.filter((p) => p.family === family),
  })).filter((g) => g.presets.length > 0)

/** The family that owns a preset id (for opening the right section). */
export const familyOfPreset = (id: string): PresetFamily | undefined => PRESET_BY_ID[id]?.family

/** Find the corpus preset whose config equals `config` (so the UI can show the
 *  active preset). Compares by stable JSON so a re-voiced track resolves back to
 *  its preset; returns undefined for a hand-edited / soundfont / tts voice. */
export const matchPreset = (config: InstrumentConfig): InstrumentPreset | undefined => {
  const key = stableKey(config)
  for (const p of INSTRUMENT_PRESETS) {
    if (stableKey(p.config) === key) return p
  }
  return undefined
}

/** Order-independent JSON key for an InstrumentConfig (param-bag order varies). */
const stableKey = (config: InstrumentConfig): string => {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, sort((v as Record<string, unknown>)[k])])
      )
    }
    return v
  }
  return JSON.stringify(sort(config))
}

/** A fresh, deep copy of a preset's config so document mutation never aliases
 *  the shared frozen preset data. */
export const instantiatePreset = (id: string): InstrumentConfig | undefined => {
  const preset = PRESET_BY_ID[id]
  if (!preset) return undefined
  return structuredClone(preset.config)
}

/** The default voice a brand-new instrument track gets — a sensible, audible
 *  starting point (a bright saw lead). */
export const DEFAULT_PRESET_ID = "saw-lead"
