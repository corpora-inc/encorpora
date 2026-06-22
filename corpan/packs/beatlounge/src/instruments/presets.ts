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

  // ============================================================ deep palette
  // A second, broader wave of presets so the corpus is the fullest-possible,
  // genuinely-distinct set. Each one differs in engine, oscillator mix, filter
  // and envelope from its family-mates above — not a variation on one voice.

  // ----------------------------------------------------------------- keys (+)
  {
    id: "tine-ep",
    name: "Tine EP",
    family: "keys",
    description: "Soft mellow tine — warm bark, gentle vintage roundness.",
    config: fm(2, 2.6, { attack: 0.004, decay: 1.3, sustain: 0.3, release: 0.9 }),
  },
  {
    id: "honky-tonk",
    name: "Honky Tonk",
    family: "keys",
    description: "Detuned bar piano — jangly, slightly out, characterful.",
    config: analog(null, {
      osc1Wave: "triangle",
      osc2Wave: "square",
      osc2Detune: 14,
      oscMix: 0.4,
      cutoff: 4600,
      resonance: 1.4,
      filterEnvAmount: 0.45,
      filterDecay: 0.5,
      filterSustain: 0.1,
      ampAttack: 0.002,
      ampDecay: 1.1,
      ampSustain: 0.0,
      ampRelease: 0.5,
      drive: 0.12,
      voiceMode: "poly",
    }),
  },
  {
    id: "pipe-organ",
    name: "Pipe Organ",
    family: "keys",
    description: "Cathedral pipes — bright sustained harmonics, slow release.",
    config: wavetable(
      "organ",
      { attack: 0.04, decay: 0.1, sustain: 0.95, release: 0.6 },
      { frequency: 5200, q: 0.5 }
    ),
  },
  {
    id: "celesta",
    name: "Celesta",
    family: "keys",
    description: "Glassy keyed bells — delicate, twinkling, music-box-bright.",
    config: fm(3, 5, { attack: 0.001, decay: 0.9, sustain: 0.1, release: 0.8 }),
  },

  // ----------------------------------------------------------------- bass (+)
  {
    id: "moog-bass",
    name: "Moog Bass",
    family: "bass",
    description: "Fat round ladder bass — creamy lows, classic mono growl.",
    config: analog("fat bass", {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      osc2Semi: -12,
      oscMix: 0.4,
      subLevel: 0.55,
      cutoff: 600,
      resonance: 8,
      filterEnvAmount: 0.7,
      filterDecay: 0.3,
      ampSustain: 0.8,
      drive: 0.4,
      voiceMode: "mono",
      glide: 0.03,
    }),
  },
  {
    id: "wobble-bass",
    name: "Wobble Bass",
    family: "bass",
    description: "LFO-wobbled growl — dubstep motion, modulated cutoff.",
    config: analog("fat bass", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "square",
      osc2Detune: 18,
      oscMix: 0.45,
      cutoff: 500,
      resonance: 9,
      filterEnvAmount: 0.3,
      ampSustain: 0.9,
      ampRelease: 0.2,
      lfoRate: 4,
      lfoDepth: 0.7,
      lfoTarget: "filter",
      drive: 0.45,
      voiceMode: "mono",
    }),
  },
  {
    id: "808-bass",
    name: "808",
    family: "bass",
    description: "Booming sine sub-boom — long tail, trap-ready low end.",
    config: fm(1, 0.8, { attack: 0.002, decay: 0.6, sustain: 0.4, release: 0.9 }),
  },
  {
    id: "finger-bass",
    name: "Finger Bass",
    family: "bass",
    description: "Plucked electric-style bass — round body, mild bite.",
    config: synth(
      "sawtooth",
      { frequency: 800, q: 2.4 },
      { attack: 0.006, decay: 0.25, sustain: 0.55, release: 0.2 }
    ),
  },

  // ----------------------------------------------------------------- leads (+)
  {
    id: "pwm-lead",
    name: "PWM Lead",
    family: "lead",
    description: "Hollow pulse lead — animated width, vocal-ish edge.",
    config: analog("init", {
      osc1Wave: "pulse",
      osc2Wave: "sawtooth",
      pulseWidth: 0.35,
      osc2Detune: 8,
      oscMix: 0.3,
      cutoff: 3000,
      resonance: 3,
      filterEnvAmount: 0.4,
      ampAttack: 0.006,
      ampSustain: 0.78,
      ampRelease: 0.25,
      lfoRate: 0.6,
      lfoDepth: 0.25,
      lfoTarget: "filter",
      voiceMode: "poly",
    }),
  },
  {
    id: "sync-lead",
    name: "Sync Lead",
    family: "lead",
    description: "Aggressive hard-sync tear — biting, metallic, screaming.",
    config: analog("acid lead", {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      osc2Semi: 7,
      oscMix: 0.5,
      cutoff: 3200,
      resonance: 9,
      filterEnvAmount: 0.7,
      filterDecay: 0.4,
      ampSustain: 0.85,
      drive: 0.45,
      voiceMode: "mono",
      glide: 0.02,
    }),
  },
  {
    id: "whistle-lead",
    name: "Whistle",
    family: "lead",
    description: "Pure sine whistle — clean, vibrato'd, flute-like top line.",
    config: analog(null, {
      osc1Wave: "sine",
      osc2Wave: "sine",
      osc2Semi: 12,
      oscMix: 0.2,
      cutoff: 4000,
      resonance: 0.7,
      filterEnvAmount: 0.1,
      ampAttack: 0.03,
      ampSustain: 0.85,
      ampRelease: 0.3,
      lfoRate: 5.5,
      lfoDepth: 0.2,
      lfoTarget: "pitch",
      voiceMode: "mono",
      glide: 0.05,
    }),
  },
  {
    id: "fifths-lead",
    name: "Fifths Lead",
    family: "lead",
    description: "Power-fifths stack — wide, epic, two-note synth horn.",
    config: analog("init", {
      osc1Wave: "sawtooth",
      osc2Wave: "sawtooth",
      osc2Semi: 7,
      oscMix: 0.5,
      subLevel: 0.15,
      cutoff: 4500,
      resonance: 1.8,
      filterEnvAmount: 0.35,
      ampAttack: 0.012,
      ampSustain: 0.8,
      ampRelease: 0.35,
      drive: 0.15,
      voiceMode: "poly",
    }),
  },

  // ------------------------------------------------------------------ pads (+)
  {
    id: "saw-string-pad",
    name: "Saw Strings",
    family: "pad",
    description: "Bright bowed-saw ensemble — rich, cinematic, swelling.",
    config: analog("warm pad", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "fatsawtooth",
      osc2Detune: 22,
      cutoff: 3400,
      resonance: 1.2,
      filterAttack: 0.6,
      ampAttack: 0.5,
      ampSustain: 0.88,
      ampRelease: 2.2,
      drive: 0.06,
    }),
  },
  {
    id: "synth-pad-bright",
    name: "Bright Pad",
    family: "pad",
    description: "Open shimmering poly pad — airy top, slow bloom. (sine-pad)",
    config: synth(
      "triangle",
      { frequency: 5000, q: 0.6 },
      { attack: 0.9, decay: 1.6, sustain: 0.85, release: 2.8 }
    ),
  },
  {
    id: "dark-pad",
    name: "Dark Pad",
    family: "pad",
    description: "Brooding low pad — closed filter, ominous slow motion.",
    config: analog("warm pad", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "fatsawtooth",
      osc2Semi: -12,
      osc2Detune: 14,
      cutoff: 600,
      resonance: 2,
      filterEnvAmount: 0.4,
      filterAttack: 2.0,
      ampAttack: 0.8,
      ampRelease: 3.0,
      lfoRate: 0.12,
      lfoDepth: 0.3,
      lfoTarget: "filter",
      drive: 0.1,
    }),
  },
  {
    id: "voice-pad",
    name: "Voices",
    family: "pad",
    description: "Massed synthetic choir — warm formant 'ooh' bed.",
    config: wavetable(
      "vocal",
      { attack: 0.6, decay: 1.2, sustain: 0.8, release: 2.6 },
      { frequency: 2200, q: 1.0 }
    ),
  },

  // ------------------------------------------------------- plucks & mallets (+)
  {
    id: "xylophone",
    name: "Xylophone",
    family: "pluck",
    description: "Hard wood mallet — bright, dry, percussive knock.",
    config: fm(2.5, 4, { attack: 0.001, decay: 0.28, sustain: 0.0, release: 0.22 }),
  },
  {
    id: "glockenspiel",
    name: "Glockenspiel",
    family: "pluck",
    description: "Silvery metal bars — high, chiming, long sparkle.",
    config: fm(4.5, 6, { attack: 0.001, decay: 1.0, sustain: 0.0, release: 1.1 }),
  },
  {
    id: "koto",
    name: "Koto",
    family: "pluck",
    description: "Plucked string zither — bright nasal twang, fast bloom.",
    config: analog("pluck", {
      osc1Wave: "sawtooth",
      osc2Wave: "triangle",
      osc2Semi: 12,
      oscMix: 0.4,
      cutoff: 3800,
      resonance: 4,
      filterEnvAmount: 0.6,
      filterDecay: 0.4,
      ampDecay: 0.7,
      ampSustain: 0.0,
      ampRelease: 0.5,
      drive: 0.1,
    }),
  },
  {
    id: "steel-drum",
    name: "Steel Drum",
    family: "pluck",
    description: "Tropical pan — warm metallic FM ping with a hollow ring.",
    config: fm(1.5, 3.5, { attack: 0.002, decay: 0.7, sustain: 0.1, release: 0.6 }),
  },

  // ------------------------------------------------------------ brass & wind (+)
  {
    id: "trumpet",
    name: "Trumpet",
    family: "brass",
    description: "Bright solo trumpet — buzzy saw, quick bite, focused.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "sawtooth",
      osc2Detune: 4,
      oscMix: 0.3,
      cutoff: 1500,
      resonance: 3,
      filterEnvAmount: 0.65,
      filterAttack: 0.03,
      filterDecay: 0.2,
      filterSustain: 0.55,
      ampAttack: 0.03,
      ampSustain: 0.8,
      ampRelease: 0.2,
      drive: 0.22,
      voiceMode: "mono",
      glide: 0.01,
    }),
  },
  {
    id: "trombone",
    name: "Trombone",
    family: "brass",
    description: "Round low brass — warm, broad, slurred low register.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "triangle",
      osc2Semi: -12,
      oscMix: 0.35,
      cutoff: 900,
      resonance: 2,
      filterEnvAmount: 0.55,
      filterAttack: 0.08,
      filterSustain: 0.5,
      ampAttack: 0.06,
      ampSustain: 0.8,
      ampRelease: 0.3,
      drive: 0.18,
      voiceMode: "mono",
      glide: 0.04,
    }),
  },
  {
    id: "sax",
    name: "Sax",
    family: "brass",
    description: "Reedy saxophone — breathy, expressive, vibrato'd mid.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      oscMix: 0.4,
      noiseLevel: 0.05,
      cutoff: 1700,
      resonance: 2.4,
      filterEnvAmount: 0.5,
      filterAttack: 0.05,
      filterSustain: 0.55,
      ampAttack: 0.05,
      ampSustain: 0.82,
      ampRelease: 0.3,
      lfoRate: 5,
      lfoDepth: 0.1,
      lfoTarget: "pitch",
      drive: 0.2,
      voiceMode: "mono",
      glide: 0.03,
    }),
  },
  {
    id: "oboe",
    name: "Oboe",
    family: "brass",
    description: "Nasal double-reed — focused, plaintive, woodwind sustain.",
    config: synth(
      "square",
      { frequency: 2200, q: 2.2, type: "bandpass" },
      { attack: 0.04, decay: 0.15, sustain: 0.75, release: 0.25 }
    ),
  },

  // ------------------------------------------------------------- fx & other (+)
  {
    id: "atmosphere",
    name: "Atmosphere",
    family: "fx",
    description: "Evolving ambient wash — formant motion, weightless drift.",
    config: wavetable(
      "vocal",
      { attack: 2.0, decay: 2.0, sustain: 0.7, release: 4.0 },
      { frequency: 1600, q: 1.4, type: "bandpass" }
    ),
  },
  {
    id: "sci-fi-zap",
    name: "Zap",
    family: "fx",
    description: "Laser pitch-zap — fast, aggressive FM blast, retro arcade.",
    config: fm(7, 14, { attack: 0.001, decay: 0.2, sustain: 0.0, release: 0.15 }),
  },
  {
    id: "deep-drone",
    name: "Deep Drone",
    family: "fx",
    description: "Sub-heavy ritual drone — endless, dark, meditative bed.",
    config: synth(
      "triangle",
      { frequency: 700, q: 1.0 },
      { attack: 2.0, decay: 1.0, sustain: 1.0, release: 5.0 }
    ),
  },
  {
    id: "ice-bells",
    name: "Ice",
    family: "fx",
    description: "Frozen glass shards — high, brittle, glittering wavetable.",
    config: wavetable(
      "glass",
      { attack: 0.001, decay: 2.4, sustain: 0.0, release: 2.6 },
      { frequency: 8000, q: 1.2, type: "highpass" }
    ),
  },

  // ============================================================ Plus palette
  // Third wave (Beat-Lounge-Plus): 50 further voices, each distinct in engine,
  // oscillator mix, filter and envelope from its family-mates above — broadening
  // the corpus across every family without leaning on a single recipe.

  // ----------------------------------------------------------------- keys (+)
  {
    id: "soft-grand",
    name: "Soft Grand",
    family: "keys",
    description: "Mellow felt piano — soft hammers, intimate close-mic decay.",
    config: analog(null, {
      osc1Wave: "triangle",
      osc2Wave: "sine",
      osc2Detune: 2,
      oscMix: 0.28,
      subLevel: 0.12,
      cutoff: 3400,
      resonance: 0.8,
      filterEnvAmount: 0.3,
      keyTracking: 0.5,
      filterDecay: 0.7,
      filterSustain: 0.1,
      ampAttack: 0.004,
      ampDecay: 1.3,
      ampSustain: 0.0,
      ampRelease: 0.6,
      drive: 0.04,
      voiceMode: "poly",
    }),
  },
  {
    id: "cp80",
    name: "CP80",
    family: "keys",
    description: "Electric grand — punchy FM body with a struck metallic edge.",
    config: fm(1.5, 5.5, { attack: 0.002, decay: 1.0, sustain: 0.25, release: 0.8 }),
  },
  {
    id: "rock-organ",
    name: "Rock Organ",
    family: "keys",
    description: "Overdriven tonewheel — gritty drawbars, full sustain.",
    config: wavetable(
      "organ",
      { attack: 0.004, decay: 0.04, sustain: 1.0, release: 0.12 },
      { frequency: 3200, q: 1.4 }
    ),
  },
  {
    id: "toy-piano",
    name: "Toy Piano",
    family: "keys",
    description: "Tiny tin-plate piano — bright, brittle, nostalgic plink.",
    config: fm(3.5, 6, { attack: 0.001, decay: 0.55, sustain: 0.0, release: 0.45 }),
  },
  {
    id: "mellow-ep",
    name: "Mellow EP",
    family: "keys",
    description: "Round dark electric piano — soft bark, smoky sustain.",
    config: analog("pluck", {
      osc1Wave: "triangle",
      osc2Wave: "triangle",
      osc2Semi: 12,
      oscMix: 0.35,
      cutoff: 1700,
      resonance: 1.6,
      filterEnvAmount: 0.4,
      filterDecay: 0.7,
      filterSustain: 0.2,
      ampAttack: 0.004,
      ampDecay: 1.2,
      ampSustain: 0.18,
      ampRelease: 0.6,
      drive: 0.14,
      voiceMode: "poly",
    }),
  },
  {
    id: "gospel-organ",
    name: "Gospel Organ",
    family: "keys",
    description: "Warm church tonewheel — round drawbars, gentle on/off.",
    config: wavetable(
      "organ",
      { attack: 0.008, decay: 0.06, sustain: 0.98, release: 0.18 },
      { frequency: 4800, q: 0.7 }
    ),
  },
  {
    id: "accordion",
    name: "Accordion",
    family: "keys",
    description: "Reedy bellows — buzzing detuned reeds, breathy sustain.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "sawtooth",
      osc2Detune: 18,
      oscMix: 0.5,
      cutoff: 2400,
      resonance: 1.2,
      filterEnvAmount: 0.2,
      ampAttack: 0.05,
      ampDecay: 0.2,
      ampSustain: 0.85,
      ampRelease: 0.25,
      drive: 0.1,
      voiceMode: "poly",
    }),
  },

  // ----------------------------------------------------------------- bass (+)
  {
    id: "deep-house-bass",
    name: "House Bass",
    family: "bass",
    description: "Round filtered house bass — warm, bouncy, just-open cutoff.",
    config: analog("fat bass", {
      osc1Wave: "sawtooth",
      osc2Wave: "triangle",
      oscMix: 0.35,
      subLevel: 0.4,
      cutoff: 750,
      resonance: 3,
      filterEnvAmount: 0.45,
      filterDecay: 0.25,
      ampSustain: 0.75,
      ampRelease: 0.18,
      drive: 0.18,
      voiceMode: "mono",
      glide: 0.02,
    }),
  },
  {
    id: "growl-bass",
    name: "Growl Bass",
    family: "bass",
    description: "Snarling FM neuro-bass — harsh, modulated, aggressive.",
    config: fm(3, 9, { attack: 0.002, decay: 0.25, sustain: 0.55, release: 0.2 }),
  },
  {
    id: "rubber-bass",
    name: "Rubber Bass",
    family: "bass",
    description: "Bouncy elastic synth bass — snappy, round, mono glide.",
    config: analog(null, {
      osc1Wave: "square",
      osc2Wave: "triangle",
      osc2Semi: -12,
      oscMix: 0.3,
      subLevel: 0.45,
      cutoff: 820,
      resonance: 6,
      filterEnvAmount: 0.6,
      filterDecay: 0.16,
      ampDecay: 0.3,
      ampSustain: 0.6,
      ampRelease: 0.14,
      drive: 0.22,
      voiceMode: "mono",
      glide: 0.03,
    }),
  },
  {
    id: "saw-bass",
    name: "Saw Bass",
    family: "bass",
    description: "Buzzy bright saw bass — gritty edge, cutting low mids.",
    config: synth(
      "sawtooth",
      { frequency: 1100, q: 3 },
      { attack: 0.004, decay: 0.2, sustain: 0.6, release: 0.18 }
    ),
  },
  {
    id: "donk-bass",
    name: "Donk",
    family: "bass",
    description: "Plucky resonant donk — bouncy, hollow, off-beat ready.",
    config: analog("acid lead", {
      osc1Wave: "square",
      osc2Semi: -12,
      oscMix: 0.2,
      cutoff: 900,
      resonance: 12,
      filterEnvAmount: 0.85,
      filterDecay: 0.1,
      ampDecay: 0.14,
      ampSustain: 0.0,
      ampRelease: 0.1,
      drive: 0.25,
      voiceMode: "mono",
      glide: 0.01,
    }),
  },
  {
    id: "fingered-synth-bass",
    name: "Picked Bass",
    family: "bass",
    description: "Crisp picked synth bass — defined attack, tight body.",
    config: analog("fat bass", {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      osc2Detune: 6,
      oscMix: 0.4,
      cutoff: 1000,
      resonance: 3.5,
      filterEnvAmount: 0.65,
      filterDecay: 0.12,
      ampDecay: 0.4,
      ampSustain: 0.55,
      ampRelease: 0.12,
      drive: 0.15,
      voiceMode: "mono",
    }),
  },
  {
    id: "organ-bass",
    name: "Organ Bass",
    family: "bass",
    description: "Pedal-organ bass — pure sustained sine-square foundation.",
    config: wavetable(
      "organ",
      { attack: 0.006, decay: 0.05, sustain: 0.95, release: 0.1 },
      { frequency: 600, q: 0.8 }
    ),
  },

  // ----------------------------------------------------------------- leads (+)
  {
    id: "hoover-lead",
    name: "Hoover",
    family: "lead",
    description: "Rave hoover stab — detuned, swept, gloriously obnoxious.",
    config: analog("init", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "sawtooth",
      osc2Semi: -5,
      osc2Detune: 24,
      oscMix: 0.5,
      cutoff: 1800,
      resonance: 5,
      filterEnvAmount: 0.6,
      filterDecay: 0.4,
      ampAttack: 0.01,
      ampSustain: 0.8,
      ampRelease: 0.3,
      lfoRate: 5,
      lfoDepth: 0.2,
      lfoTarget: "pitch",
      drive: 0.3,
      voiceMode: "mono",
      glide: 0.04,
    }),
  },
  {
    id: "soft-lead",
    name: "Soft Lead",
    family: "lead",
    description: "Gentle rounded solo — triangle warmth, singing sustain.",
    config: synth(
      "triangle",
      { frequency: 2600, q: 1.2 },
      { attack: 0.02, decay: 0.2, sustain: 0.75, release: 0.3 }
    ),
  },
  {
    id: "bright-fm-lead",
    name: "Crystal Lead",
    family: "lead",
    description: "Glassy high FM lead — sparkling, bell-edged top line.",
    config: fm(4, 7, { attack: 0.003, decay: 0.3, sustain: 0.55, release: 0.35 }),
  },
  {
    id: "harmonica",
    name: "Harmonica",
    family: "lead",
    description: "Bluesy reed harp — buzzing, breathy, hand-vibrato.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      osc2Detune: 10,
      oscMix: 0.45,
      cutoff: 1900,
      resonance: 2.6,
      filterEnvAmount: 0.3,
      ampAttack: 0.03,
      ampSustain: 0.82,
      ampRelease: 0.25,
      lfoRate: 6,
      lfoDepth: 0.15,
      lfoTarget: "amp",
      drive: 0.2,
      voiceMode: "mono",
      glide: 0.02,
    }),
  },
  {
    id: "square-pwm-lead",
    name: "Vox Lead",
    family: "lead",
    description: "Vocal-ish pulse lead — narrow width, reedy, talking edge.",
    config: analog("init", {
      osc1Wave: "pulse",
      pulseWidth: 0.2,
      osc2Wave: "pulse",
      osc2Detune: 12,
      oscMix: 0.4,
      cutoff: 2600,
      resonance: 4,
      filterEnvAmount: 0.45,
      ampAttack: 0.005,
      ampSustain: 0.8,
      ampRelease: 0.2,
      voiceMode: "mono",
      glide: 0.03,
    }),
  },
  {
    id: "trance-lead",
    name: "Trance Lead",
    family: "lead",
    description: "Plucky gated supersaw — bright, euphoric, festival-ready.",
    config: analog("init", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "fatsawtooth",
      osc2Detune: 20,
      oscMix: 0.5,
      cutoff: 5200,
      resonance: 2.4,
      filterEnvAmount: 0.5,
      filterDecay: 0.3,
      ampAttack: 0.004,
      ampDecay: 0.4,
      ampSustain: 0.55,
      ampRelease: 0.3,
      drive: 0.16,
      voiceMode: "poly",
    }),
  },
  {
    id: "chip-arp",
    name: "Chip Arp",
    family: "lead",
    description: "8-bit triangle blip — tiny, fast, arcade arpeggio voice.",
    config: wavetable(
      "square",
      { attack: 0.001, decay: 0.05, sustain: 0.6, release: 0.04 },
      { frequency: 6000, q: 1.0, type: "highpass" }
    ),
  },

  // ------------------------------------------------------------------ pads (+)
  {
    id: "ambient-pad",
    name: "Ambient",
    family: "pad",
    description: "Drifting weightless bed — slow swell, endless calm. (sine-pad)",
    config: synth(
      "sine",
      { frequency: 1800, q: 0.6 },
      { attack: 1.6, decay: 1.8, sustain: 0.9, release: 4.0 }
    ),
  },
  {
    id: "poly-pad",
    name: "Poly Pad",
    family: "pad",
    description: "Classic warm poly bed — soft saws, rounded analog body.",
    config: analog("warm pad", {
      osc1Wave: "sawtooth",
      osc2Wave: "sawtooth",
      osc2Detune: 10,
      cutoff: 2000,
      resonance: 0.9,
      filterAttack: 0.5,
      ampAttack: 0.4,
      ampSustain: 0.85,
      ampRelease: 1.6,
      drive: 0.05,
    }),
  },
  {
    id: "shimmer-pad",
    name: "Shimmer",
    family: "pad",
    description: "Glittering octave-up wash — airy, crystalline, rising. (sine-pad)",
    config: synth(
      "triangle",
      { frequency: 6500, q: 0.7 },
      { attack: 1.2, decay: 1.4, sustain: 0.8, release: 3.6 }
    ),
  },
  {
    id: "brass-pad",
    name: "Brass Pad",
    family: "pad",
    description: "Soft swelling synth-brass bed — warm, noble, slow bloom.",
    config: analog("warm pad", {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      osc2Detune: 8,
      cutoff: 1500,
      resonance: 1.6,
      filterEnvAmount: 0.4,
      filterAttack: 0.5,
      ampAttack: 0.3,
      ampSustain: 0.85,
      ampRelease: 1.8,
      drive: 0.1,
    }),
  },
  {
    id: "vowel-pad",
    name: "Aah Pad",
    family: "pad",
    description: "Open choral 'aah' — bright formant ensemble, lush.",
    config: wavetable(
      "vocal",
      { attack: 0.8, decay: 1.2, sustain: 0.82, release: 2.8 },
      { frequency: 3200, q: 1.2, type: "bandpass" }
    ),
  },
  {
    id: "motion-pad",
    name: "Motion",
    family: "pad",
    description: "Restless evolving pad — deep LFO sweep, living texture.",
    config: analog("warm pad", {
      osc1Wave: "fatsawtooth",
      osc2Wave: "pulse",
      pulseWidth: 0.4,
      osc2Detune: 12,
      cutoff: 1100,
      resonance: 4,
      filterEnvAmount: 0.5,
      filterAttack: 1.2,
      ampAttack: 0.7,
      ampRelease: 2.6,
      lfoRate: 0.22,
      lfoDepth: 0.45,
      lfoTarget: "filter",
      drive: 0.08,
    }),
  },
  {
    id: "glass-choir-pad",
    name: "Glass Choir",
    family: "pad",
    description: "Frozen vocal sheen — brittle formant top, slow drift.",
    config: wavetable(
      "glass",
      { attack: 1.0, decay: 1.6, sustain: 0.6, release: 3.0 },
      { frequency: 4200, q: 1.0 }
    ),
  },

  // ------------------------------------------------------- plucks & mallets (+)
  {
    id: "nylon-pluck",
    name: "Nylon Pluck",
    family: "pluck",
    description: "Soft nylon-string pluck — warm, round, gentle fingertip.",
    config: analog("pluck", {
      osc1Wave: "triangle",
      osc2Wave: "sawtooth",
      oscMix: 0.3,
      cutoff: 3000,
      resonance: 1.4,
      filterEnvAmount: 0.4,
      filterDecay: 0.5,
      ampDecay: 0.9,
      ampSustain: 0.0,
      ampRelease: 0.6,
      drive: 0.06,
    }),
  },
  {
    id: "tubular-bell",
    name: "Tubular Bell",
    family: "pluck",
    description: "Struck tubular chime — deep inharmonic FM toll, long ring.",
    config: fm(2.7, 9, { attack: 0.002, decay: 2.0, sustain: 0.0, release: 2.2 }),
  },
  {
    id: "sitar",
    name: "Sitar",
    family: "pluck",
    description: "Buzzing drone-string pluck — nasal, jangly, sympathetic ring.",
    config: analog("pluck", {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      osc2Detune: 14,
      oscMix: 0.5,
      cutoff: 3400,
      resonance: 7,
      filterEnvAmount: 0.6,
      filterDecay: 0.5,
      ampDecay: 1.0,
      ampSustain: 0.0,
      ampRelease: 0.7,
      drive: 0.18,
    }),
  },
  {
    id: "mbira",
    name: "Mbira",
    family: "pluck",
    description: "Metal-tine lamellophone — buzzy ping, earthy short bloom.",
    config: fm(2.2, 3, { attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.35 }),
  },
  {
    id: "pizz-strings",
    name: "Pizzicato",
    family: "pluck",
    description: "Plucked string section — short staccato bow-snap, dry.",
    config: synth(
      "sawtooth",
      { frequency: 2800, q: 1.6 },
      { attack: 0.002, decay: 0.22, sustain: 0.0, release: 0.16 }
    ),
  },
  {
    id: "banjo",
    name: "Banjo",
    family: "pluck",
    description: "Twangy drum-skin pluck — bright, snappy, rolling attack.",
    config: analog("pluck", {
      osc1Wave: "square",
      osc2Wave: "sawtooth",
      osc2Semi: 12,
      oscMix: 0.4,
      cutoff: 4400,
      resonance: 3.5,
      filterEnvAmount: 0.7,
      filterDecay: 0.2,
      ampDecay: 0.4,
      ampSustain: 0.0,
      ampRelease: 0.3,
      drive: 0.14,
    }),
  },
  {
    id: "crystal-mallet",
    name: "Crystal Mallet",
    family: "pluck",
    description: "Glassy struck crystal — pure wavetable ping, airy decay.",
    config: wavetable(
      "glass",
      { attack: 0.001, decay: 0.8, sustain: 0.0, release: 0.9 },
      { frequency: 7400, q: 0.8 }
    ),
  },

  // ------------------------------------------------------------ brass & wind (+)
  {
    id: "muted-trumpet",
    name: "Muted Trumpet",
    family: "brass",
    description: "Harmon-muted trumpet — pinched, buzzy, intimate jazz tone.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      osc2Detune: 3,
      oscMix: 0.4,
      cutoff: 1300,
      resonance: 5,
      filterEnvAmount: 0.6,
      filterAttack: 0.04,
      filterSustain: 0.5,
      ampAttack: 0.04,
      ampSustain: 0.78,
      ampRelease: 0.2,
      drive: 0.24,
      voiceMode: "mono",
      glide: 0.02,
    }),
  },
  {
    id: "tuba",
    name: "Tuba",
    family: "brass",
    description: "Deep low brass — round, fat, lumbering bottom-octave horn.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "triangle",
      osc2Semi: -12,
      oscMix: 0.3,
      subLevel: 0.3,
      cutoff: 700,
      resonance: 1.6,
      filterEnvAmount: 0.5,
      filterAttack: 0.09,
      filterSustain: 0.45,
      ampAttack: 0.07,
      ampSustain: 0.8,
      ampRelease: 0.3,
      drive: 0.16,
      voiceMode: "mono",
      glide: 0.05,
    }),
  },
  {
    id: "clarinet",
    name: "Clarinet",
    family: "brass",
    description: "Hollow woody reed — pure odd-harmonic square, smooth.",
    config: synth(
      "square",
      { frequency: 1500, q: 1.0 },
      { attack: 0.05, decay: 0.15, sustain: 0.78, release: 0.28 }
    ),
  },
  {
    id: "pan-flute",
    name: "Pan Flute",
    family: "brass",
    description: "Breathy bamboo pipes — airy sine with a noisy chiff.",
    config: analog(null, {
      osc1Wave: "sine",
      osc2Wave: "sine",
      osc2Semi: 12,
      oscMix: 0.2,
      noiseLevel: 0.12,
      cutoff: 2800,
      resonance: 0.7,
      filterEnvAmount: 0.1,
      ampAttack: 0.06,
      ampDecay: 0.2,
      ampSustain: 0.8,
      ampRelease: 0.3,
      lfoRate: 4.5,
      lfoDepth: 0.07,
      lfoTarget: "pitch",
      drive: 0.02,
      voiceMode: "poly",
    }),
  },
  {
    id: "bassoon",
    name: "Bassoon",
    family: "brass",
    description: "Reedy low woodwind — buzzy, plaintive, double-reed body.",
    config: synth(
      "sawtooth",
      { frequency: 1200, q: 2.0, type: "bandpass" },
      { attack: 0.05, decay: 0.2, sustain: 0.72, release: 0.3 }
    ),
  },
  {
    id: "brass-stab",
    name: "Brass Stab",
    family: "brass",
    description: "Punchy short horn hit — bold, resonant, funk-section stab.",
    config: analog(null, {
      osc1Wave: "fatsawtooth",
      osc2Wave: "sawtooth",
      osc2Detune: 11,
      oscMix: 0.45,
      cutoff: 1600,
      resonance: 4,
      filterEnvAmount: 0.8,
      filterDecay: 0.18,
      filterSustain: 0.2,
      ampAttack: 0.01,
      ampDecay: 0.22,
      ampSustain: 0.0,
      ampRelease: 0.16,
      drive: 0.3,
      voiceMode: "poly",
    }),
  },
  {
    id: "horn-section",
    name: "Horn Section",
    family: "brass",
    description: "Layered ensemble brass — wide, warm, anthemic sustain.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "fatsawtooth",
      osc2Detune: 14,
      oscMix: 0.5,
      cutoff: 1250,
      resonance: 2.2,
      filterEnvAmount: 0.6,
      filterAttack: 0.07,
      filterSustain: 0.55,
      ampAttack: 0.05,
      ampSustain: 0.82,
      ampRelease: 0.3,
      drive: 0.2,
      voiceMode: "poly",
    }),
  },

  // ------------------------------------------------------------- fx & other (+)
  {
    id: "vinyl-crackle-pad",
    name: "Dust",
    family: "fx",
    description: "Lo-fi noise bed — filtered hiss wash for texture and glue.",
    config: analog(null, {
      osc1Wave: "triangle",
      oscMix: 0.0,
      subLevel: 0.0,
      noiseLevel: 0.7,
      cutoff: 1400,
      resonance: 2,
      filterEnvAmount: 0.1,
      ampAttack: 0.4,
      ampDecay: 0.6,
      ampSustain: 0.7,
      ampRelease: 1.2,
      drive: 0.05,
      voiceMode: "poly",
    }),
  },
  {
    id: "down-riser",
    name: "Downlifter",
    family: "fx",
    description: "Falling tension drop — pitch-sinking noise fall, transition.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      oscMix: 0.2,
      noiseLevel: 0.6,
      cutoff: 2400,
      resonance: 6,
      filterEnvAmount: 0.9,
      filterAttack: 0.02,
      filterDecay: 2.2,
      filterSustain: 0.0,
      ampAttack: 0.02,
      ampDecay: 2.0,
      ampSustain: 0.2,
      ampRelease: 0.6,
      lfoRate: 0.3,
      lfoDepth: 0.4,
      lfoTarget: "pitch",
      drive: 0.1,
      voiceMode: "poly",
    }),
  },
  {
    id: "impact-boom",
    name: "Impact",
    family: "fx",
    description: "Cinematic sub-boom hit — deep thud with a long dark tail.",
    config: fm(0.5, 2, { attack: 0.001, decay: 1.2, sustain: 0.0, release: 1.6 }),
  },
  {
    id: "alien-pad",
    name: "Alien",
    family: "fx",
    description: "Unsettling metallic drift — inharmonic FM bed, eerie motion.",
    config: fm(6.2, 10, { attack: 1.0, decay: 1.5, sustain: 0.4, release: 2.0 }),
  },
  {
    id: "siren",
    name: "Siren",
    family: "fx",
    description: "Rising-falling alarm — deep LFO pitch wail, attention-grab.",
    config: analog(null, {
      osc1Wave: "sawtooth",
      osc2Wave: "square",
      oscMix: 0.3,
      cutoff: 2200,
      resonance: 3,
      filterEnvAmount: 0.2,
      ampAttack: 0.05,
      ampSustain: 0.85,
      ampRelease: 0.4,
      lfoRate: 0.8,
      lfoDepth: 0.8,
      lfoTarget: "pitch",
      drive: 0.2,
      voiceMode: "mono",
    }),
  },
  {
    id: "data-blip",
    name: "Data",
    family: "fx",
    description: "Glitchy digital chatter — tiny resonant bandpass pings.",
    config: synth(
      "square",
      { frequency: 3000, q: 8, type: "bandpass" },
      { attack: 0.001, decay: 0.06, sustain: 0.0, release: 0.05 }
    ),
  },
  {
    id: "wind-howl",
    name: "Wind",
    family: "fx",
    description: "Howling filtered wind — moving noise, atmospheric unease.",
    config: analog(null, {
      osc1Wave: "triangle",
      oscMix: 0.0,
      noiseLevel: 0.85,
      cutoff: 900,
      resonance: 9,
      filterEnvAmount: 0.2,
      ampAttack: 1.0,
      ampDecay: 1.0,
      ampSustain: 0.8,
      ampRelease: 2.0,
      lfoRate: 0.4,
      lfoDepth: 0.6,
      lfoTarget: "filter",
      drive: 0.04,
      voiceMode: "poly",
    }),
  },
  {
    id: "music-box-fx",
    name: "Lullaby",
    family: "fx",
    description: "Faint distant music-box — fragile glass comb, dreamy haze.",
    config: wavetable(
      "glass",
      { attack: 0.003, decay: 1.4, sustain: 0.0, release: 1.6 },
      { frequency: 5400, q: 1.4, type: "bandpass" }
    ),
  },
]

export const INSTRUMENT_PRESETS: readonly InstrumentPreset[] = Object.freeze(PRESETS)

// Build the id→preset index with a duplicate guard so a copy-paste id collision in
// the hand-authored corpus FAILS FAST at load (Object.fromEntries would silently
// drop the earlier preset, making it vanish from id-based lookups but linger in
// the list — a confusing, hard-to-spot corpus bug).
const buildPresetIndex = (
  presets: readonly InstrumentPreset[]
): Readonly<Record<string, InstrumentPreset>> => {
  const byId: Record<string, InstrumentPreset> = {}
  for (const p of presets) {
    if (byId[p.id]) throw new Error(`Duplicate instrument preset id: ${p.id}`)
    byId[p.id] = p
  }
  return Object.freeze(byId)
}
const PRESET_BY_ID: Readonly<Record<string, InstrumentPreset>> = buildPresetIndex(
  INSTRUMENT_PRESETS
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
