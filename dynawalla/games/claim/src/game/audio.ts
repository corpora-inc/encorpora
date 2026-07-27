// Procedural audio. No assets, no samples.
//
// Every hit is built the same way — transient, body, tail — and every one is
// detuned a little so a thousand claims never sand down into one sound. Sound
// is disableable and never carries information on its own: everything you can
// hear, you can also see.

const A4 = 440
/** Pentatonic minor degrees in semitones — nothing here can sound wrong. */
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]

function hz(semitonesFromA4: number): number {
  return A4 * Math.pow(2, semitonesFromA4 / 12)
}

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private tensionOsc: OscillatorNode | null = null
  private tensionGain: GainNode | null = null
  private tensionFilter: BiquadFilterNode | null = null
  private started = false
  enabled = true
  /** Transposes the whole palette per level so the ladder is audible. */
  key = 0

  private ac(): AudioContext | null {
    if (!this.enabled) return null
    if (this.ctx) return this.ctx
    const Ctor =
      (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    const master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
    this.ctx = ctx
    this.master = master

    const len = Math.floor(ctx.sampleRate * 0.7)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    // Deterministic noise: a fixed LCG, so the texture is identical every run.
    let s = 22222
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      data[i] = (s / 2147483648 - 1) * 0.9
    }
    this.noiseBuf = buf
    return ctx
  }

  /** Browsers require a gesture. Call from the first real input. */
  unlock(): void {
    const ctx = this.ac()
    if (!ctx) return
    if (ctx.state === "suspended") void ctx.resume()
    this.started = true
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (!on) {
      this.stopTension()
      if (this.master) this.master.gain.value = 0
    } else if (this.master) {
      this.master.gain.value = 0.55
    }
  }

  private tone(
    freq: number,
    type: OscillatorType,
    t0: number,
    dur: number,
    peak: number,
    bend = 1,
  ): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t0 + dur)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain).connect(master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  private noise(t0: number, dur: number, peak: number, f0: number, f1: number, q = 1): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuf) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const filt = ctx.createBiquadFilter()
    filt.type = "bandpass"
    filt.Q.value = q
    filt.frequency.setValueAtTime(f0, t0)
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filt).connect(gain).connect(master)
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }

  private now(): number {
    const ctx = this.ac()
    return ctx ? ctx.currentTime : 0
  }

  cutStart(): void {
    if (!this.ac()) return
    const t = this.now()
    this.tone(hz(this.key + 12), "square", t, 0.07, 0.07, 1.6)
    this.noise(t, 0.05, 0.05, 900, 2600, 3)
  }

  /** Pitch falls as the cut gets bigger — the game sounds like its own numbers. */
  claim(fractionOfArena: number, combo: number): void {
    if (!this.ac()) return
    const t = this.now()
    const deg = Math.max(0, Math.min(SCALE.length - 1, Math.round((1 - fractionOfArena) * 8)))
    const root = hz(this.key + (SCALE[deg] as number) - 12)
    // transient
    this.noise(t, 0.05, 0.16, 2400, 500, 1.4)
    // body
    this.tone(root, "triangle", t, 0.2 + fractionOfArena * 0.5, 0.2, 0.86)
    this.tone(root * 1.5, "sine", t + 0.01, 0.26, 0.1, 0.9)
    // tail — a short comb of echoes, brighter with a bigger combo
    const rings = Math.min(4, 1 + Math.floor(combo / 2))
    for (let i = 1; i <= rings; i++) {
      this.tone(root * 2, "sine", t + i * 0.075, 0.16, 0.05 / i, 1)
    }
  }

  cleanFraction(den: number): void {
    if (!this.ac()) return
    const t = this.now()
    const base = this.key + 12 - Math.min(12, den)
    for (let i = 0; i < 3; i++) {
      this.tone(hz(base + (SCALE[i * 2] as number)), "sine", t + i * 0.045, 0.18, 0.09, 1)
    }
  }

  perfect(): void {
    if (!this.ac()) return
    const t = this.now()
    this.noise(t, 0.12, 0.2, 3200, 900, 1)
    for (let i = 0; i < 5; i++) {
      this.tone(hz(this.key + (SCALE[i] as number)), "triangle", t + i * 0.055, 0.4, 0.17, 1)
      this.tone(hz(this.key + (SCALE[i] as number) + 12), "sine", t + i * 0.055, 0.3, 0.08, 1)
    }
  }

  /** Something new just arrived in the arena. Distinct from a bust. */
  spawn(): void {
    if (!this.ac()) return
    const t = this.now()
    this.noise(t, 0.3, 0.16, 220, 1800, 1.2)
    this.tone(hz(this.key - 17), "square", t, 0.22, 0.09, 2.4)
    this.tone(hz(this.key - 5), "square", t + 0.1, 0.18, 0.07, 2.2)
  }

  bust(): void {
    if (!this.ac()) return
    const t = this.now()
    this.noise(t, 0.42, 0.3, 1800, 90, 0.7)
    this.tone(hz(this.key - 12), "sawtooth", t, 0.4, 0.16, 0.4)
    this.tone(hz(this.key - 19), "square", t + 0.04, 0.34, 0.1, 0.5)
  }

  death(): void {
    if (!this.ac()) return
    const t = this.now()
    this.noise(t, 0.55, 0.32, 2600, 60, 0.6)
    this.tone(hz(this.key + 3), "sawtooth", t, 0.6, 0.2, 0.22)
  }

  gateRight(): void {
    if (!this.ac()) return
    const t = this.now()
    for (let i = 0; i < 4; i++) {
      this.tone(hz(this.key + (SCALE[i] as number) + 12), "square", t + i * 0.05, 0.16, 0.11, 1)
    }
  }

  gateWrong(): void {
    if (!this.ac()) return
    const t = this.now()
    this.tone(hz(this.key - 5), "square", t, 0.18, 0.12, 0.7)
    this.tone(hz(this.key - 8), "square", t + 0.09, 0.24, 0.1, 0.6)
  }

  levelClear(): void {
    if (!this.ac()) return
    const t = this.now()
    for (let i = 0; i < 8; i++) {
      const d = SCALE[i % SCALE.length] as number
      this.tone(hz(this.key + d + (i >= 5 ? 12 : 0)), "triangle", t + i * 0.07, 0.5, 0.15, 1)
    }
    this.noise(t, 0.9, 0.1, 400, 5000, 0.6)
  }

  step(): void {
    if (!this.ac()) return
    this.noise(this.now(), 0.02, 0.014, 1600, 900, 4)
  }

  /**
   * The trail hum. Rises in pitch and brightness as the cut gets longer and as
   * a hunter closes — the tension you can hear before you can see it. Purely
   * redundant: the trail also brightens and the vignette tightens.
   */
  tension(amount: number): void {
    const ctx = this.ac()
    if (!ctx || !this.master) return
    if (amount <= 0.001) {
      this.stopTension()
      return
    }
    if (!this.tensionOsc) {
      const osc = ctx.createOscillator()
      const filt = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      osc.type = "sawtooth"
      filt.type = "lowpass"
      filt.Q.value = 6
      gain.gain.value = 0
      osc.connect(filt).connect(gain).connect(this.master)
      osc.start()
      this.tensionOsc = osc
      this.tensionGain = gain
      this.tensionFilter = filt
    }
    const t = ctx.currentTime
    this.tensionOsc.frequency.setTargetAtTime(hz(this.key - 24 + amount * 14), t, 0.08)
    this.tensionFilter?.frequency.setTargetAtTime(220 + amount * 2400, t, 0.08)
    this.tensionGain?.gain.setTargetAtTime(0.012 + amount * 0.05, t, 0.08)
  }

  private stopTension(): void {
    if (!this.tensionGain || !this.ctx) return
    this.tensionGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05)
  }

  dispose(): void {
    this.stopTension()
    try {
      this.tensionOsc?.stop()
    } catch {
      /* already stopped */
    }
    this.tensionOsc = null
    if (this.started) void this.ctx?.close()
    this.ctx = null
    this.master = null
  }
}
