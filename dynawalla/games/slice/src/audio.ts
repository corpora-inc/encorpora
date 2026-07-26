// Procedural WebAudio. No assets, no samples, nothing fetched.
//
// Every cue is built as **transient → body → tail** because that is what makes
// a synthesised hit read as a physical event rather than a beep:
//   * transient — a 3–12ms noise or click that carries the "impact"
//   * body      — the pitched part that carries identity
//   * tail      — the decay that carries size
//
// Pitch varies on every single call, so a five-minute run never fatigues. The
// combo ladder walks a **minor pentatonic** scale: any two notes in it are
// consonant, so a 14-hit chain rises without ever sounding wrong, and it is the
// single most addictive thing in the sound design.
//
// Nothing here is the sole channel for any information; every cue has a visual
// twin, and the whole system is disableable.

const PENTATONIC = [0, 3, 5, 7, 10] as const

function semis(i: number): number {
  // The ladder is capped at three octaves. Beyond that a long chain walked the
  // partials of `prime()` past 24kHz, which WebAudio clamps with a console
  // warning per note — audible as the top of the ladder flattening out.
  const k = Math.min(i, PENTATONIC.length * 3 - 1)
  const oct = Math.floor(k / PENTATONIC.length)
  return (PENTATONIC[k % PENTATONIC.length] as number) + oct * 12
}

