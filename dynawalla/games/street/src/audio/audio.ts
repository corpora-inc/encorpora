// Asset-free Web Audio. No files, no decode, nothing on the answer path.
//
// The pack synthesises its own sound with an `AudioContext`; it does **not**
// declare the `audio` capability, which is the host's own feedback sounds and a
// different thing entirely.
//
// The drone is the point. A mob hums at `humHz(size)` and glides to the new
// pitch the instant a seam lands, so the child hears twelve become three before
// the crack has finished crossing the street. Everything else in here is short,
// dry and mechanical: struck steel, a shutter roll, bodies hitting cobbles. No
// chimes, no sparkle, and nothing at all that is louder when the child is
// wrong.

import { BOUNCE_HZ, REWARD_HZ, RINGOFF_HZ, fellHz, humHz } from "./tone.ts"

type Ctx = AudioContext

/** The mix ceiling. Everything below is a fraction of this. */
const MASTER = 0.5

export class StreetAudio {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private drone: OscillatorNode | null = null
  private droneGain: GainNode | null = null
  private noise: AudioBuffer | null = null
  private dead = false

  private ensure(): Ctx | null {
    if (this.dead) return null
    if (this.ctx) return this.ctx
    try {
      const Ctor =
        (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
        (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      const ctx = new Ctor()
      const master = ctx.createGain()
      master.gain.value = MASTER
      master.connect(ctx.destination)
      this.ctx = ctx
      this.master = master
      return ctx
    } catch (error) {
      // Loud, never silent. A frame with no audio is playable; a frame that
      // threw on the first tap is not, and the next person needs to see why.
      console.warn("[street] no audio context", error)
      this.dead = true
      return null
    }
  }

  /** Web Audio needs a gesture. The first tap in the game is the first gesture. */
  resume(): void {
    const ctx = this.ensure()
    if (!ctx) return
    if (ctx.state === "suspended") void ctx.resume().catch(() => {})
  }

  private noiseBuffer(ctx: Ctx): AudioBuffer {
    if (this.noise) return this.noise
    const frames = Math.floor(ctx.sampleRate * 0.4)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    // A deterministic fill: the same grit every session, and no `Math.random`
    // anywhere in the shipped runtime.
    let s = 0x9e3779b9
    for (let i = 0; i < frames; i++) {
      s = (Math.imul(s ^ (s >>> 15), s | 1) + 0x6d2b79f5) >>> 0
      data[i] = (s >>> 0) / 2147483648 - 1
    }
    this.noise = buffer
    return buffer
  }

  private tone(
    freq: number,
    opts: {
      type?: OscillatorType
      gain?: number
      attack?: number
      decay?: number
      to?: number
      delay?: number
    } = {},
  ): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const now = ctx.currentTime + (opts.delay ?? 0)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = opts.type ?? "triangle"
    osc.frequency.setValueAtTime(Math.max(20, freq), now)
    if (opts.to !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), now + (opts.decay ?? 0.2))
    }
    const peak = opts.gain ?? 0.2
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + (opts.attack ?? 0.004))
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (opts.decay ?? 0.2))
    osc.connect(gain).connect(this.master)
    osc.start(now)
    osc.stop(now + (opts.decay ?? 0.2) + 0.05)
  }

  private grit(opts: { gain?: number; decay?: number; hz?: number; q?: number } = {}): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = opts.hz ?? 1400
    filter.Q.value = opts.q ?? 0.8
    const gain = ctx.createGain()
    const decay = opts.decay ?? 0.16
    gain.gain.setValueAtTime(opts.gain ?? 0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay)
    src.connect(filter).connect(gain).connect(this.master)
    src.start(now)
    src.stop(now + decay + 0.02)
  }

  // ------------------------------------------------------------- the mob --

  /** Start or re-pitch the drone. `0` puts it away. */
  hum(size: number): void {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    if (size <= 0) {
      this.droneGain?.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08)
      return
    }
    if (!this.drone || !this.droneGain) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sawtooth"
      const filter = ctx.createBiquadFilter()
      filter.type = "lowpass"
      filter.frequency.value = 620
      gain.gain.value = 0.0001
      osc.frequency.value = humHz(size)
      osc.connect(filter).connect(gain).connect(this.master)
      osc.start()
      this.drone = osc
      this.droneGain = gain
    }
    // A glide, not a jump: the mob re-forms over the crack, and the pitch
    // arriving with the new rectangle is the whole trick.
    this.drone.frequency.setTargetAtTime(humHz(size), ctx.currentTime, 0.06)
    this.droneGain.gain.setTargetAtTime(0.055, ctx.currentTime, 0.09)
  }

  /** A seam landed. Steel parting, then the drone lifts. */
  crack(size: number): void {
    this.grit({ gain: 0.26, decay: 0.14, hz: 2600, q: 0.7 })
    this.tone(humHz(size) * 4, { type: "square", gain: 0.16, decay: 0.12, to: humHz(size) * 6 })
  }

  /** A seam refused. One hard ring, and nothing else. */
  ringoff(): void {
    this.tone(RINGOFF_HZ, { type: "square", gain: 0.1, decay: 0.11, to: RINGOFF_HZ * 0.94 })
    this.grit({ gain: 0.08, decay: 0.07, hz: 3200, q: 2 })
  }

  /** Fists off locked arms. Dull, low, over immediately. */
  bounce(): void {
    this.tone(BOUNCE_HZ, { type: "sine", gain: 0.15, decay: 0.1, to: BOUNCE_HZ * 0.7 })
  }

  /** A rank going down. */
  down(size: number): void {
    this.tone(fellHz(size), { type: "triangle", gain: 0.2, decay: 0.18 })
    this.tone(70, { type: "sine", gain: 0.22, decay: 0.2, to: 44 })
    this.grit({ gain: 0.1, decay: 0.1, hz: 700, q: 0.6 })
  }

  /** The street is empty. A short rising figure; the longest reward is a block. */
  cleared(solid: boolean): void {
    const notes = solid ? [0, 2, 4] : [0, 2]
    notes.forEach((i, n) => {
      this.tone(REWARD_HZ[i] as number, { gain: 0.15, decay: 0.34, delay: n * 0.075 })
    })
  }

  /** A block finished. The only tier-3 sound in the game. */
  block(): void {
    REWARD_HZ.forEach((hz, n) => {
      this.tone(hz, { gain: 0.14, decay: 0.5, delay: n * 0.06 })
    })
    this.tone(REWARD_HZ[0] as number, { gain: 0.12, decay: 0.9, delay: 0.34, type: "sine" })
  }

  // --------------------------------------------------------- the shutter --

  shutter(up: boolean): void {
    this.grit({ gain: 0.14, decay: 0.4, hz: up ? 900 : 500, q: 0.5 })
    this.tone(up ? 180 : 130, { type: "sawtooth", gain: 0.08, decay: 0.34, to: up ? 300 : 90 })
  }

  rivet(right: boolean): void {
    if (right) {
      this.tone(880, { type: "square", gain: 0.13, decay: 0.14, to: 1320 })
      return
    }
    this.tone(240, { type: "square", gain: 0.09, decay: 0.12, to: 180 })
  }

  /** The mob leans in. A pressure sound, not an alarm. */
  lean(marks: number): void {
    this.tone(58 + marks * 5, { type: "sine", gain: 0.12, decay: 0.26, to: 42 })
  }

  /** Shoved back a block. */
  shove(): void {
    this.grit({ gain: 0.2, decay: 0.44, hz: 340, q: 0.4 })
    this.tone(120, { type: "sawtooth", gain: 0.14, decay: 0.5, to: 60 })
  }

  dispose(): void {
    this.dead = true
    try {
      this.drone?.stop()
    } catch {
      console.warn("[street] the drone would not stop")
    }
    this.drone = null
    this.droneGain = null
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    void ctx?.close().catch(() => {})
  }
}
