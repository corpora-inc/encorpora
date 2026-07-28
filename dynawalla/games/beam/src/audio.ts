// Procedural WebAudio. No assets, no samples, nothing fetched.
//
// The signature of this game lives in `setLock`. Two oscillators run
// continuously whenever the runner is under an automaton: one is the beam's
// tone, one is the automaton's, and they are detuned by the **phase offset**
// `(value mod beam) / beam`. Two tones a little apart beat against each other,
// and the beat rate is the mismatch. When the beam divides the value the
// mismatch is exactly zero, the beating stops, and the two collapse into one
// pure sustained tone.
//
// That is division made audible, and it is deliberately *not* a verdict light.
// The ear gets the remainder as a physical quantity — a remainder of one out of
// twelve is a slow, nearly-locked wobble — so listening narrows the field but
// never finishes the job, and a child who can divide is faster than a child who
// waits for the tone to settle. The scaffold fades on its own.
//
// Nothing here is the sole channel for any information; the phasing is drawn on
// the beam as well, and the whole system is disableable.

const PENTATONIC = [0, 3, 5, 7, 10] as const

function semis(i: number): number {
  const k = Math.min(Math.max(0, i), PENTATONIC.length * 3 - 1)
  const oct = Math.floor(k / PENTATONIC.length)
  return (PENTATONIC[k % PENTATONIC.length] as number) + oct * 12
}

