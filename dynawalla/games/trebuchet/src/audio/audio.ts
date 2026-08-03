/**
 * Procedural audio. No assets, ever.
 *
 * Every impact is built in three layers — TRANSIENT (the click that tells your ear
 * where it happened), BODY (the pitched thump that gives it mass) and TAIL (the
 * valley answering back). Pitch and timing jitter on every call so a hundred shots
 * do not fatigue. Sound is a garnish: mute loses nothing but pleasure.
 *
 * ── The 2026-08 pass: lower, warmer, and not a noise burst ───────────────────
 *
 * The founder: *"can we upgrade the sound effects to premium just a little bit ..
 * the building destroyed is a bit white noise instead of a nice building crumbling
 * sound ... maybe a whole pass on making the sound effects more premium (and
 * chillaxed in most cases) .. they tend to be a bit abrasive .. maybe lower
 * pitched in a lot of cases."*
 *
 * Three things came out of that, and the first is the one that matters:
 *
 *  1. **A keep coming down is masonry, not hiss.** `collapse()` was seven
 *     band-passed noise bursts under a sine. A noise burst is ONE event with no
 *     size to it, which is exactly why it reads as static. It is now the shared
 *     `rubble` recipe — sixteen graded impacts whose sizes follow a power law, a
 *     few big low ones and a lot of small high ones, staggered, all under 1.4 kHz.
 *     See `packs/shared/game-audio/voices.ts`.
 *  2. **Nothing in this game is bright any more.** Every cue that lived in the
 *     2–5 kHz band the ear is most sensitive in — the winch tick at up to 2.4 kHz,
 *     the stone crack at up to 3.6 kHz, the rope whoosh at up to 4 kHz, the
 *     incoming whistle at 1.5 kHz — has come down, and `BRIGHTEST_HZ` is the line
 *     they are all held under. `audio.test.ts` measures it rather than trusting it.
 *  3. **The soundscape, where it fits.** `packs/shared/game-soundscape` publishes
 *     the key the whole app is in, and a game emits GESTURES and may never name a
 *     pitch. So the four cues in this game that are music rather than physics —
 *     the reward, the sour horn, the wave horn and the collapse — ask the walker
 *     what they sound like, and a run of hits arcs and cadences instead of playing
 *     the same fanfare a semitone up forever.
 *
 *     What is deliberately NOT routed through it: the winch tick. The dial repeats
 *     at up to 26 notches a second on a held button, and a melodic bell per notch
 *     is a swarm, not a phrase. It stays a click, and the click got quieter and
 *     three octaves lower.
 *
 *     When no host publishes a soundscape — an older host, a dev harness, a parent
 *     who has turned the app's Music switch off — `currentSoundscape()` is `null`,
 *     the walker does not exist, and every cue below falls back to a fixed low
 *     pitch. "Keep your own sounds", never "go quiet". The collapse is rubble
 *     either way: that is the founder's actual complaint and it is not conditional
 *     on a host feature.
 */

import {
  createSafetyBus,
  playVoice,
  safeAttack,
  type PlayableVoice,
} from "../../../../packs/shared/game-audio/index.ts"
import {
  Melody,
  currentSoundscape,
  onSoundscape,
  type Gesture,
} from "../../../../packs/shared/game-soundscape/index.ts"

type Ctx = AudioContext

const rand = (a: number, b: number): number => a + Math.random() * (b - a)

/**
 * The brightest anything in this game is allowed to be, in Hz.
 *
 * Under the 2–5 kHz band the ear is most sensitive in, which is the band
 * "abrasive" means. Every filter and every oscillator in this file is held
 * under it, and `audio.test.ts` walks the real graph to prove it rather than
 * taking the comment's word for it.
 */
export const BRIGHTEST_HZ = 2000

/**
 * Where the fallback cues sit when no soundscape is published.
 *
 * The bottom of `game-soundscape`'s own root band, so a host that publishes one
 * and a host that does not are in the same register rather than a fifth apart.
 */
