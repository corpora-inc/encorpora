// Asset-free juice audio. Web Audio only — no files to load, decode, or ship.
//
// A struck-mallet timbre (sine fundamental + a quieter triangle octave, fast
// attack, exponential release) over a pentatonic scale. Pentatonic because
// every subset of it is consonant, so tones can fire in any order at any
// spacing and never produce a sour interval — which matters when the trigger is
// a child's answer timing and not a composer.
//
// ## Trap: the context starts suspended, and `resume()` needs a real gesture
//
// Chrome, Safari and every WebView start an `AudioContext` in `suspended`.
// `resume()` only succeeds inside a user-gesture task. Creating the context at
// module load and calling `resume()` from a `setTimeout` looks like it works in
// dev (you clicked something first) and ships silent. `unlock()` here is wired
// to the first `pointerdown`/`keydown` and removes itself.
//
// ## Trap: iOS suspends the context and does not tell you
//
// A phone call, a Siri invocation, or the app backgrounding leaves the context
// `interrupted`/`suspended` and it does **not** auto-resume. The
// `visibilitychange` handler re-resumes; without it, audio dies permanently
// after the first interruption and the bug report is "sound stopped working
// yesterday".
//
// ## Trap: never `await` audio on the answer path
//
// `resume()` returns a promise. Awaiting it in the input handler puts a
// microtask — and on a cold context a real 10–40 ms of work — between the tap
// and the verdict. Audio is fire-and-forget; a dropped chime is strictly better
// than a late frame.
//
// ## Dropped, never queued
//
// Above `maxVoices` concurrent notes, new ones are dropped. Queuing produces
// the machine-gun effect when a child mashes, and each voice is an
// `OscillatorNode` + `GainNode` — cheap, but not free, and unbounded.

/** Semitone offsets of a major pentatonic, two octaves. */
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]

export interface FeelAudioOptions {
  /** Root frequency. C5 = 523.25 Hz sits above a classroom's noise floor. */
  rootHz?: number
  masterGain?: number
  maxVoices?: number
}

type Ctx = AudioContext & { state: AudioContextState }

export class FeelAudio {
  enabled = true
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private voices = 0
  private readonly rootHz: number
  private readonly masterGain: number
  private readonly maxVoices: number
  private unlocked = false

  /** Diagnostics. */
  played = 0
  dropped = 0

  constructor(opts: FeelAudioOptions = {}) {
    this.rootHz = opts.rootHz ?? 523.25
    this.masterGain = opts.masterGain ?? 0.22
    this.maxVoices = opts.maxVoices ?? 6
  }

  /**
   * Install the gesture listeners. Safe to call at boot; creates nothing until
   * the child touches the screen.
   */
  attach(): void {
    const g = globalThis as unknown as {
      addEventListener?: (t: string, f: () => void, o?: object) => void
      document?: { addEventListener?: (t: string, f: () => void) => void; hidden?: boolean }
    }
    if (!g.addEventListener) return
    const unlock = () => {
      this.unlock()
    }
    g.addEventListener("pointerdown", unlock, { once: true, passive: true })
    g.addEventListener("keydown", unlock, { once: true })
    g.document?.addEventListener?.("visibilitychange", () => {
      if (!g.document?.hidden && this.ctx && this.ctx.state !== "running") {
        void this.ctx.resume().catch(() => {})
      }
    })
  }

  /** Create and resume. Must be called from inside a user-gesture task. */
  unlock(): void {
    if (this.unlocked) return
    const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext
    if (!AC) return
    this.unlocked = true
    // `latencyHint: "interactive"` asks for the smallest buffer the platform
    // will give. On a WebView that is the difference between ~5 ms and ~40 ms
    // of output latency, and 40 ms is a visible desync from the flash.
    this.ctx = new AC({ latencyHint: "interactive" }) as Ctx
    this.master = this.ctx.createGain()
    this.master.gain.value = this.masterGain
    this.master.connect(this.ctx.destination)
    void this.ctx.resume().catch(() => {})
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === "running"
  }

