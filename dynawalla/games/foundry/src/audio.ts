// Procedural Web Audio. No assets, no samples, nothing fetched.
//
// Every cue is built as **transient → body → tail**, because that is what makes
// a synthesised hit read as a physical event rather than a beep: a 3–12ms noise
// click that carries the impact, a pitched body that carries identity, and a
// decay that carries size.
//
// The one thing that is *not* a sound is the most important sound in the game.
// The canon asked for "silence on failure", and this module takes that
// literally: `pinfall()` ducks the crowd bed to nothing in 90ms and plays one
// dry, unpitched thud. There is no sad trombone and no descending arpeggio,
// because being wrong must never be the more interesting thing to listen to —
// the same rule `energy(SLIP) < energy(SEAT)` states on the visual side.
//
// Nothing here is the sole channel for any information; every cue has a visual
// twin, and the whole system is disableable.

import { createSafetyBus } from "../../../packs/shared/game-audio/index.ts"

/** Nothing is ever scheduled above this; the partials of a bell add up fast. */
function safeHz(f: number): number {
  return Math.max(20, Math.min(15000, f))
}

/** A minor pentatonic, so any two notes the escape picks are consonant. */
const PENTATONIC = [0, 3, 5, 7, 10] as const

function semis(i: number): number {
  const k = Math.min(Math.max(0, i), PENTATONIC.length * 3 - 1)
  const oct = Math.floor(k / PENTATONIC.length)
  return (PENTATONIC[k % PENTATONIC.length] as number) + oct * 12
}

export class Audio {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private bedGain: GainNode | null = null
  private bedNodes: AudioNode[] = []
  private noise: AudioBuffer | null = null
  private voices = 0
  private readonly maxVoices = 22
  private started = false
  enabled = true

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async start(): Promise<void> {
    if (this.started) {
      if (this.ctx?.state === "suspended") await this.ctx.resume().catch(() => {})
      return
    }
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    const Ctor = globalThis.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext
    if (!Ctor) {
      console.warn("[foundry] no AudioContext; running silent")
      return
    }
    try {
      const ctx = new Ctor()
      this.ctx = ctx
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -17
      comp.knee.value = 26
      comp.ratio.value = 6
      comp.attack.value = 0.003
      comp.release.value = 0.16
      const bus = ctx.createGain()
      bus.gain.value = 0.9
      bus.connect(comp)
      // The last thing between this game and a child's ears. Everything the
      // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
      // going straight to the output. See packs/shared/game-audio/.
      const safety = createSafetyBus(ctx)
      comp.connect(safety.input)
      this.bus = bus

      // One second of white noise, generated once and reused by every transient.
      const len = Math.floor(ctx.sampleRate)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      let s = 0x9e3779b9
      for (let i = 0; i < len; i++) {
        s ^= s << 13
        s ^= s >>> 17
        s ^= s << 5
        d[i] = ((s >>> 0) / 4294967296) * 2 - 1
      }
      this.noise = buf

      this.buildBed()
      this.started = true
    } catch (error) {
      console.warn("[foundry] audio could not start", error)
    }
  }

  /** The hall: a low filtered-noise crowd that never stops and never resolves. */
  private buildBed(): void {
    const ctx = this.ctx
    const bus = this.bus
    const noise = this.noise
    if (!ctx || !bus || !noise) return
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = 420
    band.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(band)
    band.connect(gain)
    gain.connect(bus)
    src.start()
    this.bedGain = gain
    this.bedNodes = [src, band, gain]
  }

  /** Crowd volume follows heat. Ramped, never stepped. */
  setHeat(heat: number, seconds = 0.4): void {
    const ctx = this.ctx
    const g = this.bedGain
    if (!ctx || !g || !this.enabled) return
    const target = 0.012 + Math.max(0, Math.min(1, heat)) * 0.075
    g.gain.cancelScheduledValues(ctx.currentTime)
    g.gain.setTargetAtTime(target, ctx.currentTime, Math.max(0.05, seconds / 3))
  }

  private voice(): boolean {
    if (!this.enabled || !this.ctx || !this.bus) return false
    if (this.voices >= this.maxVoices) return false
    this.voices++
    return true
  }

  private release(seconds: number): void {
    globalThis.setTimeout(
      () => {
        this.voices = Math.max(0, this.voices - 1)
      },
      Math.max(40, seconds * 1000),
    )
  }

  private click(gain: number, hz: number, decay: number, q = 1.4): void {
    const ctx = this.ctx
    const bus = this.bus
    const noise = this.noise
    if (!ctx || !bus || !noise) return
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filt = ctx.createBiquadFilter()
    filt.type = "bandpass"
    filt.frequency.value = safeHz(hz)
    filt.Q.value = q
    const amp = ctx.createGain()
    const t = ctx.currentTime
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(gain, t + 0.003)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    src.connect(filt)
    filt.connect(amp)
    amp.connect(bus)
    src.start(t)
    src.stop(t + decay + 0.02)
  }

