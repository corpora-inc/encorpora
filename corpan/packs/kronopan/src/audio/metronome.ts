// Synthesized metronome voices. No samples, so the pack has no audio-asset
// dependency for its own click track.
//
// Three roles must stay distinguishable through a workshop PA, so they differ in
// both pitch and loudness: the cycle downbeat is highest and loudest, the group
// head sits in the middle, the plain pulse is soft, and the subdivision tick is
// softest of all. Each click is a short enveloped oscillator: a fast attack and
// an exponential decay give a crisp tick with no click-pop.

import type { ClickRole } from "./clock"

type VoiceSpec = {
  freq: number
  gain: number
  duration: number
  type: OscillatorType
}

const VOICES: Record<ClickRole, VoiceSpec> = {
  downbeat: { freq: 1760, gain: 1.0, duration: 0.055, type: "triangle" },
  "group-head": { freq: 1174.66, gain: 0.62, duration: 0.048, type: "triangle" },
  pulse: { freq: 880, gain: 0.34, duration: 0.038, type: "sine" },
  subdivision: { freq: 880, gain: 0.14, duration: 0.03, type: "sine" },
}

export class Metronome {
  private ctx: AudioContext
  private out: AudioNode

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx
    this.out = out
  }

  // Schedule one click at absolute audio time `time`. Times come from the pure
  // planner, so they are always in the near future relative to the context
  // clock.
  trigger(role: ClickRole, time: number): void {
    const v = VOICES[role]
    const osc = this.ctx.createOscillator()
    const env = this.ctx.createGain()
    osc.type = v.type
    osc.frequency.setValueAtTime(v.freq, time)

    // Attack fast, then exponential decay toward a floor (exponential ramps
    // cannot reach exactly 0), then hard-stop.
    const peak = v.gain
    const floor = 0.0008
    env.gain.setValueAtTime(floor, time)
    env.gain.exponentialRampToValueAtTime(peak, time + 0.004)
    env.gain.exponentialRampToValueAtTime(floor, time + v.duration)

    osc.connect(env)
    env.connect(this.out)
    osc.start(time)
    osc.stop(time + v.duration + 0.02)
    // Let the nodes free themselves once they have played.
    osc.onended = () => {
      osc.disconnect()
      env.disconnect()
    }
  }
}
