/**
 * Procedural Web Audio. No assets, nothing to download, nothing to decode.
 *
 * Every sound is built from the same three parts so the palette hangs together:
 *
 *   TRANSIENT — a 4-8 ms filtered noise click that gives the ear an attack
 *   BODY      — one or two tuned oscillators with a pitch envelope
 *   TAIL      — a quieter detuned partial that decays slower than the body
 *
 * Pitch is drawn from a pentatonic set and jittered by a few cents on every
 * hit, which is the difference between a sound you can hear four hundred times
 * in a session and one that starts to grate at minute three.
 *
 * Audio never carries information on its own — every event it marks is also a
 * visible change on screen — and the whole thing can be switched off.
 */

import { createSafetyBus, safeAttack } from "../../../../packs/shared/game-audio/index.ts"

const PENTATONIC = [0, 2, 4, 7, 9] // major pentatonic degrees, in semitones

function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12)
}

/** Degree `n` of an endlessly ascending pentatonic, as a MIDI note. */
export function pentatonic(n: number, root = 57): number {
  const oct = Math.floor(n / PENTATONIC.length)
  const deg = ((n % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length
  return root + oct * 12 + (PENTATONIC[deg] ?? 0)
}

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private started = false
  enabled = true
  /** Master volume, 0..1. */
  volume = 0.62

  /** Must be called from a user gesture on iOS. Safe to call repeatedly. */
  resume(): void {
    if (!this.enabled) return
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) {
        console.warn('[abyssal-bloom] no Web Audio in this browser; running silent')
        this.enabled = false
        return
      }
      try {
        this.ctx = new Ctor()
      } catch (e) {
        console.warn('[abyssal-bloom] AudioContext construction failed; running silent', e)
        this.enabled = false
        return
      }
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      // The last thing between this game and a child's ears. Everything the
      // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
      // going straight to the output. See packs/shared/game-audio/.
      const safety = createSafetyBus(this.ctx)
      this.master.connect(safety.input)
      this.noise = this.makeNoise()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch((e) => console.warn('[abyssal-bloom] audio resume rejected', e))
    }
    this.started = true
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master) this.master.gain.value = this.volume
  }

  close(): void {
    try {
      this.ctx?.close()
    } catch (e) {
      console.warn('[abyssal-bloom] audio close failed', e)
    }
    this.ctx = null
    this.master = null
    this.started = false
  }

  private makeNoise(): AudioBuffer | null {
    const ctx = this.ctx
    if (!ctx) return null
    const len = Math.floor(ctx.sampleRate * 0.4)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let s = 1
    for (let i = 0; i < len; i++) {
      s = (s * 16807) % 2147483647
      d[i] = (s / 1073741823.5 - 1) * (1 - i / len) ** 1.4
    }
    return buf
  }

  private get ok(): boolean {
    return this.enabled && this.started && !!this.ctx && !!this.master
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0
  }

  /** Filtered noise burst — the attack transient. */
  private transient(gain: number, freq: number, dur = 0.05, q = 1.1): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noise) return
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = q
    const g = ctx.createGain()
    const t = this.now()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp)
    bp.connect(g)
    g.connect(master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  /** Tuned partial with a pitch envelope. */
  private tone(
    type: OscillatorType,
    hz: number,
    gain: number,
    dur: number,
    opts: { bendTo?: number; delay?: number; attack?: number } = {},
  ): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    const t = this.now() + (opts.delay ?? 0)
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(hz, t)
    if (opts.bendTo !== undefined) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.bendTo), t + dur * 0.85)
    }
    const g = ctx.createGain()
    // The shared floor on onset time. Some cues here asked for 0.002 s —
    // 88 samples from silence to peak, which is a step function with a click
    // on it, and the click is most of what a child hears as "too loud".
    const atk = safeAttack(opts.attack ?? 0.006)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + atk)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + dur + 0.03)
  }

  private jitter(): number {
    // +-9 cents. Enough that repeats never phase-lock, small enough to stay in tune.
    return 2 ** ((Math.random() * 18 - 9) / 1200)
  }

  /* ------------------------------------------------------------- the palette */

  /** Lifting a polyp off the shelf. */
  pick(): void {
    if (!this.ok) return
    this.transient(0.1, 2600, 0.03, 1.6)
    this.tone('sine', 780 * this.jitter(), 0.05, 0.07)
  }

  /** Setting one down in an empty cell. */
  drop(): void {
    if (!this.ok) return
    this.transient(0.09, 900, 0.05, 0.9)
    this.tone('sine', 240 * this.jitter(), 0.07, 0.12, { bendTo: 170 })
  }

  /** A merge. Pitch climbs the ladder, so a chain of merges is a rising figure. */
  merge(rung: number, chain = 0): void {
    if (!this.ok) return
    const j = this.jitter()
    const note = pentatonic(rung + chain * 2, 57)
    const hz = midiToHz(note) * j
    this.transient(0.16, 1500 + rung * 90, 0.035, 1.4)
    this.tone('triangle', hz, 0.2, 0.2 + rung * 0.006)
    this.tone('sine', hz * 2, 0.09, 0.16, { delay: 0.012 })
    this.tone('sine', hz * 0.5, 0.11, 0.34, { delay: 0.004 })
  }

  /** A vent eruption — the reward for a correct assay. The biggest sound here. */
  erupt(tier: number): void {
    if (!this.ok) return
    const j = this.jitter()
    this.transient(0.34, 420, 0.3, 0.5)
    this.transient(0.2, 2400, 0.12, 0.8)
    this.tone('sawtooth', 70 * j, 0.16, 0.5, { bendTo: 230 })
    const base = 3 + Math.min(10, tier)
    for (let i = 0; i < 5; i++) {
      this.tone('triangle', midiToHz(pentatonic(base + i * 2, 57)) * j, 0.13, 0.42, {
        delay: 0.045 * i,
      })
    }
    this.tone('sine', midiToHz(pentatonic(base + 12, 57)) * j, 0.09, 0.9, { delay: 0.24 })
  }

  /** A choke — a wrong polyp fed to a vent. Dull and downward. Never a buzzer. */
  choke(): void {
    if (!this.ok) return
    this.transient(0.2, 200, 0.18, 0.4)
    this.tone('sawtooth', 148, 0.1, 0.26, { bendTo: 66 })
    this.tone('sine', 99, 0.08, 0.34, { bendTo: 52, delay: 0.03 })
  }

  /** A vent coughing out a new polyp. Tiny, frequent, must never tire the ear. */
  emit(): void {
    if (!this.ok) return
    this.tone('sine', (520 + Math.random() * 260) * this.jitter(), 0.045, 0.09, { bendTo: 900 })
  }

  /** Collecting a tide. Shimmering, generous. */
  tide(): void {
    if (!this.ok) return
    const j = this.jitter()
    this.transient(0.18, 3200, 0.22, 0.7)
    for (let i = 0; i < 9; i++) {
      this.tone('sine', midiToHz(pentatonic(6 + i, 57)) * j, 0.095, 0.5, { delay: 0.05 * i })
    }
  }

  /** Crossing a power of ten. The single loudest moment in the game. */
  magnitude(order: number): void {
    if (!this.ok) return
    const j = this.jitter()
    this.transient(0.3, 5200, 0.4, 0.6)
    this.tone('sawtooth', 55 * j, 0.14, 1.1, { bendTo: 220 })
    const root = 57 + Math.min(12, order)
    for (let i = 0; i < 12; i++) {
      this.tone('triangle', midiToHz(pentatonic(i, root)) * j, 0.1, 0.75, { delay: 0.035 * i })
    }
  }

  /** The shelf has crowded. A low pulse, felt more than heard. */
  crowd(): void {
    if (!this.ok) return
    this.tone('sine', 82, 0.13, 0.7, { bendTo: 62, attack: 0.14 })
    this.tone('sine', 123, 0.05, 0.6, { attack: 0.2 })
  }

  /** Dissolving a polyp back to essence. */
  cull(): void {
    if (!this.ok) return
    this.transient(0.12, 1600, 0.09, 1.2)
    this.tone('sine', 620, 0.07, 0.22, { bendTo: 190 })
  }

  /** A UI press. */
  tick(): void {
    if (!this.ok) return
    this.transient(0.08, 3000, 0.022, 2)
  }
}
