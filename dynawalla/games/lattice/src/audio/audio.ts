// Asset-free Web Audio. No files, no decode, nothing on the answer path.
//
// The timbre is the one the experience design specifies: a struck felt mallet —
// a sine with a 0.22-gain triangle an octave up — over a C5–C6 pentatonic. The
// arena's own sounds are made of the same material: a split is a stone chip, a
// prime is a struck bell that will not break, a resonance is the pentatonic
// running up.
//
// **Nothing here is queued.** A note that arrives while the context is busy is
// dropped, never stacked, because a hundred husks coming apart in a second is a
// real thing a child can do and a queue would turn it into a smear.

/** C5–C6 pentatonic, in Hz. The whole melodic vocabulary. */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]

/** The most voices that may sound at once. Over this, the note is dropped. */
const MAX_VOICES = 10

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private voices = 0
  private failed = false

  /** Called from a user gesture; a context created before one stays suspended. */
  resume(): void {
    const ctx = this.context()
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch((error: unknown) => {
        console.warn("[lattice] the audio context refused to resume", error)
      })
    }
  }

  private context(): AudioContext | null {
    if (this.ctx || this.failed) return this.ctx
    try {
      const Ctor =
        globalThis.AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) {
        this.failed = true
        console.warn("[lattice] this runtime has no AudioContext; the arena is silent")
        return null
      }
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
    } catch (error) {
      this.failed = true
      console.warn("[lattice] the audio context could not be created", error)
    }
    return this.ctx
  }

  /** One struck note. `when` is an offset in seconds from now. */
  private strike(freq: number, gain: number, ms: number, when = 0, kind: OscillatorType = "sine"): void {
    const ctx = this.context()
    const master = this.master
    if (!ctx || !master) return
    if (this.voices >= MAX_VOICES) return
    this.voices += 1

    const t = ctx.currentTime + when
    const env = ctx.createGain()
    env.connect(master)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)

    const osc = ctx.createOscillator()
    osc.type = kind
    osc.frequency.setValueAtTime(freq, t)
    osc.connect(env)
    osc.start(t)
    osc.stop(t + ms / 1000 + 0.02)

    // The felt: a triangle an octave up at a fifth of the gain gives the mallet
    // its thud without adding a second pitch a child would hear as a chord.
    const felt = ctx.createOscillator()
    felt.type = "triangle"
    felt.frequency.setValueAtTime(freq * 2, t)
    const feltGain = ctx.createGain()
    feltGain.gain.setValueAtTime(0.22, t)
    felt.connect(feltGain)
    feltGain.connect(env)
    felt.start(t)
    felt.stop(t + ms / 1000 + 0.02)

    osc.onended = () => {
      this.voices = Math.max(0, this.voices - 1)
      try {
        env.disconnect()
      } catch {
        // A node disconnected twice is not worth a line in a child's console.
      }
    }
  }

  /** A stone chip. Pitched by how far down the tree the split went. */
  split(depth: number): void {
    const i = Math.min(PENTATONIC.length - 1, Math.max(0, depth))
    this.strike((PENTATONIC[i] as number) * 0.5, 0.16, 130, 0, "square")
  }

  /** A prime refusing a shot: a bell that will not break. */
  wall(): void {
    this.strike(1318.5, 0.09, 220, 0, "sine")
  }

  /** A mote swept: one step up the pentatonic per tile held. */
  sweep(tiles: number): void {
    const i = Math.min(PENTATONIC.length - 1, Math.max(0, tiles - 1))
    this.strike(PENTATONIC[i] as number, 0.13, 180)
  }

  /** The trigger. Quiet by design — it fires many times a second. */
  shot(): void {
    this.strike(196, 0.03, 45, 0, "square")
  }

  /** A resonator opening: the pentatonic run, one note per prime it took. */
  open(tiles: number): void {
    const n = Math.max(2, Math.min(PENTATONIC.length, tiles))
    for (let i = 0; i < n; i++) {
      this.strike(PENTATONIC[i] as number, 0.17, 420, i * 0.055)
    }
  }

  /** A refusal. Lower, shorter, and quieter than a resonance — never a buzzer. */
  refuse(): void {
    this.strike(233.08, 0.1, 190, 0, "triangle")
  }

  /** A jostle: a mote knocked loose. */
  jostle(): void {
    this.strike(155.56, 0.11, 160, 0, "triangle")
  }

  dispose(): void {
    const ctx = this.ctx
    this.ctx = null
    this.master = null
    if (!ctx) return
    void ctx.close().catch((error: unknown) => {
      console.warn("[lattice] the audio context did not close", error)
    })
  }
}