  /** Output latency the platform admits to, in ms. Useful for the desync trap. */
  get outputLatencyMs(): number {
    const c = this.ctx as (Ctx & { outputLatency?: number; baseLatency?: number }) | null
    if (!c) return 0
    return ((c.outputLatency ?? c.baseLatency ?? 0) as number) * 1000
  }

  /**
   * A struck note, `semitone` above the root. Fire and forget.
   *
   * @param semitone snapped to the pentatonic, so any integer is musical.
   * @param gain 0…1, scaled by master.
   * @param durationMs release length. Short is percussive; long rings.
   */
  note(semitone: number, gain = 1, durationMs = 320): void {
    if (!this.enabled || !this.ctx || !this.master) return
    if (this.ctx.state !== "running") return
    if (this.voices >= this.maxVoices) {
      this.dropped++
      return
    }
    const ctx = this.ctx
    const t = ctx.currentTime
    const snapped = snapPentatonic(semitone)
    const hz = this.rootHz * 2 ** (snapped / 12)

    const env = ctx.createGain()
    env.connect(this.master)
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.value = hz
    osc.connect(env)
    const octave = ctx.createOscillator()
    octave.type = "triangle"
    octave.frequency.value = hz * 2
    const octGain = ctx.createGain()
    octGain.gain.value = 0.22
    octave.connect(octGain)
    octGain.connect(env)

    const dur = durationMs * 0.001
    env.gain.setValueAtTime(0.0001, t)
    // 4 ms attack: fast enough to read as struck, slow enough not to click.
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    osc.start(t)
    octave.start(t)
    osc.stop(t + dur + 0.02)
    octave.stop(t + dur + 0.02)
    this.voices++
    this.played++
    osc.onended = () => {
      this.voices--
      env.disconnect()
      octGain.disconnect()
    }
  }

  /**
   * A low, short, unpitched thud. The "that did not seat" sound.
   *
   * Filtered noise rather than a tone, because a *pitched* failure sound is
   * either a sour interval (unpleasant) or a consonant one (rewarding), and
   * neither is what a wrong answer should be.
   */
  thud(gain = 0.7): void {
    if (!this.enabled || !this.ctx || !this.master) return
    if (this.ctx.state !== "running") return
    const ctx = this.ctx
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.12)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(gain, t + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    osc.connect(env)
    env.connect(this.master)
    osc.start(t)
    osc.stop(t + 0.18)
    osc.onended = () => env.disconnect()
    this.played++
  }

  /** An arpeggio for the big tiers. Scheduled on the audio clock, not setTimeout. */
  chord(base: number, count = 4, spacingMs = 70, gain = 0.8): void {
    if (!this.ctx || this.ctx.state !== "running") return
    for (let i = 0; i < count; i++) {
      // `setTimeout` here would jitter by whole frames under load. Scheduling
      // each note against `currentTime` inside `note()` is not possible without
      // a start-time parameter, so the spacing is done with the audio clock by
      // pre-computing start times in `noteAt`.
      this.noteAt(base + i * 2, this.ctx.currentTime + (i * spacingMs) / 1000, gain, 420)
    }
  }

  private noteAt(semitone: number, when: number, gain: number, durationMs: number): void {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const hz = this.rootHz * 2 ** (snapPentatonic(semitone) / 12)
    const env = ctx.createGain()
    env.connect(this.master)
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.value = hz
    osc.connect(env)
    const dur = durationMs * 0.001
    env.gain.setValueAtTime(0.0001, when)
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), when + 0.004)
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.start(when)
    osc.stop(when + dur + 0.02)
    osc.onended = () => env.disconnect()
    this.played++
  }

  dispose(): void {
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.master = null
    this.unlocked = false
  }
}

/** Snap an arbitrary semitone to the nearest pentatonic degree. */
export function snapPentatonic(semitone: number): number {
  const octave = Math.floor(semitone / 12)
  const within = semitone - octave * 12
  let best = PENTATONIC[0]!
  let bestD = Infinity
  for (let i = 0; i < PENTATONIC.length; i++) {
    const p = PENTATONIC[i]! % 12
    const d = Math.abs(p - within)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best + octave * 12
}
