// Procedural WebAudio. No assets, no samples, nothing fetched.
//
// Every cue is built as **transient → body → tail**, because that is what makes
// a synthesised hit read as a physical event rather than a beep: a 3–12 ms
// click that carries the impact, a pitched body that carries identity, and a
// decay that carries size.
//
// The one thing here that is not decoration is `partition`. When the shear
// closes, the two pieces are played as two note-runs — the piece that comes off
// rising, the piece that stays falling — one note per link, pitched by place.
// A child hears `72 = 25 + 47` as two phrases whose lengths and registers say
// what the numbers are. It is the same information the wall carves, in the one
// channel a child can take in while looking somewhere else. Nothing in the game
// depends on hearing it.

const PENTATONIC = [0, 3, 5, 7, 10] as const

/** Nothing is ever scheduled above this; the partials of a bell add up fast. */
function safeHz(f: number): number {
  return Math.max(20, Math.min(14000, f))
}

function semitone(i: number): number {
  const k = Math.max(0, Math.min(PENTATONIC.length * 4 - 1, i))
  return (PENTATONIC[k % PENTATONIC.length] as number) + Math.floor(k / PENTATONIC.length) * 12
}

export class Audio {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private voices = 0
  private readonly maxVoices = 28
  /** Live voice-accounting timers, so `dispose` can cancel them. */
  private readonly pending = new Set<ReturnType<typeof setTimeout>>()
  private disposed = false
  enabled = true

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async start(): Promise<void> {
    // A pointerdown can land in the same turn as the host's `dispose`, and a
    // context built after teardown would never be closed by anything.
    if (this.disposed) return
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {})
      return
    }
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    const Ctor = globalThis.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext
    if (!Ctor) {
      console.warn("[coil] no AudioContext; running silent")
      return
    }
    try {
      const ctx = new Ctor()
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -16
      comp.knee.value = 24
      comp.ratio.value = 6
      comp.attack.value = 0.003
      comp.release.value = 0.15
      const bus = ctx.createGain()
      bus.gain.value = 0.8
      bus.connect(comp)
      comp.connect(ctx.destination)

      const len = Math.floor(ctx.sampleRate * 0.5)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      let s = 0x9e3779b9
      for (let i = 0; i < len; i++) {
        s ^= s << 13
        s ^= s >>> 17
        s ^= s << 5
        d[i] = ((s >>> 0) / 2147483648 - 1) * 0.6
      }

      this.ctx = ctx
      this.bus = bus
      this.noise = buf
      await ctx.resume().catch(() => {})
    } catch (error) {
      console.warn("[coil] audio unavailable", error)
    }
  }

  dispose(): void {
    this.disposed = true
    const ctx = this.ctx
    this.ctx = null
    this.bus = null
    this.noise = null
    // The voice-accounting timers outlive the context by up to three quarters
    // of a second. They touch nothing that is nulled above, so they cannot
    // throw — but an uncancelled timer keeps this instance, and the closure
    // around it, alive after the pack's frame is gone.
    for (const handle of this.pending) clearTimeout(handle)
    this.pending.clear()
    this.voices = 0
    void ctx?.close().catch(() => {})
  }

  private ready(): { ctx: AudioContext; bus: GainNode } | null {
    if (!this.enabled || !this.ctx || !this.bus) return null
    if (this.voices >= this.maxVoices) return null
    return { ctx: this.ctx, bus: this.bus }
  }

  private spend(seconds: number): void {
    this.voices++
    const handle = globalThis.setTimeout(
      () => {
        this.pending.delete(handle)
        this.voices = Math.max(0, this.voices - 1)
      },
      Math.ceil(seconds * 1000) + 40,
    )
    this.pending.add(handle)
  }

  /** A short filtered noise burst: the transient of anything metal. */
  private strike(at: number, gain: number, hz: number, decay: number): void {
    const r = this.ready()
    if (!r || !this.noise) return
    const src = r.ctx.createBufferSource()
    src.buffer = this.noise
    const bp = r.ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = safeHz(hz)
    bp.Q.value = 1.4
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
    src.connect(bp)
    bp.connect(g)
    g.connect(r.bus)
    src.start(at)
    src.stop(at + decay + 0.02)
    this.spend(decay)
  }

  /** A struck body: sine fundamental plus a quiet triangle octave. */
  private tone(
    at: number,
    hz: number,
    gain: number,
    decay: number,
    type: OscillatorType = "sine",
  ): void {
    const r = this.ready()
    if (!r) return
    const osc = r.ctx.createOscillator()
    osc.type = type
    osc.frequency.value = safeHz(hz)
    const g = r.ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(gain, at + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay)
    osc.connect(g)
    g.connect(r.bus)
    osc.start(at)
    osc.stop(at + decay + 0.02)
    this.spend(decay)
  }

  private get when(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  /** The shear moving one joint. Tiny, dry, and never fatiguing. */
  aim(place: number): void {
    const t = this.when
    this.strike(t, 0.055, 2400 + place * 320, 0.026)
  }

  /** The borrow: a link cracking into ten. A snap, then ten scattering pips. */
  crack(place: number): void {
    const t = this.when
    this.strike(t, 0.4, 1500 - place * 90, 0.07)
    this.tone(t, 260 - place * 18, 0.16, 0.16, "triangle")
    for (let i = 0; i < 6; i++) {
      this.strike(t + 0.03 + i * 0.022, 0.09, 3200 + i * 140, 0.03)
    }
  }

  /** The jaws closing. Scrape, then the bite. */
  shear(): void {
    const t = this.when
    this.strike(t, 0.16, 5200, 0.05)
    this.strike(t + 0.05, 0.5, 900, 0.1)
    this.tone(t + 0.05, 148, 0.2, 0.2, "triangle")
  }

  /**
   * The partition, heard.
   *
   * `off` is the piece that came away and `stay` is what remained, each as a
   * list of place exponents. The first run rises, the second falls, and the
   * place sets the register, so a run of ones is a fast bright flurry and a run
   * of hundreds is four low strokes.
   */
  partition(off: readonly number[], stay: readonly number[], at = 0): void {
    const base = this.when + at
    const cap = 14
    const stepA = off.length > 8 ? 0.045 : 0.07
    for (let i = 0; i < Math.min(cap, off.length); i++) {
      const p = off[i] as number
      const hz = 262 * 2 ** ((semitone(i) + (2 - Math.min(3, p)) * 5) / 12)
      this.tone(base + i * stepA, hz, 0.15, 0.24)
      this.tone(base + i * stepA, hz * 2, 0.035, 0.14, "triangle")
    }
    const gap = base + Math.min(cap, off.length) * stepA + 0.12
    const stepB = stay.length > 8 ? 0.04 : 0.06
    const n = Math.min(cap, stay.length)
    for (let i = 0; i < n; i++) {
      const p = stay[stay.length - 1 - i] as number
      const hz = 262 * 2 ** ((semitone(n - 1 - i) + (2 - Math.min(3, p)) * 5 - 12) / 12)
      this.tone(gap + i * stepB, hz, 0.11, 0.22)
    }
  }

  /** An exact piece seating into the wall. One detent, one bell. */
  seat(): void {
    const t = this.when
    this.strike(t, 0.22, 3000, 0.04)
    this.tone(t + 0.01, 523.25, 0.2, 0.5)
    this.tone(t + 0.01, 784, 0.09, 0.44, "triangle")
    this.tone(t + 0.09, 1046.5, 0.07, 0.5)
  }

  /**
   * A piece that did not fit, hitting the floor.
   *
   * Deliberately not a buzzer and deliberately quieter and shorter than
   * `seat` — being wrong must not be the more interesting sound. It is a dull
   * lump of metal landing on stone, which is exactly what happened.
   */
  slag(): void {
    const t = this.when
    this.strike(t, 0.2, 260, 0.09)
    this.tone(t, 74, 0.12, 0.18, "triangle")
  }

  /** The furnace taking the lane back. Air, then a swell. */
  furnace(): void {
    const t = this.when
    this.strike(t, 0.3, 700, 0.5)
    this.tone(t + 0.05, 98, 0.16, 0.7, "sawtooth")
    this.tone(t + 0.05, 147, 0.07, 0.6, "triangle")
  }

  /** A course of the wall closing. The one big sound in the game. */
  course(): void {
    const t = this.when
    for (let i = 0; i < 4; i++) {
      this.tone(t + i * 0.11, 262 * 2 ** (semitone(i * 2) / 12), 0.17, 0.7)
    }
    this.strike(t + 0.44, 0.24, 1800, 0.28)
  }
}
