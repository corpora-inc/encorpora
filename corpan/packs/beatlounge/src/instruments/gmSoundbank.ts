/**
 * beatlounge — programmatic GM SoundFont generator ("beatlounge-gm").
 *
 * WHY THIS EXISTS: the `soundfont` instrument needs REAL SF2/SF3 bytes to make
 * sound (see SOUNDFONTS.md). Rather than ship a third-party multi-megabyte bank
 * (license + git-size headaches), we SYNTHESIZE a compact, fully-original GM bank
 * here. Every sample is generated from math in this file, so the resulting `.sf2`
 * is unambiguously redistributable — we dedicate it to the public domain (CC0).
 * See `public/soundfonts/LICENSE.txt`.
 *
 * It is a GENERAL-MIDI bank: it defines a preset for every melodic program
 * (0..127) addressed by GM number, so picking "Acoustic Grand Piano" (program 0)
 * vs "String Ensemble 1" (program 48) selects an audibly different voice. The
 * timbre is chosen per GM FAMILY (16 distinct, looping waveforms) — a tasteful
 * synth approximation, not a sampled orchestra. For studio-grade realism a user
 * can drop in any GM SF2/SF3 (e.g. GeneralUser GS) under the same `soundfontId`;
 * the engine code is identical.
 *
 * Built with spessasynth_core's authoring API (Apache-2.0), which can WRITE SF2.
 * The bytes round-trip through the exact same synth the runtime uses, so what we
 * render here is what the pack plays.
 */

import {
  BasicSoundBank,
  BasicSample,
  BasicInstrument,
  BasicPreset,
  SampleTypes,
  GeneratorTypes,
} from "spessasynth_core"

const G = GeneratorTypes

/** ID the pack addresses this bank by (matches the committed file basename). */
export const GM_SOUNDFONT_ID = "beatlounge-gm"

/** Sample rate of the generated single-cycle waves. 22.05 kHz keeps it small
 *  while covering the band the bank actually plays. */
const SAMPLE_RATE = 22050

/** Root key the single-cycle wavetables are tuned to (A4 = 440 Hz). */
const ROOT_KEY = 69
const ROOT_FREQ = 440

/** A single timbre = a periodic waveform sampled over `cycles` whole periods so
 *  the loop is seamless, plus a volume-envelope feel (attack/release timecents)
 *  and a low-pass cutoff so families read distinctly bright/dark. */
interface Timbre {
  /** Waveform as a function of phase in [0,1). Output roughly in [-1,1]. */
  wave: (phase: number) => number
  /** Volume-envelope attack in seconds (→ SF2 timecents). */
  attack: number
  /** Volume-envelope release in seconds. */
  release: number
  /** Initial low-pass filter cutoff in Hz (brightness). */
  cutoffHz: number
  /** Whole periods captured into the looped sample (more = richer loop). */
  cycles: number
  /** Peak attenuation trim in centibels (0 = loudest). */
  attenuation?: number
}

/** Sum a set of [harmonic, amplitude] partials into one periodic value. */
const partials = (defs: ReadonlyArray<readonly [number, number]>) => (phase: number) => {
  let v = 0
  for (const [h, a] of defs) v += a * Math.sin(2 * Math.PI * h * phase)
  return v
}

/** Naive band-limited-ish saw/square/triangle via summed partials. */
const sawish = (n: number) =>
  partials(Array.from({ length: n }, (_, k) => [k + 1, 1 / (k + 1)] as const))
const squareish = (n: number) =>
  partials(
    Array.from({ length: n }, (_, k) => {
      const h = 2 * k + 1
      return [h, 1 / h] as const
    })
  )

