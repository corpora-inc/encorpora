/**
 * beatlounge — synth drum kit instrument (ported from melopan's drumSynths).
 *
 * Implements the Instrument contract for a "drumSampler" config whose
 * `fallback` is "synthKit" — i.e. no sample assets needed, the kit is fully
 * synthesized. Triggers are routed by MIDI pitch (GM-ish: see model DRUM_PITCH).
 * The Wave-2 instrument team swaps in real sample pads behind this same output.
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"
import { DRUM_PITCH } from "../model/document"

export const createDrumKitInstrument = (_config: InstrumentConfig): Instrument => {
  const out = new Tone.Gain(1)

  // ----- KICK ----- low membrane with fast pitch decay
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.4 },
  }).connect(out)

  // ----- SNARE ----- noise + body
  const snareNoise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  }).connect(out)
  const snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 4,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    volume: -6,
  }).connect(out)

  // ----- HAT ----- filtered noise burst (cuts through small speakers)
  const hatBpf = new Tone.Filter({ type: "bandpass", frequency: 8500, Q: 1.2 }).connect(out)
  const hatHpf = new Tone.Filter({ type: "highpass", frequency: 4000 }).connect(hatBpf)
  const hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
    volume: 6,
  }).connect(hatHpf)

  // ----- CLAP ----- short brighter noise
  const clapBpf = new Tone.Filter({ type: "bandpass", frequency: 1500, Q: 0.8 }).connect(out)
  const clap = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.002, decay: 0.14, sustain: 0 },
    volume: 2,
  }).connect(clapBpf)

  const triggerForPitch = (pitch: number, when: number, v: number) => {
    switch (pitch) {
      case DRUM_PITCH.kick:
        kick.triggerAttackRelease("C1", "8n", when, v)
        break
      case DRUM_PITCH.snare:
        snareNoise.triggerAttackRelease("16n", when, v)
        snareBody.triggerAttackRelease("E2", "16n", when, v * 0.7)
        break
      case DRUM_PITCH.hat:
        hat.triggerAttackRelease("32n", when, Math.max(0.4, Math.min(1, v)))
        break
      case DRUM_PITCH.clap:
        clap.triggerAttackRelease("16n", when, v)
        break
      default:
        // Unknown pad → treat as a hat tick so nothing is silent.
        hat.triggerAttackRelease("32n", when, Math.max(0.4, Math.min(1, v)))
    }
  }

  return {
    output: out,
    trigger(note: TriggerNote, when: number) {
      try {
        triggerForPitch(note.pitch, when, note.velocity)
      } catch {
        /* drum synths can throw on rapid retrigger; ignore */
      }
    },
    update() {
      /* synth kit has no per-config state yet (Wave 2: sample pads) */
    },
    setParam() {
      /* no automatable params yet */
    },
    async load() {
      /* synth kit: no assets */
    },
    dispose() {
      kick.dispose()
      snareNoise.dispose()
      snareBody.dispose()
      hat.dispose()
      hatHpf.dispose()
      hatBpf.dispose()
      clap.dispose()
      clapBpf.dispose()
      out.dispose()
    },
  }
}
