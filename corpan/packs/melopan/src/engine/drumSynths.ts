import * as Tone from "tone"

export type DrumKit = {
  kick: { trigger: (time: number, velocity: number) => void; volume: Tone.Volume }
  snare: { trigger: (time: number, velocity: number) => void; volume: Tone.Volume }
  hat: { trigger: (time: number, velocity: number) => void; volume: Tone.Volume }
  dispose: () => void
}

/**
 * Per-instrument output destinations so each drum can route to its own
 * aux-send channel (for the master delay routing). Kept as a small obj
 * literal at the call site rather than a single shared destination.
 */
export type DrumDestinations = {
  kick: Tone.InputNode
  snare: Tone.InputNode
  hat: Tone.InputNode
}

/**
 * A small synth drum kit, no samples needed.
 * - Kick: MembraneSynth tuned low with a fast pitch decay
 * - Snare: NoiseSynth + a body MembraneSynth blended
 * - Hat:  MetalSynth tuned bright with a short envelope
 */
export const createDrumKit = (dest: DrumDestinations): DrumKit => {
  // ----- KICK -----
  const kickVol = new Tone.Volume(0).connect(dest.kick)
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
  const snareVol = new Tone.Volume(0).connect(dest.snare)
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
  // v0.2.0's MetalSynth hat was still inaudible on Jeff's phone — high-Q
  // metal partials are easy to lose on a small speaker. Replaced with a
  // straightforward filtered-noise burst: white noise + bandpass around
  // 8 kHz with a touch of resonance, riding a snappy AR envelope. This is
  // the same pattern hover-runner uses for hits and reliably cuts through.
  const hatVol = new Tone.Volume(-2).connect(dest.hat)
  const hatBpf = new Tone.Filter({
    type: "bandpass",
    frequency: 8500,
    Q: 1.2,
  }).connect(hatVol)
  const hatHpf = new Tone.Filter({
    type: "highpass",
    frequency: 4000,
  }).connect(hatBpf)
  const hatSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
    volume: 6,
  }).connect(hatHpf)

  const triggerHat = (time: number, velocity: number) => {
    hatSynth.triggerAttackRelease(
      "32n",
      time,
      Math.max(0.4, Math.min(1, velocity))
    )
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
      hatBpf.dispose()
      hatHpf.dispose()
      kickVol.dispose()
      snareVol.dispose()
      hatVol.dispose()
    },
  }
}