function safeHz(f: number): number {
  return Math.max(20, Math.min(15000, f))
}

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private voices = 0
  private readonly maxVoices = 24
  private started = false
  private warnedSilent = false
  enabled = true

  // The lock voice — the two phasing oscillators, plus a body partial.
  private lockA: OscillatorNode | null = null
  private lockB: OscillatorNode | null = null
  private lockBody: OscillatorNode | null = null
  private lockGain: GainNode | null = null
  private lockTone: BiquadFilterNode | null = null
  private bedOscs: OscillatorNode[] = []

  /** Must be called from a user gesture. Safe to call repeatedly. */
  async start(): Promise<void> {
    if (this.started) {
      if (this.ctx?.state === "suspended") await this.ctx.resume().catch(() => {})
      return
    }
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    const Ctor = globalThis.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext
    if (!Ctor) {
      // Once, not once per tap. A device with no WebAudio is a fact about the
      // device, and repeating it a thousand times buries everything else.
      if (!this.warnedSilent) {
        this.warnedSilent = true
        console.warn("[beam] no AudioContext; running silent")
      }
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
      this.buildLock()
      this.buildBed()
    } catch (e) {
      console.warn("[beam] audio failed to start", e)
    }
  }

  private buildLock(): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus) return
    const gain = ctx.createGain()
    gain.gain.value = 0
    const tone = ctx.createBiquadFilter()
    tone.type = "lowpass"
    tone.frequency.value = 900
    tone.Q.value = 0.4
    gain.connect(tone)
    tone.connect(bus)

    const a = ctx.createOscillator()
    a.type = "sine"
    a.frequency.value = 220
    const b = ctx.createOscillator()
    b.type = "sine"
    b.frequency.value = 220
    const body = ctx.createOscillator()
    body.type = "triangle"
    body.frequency.value = 110
    const bodyGain = ctx.createGain()
    bodyGain.gain.value = 0.32
    a.connect(gain)
    b.connect(gain)
    body.connect(bodyGain)
    bodyGain.connect(gain)
    a.start()
    b.start()
    body.start()
    this.lockA = a
    this.lockB = b
    this.lockBody = body
    this.lockGain = gain
    this.lockTone = tone
  }

  private buildBed(): void {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus) return
    const g = ctx.createGain()
    g.gain.value = 0.035
    g.connect(bus)
    for (const [hz, type] of [
      [55, "sine"],
      [82.5, "sine"],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = hz
      o.detune.value = (Math.random() - 0.5) * 8
      o.connect(g)
      o.start()
      this.bedOscs.push(o)
    }
  }

  /**
   * Drive the resonance lock.
   *
   * @param beamHz  the ridden beam's own tone
   * @param phase   signed phase offset in (−0.5, 0.5]; exactly 0 means the beam
   *                divides the automaton's value
   * @param present false when nothing is above the runner — the voice ducks out
   *                rather than droning at an imaginary target
   */
  setLock(beamHz: number, phase: number, present: boolean): void {
    const ctx = this.ctx
    if (!ctx || !this.lockA || !this.lockB || !this.lockGain || !this.lockBody || !this.lockTone) {
      return
    }
    const t = ctx.currentTime
    const f = safeHz(beamHz)
    this.lockA.frequency.setTargetAtTime(f, t, 0.05)
    // ±48 cents at a half-turn of phase: wide enough to beat audibly at about
    // six hertz, narrow enough that the pair still reads as one note.
    this.lockB.detune.setTargetAtTime(phase * 96, t, 0.05)
    this.lockB.frequency.setTargetAtTime(f, t, 0.05)
    this.lockBody.frequency.setTargetAtTime(safeHz(f * 0.5), t, 0.08)
    const locked = phase === 0
    // Locked, the filter opens and the pair gets a touch louder: the sound goes
    // from a muffled wobble to something glassy and whole.
    this.lockTone.frequency.setTargetAtTime(locked ? 2600 : 780, t, 0.06)
    this.lockGain.gain.setTargetAtTime(
      !present || !this.enabled ? 0 : locked ? 0.075 : 0.05,
      t,
      0.07,
    )
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.02)
    }
  }

  suspend(): void {
    this.ctx?.suspend().catch(() => console.warn("[beam] audio suspend refused"))
  }

  dispose(): void {
    for (const o of [this.lockA, this.lockB, this.lockBody, ...this.bedOscs]) {
      if (!o) continue
      try {
        o.stop()
      } catch {
        console.warn("[beam] oscillator already stopped")
      }
    }
    this.bedOscs.length = 0
    this.lockA = null
    this.lockB = null
    this.lockBody = null
    this.ctx?.close().catch(() => console.warn("[beam] audio close refused"))
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

  /** Sliding onto a beam. A detent, not a note — the ride must not sing. */
  ride(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    this.transient(this.ctx.currentTime, 0.03, 1900 + Math.random() * 500, 3, 0.09)
  }

  /** The pulse leaving the runner. */
  fire(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.transient(t, 0.05, 3100, 1.4, 0.11)
    this.tone(t, 520, 0.1, 0.05, "triangle")
    this.tone(t + 0.005, 1040, 0.07, 0.02, "sine")
  }

  /**
   * An automaton coming apart. `step` walks a minor pentatonic ladder, so a
   * pulse that opens four multiples in one sweep rises without sounding wrong.
   */
  shatter(step: number): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    const base = 262 * Math.pow(2, semis(step) / 12)
    this.transient(t, 0.08, 2400 + Math.random() * 800, 0.9, 0.16)
    this.tone(t + 0.003, base, 0.22, 0.11, "triangle", (Math.random() - 0.5) * 14)
    this.tone(t + 0.003, base * 2, 0.13, 0.045, "sine")
    this.tone(t + 0.012, base * 0.5, 0.3, 0.05, "sine")
  }

  /** A pulse that did not divide. A dry, detuned knock. Never a buzzer. */
  dissonance(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.transient(t, 0.05, 420, 2.2, 0.1)
    this.tone(t, 146, 0.14, 0.06, "triangle", -34)
    this.tone(t + 0.004, 151, 0.14, 0.05, "triangle", 34)
  }

  /** The CORE entering the hall. Lapis, low, a door opening. */
  coreArrive(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.tone(t, 98, 0.6, 0.09, "sine")
    this.tone(t + 0.02, 147, 0.5, 0.05, "sine")
    this.tone(t + 0.04, 196, 0.42, 0.035, "triangle")
  }

  /** The CORE breaking into its candidates. */
  fracture(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.transient(t, 0.16, 1700, 0.6, 0.2)
    for (let i = 0; i < 4; i++) {
      this.tone(t + i * 0.03, 392 * Math.pow(2, i / 12), 0.2, 0.045, "sine")
    }
  }

  /** The answer, taken. The biggest sound in the game. */
  ascend(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    for (let i = 0; i < 6; i++) {
      this.tone(t + i * 0.045, 262 * Math.pow(2, semis(i + 3) / 12), 0.5, 0.075, "sine")
      this.tone(t + i * 0.045, 262 * Math.pow(2, semis(i + 3) / 12) * 2, 0.3, 0.025, "triangle")
    }
    this.tone(t, 131, 0.9, 0.06, "sine")
  }

  /** A candidate taken that was not the answer. Falls, does not scold. */
  settleWrong(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.tone(t, 196, 0.28, 0.07, "sine")
    this.tone(t + 0.07, 165, 0.34, 0.06, "sine")
    this.tone(t + 0.15, 131, 0.5, 0.05, "sine")
  }

  /** Something reached the floor. */
  breach(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.transient(t, 0.22, 180, 0.7, 0.24)
    this.tone(t, 62, 0.6, 0.13, "sine")
    this.tone(t + 0.01, 93, 0.3, 0.05, "triangle", -18)
  }

  /** An anchor relit. Rising, warm, earned. */
  riser(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    for (let i = 0; i < 5; i++) {
      this.tone(t + i * 0.06, 175 * Math.pow(2, semis(i) / 12), 0.45, 0.06, "triangle")
    }
  }

  /** The lattice going dark. */
  collapse(): void {
    if (!this.ok() || !this.ctx) return
    this.voice()
    const t = this.ctx.currentTime
    this.tone(t, 220, 1.4, 0.09, "sine", 0)
    this.tone(t + 0.1, 146, 1.5, 0.08, "sine")
    this.tone(t + 0.2, 98, 1.8, 0.07, "sine")
    this.transient(t, 0.5, 300, 0.5, 0.12)
  }
}
