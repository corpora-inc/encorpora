/**
 * ARENA's sound, synthesized in Web Audio at runtime. No files, ever.
 *
 * Every one-shot is built the same way — a transient, a body and a tail — and
 * every one-shot varies in pitch, filter and timbre per hit so that ten
 * thousand absorbs in a session do not sand a child's ears down. The whole mix
 * runs through a lowpass whose cutoff opens as you grow, so becoming enormous
 * is something you hear before you read it.
 *
 * Sound never carries information alone: every cue here has a visual twin.
 */

type Voice = { stop(at: number): void }

const NOTES = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24] // minor pentatonic + octaves

export class Audio {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private tone!: BiquadFilterNode
  private comp!: DynamicsCompressorNode
  private wetSend!: GainNode
  private musicBus!: GainNode
  private sfxBus!: GainNode
  private noiseBuf!: AudioBuffer
  private voices = 0
  private started = false
  enabled = true
  private lastAbsorb = 0
  private lastFlip = 0
  private musicTimer = 0
  private musicStep = 0
  private intensity = 0
  private root = 55 // A1

  /** Called on the first user gesture. Safe to call repeatedly. */
  async init(): Promise<void> {
    if (this.started) {
      if (this.ctx?.state === "suspended") await this.ctx.resume().catch(() => {})
      return
    }
    this.started = true
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor({ latencyHint: "interactive" })
    } catch (err) {
      console.warn("[arena] no AudioContext; running silent", err)
      this.ctx = null
      return
    }
    const ctx = this.ctx

    this.comp = ctx.createDynamicsCompressor()
    this.comp.threshold.value = -14
    this.comp.knee.value = 22
    this.comp.ratio.value = 5
    this.comp.attack.value = 0.004
    this.comp.release.value = 0.18

    this.master = ctx.createGain()
    // Honour a mute that landed before the context existed. `setEnabled` can
    // only reach a GainNode that has been built, so a child who taps the note
    // as their very first gesture would otherwise be un-muted by this line.
    this.master.gain.value = this.enabled ? 0.85 : 0

    this.tone = ctx.createBiquadFilter()
    this.tone.type = "lowpass"
    this.tone.frequency.value = 1400
    this.tone.Q.value = 0.6

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 1
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0.34

