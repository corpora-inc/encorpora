// Procedural audio. No files, no samples, nothing to download.
//
// Every hit is built in three layers, the way a real impact is:
//   TRANSIENT — 3-8 ms of filtered noise. This is what your ear reads as
//               "something hard hit something hard". Remove it and the same
//               sound turns to cardboard.
//   BODY      — the object ringing. A struck steel bar is INHARMONIC: its
//               partials sit near 1 : 2.76 : 5.40 : 8.93, not 1 : 2 : 3. That
//               ratio is why this reads as metal and not as a xylophone.
//   TAIL      — the room. Bandpassed noise with a long decay and a slow
//               downward sweep, so the forge sounds like a big space.
//
// Pitch moves with the combo up a minor pentatonic, so twenty hits in a row is
// a melodic line rather than twenty identical clicks. Every sound also gets a
// few cents of random detune: identical repeats are what makes game audio
// fatiguing, and children hear far more repetitions than adults do.
//
// Nothing here ever carries information on its own — audio is always a
// duplicate of something visible.

import { createSafetyBus, safeAttack } from "../../../../packs/shared/game-audio/index.ts"

type Ctx = AudioContext

const PENTATONIC = [1, 9 / 8, 6 / 5, 3 / 2, 5 / 3, 2, 9 / 4, 12 / 5] as const
const BAR_MODES = [1, 2.76, 5.4, 8.93] as const

export type Audio = {
  enabled(): boolean
  setEnabled(on: boolean): void
  resume(): void
  strike(combo: number): void
  shatter(): void
  buy(step: number): void
  magnitude(n: number): void
  unlock(): void
  perfect(): void
  quench(): void
  reignite(): void
  claim(): void
  blip(): void
  /** Forge bed volume, 0..1. Tracks heat. */
  setRoar(level: number): void
  dispose(): void
}

