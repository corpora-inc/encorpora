/**
 * Every sound is synthesized at runtime. There are no audio files.
 *
 * Three constraints shape the whole kit:
 *  1. **Transient / body / tail.** A sound with only a body is a beep, and a
 *     child hears four hundred of these a minute.
 *  2. **Pitch variation on every voice.** The single fastest way to make a
 *     game unbearable is a hit sound that is byte-identical 8000 times.
 *  3. **Voice limiting.** A horde survivor kills 40 things in a second. An
 *     unlimited kit produces a wall of mud and blows the audio thread.
 *
 * Sound never carries information alone — every cue here has a visual twin.
 */

type Voice =
  | "hit" | "kill" | "killBig" | "pickup" | "levelup" | "card"
  | "coreOpen" | "answerRight" | "answerWrong" | "overcharge" | "nova"
  | "hurt" | "death" | "riftOpen" | "revive" | "tick" | "warn" | "evolve"

const PENT = [0, 2, 4, 7, 9]

export class Audio {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private bus!: DynamicsCompressorNode
  private noise!: AudioBuffer
  private padGain!: GainNode
  private padFilter!: BiquadFilterNode
  private padOscs: OscillatorNode[] = []
  private frameVoices = 0
  private lastAt: Partial<Record<Voice, number>> = {}
  enabled = true
  private started = false
  private pickupStep = 0