    // A procedurally generated impulse response: exponentially decaying noise
    // with a darkening tilt. This is the "underwater cathedral" the whole game
    // sits inside.
    const len = Math.floor(ctx.sampleRate * 2.6)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const t = i / len
        const env = Math.pow(1 - t, 2.6)
        const n = Math.random() * 2 - 1
        lp += (n - lp) * (0.06 + 0.30 * (1 - t))
        d[i] = lp * env * (i < 200 ? i / 200 : 1)
      }
    }
    const conv = ctx.createConvolver()
    conv.buffer = ir
    const wetGain = ctx.createGain()
    wetGain.gain.value = 0.5
    this.wetSend = ctx.createGain()
    this.wetSend.gain.value = 1
    this.wetSend.connect(conv)
    conv.connect(wetGain)

    this.sfxBus.connect(this.tone)
    this.musicBus.connect(this.tone)
    wetGain.connect(this.tone)
    this.tone.connect(this.comp)
    this.comp.connect(this.master)
    this.master.connect(ctx.destination)

    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    this.noiseBuf = nb

    this.startBed()
    if (ctx.state === "suspended") await ctx.resume().catch(() => {})
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.now, 0.05)
  }

  private get now(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  /** Brightness follows mass; intensity drives the score. */
  setState(mass: number, depthIndex: number, danger: number): void {
    if (!this.ctx) return
    const openness = Math.min(1, Math.log(1 + mass / 12) / Math.log(1 + 900 / 12))
    const cut = 900 + openness * 8600 + danger * 1600
    this.tone.frequency.setTargetAtTime(cut, this.now, 0.35)
    this.intensity = Math.min(1, depthIndex * 0.18 + openness * 0.6 + danger * 0.3)
  }

  private noise(dur: number, type: BiquadFilterType, freq: number, q: number, gain: number, when = 0): Voice | null {
    const ctx = this.ctx
    if (!ctx || this.voices > 26) return null
    const t = this.now + when
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    src.playbackRate.value = 0.7 + Math.random() * 0.6
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.sfxBus)
    g.connect(this.wetSend)
    src.start(t)
    src.stop(t + dur + 0.02)
    this.voices++
    src.onended = () => {
      this.voices--
      g.disconnect()
      f.disconnect()
    }
    return { stop: (at) => src.stop(at) }
  }

  private osc(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
    when = 0,
    dest?: AudioNode,
  ): void {
    const ctx = this.ctx
    if (!ctx || this.voices > 26) return
    const t = this.now + when
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.9)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.012, dur * 0.2))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(dest ?? this.sfxBus)
    g.connect(this.wetSend)
    o.start(t)
    o.stop(t + dur + 0.02)
    this.voices++
    o.onended = () => {
      this.voices--
      g.disconnect()
    }
  }

  // -- one-shots ------------------------------------------------------------

  /** Absorb. Pitch climbs the pentatonic ladder with the combo, then resets. */
  absorb(combo: number, value: number, mass: number): void {
    if (!this.ctx) return
    const t = this.now
    if (t - this.lastAbsorb < 0.028) return
    this.lastAbsorb = t
    const step = NOTES[Math.min(NOTES.length - 1, combo % 11)] as number
    const oct = 1 + Math.floor(Math.min(3, combo / 11))
    const f = this.root * Math.pow(2, oct + step / 12)
    // Bigger swallows sit lower and rounder; crumbs are bright ticks.
    const size = Math.min(1, value / Math.max(1, mass))
    this.osc("triangle", f * (1.4 - size * 0.45), f * (0.98 - size * 0.15), 0.10 + size * 0.16, 0.10 + size * 0.09)
    this.noise(0.045, "bandpass", 2400 + Math.random() * 2600 - size * 900, 3.5, 0.055)
  }

  /** A rival went down. The genre's payoff moment gets a real chord. */
  devour(mass: number, rivalMass: number): void {
    if (!this.ctx) return
    const scale = Math.min(1.6, rivalMass / Math.max(1, mass))
    const f = this.root * Math.pow(2, 2 - scale * 0.4)
    this.osc("sine", f * 0.5, f * 0.25, 0.75, 0.30)
    this.osc("triangle", f, f * 1.5, 0.42, 0.16)
    this.osc("triangle", f * 1.5, f * 2.0, 0.5, 0.11, 0.03)
    this.osc("sine", f * 3.0, f * 4.0, 0.6, 0.07, 0.06)
    this.noise(0.30, "lowpass", 900, 1.0, 0.20)
    this.noise(0.5, "highpass", 5200, 0.8, 0.05, 0.02)
  }

  /** Something too big to swallow. Dissonant, short, unmistakable. */
  sting(loss: number, mass: number): void {
    if (!this.ctx) return
    const hurt = Math.min(1, loss / Math.max(1, mass * 0.2))
    const f = 190 - hurt * 60
    this.osc("sawtooth", f, f * 0.55, 0.20, 0.16)
    this.osc("square", f * 1.06, f * 0.6, 0.16, 0.09)
    this.noise(0.14, "bandpass", 620, 1.4, 0.22)
  }

  /** Rupture. Sub, a long descending sweep, and the room falling in. */
  rupture(): void {
    if (!this.ctx) return
    this.osc("sine", 120, 32, 1.4, 0.42)
    this.osc("sawtooth", 300, 48, 0.95, 0.16)
    this.osc("triangle", 640, 110, 0.7, 0.10)
    this.noise(0.9, "lowpass", 1600, 0.9, 0.30)
    this.noise(1.5, "bandpass", 260, 0.7, 0.16, 0.05)
  }

  /** A Resonance opens: the arena inhales. */
  resonanceOpen(): void {
    if (!this.ctx) return
    const f = this.root * 2
    for (let i = 0; i < 4; i++) {
      this.osc("sine", f * Math.pow(2, (NOTES[i] as number) / 12), f * Math.pow(2, (NOTES[i] as number) / 12), 1.5, 0.055, i * 0.06)
    }
    this.osc("sine", f * 0.5, f * 0.5, 1.8, 0.14)
    this.noise(1.2, "highpass", 3800, 0.7, 0.06)
  }

  /** Correct. A resolving major chord with a shimmer on top, rising with the streak. */
  resonanceHit(combo: number): void {
    if (!this.ctx) return
    const lift = Math.min(5, combo) / 12
    const f = this.root * Math.pow(2, 2 + lift)
    const chord = [0, 4, 7, 11, 14]
    for (let i = 0; i < chord.length; i++) {
      const n = f * Math.pow(2, (chord[i] as number) / 12)
      this.osc("triangle", n, n, 1.1 - i * 0.08, 0.11 - i * 0.014, i * 0.035)
    }
    this.osc("sine", f * 0.25, f * 0.25, 1.4, 0.34)
    this.noise(0.7, "highpass", 6200, 0.8, 0.10)
    this.noise(0.35, "bandpass", 1800, 2.0, 0.14)
  }

  /** Wrong. It sags — it does not buzz, and it never sounds like a school bell. */
  resonanceMiss(): void {
    if (!this.ctx) return
    const f = this.root * 2
    this.osc("triangle", f, f * 0.86, 0.55, 0.16)
    this.osc("triangle", f * 1.19, f * 0.98, 0.5, 0.10, 0.02)
    this.osc("sine", f * 0.5, f * 0.42, 0.8, 0.18)
    this.noise(0.25, "lowpass", 700, 1.0, 0.12)
  }

  /** A depth boundary. A slow gong from far below. */
  depth(index: number): void {
    if (!this.ctx) return
    const f = 44 * Math.pow(2, index * 0.14)
    this.osc("sine", f, f * 0.9, 3.4, 0.40)
    this.osc("triangle", f * 3.02, f * 2.9, 2.4, 0.07, 0.02)
    this.osc("triangle", f * 4.51, f * 4.3, 1.8, 0.05, 0.05)
    this.noise(2.2, "lowpass", 500, 0.8, 0.10)
  }

  /** The floor held. A short, warm, rising perfect fifth — a "no, that's enough". */
  held(): void {
    if (!this.ctx) return
    const f = 196 * (0.97 + Math.random() * 0.06)
    this.osc("triangle", f, f * 1.5, 0.55, 0.13)
    this.osc("sine", f * 3, f * 4.5, 0.34, 0.05, 0.02)
    this.noise(0.24, "bandpass", 1400, 1.6, 0.07)
  }

  /**
   * A rung banked. Deliberately the only *rising* major arpeggio in the whole
   * game — everything else here bends down or sits still — so it is
   * unmistakable even with the screen not being looked at.
   */
  anchor(index: number): void {
    if (!this.ctx) return
    const root = 138.6 * Math.pow(2, (index % 5) * 0.0834)
    const steps = [1, 1.25, 1.5, 2, 2.5]
    for (let i = 0; i < steps.length; i++) {
      const f = root * (steps[i] as number)
      this.osc("triangle", f, f * 1.004, 1.5 - i * 0.14, 0.16 - i * 0.014, i * 0.075)
      this.osc("sine", f * 2, f * 2, 0.9 - i * 0.08, 0.07, i * 0.075)
    }
    this.osc("sine", root * 0.5, root * 0.5, 3.0, 0.30)
    this.noise(0.9, "highpass", 5200, 0.7, 0.09)
    this.noise(1.8, "lowpass", 900, 0.8, 0.08, 0.06)
  }

  /** A mote just converted from threat to food. Tiny, rate-limited, delicious. */
  flip(): void {
    if (!this.ctx) return
    const t = this.now
    if (t - this.lastFlip < 0.09) return
    this.lastFlip = t
    const f = 1400 + Math.random() * 900
    this.osc("sine", f, f * 1.5, 0.07, 0.035)
  }

  // -- the surge loop -------------------------------------------------------

  private surgeSrc: AudioBufferSourceNode | null = null
  private surgeGain: GainNode | null = null
  private surgeFilter: BiquadFilterNode | null = null

  surge(on: boolean, speed: number): void {
    const ctx = this.ctx
    if (!ctx) return
    if (on && !this.surgeSrc) {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuf
      src.loop = true
      const f = ctx.createBiquadFilter()
      f.type = "bandpass"
      f.frequency.value = 700
      f.Q.value = 1.1
      const g = ctx.createGain()
      g.gain.value = 0
      src.connect(f)
      f.connect(g)
      g.connect(this.sfxBus)
      g.connect(this.wetSend)
      src.start()
      this.surgeSrc = src
      this.surgeGain = g
      this.surgeFilter = f
    }
    if (this.surgeGain && this.surgeFilter) {
      const target = on ? 0.10 : 0
      this.surgeGain.gain.setTargetAtTime(target, this.now, 0.05)
      this.surgeFilter.frequency.setTargetAtTime(500 + Math.min(1, speed / 700) * 1500, this.now, 0.08)
    }
  }

  // -- the bed and the score ------------------------------------------------

  private startBed(): void {
    const ctx = this.ctx
    if (!ctx) return
    // Two detuned sub oscillators plus filtered noise: the sound of a lot of
    // very cold water in every direction.
    const g = ctx.createGain()
    g.gain.value = 0.16
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.frequency.value = 240
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06
    const lfoG = ctx.createGain()
    lfoG.gain.value = 90
    lfo.connect(lfoG)
    lfoG.connect(f.frequency)
    lfo.start()
    for (const d of [0, 0.6, -0.4]) {
      const o = ctx.createOscillator()
      o.type = "sine"
      o.frequency.value = this.root * 0.5 + d
      o.connect(f)
      o.start()
    }
    const n = ctx.createBufferSource()
    n.buffer = this.noiseBuf
    n.loop = true
    const nf = ctx.createBiquadFilter()
    nf.type = "bandpass"
    nf.frequency.value = 380
    nf.Q.value = 0.5
    const ng = ctx.createGain()
    ng.gain.value = 0.05
    n.connect(nf)
    nf.connect(ng)
    ng.connect(g)
    n.start()
    f.connect(g)
    g.connect(this.musicBus)
  }

  /**
   * The score: a slow arpeggio that gains voices and rhythm with intensity.
   * It never loops — the step pattern advances through a pentatonic set with a
   * drifting root, so a twenty-minute run never repeats a bar.
   */
  tick(dt: number): void {
    if (!this.ctx || !this.enabled) return
    this.musicTimer -= dt
    if (this.musicTimer > 0) return
    const beat = 0.62 - this.intensity * 0.22
    this.musicTimer = beat
    this.musicStep++

    const density = 0.18 + this.intensity * 0.55
    if (Math.random() > density) return
    const n = NOTES[(this.musicStep * 3 + ((Math.random() * 3) | 0)) % NOTES.length] as number
    const oct = 2 + ((this.musicStep >> 3) % 2)
    const f = this.root * Math.pow(2, oct + n / 12)
    const g = 0.045 + this.intensity * 0.03
    this.osc("triangle", f, f, 0.9 + Math.random() * 0.5, g, 0, this.musicBus)
    if (this.intensity > 0.45 && this.musicStep % 4 === 0) {
      this.osc("sine", this.root * 2, this.root * 2, 0.5, 0.05, 0, this.musicBus)
    }
    if (this.intensity > 0.75 && this.musicStep % 8 === 4) {
      this.osc("sine", this.root, this.root * 0.94, 1.2, 0.09, 0, this.musicBus)
    }
  }

  dispose(): void {
    try {
      this.surgeSrc?.stop()
    } catch {
      /* already stopped */
    }
    this.ctx?.close().catch((e: unknown) => console.warn("[arena] audio close failed", e))
    this.ctx = null
  }
}
