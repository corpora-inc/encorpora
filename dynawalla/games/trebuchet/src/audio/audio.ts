/**
 * Procedural audio. No assets, ever.
 *
 * Every impact is built in three layers — TRANSIENT (the click that tells your ear
 * where it happened), BODY (the pitched thump that gives it mass) and TAIL (the
 * valley answering back). Pitch and timing jitter on every call so a hundred shots
 * do not fatigue. Sound is a garnish: mute loses nothing but pleasure.
 */

type Ctx = AudioContext

const rand = (a: number, b: number): number => a + Math.random() * (b - a)

export class Audio {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private verb: ConvolverNode | null = null
  private send: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private flightOsc: OscillatorNode | null = null
  private flightGain: GainNode | null = null
  private flightFilt: BiquadFilterNode | null = null
  enabled = true

  /** Must be called from a user gesture. Safe to call repeatedly. */
  resume(): void {
    if (!this.ctx) {
      const AC: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      const c = this.ctx
      this.master = c.createGain()
      this.master.gain.value = 0.62
      const comp = c.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.knee.value = 22
      comp.ratio.value = 5
      comp.attack.value = 0.004
      comp.release.value = 0.16
      this.master.connect(comp)
      comp.connect(c.destination)

      // Generated impulse response: a stone valley. Synthesis, not an asset.
      const len = Math.floor(c.sampleRate * 1.7)
      const ir = c.createBuffer(2, len, c.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch)
        for (let i = 0; i < len; i++) {
          const t = i / len
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.1) * (1 - t * 0.2)
        }
      }
      this.verb = c.createConvolver()
      this.verb.buffer = ir
      this.send = c.createGain()
      this.send.gain.value = 0.34
      this.send.connect(this.verb)
      this.verb.connect(this.master)