  /** Must be called from a user gesture on iOS; safe to call repeatedly. */
  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {})
      return
    }
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor({ latencyHint: "interactive" })
    this.ctx = ctx

    this.bus = ctx.createDynamicsCompressor()
    this.bus.threshold.value = -18
    this.bus.knee.value = 24
    this.bus.ratio.value = 8
    this.bus.attack.value = 0.003
    this.bus.release.value = 0.16

    this.master = ctx.createGain()
    this.master.gain.value = 0.62
    this.bus.connect(this.master)
    this.master.connect(ctx.destination)

    // One reusable noise table — allocating a buffer per shot is a stutter.
    const n = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = n.getChannelData(0)
    let s = 0
    for (let i = 0; i < d.length; i++) {
      s = s * 0.86 + (Math.random() * 2 - 1) * 0.42
      d[i] = s
    }
    this.noise = n

    this.buildPad()
    if (ctx.state === "suspended") await ctx.resume().catch(() => {})
  }

  private buildPad(): void {
    const ctx = this.ctx!
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = "lowpass"
    this.padFilter.frequency.value = 260
    this.padFilter.Q.value = 1.4
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0
    this.padFilter.connect(this.padGain)
    this.padGain.connect(this.bus)

    // A slowly beating drone: the abyss has a pulse.
    for (const [f, det, type] of [
      [55, 0, "sawtooth"], [55.4, 0, "sawtooth"], [82.5, 0, "triangle"], [110, 6, "sine"],
    ] as [number, number, OscillatorType][]) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = f
      o.detune.value = det
      const g = ctx.createGain()
      g.gain.value = 0.24
      o.connect(g)
      g.connect(this.padFilter)
      // Slow independent drift keeps it from ever locking into a beat.
      const lfo = ctx.createOscillator()
      lfo.type = "sine"
      lfo.frequency.value = 0.031 + Math.random() * 0.06
      const la = ctx.createGain()
      la.gain.value = 3.2
      lfo.connect(la)
      la.connect(o.detune)
      lfo.start()
      o.start()
      this.padOscs.push(o, lfo)
    }
  }

  /** 0..1 — how deep the run has gone. Opens the filter and lifts the bed. */
  setIntensity(v: number): void {
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    this.padGain.gain.setTargetAtTime(0.05 + v * 0.11, t, 1.2)
    this.padFilter.frequency.setTargetAtTime(220 + v * 900, t, 1.6)
  }

  /** Ducks the bed hard — used for the level-up freeze and the Rift. */
  duck(amount: number, seconds = 0.25): void {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setTargetAtTime(0.62 * amount, t, 0.05)
    this.master.gain.setTargetAtTime(0.62, t + seconds, 0.22)
  }

  frame(): void {
    this.frameVoices = 0
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.62 : 0, this.ctx.currentTime, 0.05)
  }

  private gate(v: Voice, budget: number, minGapMs: number): boolean {
    if (!this.ctx || !this.enabled) return false
    if (!this.started) return false
    if (this.frameVoices >= budget) return false
    const now = performance.now()
    const last = this.lastAt[v] ?? -1e9
    if (now - last < minGapMs) return false
    this.lastAt[v] = now
    this.frameVoices++
    return true
  }

  markStarted(): void {
    this.started = true
  }

  /* ------------------------------------------------------------ builders */

  private env(g: GainNode, t: number, a: number, d: number, peak: number, sustain = 0, hold = 0): void {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
    if (hold > 0 && sustain > 0) {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, sustain), t + a + d * 0.35)
      g.gain.setValueAtTime(Math.max(0.0002, sustain), t + a + d * 0.35 + hold)
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + hold)
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
    }
  }

  private tone(
    t: number, type: OscillatorType, f0: number, f1: number,
    a: number, d: number, peak: number, dest?: AudioNode,
  ): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + d)
    const g = ctx.createGain()
    this.env(g, t, a, d, peak)
    o.connect(g)
    g.connect(dest ?? this.bus)
    o.start(t)
    o.stop(t + a + d + 0.03)
  }

  private burst(
    t: number, type: BiquadFilterType, f0: number, f1: number,
    a: number, d: number, peak: number, q = 1,
  ): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.playbackRate.value = 0.7 + Math.random() * 0.7
    const bq = ctx.createBiquadFilter()
    bq.type = type
    bq.Q.value = q
    bq.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + a + d)
    const g = ctx.createGain()
    this.env(g, t, a, d, peak)
    src.connect(bq)
    bq.connect(g)
    g.connect(this.bus)
    src.start(t, Math.random() * 0.2)
    src.stop(t + a + d + 0.03)
  }

  /* -------------------------------------------------------------- voices */

  hit(): void {
    if (!this.gate("hit", 5, 14)) return
    const t = this.ctx!.currentTime
    const p = 1 + (Math.random() - 0.5) * 0.5
    this.burst(t, "highpass", 2200 * p, 900 * p, 0.001, 0.035, 0.055)
    this.tone(t, "triangle", 720 * p, 380 * p, 0.001, 0.045, 0.045)
  }

  kill(): void {
    if (!this.gate("kill", 6, 11)) return
    const t = this.ctx!.currentTime
    const p = 0.82 + Math.random() * 0.5
    this.burst(t, "bandpass", 1500 * p, 380 * p, 0.001, 0.07, 0.075, 1.4)
    this.tone(t, "sine", 300 * p, 96 * p, 0.001, 0.085, 0.06)
  }

  killBig(): void {
    if (!this.gate("killBig", 8, 60)) return
    const t = this.ctx!.currentTime
    const p = 0.9 + Math.random() * 0.25
    this.burst(t, "lowpass", 2400, 180, 0.002, 0.34, 0.2, 0.8)
    this.tone(t, "sine", 150 * p, 42, 0.003, 0.5, 0.3)
    this.tone(t, "triangle", 420 * p, 210 * p, 0.004, 0.34, 0.09)
    this.tone(t, "sine", 1260 * p, 1180 * p, 0.004, 0.7, 0.05)
  }

  pickup(): void {
    if (!this.gate("pickup", 4, 26)) return
    const t = this.ctx!.currentTime
    // Wanders up and down a pentatonic ladder: musical, never a streak signal.
    this.pickupStep = (this.pickupStep + 1) % 12
    const oct = Math.floor(this.pickupStep / PENT.length)
    const semis = PENT[this.pickupStep % PENT.length] + oct * 12
    const f = 660 * Math.pow(2, semis / 12)
    this.tone(t, "triangle", f, f, 0.001, 0.075, 0.05)
    this.tone(t, "sine", f * 2, f * 2, 0.001, 0.05, 0.022)
  }

  levelup(): void {
    if (!this.gate("levelup", 12, 200)) return
    const t = this.ctx!.currentTime
    ;[0, 4, 7, 12, 16].forEach((s, i) => {
      const f = 330 * Math.pow(2, s / 12)
      this.tone(t + i * 0.045, "triangle", f, f, 0.006, 0.55, 0.075)
    })
    this.burst(t, "highpass", 600, 6000, 0.02, 0.5, 0.05)
    this.tone(t, "sine", 90, 55, 0.004, 0.45, 0.2)
  }

  card(): void {
    if (!this.gate("card", 8, 40)) return
    const t = this.ctx!.currentTime
    this.burst(t, "bandpass", 1800, 700, 0.001, 0.06, 0.1, 2.4)
    this.tone(t, "square", 180, 130, 0.001, 0.07, 0.035)
  }

  tick(): void {
    if (!this.gate("tick", 4, 30)) return
    const t = this.ctx!.currentTime
    this.burst(t, "highpass", 4200, 3000, 0.0008, 0.02, 0.03)
  }

  warn(): void {
    if (!this.gate("warn", 10, 220)) return
    const t = this.ctx!.currentTime
    this.tone(t, "sawtooth", 132, 118, 0.02, 0.42, 0.055)
    this.tone(t, "sine", 66, 58, 0.02, 0.5, 0.1)
  }

  coreOpen(): void {
    if (!this.gate("coreOpen", 12, 400)) return
    const t = this.ctx!.currentTime
    this.tone(t, "sine", 55, 110, 0.35, 0.9, 0.16)
    this.tone(t, "triangle", 440, 660, 0.3, 1.0, 0.05)
    this.burst(t, "bandpass", 400, 3200, 0.4, 0.9, 0.045, 3)
  }

  answerRight(): void {
    if (!this.gate("answerRight", 16, 120)) return
    const t = this.ctx!.currentTime
    ;[0, 7, 12, 19, 24].forEach((s, i) => {
      const f = 392 * Math.pow(2, s / 12)
      this.tone(t + i * 0.03, "triangle", f, f, 0.004, 0.6, 0.085)
    })
    this.tone(t, "sine", 110, 220, 0.01, 0.5, 0.22)
    this.burst(t, "highpass", 900, 9000, 0.006, 0.42, 0.07)
  }

  answerWrong(): void {
    if (!this.gate("answerWrong", 12, 120)) return
    const t = this.ctx!.currentTime
    // Dull and physical, never a buzzer. Being wrong is not the loud moment.
    this.tone(t, "sine", 150, 84, 0.004, 0.3, 0.17)
    this.tone(t, "triangle", 149, 82, 0.004, 0.26, 0.07)
    this.burst(t, "lowpass", 900, 220, 0.003, 0.2, 0.09)
  }

  overcharge(): void {
    if (!this.gate("overcharge", 20, 300)) return
    const t = this.ctx!.currentTime
    this.tone(t, "sawtooth", 110, 880, 0.18, 0.5, 0.08)
    this.tone(t, "sine", 55, 40, 0.02, 1.1, 0.32)
    this.burst(t, "highpass", 300, 11000, 0.16, 0.7, 0.1)
    ;[0, 5, 12].forEach((s, i) => this.tone(t + 0.18 + i * 0.05, "triangle", 523 * Math.pow(2, s / 12), 0, 0.005, 0.9, 0.07))
  }

  nova(): void {
    if (!this.gate("nova", 20, 200)) return
    const t = this.ctx!.currentTime
    this.tone(t, "sine", 120, 28, 0.004, 1.3, 0.42)
    this.burst(t, "lowpass", 9000, 120, 0.004, 0.85, 0.26, 0.6)
    this.burst(t, "highpass", 2000, 14000, 0.02, 0.6, 0.08)
  }

  hurt(): void {
    if (!this.gate("hurt", 10, 180)) return
    const t = this.ctx!.currentTime
    this.tone(t, "sine", 190, 60, 0.002, 0.24, 0.24)
    this.burst(t, "lowpass", 1400, 200, 0.002, 0.2, 0.14)
  }

  evolve(): void {
    if (!this.gate("evolve", 20, 400)) return
    const t = this.ctx!.currentTime
    this.tone(t, "sawtooth", 220, 1760, 0.3, 0.35, 0.07)
    ;[0, 4, 7, 11, 14].forEach((s, i) => this.tone(t + 0.25 + i * 0.04, "triangle", 523 * Math.pow(2, s / 12), 0, 0.005, 1.0, 0.075))
    this.tone(t + 0.25, "sine", 65, 44, 0.01, 1.2, 0.3)
  }

  death(): void {
    if (!this.gate("death", 24, 400)) return
    const t = this.ctx!.currentTime
    this.tone(t, "sawtooth", 220, 30, 0.01, 1.5, 0.14)
    this.tone(t, "sine", 110, 24, 0.01, 1.8, 0.24)
    this.burst(t, "lowpass", 5000, 90, 0.02, 1.4, 0.13, 0.7)
  }

  riftOpen(): void {
    if (!this.gate("riftOpen", 24, 500)) return
    const t = this.ctx!.currentTime
    this.tone(t, "sine", 44, 66, 0.6, 2.2, 0.2)
    this.tone(t, "triangle", 330, 494, 0.8, 2.0, 0.045)
    this.burst(t, "bandpass", 200, 1800, 0.9, 1.8, 0.05, 4)
  }

  revive(): void {
    if (!this.gate("revive", 30, 300)) return
    const t = this.ctx!.currentTime
    ;[0, 7, 12, 16, 19, 24, 28, 31].forEach((s, i) => {
      const f = 262 * Math.pow(2, s / 12)
      this.tone(t + i * 0.045, "triangle", f, f, 0.004, 0.85, 0.085)
    })
    this.tone(t, "sine", 55, 110, 0.02, 1.6, 0.34)
    this.burst(t, "highpass", 400, 13000, 0.1, 1.1, 0.1)
  }

  destroy(): void {
    for (const o of this.padOscs) { try { o.stop() } catch { /* already stopped */ } }
    this.padOscs.length = 0
    this.ctx?.close().catch(() => {})
    this.ctx = null
  }
}
