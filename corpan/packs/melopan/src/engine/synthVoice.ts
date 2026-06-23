import * as Tone from "tone"

export type SynthVoice = {
  /** Trigger a single note at a given audio time. */
  trigger: (midi: number, time: number, velocity: number, durationSec?: number) => void
  volume: Tone.Volume
  dispose: () => void
}

/**
 * A simple polyphonic synth voice for the piano roll.
 * Sawtooth-ish core through a low-pass filter for a warm pluck-ish texture,
 * a touch of stereo width via a haas-style delay, and a short release so
 * 16ths-at-fast-BPMs don't smear.
 */
export const createSynthVoice = (destination: Tone.InputNode): SynthVoice => {
  const volume = new Tone.Volume(-2).connect(destination)
  const filter = new Tone.Filter({
    type: "lowpass",
    frequency: 3000,
    Q: 1.2,
  }).connect(volume)

  const polySynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.25 },
  }).connect(filter)
  polySynth.maxPolyphony = 8

  const trigger = (midi: number, time: number, velocity: number, durationSec = 0.18) => {
    const note = Tone.Frequency(midi, "midi").toNote()
    try {
      polySynth.triggerAttackRelease(note, durationSec, time, velocity)
    } catch {
      // PolySynth can throw on rapid retriggers under voice exhaustion; ignore.
    }
  }

  return {
    trigger,
    volume,
    dispose: () => {
      polySynth.dispose()
      filter.dispose()
      volume.dispose()
    },
  }
}