const FALLBACK_ROOT_HZ = 116.5

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

  /**
   * The app's key, or `null` when nobody has published one.
   *
   * Followed rather than read once: the host re-publishes on every settings
   * change, so a game that only looked at construction would be in last hour's
   * key — or, worse, would keep a walker alive after a parent turned Music off.
   */
  private melody: Melody | null = null
  private readonly unfollow: () => void

  constructor() {
    const scape = currentSoundscape()
    this.melody = scape ? new Melody(scape) : null
    this.unfollow = onSoundscape((next) => {
      if (!next) this.melody = null
      else if (this.melody) this.melody.retune(next)
      else this.melody = new Melody(next)
    })
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  resume(): void {
    if (!this.ctx) {
      const AC: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      const c = this.ctx
      this.master = c.createGain()
      // Down from 0.62. Everything under it also came down, so this is not a
      // volume knob compensating for cues that are still shouting — it is the
      // last 1.5 dB of a pass that took the level out of each cue first.
      this.master.gain.value = 0.52
      const comp = c.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.knee.value = 22
      comp.ratio.value = 5
      comp.attack.value = 0.004
      comp.release.value = 0.16
      this.master.connect(comp)
      // The last thing between this game and a child's ears. Everything the
      // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
      // going straight to the output. See packs/shared/game-audio/.
      const safety = createSafetyBus(c)
      comp.connect(safety.input)

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
      this.send.gain.value = 0.3
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

  private env(gain: GainNode, peak: number, attackIn: number, decay: number, at = this.t): void {
    // The shared floor on onset time. Some cues here asked for 0.002 s —
    // 88 samples from silence to peak, which is a step function with a click
    // on it, and the click is most of what a child hears as "too loud".
    const attack = safeAttack(attackIn)
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

  /* ------------------------------------------------------------- the music */

  /**
   * Say what happened, and let the walker decide what it sounds like.
   *
   * @returns false when there is no soundscape and the caller must play its own
   *          fallback. A `void` return here would be the shape of bug where a
   *          cue silently stops making any sound at all on a host that publishes
   *          nothing, which is most of them today.
   */
  private gesture(g: Gesture): boolean {
    const m = this.melody
    if (!m || !this.ctx || !this.master) return false
    for (const v of m.emit(g)) this.voice(v)
    return true
  }

  /** One voice, through the shared synthesiser, into this game's own master. */
  private voice(v: PlayableVoice): void {
    if (!this.ctx || !this.master) return
    playVoice(this.ctx, this.master, v)
  }

  /* ------------------------------------------------------------- the cues */

  /**
   * Winch ratchet — one click per notch, pitch climbing with the dial.
   *
   * Was a band-pass sweeping 900–2400 Hz at 0.16, which is a needle straight
   * into the sensitive band, sixty times over on a held button. Now 240–700 Hz
   * and half the level: a wooden ratchet rather than a Geiger counter.
   */
  tick(power01: number): void {
    if (!this.ok()) return
    const c = this.ctx!
    const src = this.noise(0.05)
    if (!src) return
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = (240 + power01 * 460) * rand(0.96, 1.04)
    bp.Q.value = 5
    const g = c.createGain()
    this.env(g, 0.075, 0.004, 0.045)
    src.connect(bp)
    bp.connect(g)
    this.toOut(g, 0.05)
  }

  /** Loading a different boulder — a woodier, lower detent. */
  detent(): void {
    if (!this.ok()) return
    const c = this.ctx!
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.setValueAtTime(rand(190, 210), this.t)
    o.frequency.exponentialRampToValueAtTime(96, this.t + 0.07)
    const g = c.createGain()
    this.env(g, 0.1, 0.004, 0.08)
    o.connect(g)
    this.toOut(g, 0.1)
    o.start(this.t)
    o.stop(this.t + 0.16)
  }

  /** Counterweight drops, rope sings, arm whips. */
  launch(power01: number): void {
    if (!this.ok()) return
    const c = this.ctx!
    const t0 = this.t
    // body: the counterweight
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(rand(128, 142), t0)
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.34)
    const og = c.createGain()
    this.env(og, 0.46, 0.008, 0.36, t0)
    o.connect(og)
    this.toOut(og, 0.22)
    o.start(t0)
    o.stop(t0 + 0.54)
    // transient + rope whoosh. The sweep used to end as high as 4 kHz; a rope
    // is a low sound and the top of it was all that was audible on a tablet.
    const src = this.noise(0.42)
    if (src) {
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 1.2
      bp.frequency.setValueAtTime(300, t0)
      bp.frequency.exponentialRampToValueAtTime(900 + power01 * 500, t0 + 0.28)
      const g = c.createGain()
      this.env(g, 0.2, 0.026, 0.32, t0)
      src.connect(bp)
      bp.connect(g)
      this.toOut(g, 0.3)
    }
  }

  /**
   * Continuous flight whistle. Pitch tracks speed; volume tracks height.
   *
   * The one cue that is unavoidably a tone held for seconds, so it is the one
   * that most needed lowering: 300–1200 Hz became 170–620, and the low-pass
   * above it came down with it.
   */
  flightStart(): void {
    if (!this.ok()) return
    const c = this.ctx!
    this.flightStop()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = 300
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 1200
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
    this.flightOsc.frequency.setTargetAtTime(170 + speed01 * 450, t, 0.05)
    this.flightGain.gain.setTargetAtTime(0.022 + height01 * 0.05, t, 0.08)
    this.flightFilt?.frequency.setTargetAtTime(600 + speed01 * 1200, t, 0.08)
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
    o.frequency.setValueAtTime(rand(82, 98), t0)
    o.frequency.exponentialRampToValueAtTime(31, t0 + 0.24)
    const og = c.createGain()
    this.env(og, 0.3 + mass * 0.34, 0.005, 0.32, t0)
    o.connect(og)
    this.toOut(og, 0.3)
    o.start(t0)
    o.stop(t0 + 0.54)
    const src = this.noise(0.3)
    if (src) {
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      // Opened at 2.4 kHz before, i.e. straight into the sensitive band for the
      // first 40 ms of every single shot.
      lp.frequency.setValueAtTime(1100, t0)
      lp.frequency.exponentialRampToValueAtTime(260, t0 + 0.26)
      const g = c.createGain()
      this.env(g, 0.22 + mass * 0.16, 0.004, 0.28, t0)
      src.connect(lp)
      lp.connect(g)
      this.toOut(g, 0.4)
    }
  }

  /**
   * Stone impact: a crack on top of the dirt.
   *
   * The cracks used to be band-passed anywhere in 1400–3600 Hz — three of them,
   * on every shot that touched masonry. That is the single most abrasive thing
   * this game made. They are now 520–1500 Hz and a third quieter: a stone
   * knocking against stone rather than a plate smashing.
   */
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
      bp.Q.value = 1.8
      bp.frequency.value = rand(520, 1500)
      const g = c.createGain()
      this.env(g, 0.13, 0.003, 0.12, t0 + i * rand(0.006, 0.034))
      src.connect(bp)
      bp.connect(g)
      this.toOut(g, 0.35)
    }
  }

  /**
   * A KEEP COMING DOWN. The founder's example, and the one cue this whole pass
   * exists for.
   *
   * It was seven lowpassed noise bursts and a sine — "a bit white noise". It is
   * now the shared `rubble` recipe: many small impacts whose sizes follow a
   * power law, low-centred, staggered, so the ear hears masonry with a size to
   * it rather than a hiss with an envelope on it.
   *
   * The soundscape picks the two degrees it lands on, so the fall is in tune
   * with whatever else is playing; with no soundscape it falls on a fixed low
   * root instead. **It is rubble either way** — that is the defect, and it is
   * not conditional on the host publishing anything.
   */
  collapse(): void {
    if (!this.ok()) return
    if (this.gesture({ kind: 'collapse', weight: 1 })) return
    this.voice({ hz: FALLBACK_ROOT_HZ / 2, at: 0, seconds: 1.2, gain: 0.13, timbre: 'rubble' })
    this.voice({ hz: FALLBACK_ROOT_HZ, at: 0.22, seconds: 0.85, gain: 0.075, timbre: 'rubble' })
    // The sub under it: the ground taking the weight. Kept from the old cue,
    // because it is the half of it that was never the problem.
    const c = this.ctx!
    const t0 = this.t
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(54, t0)
    o.frequency.exponentialRampToValueAtTime(24, t0 + 0.9)
    const og = c.createGain()
    this.env(og, 0.4, 0.03, 0.95, t0)
    o.connect(og)
    this.toOut(og, 0.2)
    o.start(t0)
    o.stop(t0 + 1.1)
  }

  /** The reward. A phrase that arrives, and a different one every time. */
  fanfare(chain: number): void {
    if (!this.ok()) return
    if (this.gesture({ kind: 'success' })) return
    // No soundscape: the old pentatonic run, a fourth lower and quieter.
    const c = this.ctx!
    const pent = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]
    const base = 294 * Math.pow(2, Math.min(chain, 8) / 12)
    const t0 = this.t
    for (let i = 0; i < 5; i++) {
      const o = c.createOscillator()
      o.type = i % 2 === 0 ? 'triangle' : 'sine'
      o.frequency.value = base * Math.pow(2, pent[i] / 12) * rand(0.997, 1.003)
      const g = c.createGain()
      this.env(g, 0.11, 0.008, 0.36, t0 + i * 0.06)
      o.connect(g)
      this.toOut(g, 0.5)
      o.start(t0 + i * 0.06)
      o.stop(t0 + i * 0.06 + 0.52)
    }
  }

  /** Struck the wrong keep: sour but never a buzzer, and never a punishment. */
  wrongHorn(): void {
    if (!this.ok()) return
    if (this.gesture({ kind: 'failure' })) return
    const c = this.ctx!
    const t0 = this.t
    for (const [f, det] of [
      [146, 1],
      [155, 1.004],
    ] as Array<[number, number]>) {
      const o = c.createOscillator()
      // Triangle, not sawtooth. A saw through a low-pass is still a saw at the
      // onset, and the onset is the part that reads as a telling-off.
      o.type = 'triangle'
      o.frequency.value = f * det
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(800, t0)
      lp.frequency.exponentialRampToValueAtTime(280, t0 + 0.7)
      const g = c.createGain()
      this.env(g, 0.12, 0.07, 0.62, t0)
      o.connect(lp)
      lp.connect(g)
      this.toOut(g, 0.4)
      o.start(t0)
      o.stop(t0 + 0.92)
    }
  }

  /**
   * The completed sum has gone up on the glass after a miss.
   *
   * Deliberately NOT a failure sting — the horn already answered the shot, and
   * the reveal is the calm part that follows it. One low breath, so a child who
   * has just been shown the answer hears the game settle rather than scold.
   */
  reveal(): void {
    if (!this.ok()) return
    if (this.gesture({ kind: 'arrive' })) return
    this.voice({ hz: FALLBACK_ROOT_HZ, at: 0, seconds: 0.9, gain: 0.055, timbre: 'bloom' })
    this.voice({ hz: FALLBACK_ROOT_HZ * 1.5, at: 0.05, seconds: 0.8, gain: 0.04, timbre: 'bloom' })
  }

  /** Incoming counter-fire. Doppler down, then a hit on your platform. */
  incoming(delay: number): void {
    if (!this.ok()) return
    const c = this.ctx!
    const t0 = this.t
    const o = c.createOscillator()
    o.type = 'sine'
    // Opened at 1500 Hz. A shell coming in is a falling sound; it does not need
    // to start inside the band that hurts to read as one.
    o.frequency.setValueAtTime(760, t0)
    o.frequency.exponentialRampToValueAtTime(190, t0 + delay)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.075, t0 + delay * 0.7)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay)
    o.connect(g)
    this.toOut(g, 0.3)
    o.start(t0)
    o.stop(t0 + delay + 0.1)
  }

  /**
   * Wave horn — low, ceremonial, once per wave.
   *
   * `up` is the pitch bend, and it means "this went well": a wave opening, or a
   * wave cleared without a miss. `ending` is which end of the wave it is, and
   * the two are genuinely independent — a wave that opens is not a level
   * completed, and reading `up` as one would fire a flourish every time a wave
   * laid itself out.
   */
  horn(up: boolean, ending = false): void {
    if (!this.ok()) return
    // A wave is a thing that arrives; a cleared wave is the one gesture the
    // walker is allowed to be big about.
    if (this.gesture(ending ? { kind: 'levelComplete' } : { kind: 'arrive' })) return
    const c = this.ctx!
    const t0 = this.t
    for (const mult of [1, 1.5, 2.02]) {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(98 * mult, t0)
      o.frequency.linearRampToValueAtTime(98 * mult * (up ? 1.06 : 0.94), t0 + 0.8)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 700
      const g = c.createGain()
      this.env(g, 0.085, 0.16, 0.82, t0)
      o.connect(lp)
      lp.connect(g)
      this.toOut(g, 0.6)
      o.start(t0)
      o.stop(t0 + 1.2)
    }
  }

  dispose(): void {
    this.unfollow()
    this.melody = null
    this.flightStop()
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
  }
}