      const nlen = Math.floor(c.sampleRate * 2)
      this.noiseBuf = c.createBuffer(1, nlen, c.sampleRate)
      const nd = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private get t(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  private ok(): boolean {
    return this.enabled && !!this.ctx && !!this.master
  }

  private noise(dur: number): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuf) return null
    const s = this.ctx.createBufferSource()
    s.buffer = this.noiseBuf
    s.loop = true
    s.start(this.t, rand(0, 1))
    s.stop(this.t + dur + 0.05)
    return s
  }

  private env(gain: GainNode, peak: number, attack: number, decay: number, at = this.t): void {
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
  }

  private toOut(node: AudioNode, sendAmt: number): void {
    if (!this.master || !this.send) return
    node.connect(this.master)
    if (sendAmt > 0) {
      const g = this.ctx!.createGain()
      g.gain.value = sendAmt
      node.connect(g)
      g.connect(this.send)
    }
  }

  /** Winch ratchet — one click per notch, pitch climbing with the dial. */
  tick(power01: number): void {
    if (!this.ok()) return
    const c = this.ctx!
    const src = this.noise(0.05)
    if (!src) return
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 900 + power01 * 1500 * rand(0.96, 1.04)
    bp.Q.value = 6
    const g = c.createGain()
    this.env(g, 0.16, 0.002, 0.04)
    src.connect(bp)
    bp.connect(g)
    this.toOut(g, 0.05)
  }

  /** The loft lever — a woodier, lower detent. */
  detent(): void {
    if (!this.ok()) return
    const c = this.ctx!
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(rand(300, 330), this.t)
    o.frequency.exponentialRampToValueAtTime(150, this.t + 0.06)
    const g = c.createGain()
    this.env(g, 0.12, 0.003, 0.07)
    o.connect(g)
    this.toOut(g, 0.1)
    o.start(this.t)
    o.stop(this.t + 0.14)
  }

  /** Counterweight drops, rope sings, arm whips. */
  launch(power01: number): void {
    if (!this.ok()) return
    const c = this.ctx!
    const t0 = this.t
    // body: the counterweight
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(rand(150, 168), t0)
    o.frequency.exponentialRampToValueAtTime(46, t0 + 0.3)
    const og = c.createGain()
    this.env(og, 0.55, 0.006, 0.34, t0)
    o.connect(og)
    this.toOut(og, 0.22)
    o.start(t0)
    o.stop(t0 + 0.5)
    // transient + rope whoosh
    const src = this.noise(0.42)
    if (src) {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 1.4
      bp.frequency.setValueAtTime(420, t0)
      bp.frequency.exponentialRampToValueAtTime(2600 + power01 * 1400, t0 + 0.26)
      const g = c.createGain()
      this.env(g, 0.3, 0.02, 0.3, t0)
      src.connect(bp)
      bp.connect(g)
      this.toOut(g, 0.3)
    }
  }

  /** Continuous flight whistle. Pitch tracks speed; volume tracks height. */
  flightStart(): void {
    if (!this.ok()) return
    const c = this.ctx!
    this.flightStop()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = 520
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 2200
    const g = c.createGain()
    g.gain.value = 0.0001
    o.connect(f)
    f.connect(g)
    this.toOut(g, 0.2)
    o.start()
    this.flightOsc = o
    this.flightGain = g
    this.flightFilt = f
  }

  flightUpdate(speed01: number, height01: number): void {
    if (!this.flightOsc || !this.flightGain || !this.ctx) return
    const t = this.t
    this.flightOsc.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.05)
    this.flightGain.gain.setTargetAtTime(0.03 + height01 * 0.075, t, 0.08)
    this.flightFilt?.frequency.setTargetAtTime(900 + speed01 * 2600, t, 0.08)
  }

  flightStop(): void {
    if (this.flightOsc && this.flightGain && this.ctx) {
      const t = this.t
      this.flightGain.gain.setTargetAtTime(0.0001, t, 0.03)
      const o = this.flightOsc
      try {
        o.stop(t + 0.2)
      } catch {
        /* already stopped */
      }
    }
    this.flightOsc = null
    this.flightGain = null
    this.flightFilt = null
  }

  /** Ground impact: dirt transient, low body, valley tail. `mass` 0..1 */
  impactDirt(mass: number): void {
    if (!this.ok()) return
    const c = this.ctx!
    const t0 = this.t
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(rand(96, 116), t0)
    o.frequency.exponentialRampToValueAtTime(34, t0 + 0.22)
    const og = c.createGain()
    this.env(og, 0.35 + mass * 0.4, 0.004, 0.3, t0)
    o.connect(og)
    this.toOut(og, 0.3)
    o.start(t0)
    o.stop(t0 + 0.5)
    const src = this.noise(0.3)
    if (src) {
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(2400, t0)
      lp.frequency.exponentialRampToValueAtTime(320, t0 + 0.24)
      const g = c.createGain()
      this.env(g, 0.28 + mass * 0.2, 0.003, 0.26, t0)
      src.connect(lp)
      lp.connect(g)
      this.toOut(g, 0.4)
    }
  }

  /** Stone impact: a crack on top of the dirt. */
  impactStone(mass: number): void {
    if (!this.ok()) return
    this.impactDirt(mass)
    const c = this.ctx!
    const t0 = this.t
    for (let i = 0; i < 3; i++) {
      const src = this.noise(0.14)
      if (!src) continue
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 2.2
      bp.frequency.value = rand(1400, 3600)
      const g = c.createGain()
      this.env(g, 0.2, 0.001, 0.1, t0 + i * rand(0.005, 0.03))
      src.connect(bp)
      bp.connect(g)
      this.toOut(g, 0.35)
    }
  }

  /** A tower coming apart — staggered crunches over ~700 ms. */
  collapse(): void {
    if (!this.ok()) return
    const c = this.ctx!
    const t0 = this.t
    for (let i = 0; i < 7; i++) {
      const at = t0 + i * rand(0.04, 0.12)
      const src = this.noise(0.3)
      if (!src) continue
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = rand(500, 1800)
      const g = c.createGain()
      this.env(g, rand(0.1, 0.26), 0.004, rand(0.12, 0.34), at)
      src.connect(lp)
      lp.connect(g)
      this.toOut(g, 0.45)
    }
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(60, t0)
    o.frequency.exponentialRampToValueAtTime(26, t0 + 0.9)
    const og = c.createGain()
    this.env(og, 0.5, 0.02, 0.9, t0)
    o.connect(og)
    this.toOut(og, 0.2)
    o.start(t0)
    o.stop(t0 + 1.1)
  }

  /** The reward. Rises a step per chain link, then rolls over — never a slot machine. */
  fanfare(chain: number): void {
    if (!this.ok()) return
    const c = this.ctx!
    const pent = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]
    const base = 392 * Math.pow(2, Math.min(chain, 8) / 12)
    const t0 = this.t
    for (let i = 0; i < 5; i++) {
      const o = c.createOscillator()
      o.type = i % 2 === 0 ? 'triangle' : 'sine'
      o.frequency.value = base * Math.pow(2, pent[i] / 12) * rand(0.997, 1.003)
      const g = c.createGain()
      this.env(g, 0.14, 0.006, 0.34, t0 + i * 0.055)
      o.connect(g)
      this.toOut(g, 0.5)
      o.start(t0 + i * 0.055)
      o.stop(t0 + i * 0.055 + 0.5)
    }
  }

  /** Struck the wrong keep: a horn, sour but not a buzzer. Never a punishment noise. */
  wrongHorn(): void {
    if (!this.ok()) return
    const c = this.ctx!
    const t0 = this.t
    for (const [f, det] of [
      [174, 1],
      [184, 1.004],
    ] as Array<[number, number]>) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f * det
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(1400, t0)
      lp.frequency.exponentialRampToValueAtTime(340, t0 + 0.7)
      const g = c.createGain()
      this.env(g, 0.16, 0.05, 0.6, t0)
      o.connect(lp)
      lp.connect(g)
      this.toOut(g, 0.4)
      o.start(t0)
      o.stop(t0 + 0.9)
    }
  }

  /** Incoming counter-fire. Doppler down, then a hit on your platform. */
  incoming(delay: number): void {
    if (!this.ok()) return
    const c = this.ctx!
    const t0 = this.t
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(1500, t0)
    o.frequency.exponentialRampToValueAtTime(260, t0 + delay)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.1, t0 + delay * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay)
    o.connect(g)
    this.toOut(g, 0.3)
    o.start(t0)
    o.stop(t0 + delay + 0.1)
  }

  /** Wave horn — low, ceremonial, once per wave. */
  horn(up: boolean): void {
    if (!this.ok()) return
    const c = this.ctx!
    const t0 = this.t
    for (const mult of [1, 1.5, 2.02]) {
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(110 * mult, t0)
      o.frequency.linearRampToValueAtTime(110 * mult * (up ? 1.06 : 0.94), t0 + 0.8)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 900
      const g = c.createGain()
      this.env(g, 0.1, 0.14, 0.8, t0)
      o.connect(lp)
      lp.connect(g)
      this.toOut(g, 0.6)
      o.start(t0)
      o.stop(t0 + 1.2)
    }
  }

  dispose(): void {
    this.flightStop()
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
  }
}