/** 16 family timbres, indexed by GM family order (piano..sound-fx). */
const FAMILY_TIMBRES: readonly Timbre[] = [
  // Piano — bright struck partials, quick decay feel.
  { wave: partials([[1, 1], [2, 0.5], [3, 0.28], [4, 0.12], [6, 0.06]]), attack: 0.002, release: 0.5, cutoffHz: 5200, cycles: 4 },
  // Chromatic (bells/mallets) — inharmonic-ish, very bright, short.
  { wave: partials([[1, 1], [3, 0.6], [5, 0.4], [9, 0.2]]), attack: 0.001, release: 0.7, cutoffHz: 8000, cycles: 6 },
  // Organ — odd + even drawbars, sustained, no decay.
  { wave: partials([[1, 1], [2, 0.7], [3, 0.5], [4, 0.4], [8, 0.25]]), attack: 0.01, release: 0.12, cutoffHz: 6000, cycles: 4 },
  // Guitar — plucked saw-ish, medium decay.
  { wave: partials([[1, 1], [2, 0.6], [3, 0.4], [4, 0.25], [5, 0.15]]), attack: 0.003, release: 0.35, cutoffHz: 4200, cycles: 4 },
  // Bass — fat low partials, mellow.
  { wave: partials([[1, 1], [2, 0.45], [3, 0.18]]), attack: 0.006, release: 0.3, cutoffHz: 2200, cycles: 4, attenuation: -10 },
  // Strings (solo) — rich saw, slow bow.
  { wave: sawish(12), attack: 0.08, release: 0.4, cutoffHz: 4800, cycles: 6 },
  // Ensemble (sections/choir) — softened saw, slow, lush.
  { wave: sawish(8), attack: 0.12, release: 0.5, cutoffHz: 4000, cycles: 6 },
  // Brass — bright saw with bite.
  { wave: sawish(14), attack: 0.03, release: 0.25, cutoffHz: 5600, cycles: 6 },
  // Reed — hollow-ish, woody.
  { wave: partials([[1, 1], [2, 0.3], [3, 0.5], [5, 0.25], [7, 0.12]]), attack: 0.02, release: 0.2, cutoffHz: 4400, cycles: 5 },
  // Pipe (flutes) — near sine + breath of 2nd/3rd, soft.
  { wave: partials([[1, 1], [2, 0.12], [3, 0.06]]), attack: 0.03, release: 0.18, cutoffHz: 3600, cycles: 4 },
  // Synth Lead — square lead, bright, immediate.
  { wave: squareish(12), attack: 0.002, release: 0.18, cutoffHz: 6800, cycles: 4 },
  // Synth Pad — soft saw, very slow, warm.
  { wave: sawish(6), attack: 0.25, release: 0.8, cutoffHz: 3000, cycles: 6 },
  // Synth FX — detuned/inharmonic shimmer.
  { wave: partials([[1, 1], [2.01, 0.5], [3.99, 0.35], [7, 0.2]]), attack: 0.15, release: 0.9, cutoffHz: 7000, cycles: 8 },
  // Ethnic (plucked/strung) — twangy saw.
  { wave: partials([[1, 1], [2, 0.55], [3, 0.5], [5, 0.3], [7, 0.2]]), attack: 0.002, release: 0.45, cutoffHz: 5000, cycles: 6 },
  // Percussive (tuned perc) — bright, very short.
  { wave: partials([[1, 1], [2, 0.8], [4, 0.5], [7, 0.3]]), attack: 0.001, release: 0.5, cutoffHz: 7500, cycles: 6 },
  // Sound FX — noisy-ish broad spectrum.
  { wave: partials([[1, 0.8], [3, 0.6], [5, 0.5], [9, 0.4], [13, 0.3]]), attack: 0.01, release: 0.4, cutoffHz: 6000, cycles: 8 },
]

/** Family index (0..15) for a GM program. */
const familyIndex = (program: number): number =>
  Math.min(15, Math.floor((((program % 128) + 128) % 128) / 8))

/** Seconds → SF2 absolute timecents (1200 * log2(sec)). Clamped to valid range. */
const secToTimecents = (sec: number): number => {
  const tc = Math.round(1200 * Math.log2(Math.max(0.001, sec)))
  return Math.max(-12000, Math.min(8000, tc))
}

/** Hz → SF2 absolute cents for initialFilterFc (1200*log2(f/8.176)). */
const hzToCents = (hz: number): number =>
  Math.max(1500, Math.min(13500, Math.round(1200 * Math.log2(hz / 8.176))))

/**
 * Render one timbre to a seamless looped Float32 sample: `cycles` whole periods
 * of the periodic waveform at ROOT_FREQ, normalized, with the whole buffer as
 * the loop region so a held note sustains indefinitely.
 */
