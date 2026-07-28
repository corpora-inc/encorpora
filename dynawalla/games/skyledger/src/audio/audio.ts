// The observatory's sound, synthesised. No assets, no decode, nothing on the
// answer path — a `AudioContext` and a handful of oscillators.
//
// The timbre is the house one: a struck felt mallet, a sine with a quiet
// triangle an octave up, over a C5–C6 pentatonic. Brass rings click; a
// measurement that lands rings a bell that climbs with the chain; a mark that
// goes wide makes almost no sound at all, because restraint is the whole
// vocabulary for being wrong.
//
// **The chain's pitch is the score.** A child hears where they are in a chain
// before they can read it, which is what makes a nine-link run feel like it is
// going somewhere while it is still happening.

/** C5 pentatonic, then the same five an octave up. */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0]

export class Audio {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private failed = false

  /** Lazily built on the first sound, which is always inside a gesture. */
  private wake(): AudioContext | null {
    if (this.failed) return null
    if (!this.ctx) {
      type Win = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
      const w = globalThis as unknown as Win
      const Ctor = w.AudioContext ?? w.webkitAudioContext
      if (!Ctor) {
        this.failed = true
        console.warn("[skyledger] no AudioContext; the observatory will be silent")
        return null
      }
      try {
        this.ctx = new Ctor()
        this.bus = this.ctx.createGain()
        this.bus.gain.value = 0.5
        this.bus.connect(this.ctx.destination)
      } catch (error) {
        this.failed = true
        console.warn("[skyledger] the AudioContext refused to start", error)
        return null
      }
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {
        // A context that will not resume without a gesture is not an error a
        // child should hear about; the next tap will bring it back.
      })
    }
    return this.ctx
  }

  /** One struck note. `gain` is peak; `ms` the whole decay. */
  private strike(freq: number, gain: number, ms: number, type: OscillatorType = "sine"): void {
    const ctx = this.wake()
    const bus = this.bus
    if (!ctx || !bus) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(gain, t + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
    osc.connect(env)
    env.connect(bus)
    osc.start(t)
    osc.stop(t + ms / 1000 + 0.02)

    // The felt: a quiet triangle an octave up, gone before the fundamental is.
    const top = ctx.createOscillator()
    const topEnv = ctx.createGain()
    top.type = "triangle"
    top.frequency.setValueAtTime(freq * 2, t)
    topEnv.gain.setValueAtTime(0, t)
    topEnv.gain.linearRampToValueAtTime(gain * 0.22, t + 0.004)
    topEnv.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(ms, 180) / 1000)
    top.connect(topEnv)
    topEnv.connect(bus)
    top.start(t)
    top.stop(t + ms / 1000 + 0.02)
  }

  /** A ring seats in a detent. The smallest sound in the game. */
  detent(digit: number): void {
    this.strike(1400 + digit * 34, 0.045, 42, "square")
  }

  /** A measurement lands. The pitch climbs with the chain. */
  bloom(link: number): void {
    const note = SCALE[Math.min(SCALE.length - 1, link - 1)] ?? SCALE[0] ?? 523.25
    this.strike(note, 0.3, 520)
    this.strike(note * 1.5, 0.09, 320)
  }

  /**
   * A mark that went wide.
   *
   * Quieter and shorter than any success, deliberately. Being wrong must never
   * be the more interesting outcome.
   */
  wide(): void {
    this.strike(196, 0.07, 130, "triangle")
  }

  /** The astrolabe has nothing left to spend. */
  refuse(): void {
    this.strike(140, 0.05, 90, "square")
  }

  /** The snap-back. A chord that opens rather than a hit. */
  release(links: number): void {
    // Matching the scene: one link is a seat and already rang once.
    if (links < 2) return
    const ctx = this.wake()
    if (!ctx) return
    const root = SCALE[0] ?? 523.25
    const voices = [1, 1.5, 2, 3].slice(0, Math.max(2, Math.min(4, Math.ceil(links / 3) + 1)))
    voices.forEach((ratio, i) => {
      setTimeout(() => this.strike(root * ratio, 0.16, 1100), i * 55)
    })
  }

  /** A star reached the horizon and a lamp went out. Low, dry, brief. */
  snuff(): void {
    this.strike(98, 0.16, 380, "triangle")
  }

  close(): void {
    const ctx = this.ctx
    this.ctx = null
    this.bus = null
    if (!ctx) return
    void ctx.close().catch(() => {
      // A context that was already gone is not worth a line in the log.
    })
  }
}
