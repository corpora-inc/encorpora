import * as Tone from "tone"

export type DrumKit = {
  kick: { trigger: (time: number, velocity: number) => void; volume: Tone.Volume }
  snare: { trigger: (time: number, velocity: number) => void; volume: Tone.Volume }
  hat: { trigger: (time: number, velocity: number) => void; volume: Tone.Volume }
  dispose: () => void
}

/**
 * A small synth drum kit, no samples needed.
 * - Kick: MembraneSynth tuned low with a fast pitch decay
 * - Snare: NoiseSynth + a body MembraneSynth blended
 * - Hat:  MetalSynth tuned bright with a short envelope
 */
export const createDrumKit = (destination: Tone.InputNode): DrumKit => {
  // ----- KICK -----
  const kickVol = new Tone.Volume(0).connect(destination)
  const kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.4 },
  }).connect(kickVol)

  const triggerKick = (time: number, velocity: number) => {
    kickSynth.triggerAttackRelease("C1", "8n", time, velocity)
  }

  // ----- SNARE -----
  const snareVol = new Tone.Volume(0).connect(destination)
  const snareNoise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  }).connect(snareVol)
  const snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 4,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    volume: -6,
  }).connect(snareVol)

  const triggerSnare = (time: number, velocity: number) => {
    snareNoise.triggerAttackRelease("16n", time, velocity)
    snareBody.triggerAttackRelease("E2", "16n", time, velocity * 0.7)
  }

  // ----- HAT -----
  const hatVol = new Tone.Volume(-6).connect(destination)
  const hatSynth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.06, release: 0.02 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).connect(hatVol)

  const triggerHat = (time: number, velocity: number) => {
    hatSynth.triggerAttackRelease("16n", time, velocity * 0.4)
  }

  return {
    kick:  { trigger: triggerKick,  volume: kickVol },
    snare: { trigger: triggerSnare, volume: snareVol },
    hat:   { trigger: triggerHat,   volume: hatVol },
    dispose: () => {
      kickSynth.dispose()
      snareNoise.dispose()
      snareBody.dispose()
      hatSynth.dispose()
      kickVol.dispose()
      snareVol.dispose()
      hatVol.dispose()
    },
  }
}