  private tone(hz: number, gain: number, decay: number, type: OscillatorType = "triangle"): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus) return
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = safeHz(hz)
    const amp = ctx.createGain()
    const t = ctx.currentTime
    amp.gain.setValueAtTime(0, t)
    amp.gain.linearRampToValueAtTime(gain, t + 0.008)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    osc.connect(amp)
    amp.connect(bus)
    osc.start(t)
    osc.stop(t + decay + 0.02)
  }

  /**
   * A plate going down.
   *
   * The pitch rides the load: the closer the bar is to the target, the higher
   * the clank. It is a second channel for "how close am I" that costs nothing
   * to read, and it has a visual twin in the bar's tilt — a child who cannot
   * hear it loses no information.
   */
  plate(heavy: boolean, fraction: number): void {
    if (!this.voice()) return
    const f = Math.max(0, Math.min(1, fraction))
    const base = heavy ? 168 : 268
    const hz = base * Math.pow(2, semis(Math.round(f * 7)) / 12)
    this.click(heavy ? 0.5 : 0.36, hz * 3.1, heavy ? 0.075 : 0.05, 2.2)
    this.tone(hz, heavy ? 0.3 : 0.22, heavy ? 0.4 : 0.26, "triangle")
    this.tone(hz * 2.02, 0.07, 0.2, "sine")
    this.release(0.45)
  }

  /** Palm on canvas. Flat, unpitched, and louder each time. */
  slap(index: number): void {
    if (!this.voice()) return
    const i = Math.max(1, Math.min(3, index))
    this.click(0.34 + i * 0.14, 190 + i * 40, 0.12 + i * 0.02, 0.7)
    this.tone(58 - i * 4, 0.2 + i * 0.05, 0.16, "sine")
    this.release(0.25)
  }

  /** The escape. The biggest thing in the game, sized by the reaction tier. */
  kickout(tier: number): void {
    const ctx = this.ctx
    if (!ctx || !this.voice()) return
    const t = Math.max(0, Math.min(3, tier))
    this.click(0.62, 900, 0.3, 0.5)
    this.click(0.42, 2400, 0.16, 0.9)
    // A brass chord that opens upward. The higher the tier, the more of it.
    const root = 146.8
    const chord = [0, 7, 12, 16, 19].slice(0, 3 + t)
    chord.forEach((s, i) => {
      const osc = ctx.createOscillator()
      osc.type = i === 0 ? "sawtooth" : "triangle"
      osc.frequency.value = safeHz(root * Math.pow(2, s / 12))
      const amp = ctx.createGain()
      const at = ctx.currentTime + i * 0.018
      const peak = (0.2 - i * 0.025) * (0.65 + t * 0.14)
      amp.gain.setValueAtTime(0, at)
      amp.gain.linearRampToValueAtTime(Math.max(0.02, peak), at + 0.02)
      amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.7 + t * 0.2)
      osc.connect(amp)
      if (this.bus) amp.connect(this.bus)
      osc.start(at)
      osc.stop(at + 0.95 + t * 0.2)
    })
    // The hall comes up and comes back down.
    const g = this.bedGain
    if (g) {
      const now = ctx.currentTime
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0.11 + t * 0.03, now + 0.09)
      g.gain.setTargetAtTime(0.04, now + 0.35, 0.5)
    }
    this.release(1.2)
  }

  /**
   * A false finish: the hall surges and is cut off flat. Everybody thought that
   * was it. The wave-off is a dry wood knock, not a buzzer.
   */
  falseFinish(): void {
    const ctx = this.ctx
    if (!ctx || !this.voice()) return
    const g = this.bedGain
    if (g) {
      const now = ctx.currentTime
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0.1, now + 0.13)
      g.gain.setValueAtTime(0.1, now + 0.2)
      g.gain.linearRampToValueAtTime(0.02, now + 0.23)
    }
    this.click(0.3, 1500, 0.05, 3)
    this.tone(392, 0.12, 0.09, "square")
    this.release(0.4)
  }

  /** The pinfall. The bed is cut and one dry thud lands in the hole it leaves. */
  pinfall(): void {
    const ctx = this.ctx
    if (!ctx) return
    const g = this.bedGain
    if (g) {
      const now = ctx.currentTime
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0.0, now + 0.09)
    }
    if (!this.voice()) return
    this.click(0.4, 120, 0.2, 0.5)
    this.release(0.3)
  }

  /** A challenger put away. One bell, and the hall stays up for a while. */
  title(): void {
    if (!this.voice()) return
    this.click(0.3, 3200, 0.1, 2)
    this.tone(523.25, 0.2, 1.5, "sine")
    this.tone(783.99, 0.11, 1.3, "sine")
    this.tone(1046.5, 0.07, 1.0, "sine")
    this.release(1.6)
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (!on) this.setHeat(0, 0.15)
  }

  dispose(): void {
    for (const n of this.bedNodes) {
      try {
        ;(n as AudioScheduledSourceNode).stop?.()
      } catch {
        // A node that was never started throws on stop. Nothing to do about it
        // and nothing worth telling anyone.
      }
      n.disconnect()
    }
    this.bedNodes = []
    this.bedGain = null
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.bus = null
    this.started = false
  }
}
