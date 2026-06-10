/**
 * beatlounge — the DEFAULT ("studio") kit.
 *
 * This is a faithful, parameter-for-parameter transcription of the ORIGINAL
 * hardcoded synth kit (the pre-corpus instruments/drumKit.ts). It is the
 * baseline every other kit merges over, and the kit the parametric synth builds
 * when a track has no `kitId`. It MUST stay byte-for-ear identical to the
 * original so nothing regresses.
 *
 * The mapping from the original constants:
 *   kick     → MembraneSynth pitchDecay .04 oct6 sine, C1, env(.001,.32,0,.4)
 *   tom      → MembraneSynth pitchDecay .03 oct3 sine, env(.001,.4,0,.3)
 *              (the original retunes ONE tom for lo/hi/conga — here loTom/hiTom/
 *               conga share the same recipe, retuned per role's baseNote)
 *   snare    → white NoiseSynth env(.001,.18,0) + triangle membrane body E2 -6dB
 *   hats     → white NoiseSynth → HPF 4000 → BPF 8500 Q1.2
 *   crash    → white NoiseSynth env(.001,1.4,0,.6) +2dB → HPF 5000
 *   ride     → white NoiseSynth env(.001,.5,0,.25) 0dB → BPF 7000 Q0.7
 *   clap     → pink NoiseSynth env(.002,.14,0) +2dB → BPF 1500 Q0.8
 *   cowbell  → squares 540+800 (-6dB each) → BPF 2640 Q1.2 → amp env(.001,.2,0,.06)
 *   shaker   → white NoiseSynth env(.002,.05,0,.02) → BPF 6500 Q1.4
 *   tamb     → white NoiseSynth env(.001,.09,0,.03) +2dB → (shared BPF 6500 Q1.4)
 *   rim/click→ triangle Synth env(.001,.05,0,.02) -4dB (retuned C6 rim / A5 claves)
 */

import type { KitDef, VoiceParams } from "./types"
import { DRUM_PITCH } from "../model/document"

// MIDI helpers so the recipes read like the original `triggerForPitch` notes.
const C1 = 24
const E2 = 40
const A1 = 33
const D2 = 38
const G2 = 43
const C6 = 84
const A5 = 81

/** The hat noise voice shape, parameterised by decay/release/level so the three
 *  hats (closed/open/pedal) share one recipe with different envelopes. */
const hat = (decay: number, release: number, level: number): VoiceParams => ({
  source: "noise",
  noise: "white",
  env: { attack: 0.001, decay, sustain: 0, release },
  // The original hats run HPF 4000 → BPF 8500 Q1.2 in series.
  filter2: { type: "highpass", frequency: 4000 },
  filter: { type: "bandpass", frequency: 8500, q: 1.2 },
  level,
})

/** A membrane tom voice, retuned per role (the original used ONE tom). */
const tom = (baseNote: number, durationSec: number): VoiceParams => ({
  source: "membrane",
  baseNote,
  pitchDecay: 0.03,
  octaves: 3,
  osc: "sine",
  env: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
  durationSec,
})

/** A bright click voice (the original triangle Synth), retuned per role. */
const click = (baseNote: number, durationSec: number, level = -4): VoiceParams => ({
  source: "tonal",
  baseNote,
  osc: "triangle",
  env: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
  level,
  durationSec,
})

export const DEFAULT_VOICES: Record<keyof KitDef["voices"], VoiceParams> = {
  // ----- KICK -----
  kick: {
    source: "membrane",
    baseNote: C1,
    pitchDecay: 0.04,
    octaves: 6,
    osc: "sine",
    env: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.4 },
    durationSec: 0.25, // original triggered "8n"
  },

  // ----- SNARE ----- noise top + triangle membrane body
  snare: {
    source: "noise",
    noise: "white",
    env: { attack: 0.001, decay: 0.18, sustain: 0 },
    body: {
      baseNote: E2,
      pitchDecay: 0.02,
      octaves: 4,
      type: "triangle",
      env: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      level: -6,
    },
  },

  // ----- RIM ----- bright triangle click at C6 (original 0.03s)
  rim: click(C6, 0.03),

  // ----- CLAP ----- pink noise burst through BPF
  clap: {
    source: "noise",
    noise: "pink",
    env: { attack: 0.002, decay: 0.14, sustain: 0 },
    filter: { type: "bandpass", frequency: 1500, q: 0.8 },
    level: 2,
  },

  // ----- HATS -----
  closedHat: hat(0.06, 0.02, 6),
  openHat: hat(0.32, 0.12, 4),
  pedalHat: hat(0.03, 0.01, 4),

  // ----- TOMS / CONGA ----- (the original retuned one membrane)
  loTom: tom(A1, 0.25),
  hiTom: tom(D2, 0.25),
  conga: tom(G2, 0.125),

  // ----- CYMBALS -----
  crash: {
    source: "noise",
    noise: "white",
    env: { attack: 0.001, decay: 1.4, sustain: 0, release: 0.6 },
    filter: { type: "highpass", frequency: 5000 },
    level: 2,
    durationSec: 0.5, // original "4n"
  },
  ride: {
    source: "noise",
    noise: "white",
    env: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.25 },
    filter: { type: "bandpass", frequency: 7000, q: 0.7 },
    level: 0,
    durationSec: 0.25, // original "8n"
  },

  // ----- COWBELL ----- dual square through BPF, gated by an amp env
  cowbell: {
    source: "tonal",
    baseNote: 0, // unused: cowbell is authored as absolute-frequency partials
    osc: "square",
    partials: [
      { frequency: 540, type: "square", level: -6 },
      { frequency: 800, type: "square", level: -6 },
    ],
    filter: { type: "bandpass", frequency: 2640, q: 1.2 },
    env: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.06 },
    durationSec: 0.18,
  },

  // ----- SHAKER / TAMBOURINE ----- shared high BPF
  shaker: {
    source: "noise",
    noise: "white",
    env: { attack: 0.002, decay: 0.05, sustain: 0, release: 0.02 },
    filter: { type: "bandpass", frequency: 6500, q: 1.4 },
    level: 0,
  },
  tamb: {
    source: "noise",
    noise: "white",
    env: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.03 },
    filter: { type: "bandpass", frequency: 6500, q: 1.4 },
    level: 2,
  },

  // ----- CLAVES ----- bright triangle click at A5 (original 0.04s)
  click: click(A5, 0.04),
}

/** The default ("studio") kit — the byte-for-ear baseline. */
export const DEFAULT_KIT: KitDef = {
  id: "studio",
  name: "Studio",
  family: "acoustic",
  description:
    "The house kit — a clean, balanced synth bank with punchy kick, crisp " +
    "snare, and bright hats. The faithful baseline every other kit is built on.",
  voices: DEFAULT_VOICES,
}

/** Convenience: the canonical default kit id. */
export const DEFAULT_KIT_ID = DEFAULT_KIT.id

// keep DRUM_PITCH referenced so the role↔pitch convention is visibly anchored
// here (the synth routes pitches to these roles; see kits/voiceForPitch.ts).
void DRUM_PITCH
