// The sound of the building. Synthesised here, in this pack's own
// `AudioContext` — the host's `feedback.sound` capability is a different thing
// and is not declared.
//
// Everything is stone: noise through a band-pass with a fast decay, plus a low
// sine that carries the weight. Nothing in here is a buzzer, because nothing in
// this game is a buzz — a wrong strike sounds like more masonry arriving, which
// is exactly what it is.

type Ctor = typeof AudioContext

function contextCtor(): Ctor | null {
  const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
  return g.AudioContext ?? g.webkitAudioContext ?? null
}

export class Audio {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private noise: AudioBuffer | null = null

  /** Web Audio needs a gesture. The first touch in the game is the first one. */
  resume(): void {
    if (!this.ctx) {
      const Ctx = contextCtor()
      if (!Ctx) return
      try {
        this.ctx = new Ctx()
      } catch (error) {
        console.warn("[colossus] no audio context", error)
        return
      }
      this.bus = this.ctx.createGain()
      this.bus.gain.value = 0.7
      this.bus.connect(this.ctx.destination)
      this.noise = this.makeNoise(this.ctx)
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch((error: unknown) => {
        console.warn("[colossus] audio could not resume", error)
      })
    }
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.4), ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      // Brown-ish noise: grit rather than hiss. Stone, not steam.
      last = (last + Math.random() * 2 - 1) * 0.5
      data[i] = last
    }
    return buf
  }

  private rumble(when: number, dur: number, freq: number, gain: number, q: number): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus || !this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.7 + Math.random() * 0.5
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = freq
    filter.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(gain, when + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(filter).connect(g).connect(bus)
    src.start(when)
    src.stop(when + dur + 0.05)
  }

  private tone(when: number, dur: number, from: number, to: number, gain: number): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus) return
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(from, when)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(gain, when + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(g).connect(bus)
    osc.start(when)
    osc.stop(when + dur + 0.05)
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime + 0.005 : 0
  }

  /** Taking hold of a slab. `depth` is how many are in the fist already. */
  hold(depth: number): void {
    if (!this.ctx) return
    const t = this.now()
    this.rumble(t, 0.09, 900, 0.1, 2.2)
    this.tone(t, 0.16, 220 * Math.pow(1.26, Math.min(5, depth)), 180, 0.075)
  }

  release(): void {
    if (!this.ctx) return
    this.rumble(this.now(), 0.07, 620, 0.06, 1.8)
  }

  /** The building coming apart. */
  collapse(floors: number): void {
    if (!this.ctx) return
    const t = this.now()
    this.rumble(t, 0.5, 180, 0.5, 0.7)
    this.rumble(t + 0.03, 0.9, 70, 0.42, 0.5)
    this.tone(t, 0.7, 120, 34, 0.32)
    for (let i = 0; i < Math.min(6, floors); i++) {
      this.rumble(t + 0.08 + i * 0.055, 0.24, 320 + i * 90, 0.16, 1.4)
    }
  }

  /** More stone arriving. Heavy, slow, and not a scold. */
  growth(count: number): void {
    if (!this.ctx) return
    const t = this.now()
    for (let i = 0; i < count; i++) {
      this.rumble(t + i * 0.13, 0.3, 150 - i * 18, 0.38, 0.8)
      this.tone(t + i * 0.13, 0.26, 88 - i * 8, 40, 0.2)
    }
  }

  /** The last floor leaves the ground line. */
  topple(): void {
    if (!this.ctx) return
    const t = this.now()
    this.rumble(t, 1.5, 90, 0.55, 0.4)
    this.tone(t, 1.4, 180, 28, 0.4)
    // A short bright fifth over the top, so the ground shaking reads as a win.
    this.tone(t + 0.1, 0.5, 392, 588, 0.12)
    this.tone(t + 0.24, 0.6, 588, 784, 0.1)
  }

  dispose(): void {
    const ctx = this.ctx
    this.ctx = null
    this.bus = null
    this.noise = null
    if (!ctx) return
    void ctx.close().catch(() => {
      // A context that was already closed is not news.
    })
  }
}