/** Nothing is ever scheduled above this; the partials of a bell add up fast. */
function safeHz(f: number): number {
  return Math.max(20, Math.min(15000, f))
}

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private voices = 0
  private readonly maxVoices = 26
  enabled = true
  private bedGain: GainNode | null = null
  private bedOscs: OscillatorNode[] = []
  private started = false

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async start(): Promise<void> {
    if (this.started) {
      if (this.ctx?.state === "suspended") await this.ctx.resume().catch(() => {})
      return
    }
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    const Ctor = globalThis.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext
    if (!Ctor) {
      console.warn("[slice] no AudioContext; running silent")
      return
    }
    try {
      const ctx = new Ctor()
      this.ctx = ctx
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.knee.value = 26
      comp.ratio.value = 6
      comp.attack.value = 0.003
      comp.release.value = 0.16
      const master = ctx.createGain()
      master.gain.value = 0.85
      const bus = ctx.createGain()
      bus.gain.value = 1
      bus.connect(comp)
      comp.connect(master)
      master.connect(ctx.destination)
      this.master = master
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
        d[i] = ((s >>> 0) / 2147483648 - 1) * 0.6
      }
      this.noise = buf

      await ctx.resume().catch(() => {})
      this.started = true
      this.startBed()
    } catch (e) {
      console.warn("[slice] audio failed to start", e)
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.02)
    }
  }

  suspend(): void {
    this.ctx?.suspend().catch(() => console.warn("[slice] audio suspend refused"))
  }
  resume(): void {
    this.ctx?.resume().catch(() => console.warn("[slice] audio resume refused"))
  }

  dispose(): void {
    for (const o of this.bedOscs) {
      try {
        o.stop()
      } catch {
        console.warn("[slice] bed oscillator already stopped")
      }
    }
    this.bedOscs.length = 0
    this.ctx?.close().catch(() => console.warn("[slice] audio close refused"))
    this.ctx = null
    this.started = false
  }

  private ok(): boolean {
    return this.enabled && this.ctx !== null && this.bus !== null && this.voices < this.maxVoices
  }

  private voice(): void {
    this.voices++
    setTimeout(() => {
      this.voices--
    }, 900)
  }

  /** Shared transient: a band-passed noise burst. */
  private transient(t: number, dur: number, freq: number, q: number, gain: number): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus || !this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.8 + Math.random() * 0.5
    const bp = ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.value = freq
    bp.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.0016)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp)
    bp.connect(g)
    g.connect(bus)
    src.start(t, Math.random() * 0.4)
    src.stop(t + dur + 0.02)
  }

  private tone(
    t: number,
    freq: number,
    dur: number,
    gain: number,
    type: OscillatorType = "sine",
    detune = 0,
  ): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus) return
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(safeHz(freq), t)
    o.detune.value = detune
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(bus)
    o.start(t)
    o.stop(t + dur + 0.03)
  }

  /** Blade through air. Pitch and brightness track swipe speed. */
  whoosh(speed: number): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    const s = Math.min(1, speed / 2600)
    const f = 700 + s * 2600 + Math.random() * 300
    const ctx = this.ctx
    const bus = this.bus
    if (!bus || !this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.9 + Math.random() * 0.4
    const bp = ctx.createBiquadFilter()
    bp.type = "bandpass"
    bp.frequency.setValueAtTime(f * 0.5, t)
    bp.frequency.exponentialRampToValueAtTime(f, t + 0.06)
    bp.frequency.exponentialRampToValueAtTime(f * 0.42, t + 0.2)
    bp.Q.value = 1.1
    const g = ctx.createGain()
    const peak = 0.03 + s * 0.09
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
    src.connect(bp)
    bp.connect(g)
    g.connect(bus)
    src.start(t, Math.random() * 0.4)
    src.stop(t + 0.28)
  }

  /**
   * A composite splitting open. `step` is the combo index — it walks the
   * pentatonic ladder up, which is the hook.
   */
  cut(step: number, wetness = 1): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    const n = Math.min(step, 22)
    const base = 196 * Math.pow(2, semis(n) / 12)
    // transient: the wet "shk"
    this.transient(t, 0.075 * wetness, 2200 + Math.random() * 900, 0.9, 0.2)
    // body: the pitched thunk
    this.tone(t + 0.004, base, 0.16, 0.13, "triangle", (Math.random() - 0.5) * 18)
    this.tone(t + 0.004, base * 2, 0.1, 0.05, "sine", (Math.random() - 0.5) * 22)
    // tail: a short low bloom so the cut has size
    this.tone(t + 0.01, base * 0.5, 0.26, 0.055, "sine")
  }

  /** A prime bursting. Bell-like, gold, unmistakably the payoff. */
  prime(step: number): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    const n = Math.min(step, 22)
    const base = 392 * Math.pow(2, semis(n) / 12)
    this.transient(t, 0.03, 5200, 1.6, 0.13)
    this.tone(t, base, 0.5, 0.11, "sine")
    this.tone(t + 0.006, base * 1.5, 0.42, 0.06, "sine", 6)
    this.tone(t + 0.012, base * 2.02, 0.66, 0.045, "sine", -8)
    this.tone(t + 0.02, base * 3.01, 0.3, 0.022, "sine")
  }

  /** A sigil tablet cracking open. A rising shimmer — "the question is live". */
  sigilOpen(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.transient(t, 0.09, 3400, 0.8, 0.16)
    for (let i = 0; i < 5; i++) {
      this.tone(t + i * 0.032, 330 * Math.pow(2, semis(i + 2) / 12), 0.3, 0.05, "triangle")
    }
  }

  /** The right answer. The biggest sound in the game. */
  ascend(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.transient(t, 0.05, 4200, 1.2, 0.2)
    const root = 261.63
    for (const [i, mul] of [1, 1.5, 2, 3, 4].entries()) {
      this.tone(t + i * 0.018, root * mul, 0.85 - i * 0.07, 0.1 - i * 0.012, "sine")
    }
    // A rising sweep underneath — the "lift".
    const ctx = this.ctx
    const bus = this.bus
    if (!bus) return
    const o = ctx.createOscillator()
    o.type = "sawtooth"
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(880, t + 0.42)
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.setValueAtTime(500, t)
    lp.frequency.exponentialRampToValueAtTime(4200, t + 0.4)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.16)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62)
    o.connect(lp)
    lp.connect(g)
    g.connect(bus)
    o.start(t)
    o.stop(t + 0.68)
  }

  /** A wrong candidate turning to ash. Dull and low — never harsh, never a buzzer. */
  ash(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.transient(t, 0.13, 420, 0.7, 0.14)
    this.tone(t, 116, 0.3, 0.09, "triangle")
    this.tone(t + 0.01, 109, 0.34, 0.06, "triangle", -30)
  }

  /** A lamp going out. Descending, glassy, sad rather than punitive. */
  lampOut(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    const ctx = this.ctx
    const bus = this.bus
    if (!bus) return
    const o = ctx.createOscillator()
    o.type = "sine"
    o.frequency.setValueAtTime(760, t)
    o.frequency.exponentialRampToValueAtTime(150, t + 0.7)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.11, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
    o.connect(g)
    g.connect(bus)
    o.start(t)
    o.stop(t + 0.85)
    this.transient(t, 0.2, 900, 0.6, 0.1)
  }

  /** A bomb. Sub drop plus a wide noise body. */
  bomb(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    const ctx = this.ctx
    const bus = this.bus
    if (!bus || !this.noise) return
    this.transient(t, 0.42, 260, 0.35, 0.32)
    const o = ctx.createOscillator()
    o.type = "sine"
    o.frequency.setValueAtTime(190, t)
    o.frequency.exponentialRampToValueAtTime(28, t + 0.55)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.28, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75)
    o.connect(g)
    g.connect(bus)
    o.start(t)
    o.stop(t + 0.8)
  }

  /** The fuse, while a bomb is on screen. Ticking, quiet, positional in pitch. */
  fuse(): void {
    if (!this.ok() || !this.ctx) return
    this.transient(this.ctx.currentTime, 0.02, 3000 + Math.random() * 1500, 2.4, 0.045)
  }

  /** MARKET RUSH begins. */
  riser(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const ctx = this.ctx
    const bus = this.bus
    if (!bus) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = "sawtooth"
    o.frequency.setValueAtTime(90, t)
    o.frequency.exponentialRampToValueAtTime(1400, t + 1.1)
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.setValueAtTime(400, t)
    lp.frequency.exponentialRampToValueAtTime(6000, t + 1.1)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.9)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35)
    o.connect(lp)
    lp.connect(g)
    g.connect(bus)
    o.start(t)
    o.stop(t + 1.4)
  }

  /** A soft toss, so objects entering the frame are *heard* arriving. */
  toss(): void {
    if (!this.ok() || !this.ctx) return
    this.transient(this.ctx.currentTime, 0.09, 900 + Math.random() * 700, 0.7, 0.035)
  }

  /**
   * The bed: two slightly detuned low oscillators through a slow filter sweep.
   * The market at the blue hour. It is very quiet, it never resolves and it
   * never loops audibly — the detune beats at ~0.16Hz, so it breathes.
   */
  private startBed(): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus) return
    const g = ctx.createGain()
    g.gain.value = 0.0
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 480
    lp.Q.value = 0.7
    g.connect(lp)
    lp.connect(bus)
    for (const [i, f] of [55, 82.5, 110.16].entries()) {
      const o = ctx.createOscillator()
      o.type = i === 2 ? "triangle" : "sawtooth"
      o.frequency.value = f
      o.detune.value = i * 5 - 5
      const og = ctx.createGain()
      og.gain.value = i === 2 ? 0.35 : 0.55
      o.connect(og)
      og.connect(g)
      o.start()
      this.bedOscs.push(o)
    }
    g.gain.setTargetAtTime(0.055, ctx.currentTime, 2.5)
    this.bedGain = g
    // A slow, never-repeating filter drift.
    const drift = (): void => {
      if (!this.ctx) return
      const now = this.ctx.currentTime
      lp.frequency.setTargetAtTime(320 + Math.random() * 520, now, 3.5)
      setTimeout(drift, 4000 + Math.random() * 3000)
    }
    setTimeout(drift, 3000)
  }

  /** Push the bed up as the run escalates. 0..1. */
  setIntensity(v: number): void {
    if (!this.bedGain || !this.ctx) return
    this.bedGain.gain.setTargetAtTime(0.04 + v * 0.075, this.ctx.currentTime, 0.6)
  }
}
