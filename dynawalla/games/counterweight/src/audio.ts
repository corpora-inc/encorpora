// Asset-free Web Audio. No files, no decode, nothing on the answer path.
//
// The one voice that matters is the **bowed drone**: a sawtooth through a
// narrow band-pass, the note a heavy steel bar makes when it is under load.
// Its pitch tracks the tilt of the beam — flat and low at dead level, rising as
// your side goes down. So the beam is audible as well as visible, which is what
// lets a child find the tipping point with their eyes on the rack.
//
// It is deliberately quiet and deliberately narrow in range. A drone that swept
// an octave would be a siren; this one moves about a major third across the
// whole of the beam's travel, which is enough to hear and not enough to nag.
//
// The strikes are pitched **by place**: the ones plate is a small bright tick
// and the thousands plate is a low, heavy clang. Place value is a thing you can
// hear here, and a child working the rack learns the four voices before they
// could tell you why.

import type { Place } from "./game/places.ts"
import { createSafetyBus } from "../../../packs/shared/game-audio/index.ts"

type Ctor = new () => AudioContext

/** Where the drone sits at dead level, and how far the tilt moves it. */
const DRONE_HZ = 116
const DRONE_SPAN = 0.28

const PLACE_HZ: Record<Place, number> = { 1: 1180, 10: 830, 100: 520, 1000: 288 }

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private droneOsc: OscillatorNode | null = null
  private droneBand: BiquadFilterNode | null = null
  private droneGain: GainNode | null = null
  private failed = false

  private context(): AudioContext | null {
    if (this.ctx || this.failed) return this.ctx
    const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
    const Ctx = g.AudioContext ?? g.webkitAudioContext
    if (!Ctx) {
      this.failed = true
      return null
    }
    try {
      const ctx = new Ctx()
      const master = ctx.createGain()
      master.gain.value = 0.5
      // The last thing between this game and a child's ears. Everything the
      // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
      // going straight to the output. See packs/shared/game-audio/.
      const safety = createSafetyBus(ctx)
      master.connect(safety.input)
      this.ctx = ctx
      this.master = master
      return ctx
    } catch (error) {
      // Loud, never silent. A yard with no sound is playable; a yard that threw
      // on the first tap and swallowed it is a bug nobody finds.
      console.warn("[counterweight] no audio context", error)
      this.failed = true
      return null
    }
  }

  /** Web Audio needs a gesture. The first strike is the first gesture there is. */
  resume(): void {
    const ctx = this.context()
    if (!ctx) return
    if (ctx.state !== "suspended") return
    void ctx.resume().catch((error: unknown) => {
      // Loud, never silent. This runs at most once a session — after the first
      // gesture the context is running — so a warning here is a real signal that
      // the yard is about to be played in silence, not noise.
      console.warn("[counterweight] the audio context would not resume", error)
    })
  }

  /** Bring the drone up. Called when a round opens. */
  bow(): void {
    const ctx = this.context()
    if (!ctx || !this.master || this.droneOsc) return
    const osc = ctx.createOscillator()
    osc.type = "sawtooth"
    osc.frequency.value = DRONE_HZ
    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = DRONE_HZ * 3
    band.Q.value = 5.5
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.gain.linearRampToValueAtTime(0.075, ctx.currentTime + 0.5)
    osc.connect(band)
    band.connect(gain)
    gain.connect(this.master)
    osc.start()
    this.droneOsc = osc
    this.droneBand = band
    this.droneGain = gain
  }

  /**
   * The drone follows the beam.
   *
   * `tilt` is −1..1 and `ring` is 0..1: a beam still travelling opens the filter
   * so the note goes bright and unsettled, and a beam that has come to rest
   * closes it back down. That is the settle cue, and it arrives before the eye
   * gets there.
   */
  track(tilt: number, ring: number): void {
    const ctx = this.ctx
    if (!ctx || !this.droneOsc || !this.droneBand || !this.droneGain) return
    const t = ctx.currentTime
    const clamped = Math.max(-1, Math.min(1, tilt))
    const hz = DRONE_HZ * (1 + clamped * DRONE_SPAN)
    this.droneOsc.frequency.setTargetAtTime(hz, t, 0.06)
    this.droneBand.frequency.setTargetAtTime(hz * (2.4 + ring * 4.5), t, 0.05)
    this.droneGain.gain.setTargetAtTime(0.06 + ring * 0.045, t, 0.08)
  }

  /** Stop bowing. */
  release(): void {
    const ctx = this.ctx
    const osc = this.droneOsc
    const gain = this.droneGain
    if (!ctx || !osc || !gain) return
    this.droneOsc = null
    this.droneBand = null
    this.droneGain = null
    const t = ctx.currentTime
    gain.gain.cancelScheduledValues(t)
    gain.gain.setTargetAtTime(0, t, 0.09)
    try {
      osc.stop(t + 0.5)
    } catch {
      console.warn("[counterweight] the drone would not stop")
    }
  }

  /** A plate lands. Pitched by place; harder blows bite harder. */
  clang(place: Place, impulse: number): void {
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const hz = PLACE_HZ[place]
    const bite = Math.max(0, Math.min(1, (impulse - 2) / 9))

    const osc = ctx.createOscillator()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(hz * (1.3 + bite * 0.4), t)
    osc.frequency.exponentialRampToValueAtTime(hz, t + 0.05)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.16 + bite * 0.12, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22 + bite * 0.2)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.5)

    // The metallic edge: a short burst through a high band-pass. A resonant blow
    // gets more of it, so mashing sounds like what it is.
    const noise = ctx.createOscillator()
    noise.type = "square"
    noise.frequency.setValueAtTime(hz * 3.7, t)
    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = hz * 3.4
    band.Q.value = 2.2
    const edge = ctx.createGain()
    edge.gain.setValueAtTime(0.0001, t)
    edge.gain.exponentialRampToValueAtTime(0.02 + bite * 0.07, t + 0.004)
    edge.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    noise.connect(band)
    band.connect(edge)
    edge.connect(this.master)
    noise.start(t)
    noise.stop(t + 0.15)
  }

  /** A refused strike: the plate is still swinging. A dead, unmusical thud. */
  refuse(): void {
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(88, t)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  /**
   * Brass sliding on the pan: the weigh-master laying out a fresh set, or a lot
   * going back on the barrow. A tiny descending tick, and never a buzzer.
   *
   * Was `sag()`, for a pan that drained under a child who stopped to think. That
   * behaviour is gone; the sound was worth keeping.
   */
  slide(): void {
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(420, t)
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.2)
  }

  /** A good weight: a cold, clean fifth. The best sound in the game. */
  held(): void {
    this.chord([784, 1176], 0.1, 0.5)
  }

  /** The docket is refused. Low, short, not cruel. */
  lost(): void {
    this.chord([196, 233], 0.085, 0.32)
  }

  /** The steel lets go. */
  shear(): void {
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = "sawtooth"
    osc.frequency.setValueAtTime(760, t)
    osc.frequency.exponentialRampToValueAtTime(74, t + 0.42)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.19, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.7)
  }

  /** A scale is cleared. */
  fanfare(): void {
    this.chord([523, 659, 784], 0.09, 0.85)
    const ctx = this.ctx
    if (!ctx) return
    globalThis.setTimeout(() => this.chord([659, 784, 1046], 0.085, 0.9), 190)
  }

  private chord(hz: readonly number[], peak: number, seconds: number): void {
    const ctx = this.context()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    for (const f of hz) {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = f
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak / hz.length + 0.001, t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(t)
      osc.stop(t + seconds + 0.1)
    }
  }

  dispose(): void {
    this.release()
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    if (!ctx) return
    void ctx.close().catch(() => {
      console.warn("[counterweight] the audio context would not close")
    })
  }
}