export function makeAudio(): Audio {
  let ctx: Ctx | null = null
  let master: GainNode | null = null
  let roarGain: GainNode | null = null
  let roarSrc: AudioBufferSourceNode | null = null
  let noise: AudioBuffer | null = null
  let on = true
  let disposed = false

  function ensure(): Ctx | null {
    if (disposed || !on) return null
    if (ctx) return ctx
    const AC: typeof AudioContext | undefined =
      typeof AudioContext !== "undefined"
        ? AudioContext
        : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()

    // A limiter, not a compressor for taste: forty overlapping particles' worth
    // of impacts must never clip a tablet speaker into distortion.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.knee.value = 6
    comp.ratio.value = 12
    comp.attack.value = 0.002
    comp.release.value = 0.12

    master = ctx.createGain()
    // 0.50, not 0.85. At 0.85 a single ordinary cue rendered above full
    // scale — `unlock()` peaked at 1.220 with 74 clipped samples, `perfect()`
    // at 1.101, `shatter()` at 1.034 — so this pack was clipping on its own,
    // one hit at a time, before anything overlapped. The shared ceiling would
    // hold it, but only by saturating on every single sound; that is a game
    // permanently squashed rather than a game with headroom. The loudest cue
    // now lands near 0.72 against a 0.89 ceiling.
    master.gain.value = 0.5
    master.connect(comp)
    // The last thing between this game and a child's ears. Everything the
    // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
    // going straight to the output. See packs/shared/game-audio/.
    const safety = createSafetyBus(ctx)
    comp.connect(safety.input)

    // 2 s of noise, generated once and reused by every transient and tail.
    const len = ctx.sampleRate * 2
    noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noise.getChannelData(0)
    let brown = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      brown = (brown + 0.02 * w) / 1.02
      // Mix white and brown so one buffer serves both bright cracks and the bed.
      d[i] = w * 0.6 + brown * 3.2
    }

    // The forge bed: brown-ish noise, heavily filtered, looping forever.
    roarGain = ctx.createGain()
    roarGain.gain.value = 0
    const lp = ctx.createBiquadFilter()
    lp.type = "lowpass"
    lp.frequency.value = 220
    lp.Q.value = 0.7
    roarSrc = ctx.createBufferSource()
    roarSrc.buffer = noise
    roarSrc.loop = true
    roarSrc.connect(lp)
    lp.connect(roarGain)
    roarGain.connect(master)
    roarSrc.start()

    return ctx
  }

  function env(g: GainNode, t: number, peak: number, attackIn: number, decay: number): void {
  // The shared floor on onset time. Some cues here asked for 0.002 s —
  // 88 samples from silence to peak, which is a step function with a click
  // on it, and the click is most of what a child hears as "too loud".
    const attack = safeAttack(attackIn)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  function tone(
    c: Ctx,
    t: number,
    freq: number,
    peak: number,
    attack: number,
    decay: number,
    type: OscillatorType = "sine",
    bendTo?: number,
  ): void {
    const o = c.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (bendTo !== undefined) o.frequency.exponentialRampToValueAtTime(bendTo, t + attack + decay)
    const g = c.createGain()
    env(g, t, peak, attack, decay)
    o.connect(g)
    g.connect(master as GainNode)
    o.start(t)
    o.stop(t + attack + decay + 0.05)
  }

  function burst(
    c: Ctx,
    t: number,
    peak: number,
    decay: number,
    filter: BiquadFilterType,
    freq: number,
    q: number,
    sweepTo?: number,
  ): void {
    const s = c.createBufferSource()
    s.buffer = noise
    s.playbackRate.value = 0.85 + Math.random() * 0.3
    const f = c.createBiquadFilter()
    f.type = filter
    f.frequency.setValueAtTime(freq, t)
    f.Q.value = q
    if (sweepTo !== undefined) f.frequency.exponentialRampToValueAtTime(sweepTo, t + decay)
    const g = c.createGain()
    env(g, t, peak, 0.002, decay)
    s.connect(f)
    f.connect(g)
    g.connect(master as GainNode)
    s.start(t, Math.random() * 1.2)
    s.stop(t + decay + 0.05)
  }

  const cents = (n: number): number => Math.pow(2, n / 1200)

  return {
    enabled: () => on,
    setEnabled(next) {
      on = next
      if (!next && ctx) {
        void ctx.suspend()
      } else if (next && ctx) {
        void ctx.resume()
      }
    },
    resume() {
      const c = ensure()
      if (c && c.state === "suspended") void c.resume()
    },

    strike(combo) {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      const step = PENTATONIC[Math.min(combo, PENTATONIC.length - 1)]
      const root = 196 * step * cents(Math.random() * 24 - 12)

      // transient: the hammer face
      burst(c, t, 0.5, 0.03, "highpass", 2400, 0.7)
      // body: an inharmonic bar, brightest partial first so the attack sparkles
      for (let i = 0; i < BAR_MODES.length; i++) {
        const f = root * BAR_MODES[i]
        if (f > 12000) continue
        tone(c, t, f, 0.3 / (i + 1.4), 0.004, 0.36 + i * 0.1, i === 0 ? "triangle" : "sine")
      }
      // tail: the shop
      burst(c, t + 0.01, 0.1, 0.5, "bandpass", 1600 + combo * 90, 1.2, 700)
      // sub thump so it lands in the chest on a tablet
      tone(c, t, 78, 0.42, 0.004, 0.16, "sine", 44)
    },

    shatter() {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      burst(c, t, 0.55, 0.28, "bandpass", 900, 0.6, 180)
      tone(c, t, 150, 0.4, 0.005, 0.3, "sawtooth", 52)
      tone(c, t + 0.02, 96, 0.3, 0.006, 0.42, "square", 40)
      burst(c, t + 0.05, 0.2, 0.4, "highpass", 3000, 0.5, 900)
    },

    buy(step) {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      const f = 300 * Math.pow(2, Math.min(step, 24) / 24)
      burst(c, t, 0.22, 0.02, "highpass", 3600, 0.6)
      tone(c, t, f, 0.2, 0.003, 0.1, "square")
      tone(c, t, f / 2.02, 0.24, 0.004, 0.16, "triangle")
      tone(c, t, 62, 0.3, 0.004, 0.12, "sine", 38)
    },

    magnitude(n) {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      // A rising arpeggio whose top note climbs with the exponent: crossing
      // 10^9 is audibly higher than crossing 10^4.
      const root = 160 * Math.pow(2, Math.min(n, 18) / 12)
      for (let i = 0; i < 5; i++) {
        tone(c, t + i * 0.045, root * PENTATONIC[i], 0.24, 0.004, 0.34, "triangle")
        tone(c, t + i * 0.045, root * PENTATONIC[i] * 2.01, 0.09, 0.004, 0.22, "sine")
      }
      tone(c, t, 52, 0.5, 0.006, 0.7, "sine", 30)
      burst(c, t, 0.24, 0.6, "bandpass", 2600, 1.4, 500)
    },

    unlock() {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      // chain snapping
      for (let i = 0; i < 4; i++) burst(c, t + i * 0.035, 0.34, 0.06, "highpass", 3200, 0.8)
      // and the station landing
      const root = 118
      for (let i = 0; i < BAR_MODES.length; i++) {
        tone(c, t + 0.12, root * BAR_MODES[i], 0.34 / (i + 1.2), 0.005, 1.3 - i * 0.16)
      }
      tone(c, t + 0.12, 44, 0.62, 0.008, 0.9, "sine", 26)
      burst(c, t + 0.12, 0.34, 1.0, "bandpass", 1200, 0.9, 300)
    },

    perfect() {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      const root = 880
      tone(c, t, root, 0.24, 0.002, 0.9, "sine")
      tone(c, t, root * 2.76, 0.12, 0.002, 0.7, "sine")
      tone(c, t + 0.06, root * 1.5, 0.2, 0.002, 1.1, "sine")
      burst(c, t, 0.18, 0.7, "highpass", 5200, 0.8, 9000)
      tone(c, t, 70, 0.36, 0.004, 0.3, "sine", 40)
    },

    quench() {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      // Steam: a long noise wash swept from bright to dark, plus a sub drop.
      const s = c.createBufferSource()
      s.buffer = noise
      s.loop = true
      const f = c.createBiquadFilter()
      f.type = "bandpass"
      f.Q.value = 0.5
      f.frequency.setValueAtTime(6000, t)
      f.frequency.exponentialRampToValueAtTime(300, t + 2.4)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.08)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6)
      s.connect(f)
      f.connect(g)
      g.connect(master as GainNode)
      s.start(t)
      s.stop(t + 2.7)
      tone(c, t, 120, 0.55, 0.01, 1.6, "sine", 24)
    },

    reignite() {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      burst(c, t, 0.4, 1.1, "lowpass", 400, 0.7, 2600)
      for (let i = 0; i < 6; i++) {
        tone(c, t + 0.5 + i * 0.06, 130 * PENTATONIC[i], 0.2, 0.005, 0.5, "triangle")
      }
      tone(c, t + 0.5, 48, 0.5, 0.01, 1.1, "sine")
    },

    claim() {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      for (let i = 0; i < 7; i++) {
        tone(c, t + i * 0.035, 320 * PENTATONIC[i % PENTATONIC.length], 0.16, 0.003, 0.3, "square")
      }
      tone(c, t, 58, 0.4, 0.006, 0.5, "sine", 34)
    },

    blip() {
      const c = ensure()
      if (!c) return
      const t = c.currentTime
      tone(c, t, 620 * cents(Math.random() * 60 - 30), 0.1, 0.002, 0.05, "square")
    },

    setRoar(level) {
      const c = ensure()
      if (!c || !roarGain) return
      const target = Math.max(0, Math.min(1, level)) * 0.3
      roarGain.gain.setTargetAtTime(target, c.currentTime, 0.4)
    },

    dispose() {
      disposed = true
      try {
        roarSrc?.stop()
      } catch {
        /* already stopped */
      }
      void ctx?.close()
      ctx = null
      master = null
      roarGain = null
      roarSrc = null
    },
  }
}