const renderTimbreSample = (timbre: Timbre, name: string): BasicSample => {
  const period = SAMPLE_RATE / ROOT_FREQ
  const length = Math.max(2, Math.round(period * timbre.cycles))
  const data = new Float32Array(length)
  let peak = 1e-6
  for (let i = 0; i < length; i++) {
    // phase spans `cycles` full turns across the buffer → integer periods → loop
    const phase = ((i / length) * timbre.cycles) % 1
    const v = timbre.wave(phase)
    data[i] = v
    const a = Math.abs(v)
    if (a > peak) peak = a
  }
  // Normalize to ~0.85 to leave headroom; the SF2 attenuation trims further.
  const norm = 0.85 / peak
  for (let i = 0; i < length; i++) data[i] *= norm

  // Loop the whole captured region (seamless because it is integer periods).
  const sample = new BasicSample(
    name,
    SAMPLE_RATE,
    ROOT_KEY,
    0,
    SampleTypes.monoSample,
    0,
    length - 1
  )
  sample.setAudioData(data, SAMPLE_RATE)
  return sample
}

/**
 * Build the complete "beatlounge-gm" SoundFont in memory and return its SF2
 * bytes. One BasicInstrument per family (16 looping samples); a GM preset for
 * every program 0..127 points at its family's instrument, with per-family
 * envelope + filter generators so families read distinctly.
 */
export const buildGmSoundBank = (): BasicSoundBank => {
  const bank = new BasicSoundBank("sf2")
  bank.soundBankInfo = {
    ...bank.soundBankInfo,
    name: "beatlounge GM",
    engineer: "beatlounge (procedural)",
    product: "beatlounge",
    copyright: "CC0 1.0 (public domain dedication)",
    // Pinned so the serialized SF2 bytes are DETERMINISTIC (a fresh Date would
    // dirty the committed asset on every build/test run).
    creationDate: new Date("2026-01-01T00:00:00.000Z"),
    comment:
      "Compact procedural General-MIDI bank generated for the beatlounge pack. Public domain (CC0).",
  }

  // One instrument (looped sample + per-family generators) per family.
  const familyInstruments = FAMILY_TIMBRES.map((timbre, fi) => {
    const sample = renderTimbreSample(timbre, `bl-fam-${fi}`)
    bank.addSamples(sample)

    const inst = new BasicInstrument()
    inst.name = `bl-inst-${fi}`
    const zone = inst.createZone(sample)
    zone.setGenerator(G.overridingRootKey, ROOT_KEY)
    // sampleModes 1 = loop continuously (sustained notes hold).
    zone.setGenerator(G.sampleModes, 1)
    zone.setGenerator(G.initialFilterFc, hzToCents(timbre.cutoffHz))
    zone.setGenerator(G.attackVolEnv, secToTimecents(timbre.attack))
    zone.setGenerator(G.releaseVolEnv, secToTimecents(timbre.release))
    // A gentle decay→sustain so sustained voices don't sit at full blast.
    zone.setGenerator(G.decayVolEnv, secToTimecents(0.6))
    zone.setGenerator(G.sustainVolEnv, 120) // 1.2 dB of attenuation at sustain
    if (timbre.attenuation) zone.setGenerator(G.initialAttenuation, -timbre.attenuation)
    bank.addInstruments(inst)
    return inst
  })

  // A preset for every GM melodic program, addressed by its GM number.
  for (let program = 0; program < 128; program++) {
    const inst = familyInstruments[familyIndex(program)]
    const preset = new BasicPreset(bank)
    preset.name = GM_DISPLAY_NAMES[program] ?? `Program ${program}`
    preset.program = program
    preset.bankMSB = 0
    preset.bankLSB = 0
    preset.createZone(inst)
    bank.addPresets(preset)
  }

  return bank
}

/** Serialize the built bank to SF2 bytes (an ArrayBuffer). */
export const buildGmSoundFontBytes = (): ArrayBuffer => buildGmSoundBank().writeSF2()

// Preset display names mirror gmPrograms.ts (kept here to avoid a UI-layer dep
// in this engine-side module; the lists are validated equal by the tests).
import { GM_PROGRAM_NAMES } from "./gmPrograms"
const GM_DISPLAY_NAMES = GM_PROGRAM_NAMES
