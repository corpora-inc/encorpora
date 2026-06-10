/**
 * beatlounge — synth drum kit instrument (ported from melopan's drumSynths and
 * expanded to a full GM-ish bank so every pad in the drum-pad module has a
 * DISTINCT voice). Triggers are routed by MIDI pitch (see model DRUM_PITCH +
 * the drum-pads PAD_BANK). No samples needed; the Wave-2 sample team swaps in
 * real one-shots behind this same output.
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

  // ----- TOMS / CONGA ----- one membrane, retuned per trigger
  const tom = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 3,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
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

  // ----- HATS (closed/pedal/open) ----- filtered noise bursts
  const hatBpf = new Tone.Filter({ type: "bandpass", frequency: 8500, Q: 1.2 }).connect(out)
  const hatHpf = new Tone.Filter({ type: "highpass", frequency: 4000 }).connect(hatBpf)
  const closedHat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
    volume: 6,
  }).connect(hatHpf)
  const openHat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.12 },
    volume: 4,
  }).connect(hatHpf)
  const pedalHat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    volume: 4,
  }).connect(hatHpf)

  // ----- CYMBALS (crash/ride) ----- bright metallic via MetalSynth
  const crash = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 1.2, release: 0.4 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
    volume: -12,
  }).connect(out)
  const ride = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.5, release: 0.2 },
    harmonicity: 8,
    modulationIndex: 20,
    resonance: 6000,
    octaves: 1,
    volume: -16,
  }).connect(out)

  // ----- CLAP ----- pink noise burst
  const clapBpf = new Tone.Filter({ type: "bandpass", frequency: 1500, Q: 0.8 }).connect(out)
  const clap = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.002, decay: 0.14, sustain: 0 },
    volume: 2,
  }).connect(clapBpf)

  // ----- COWBELL ----- short metallic ring
  const cowbell = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.12, release: 0.05 },
    harmonicity: 3.4,
    modulationIndex: 12,
    resonance: 1800,
    octaves: 0.8,
    volume: -16,
  }).connect(out)

  // ----- SHAKER / TAMBOURINE ----- soft high filtered noise
  const shakerBpf = new Tone.Filter({ type: "bandpass", frequency: 6500, Q: 1.4 }).connect(out)
  const shaker = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.002, decay: 0.05, sustain: 0, release: 0.02 },
    volume: 0,
  }).connect(shakerBpf)
  const tamb = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.03 },
    volume: 2,
  }).connect(shakerBpf)

  // ----- RIM / CLAVES ----- short bright clicks (one synth, retuned)
  const click = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    volume: -4,
  }).connect(out)

  const clamp = (v: number) => Math.max(0.3, Math.min(1, v))
  const note = (m: number) => Tone.Frequency(m, "midi").toNote()

  // GM-ish pitch → voice. Covers DRUM_PITCH + the drum-pads PAD_BANK.
  const triggerForPitch = (pitch: number, when: number, v: number) => {
    switch (pitch) {
      case DRUM_PITCH.kick: // 36
        kick.triggerAttackRelease("C1", "8n", when, v); break
      case DRUM_PITCH.snare: // 38
        snareNoise.triggerAttackRelease("16n", when, v)
        snareBody.triggerAttackRelease("E2", "16n", when, v * 0.7); break
      case 37: // rim
        click.triggerAttackRelease("C6", 0.03, when, clamp(v)); break
      case DRUM_PITCH.clap: // 39
        clap.triggerAttackRelease("16n", when, v); break
      case DRUM_PITCH.hat: // 42 closed hat
        closedHat.triggerAttackRelease("32n", when, clamp(v)); break
      case 44: // pedal hat
        pedalHat.triggerAttackRelease("32n", when, clamp(v)); break
      case 46: // open hat
        openHat.triggerAttackRelease("8n", when, clamp(v)); break
      case 43: // low tom
        tom.triggerAttackRelease("A1", "8n", when, v); break
      case 45: // hi tom
        tom.triggerAttackRelease("D2", "8n", when, v); break
      case 64: // conga
        tom.triggerAttackRelease("G2", "16n", when, v); break
      case 49: // crash
        crash.triggerAttackRelease("16n", when, clamp(v)); break
      case 51: // ride
        ride.triggerAttackRelease("16n", when, clamp(v)); break
      case 56: // cowbell
        cowbell.triggerAttackRelease("16n", when, clamp(v)); break
      case 54: // tambourine
        tamb.triggerAttackRelease("32n", when, clamp(v)); break
      case 70: // shaker
        shaker.triggerAttackRelease("32n", when, clamp(v)); break
      case 75: // claves
        click.triggerAttackRelease("A5", 0.04, when, clamp(v)); break
      default:
        // Unknown pad → a pitched tom so it's at least distinct, not silent.
        tom.triggerAttackRelease(note(Math.max(36, Math.min(72, pitch))), "16n", when, v)
    }
  }

  return {
    output: out,
    trigger(n: TriggerNote, when: number) {
      try {
        triggerForPitch(n.pitch, when, n.velocity)
      } catch {
        /* drum synths can throw on rapid retrigger; ignore */
      }
    },
    update() {},
    setParam() {},
    async load() {},
    dispose() {
      for (const node of [
        kick, tom, snareNoise, snareBody, closedHat, openHat, pedalHat,
        hatHpf, hatBpf, crash, ride, clap, clapBpf, cowbell, shaker, tamb,
        shakerBpf, click, out,
      ]) {
        node.dispose()
      }
    },
  }
}
