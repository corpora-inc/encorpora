/**
 * Synthesis primitives. Presets are compositions of these; nothing here is a
 * preset itself.
 *
 * THE LAYERING RECIPE — this is the whole difference between "beepy" and
 * "premium", and it is not subtle once you hear it:
 *
 *    TRANSIENT (0-15 ms)  what the ear uses to identify the material.
 *                         Noise through a tight bandpass. Almost inaudible
 *                         alone, and removing it makes any sound feel fake.
 *    BODY      (15-300 ms) the pitch and the character. Modal, FM, or both.
 *    TAIL      (0.2-3 s)   the space it happened in. A reverb send, not a
 *                          longer envelope — a long envelope is a synth pad,
 *                          a tail is a room.
 *    SUB       (optional)  20-90 Hz thump for weight. On a tablet speaker it
 *                          is felt as loudness, not heard as bass, which is
 *                          exactly why it works.
 *
 * Every one-shot returns the context time it is silent at, so the engine can
 * reclaim its budget without an `onended` closure per voice.
 */

import { glide, percEnv, thock } from "../dsp/env.ts"
import type { RenderCtx } from "../types.ts"

/** Equal-power stereo placement. StereoPannerNode, never PannerNode: the 3D
 *  panner runs an HRTF and costs ~20x more for a result nobody asked for. */
export const pan = (rc: RenderCtx, amount: number): StereoPannerNode | null => {
  const ctx = rc.ctx
  if (!ctx.createStereoPanner) return null
  const p = ctx.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, amount))
  return p
}

/**
 * Connect `node` to the voice output, and (if reverb is on) to this bus's send.
 *
 * The send taps the BUS, not the voice's gain node, so it is scaled by
 * `rc.level` here — otherwise a quiet UI tick would arrive at the reverb as
 * loud as a gong and the room would breathe on every button press.
 */
export const route = (rc: RenderCtx, node: AudioNode, sendAmount = 0): void => {
  node.connect(rc.out)
  if (rc.send && sendAmount > 0) {
    const g = rc.ctx.createGain()
    g.gain.value = sendAmount * rc.level
    node.connect(g)
    g.connect(rc.send)
  }
}

export interface NoiseOpts {
  kind?: "white" | "pink" | "brown" | "velvet"
  /** Bandpass centre in Hz. */
  freq: number
  q?: number
  /** Sweep the bandpass down (or up) to this frequency over `sweep` seconds. */
  freqTo?: number
  sweep?: number
  gain: number
  attack?: number
  decay: number
  pan?: number
  send?: number
  /** Highpass to keep a transient from muddying the low end. */
  highpass?: number
}

/**
 * A filtered noise burst — the transient layer, and on its own a perfectly good
 * shaker, breath, cloth or scrape.
 *
 * Reading the shared noise buffer at a RANDOM OFFSET is the single cheapest
 * anti-fatigue trick in the kit: identical parameters produce a different
 * waveform every time, so 500 taps never phase-align into a machine gun.
 */
export const noiseBurst = (rc: RenderCtx, o: NoiseOpts): number => {
  const ctx = rc.ctx
  const t = rc.tables
  const buf =
    o.kind === "pink" ? t.pink() : o.kind === "brown" ? t.brown() : o.kind === "velvet" ? t.velvet() : t.white()
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  // Random read offset + slight rate detune: two independent variation axes.
  src.playbackRate.value = 0.88 + rc.rand() * 0.24

  const bp = ctx.createBiquadFilter()
  bp.type = "bandpass"
  bp.Q.value = o.q ?? 1.2
  if (o.freqTo && o.sweep) {
    glide(bp.frequency, rc.when, o.freq, o.freqTo, o.sweep)
  } else {
    bp.frequency.value = o.freq
  }

  let head: AudioNode = bp
  if (o.highpass) {
    const hp = ctx.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.value = o.highpass
    bp.connect(hp)
    head = hp
  }

  const g = ctx.createGain()
  const end = percEnv(g.gain, rc.when, o.gain, o.attack ?? 0.0008, o.decay)
  src.connect(bp)
  head.connect(g)

  const p = pan(rc, o.pan ?? 0)
  if (p) {
    g.connect(p)
    route(rc, p, o.send ?? 0)
  } else {
    route(rc, g, o.send ?? 0)
  }

  src.start(rc.when, rc.rand() * 1.5)
  src.stop(end + 0.02)
  return end
}

export interface FmOpts {
  /** Carrier frequency in Hz. */
  freq: number
  /** Modulator:carrier ratio. Integer = harmonic (mallet, bell-ish organ);
   *  non-integer = inharmonic (bell, metal, glass). This one number is most of
   *  the timbre. */
  ratio: number
  /** Peak modulation index. 0 = pure sine; 3-8 = bell; >12 = noise-adjacent. */
  index: number
  /** Index decay in seconds — the "hammer" of an FM tone. Always shorter than
   *  the amplitude decay, or it sounds like a synthesiser rather than a bell. */
  indexDecay?: number
  gain: number
  attack?: number
  decay: number
  /** Detune a second carrier by this many cents for chorus/beating. */
  spread?: number
  pan?: number
  send?: number
  /** Drop the carrier pitch by this many semitones over `pitchFall` seconds. */
  pitchDrop?: number
  pitchFall?: number
  type?: OscillatorType
}

/**
 * Two-operator FM. Cheap, enormously expressive, and the correct tool for
 * anything metallic and pitched — coins, beads, bells, chimes.
 */
export const fmTone = (rc: RenderCtx, o: FmOpts): number => {
  const ctx = rc.ctx
  const car = ctx.createOscillator()
  car.type = o.type ?? "sine"
  const mod = ctx.createOscillator()
  mod.type = "sine"
  const modGain = ctx.createGain()

  const f = o.freq
  car.frequency.value = f
  mod.frequency.value = f * o.ratio

  if (o.pitchDrop && o.pitchFall) {
    thock(car.frequency, rc.when, f * Math.pow(2, o.pitchDrop / 12), f, o.pitchFall)
    thock(mod.frequency, rc.when, f * o.ratio * Math.pow(2, o.pitchDrop / 12), f * o.ratio, o.pitchFall)
  }

  // Modulation index in Hz of deviation = index * modulator frequency.
  const peakDev = o.index * f * o.ratio
  const idxDecay = o.indexDecay ?? Math.min(o.decay * 0.45, 0.12)
  modGain.gain.setValueAtTime(peakDev, rc.when)
  modGain.gain.setTargetAtTime(peakDev * 0.02, rc.when, idxDecay / 3)
  mod.connect(modGain)
  modGain.connect(car.frequency)

  const g = ctx.createGain()
  const end = percEnv(g.gain, rc.when, o.gain, o.attack ?? 0.002, o.decay)
  car.connect(g)

  let second: OscillatorNode | null = null
  if (o.spread) {
    second = ctx.createOscillator()
    second.type = car.type
    second.frequency.value = f * Math.pow(2, o.spread / 1200)
    modGain.connect(second.frequency)
    second.connect(g)
  }

  const p = pan(rc, o.pan ?? 0)
  if (p) {
    g.connect(p)
    route(rc, p, o.send ?? 0)
  } else {
    route(rc, g, o.send ?? 0)
  }

  car.start(rc.when)
  mod.start(rc.when)
  second?.start(rc.when)
  car.stop(end + 0.02)
  mod.stop(end + 0.02)
  second?.stop(end + 0.02)
  return end
}

export interface SubOpts {
  freq: number
  /** Semitones the pitch falls. A sub with no drop is a test tone. */
  drop?: number
  fall?: number
  gain: number
  decay: number
  /** Soft-saturate for audibility on a speaker with no low end. */
  drive?: number
}

/**
 * Sub thump. On a tablet speaker you cannot hear 45 Hz — but you can hear its
 * harmonics, so we saturate it. The result reads as WEIGHT on a phone and as
 * actual bass on headphones, which is exactly the trade we want.
 */
export const subThump = (rc: RenderCtx, o: SubOpts): number => {
  const ctx = rc.ctx
  const osc = ctx.createOscillator()
  osc.type = "sine"
  thock(osc.frequency, rc.when, o.freq * Math.pow(2, (o.drop ?? 8) / 12), o.freq, o.fall ?? 0.06)
  const g = ctx.createGain()
  const end = percEnv(g.gain, rc.when, o.gain, 0.002, o.decay)
  osc.connect(g)
  let tailNode: AudioNode = g
  if (o.drive && o.drive > 0) {
    const ws = ctx.createWaveShaper()
    ws.curve = rc.tables.saturation(o.drive)
    ws.oversample = "2x"
    g.connect(ws)
    tailNode = ws
  }
  route(rc, tailNode, 0)
  osc.start(rc.when)
  osc.stop(end + 0.02)
  return end
}

export interface SweepOpts {
  from: number
  to: number
  time: number
  q?: number
  gain: number
  kind?: "white" | "pink" | "brown"
  pan?: number
  send?: number
  /** Curve the amplitude: 0 = flat, 1 = swells into the end (an arrival). */
  swell?: number
}

/** Filtered-noise sweep — whooshes, arrivals, transitions. */
export const sweep = (rc: RenderCtx, o: SweepOpts): number => {
  const ctx = rc.ctx
  const src = ctx.createBufferSource()
  src.buffer = o.kind === "white" ? rc.tables.white() : o.kind === "brown" ? rc.tables.brown() : rc.tables.pink()
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = "bandpass"
  bp.Q.value = o.q ?? 3.2
  glide(bp.frequency, rc.when, o.from, o.to, o.time)

  const g = ctx.createGain()
  const swellAmt = o.swell ?? 0
  g.gain.setValueAtTime(0, rc.when)
  g.gain.linearRampToValueAtTime(o.gain * (swellAmt > 0 ? 0.35 : 1), rc.when + o.time * 0.12)
  if (swellAmt > 0) {
    g.gain.linearRampToValueAtTime(o.gain, rc.when + o.time * (0.75 + swellAmt * 0.2))
  }
  g.gain.setTargetAtTime(0, rc.when + o.time * 0.82, o.time / 8)
  const end = rc.when + o.time * 1.25
  g.gain.setValueAtTime(0, end)

  src.connect(bp)
  bp.connect(g)
  const p = pan(rc, o.pan ?? 0)
  if (p) {
    g.connect(p)
    route(rc, p, o.send ?? 0.2)
  } else {
    route(rc, g, o.send ?? 0.2)
  }
  src.start(rc.when, rc.rand() * 1.5)
  src.stop(end + 0.02)
  return end
}

export interface GrainOpts {
  /** Grains per second. Clamped by tier. */
  rate: number
  seconds: number
  /** Centre pitch in Hz for the grain's bandpass. */
  freq: number
  /** Semitone spread of grain pitches — the shimmer. */
  spreadSemis: number
  gain: number
  send?: number
  /** Scale the whole cloud in over this long. */
  fadeIn?: number
}

/** Grain band centres, matching `SharedTables.grain`. */
const GRAIN_BANDS = [1400, 2000, 2800, 3900, 5400, 7200, 9600, 12800]

const nearestBand = (hz: number): number => {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < GRAIN_BANDS.length; i++) {
    const d = Math.abs(Math.log2(GRAIN_BANDS[i] / hz))
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/**
 * Granular shimmer. Dozens of tiny windowed grains at scattered pitches and
 * pans — what makes a big reward feel like a cascade of glass beads instead of
 * one loud noise.
 *
 * ONE NODE PER GRAIN. Band-pass, window and amplitude are all baked into the
 * pre-rendered grain buffers (`tables.grain`), pitch comes from `playbackRate`,
 * and panning uses a fixed set of FIVE shared panners rather than one per
 * grain. The obvious four-nodes-per-grain version measured 49.3% of a core at
 * 140 grains/s; this one measures a fraction of that for an identical sound.
 * The lesson generalises: in Web Audio you are usually paying for the GRAPH,
 * not for the arithmetic.
 */
export const grainCloud = (rc: RenderCtx, o: GrainOpts): number => {
  const ctx = rc.ctx
  const count = Math.max(1, Math.round(o.rate * o.seconds))
  const out = ctx.createGain()
  out.gain.value = o.gain
  route(rc, out, o.send ?? 0.35)

  // Five static pan positions. Beyond about five the ear cannot place them
  // anyway, and each one is a node that lives for the whole cloud rather than
  // for 60 ms.
  const lanes: AudioNode[] = []
  for (const p of [-0.8, -0.4, 0, 0.4, 0.8]) {
    const sp = pan(rc, p)
    if (sp) {
      sp.connect(out)
      lanes.push(sp)
    }
  }
  if (lanes.length === 0) lanes.push(out)

  const band = nearestBand(o.freq)
  for (let i = 0; i < count; i++) {
    const frac = i / count
    const at = rc.when + frac * o.seconds + rc.rand() * (o.seconds / count)
    const src = ctx.createBufferSource()
    const ampIdx = Math.min(3, Math.floor(rc.rand() * 4))
    const bandIdx = Math.max(0, Math.min(GRAIN_BANDS.length - 1, band + (rc.rand() < 0.5 ? 0 : 1) - (rc.rand() < 0.3 ? 1 : 0)))
    src.buffer = rc.tables.grain(bandIdx, o.fadeIn && frac < 0.15 ? 0 : ampIdx)
    // Pitch scatter via playback rate: also shortens/lengthens the grain, which
    // is exactly what a real granulator does and it sounds better for it.
    src.playbackRate.value = Math.pow(2, ((rc.rand() * 2 - 1) * o.spreadSemis) / 12)
    src.connect(lanes[i % lanes.length])
    src.start(at)
  }
  return rc.when + o.seconds + 0.3
}

/**
 * A pitched "air" layer — a very quiet sine an octave above the body, with a
 * slow attack. Adds perceived quality for almost no cost; it is the thing
 * expensive sound design has that cheap sound design does not.
 */
export const airTone = (rc: RenderCtx, freq: number, gain: number, decay: number): number => {
  const ctx = rc.ctx
  const o = ctx.createOscillator()
  o.type = "sine"
  o.frequency.value = freq
  const g = ctx.createGain()
  const end = percEnv(g.gain, rc.when, gain, 0.012, decay)
  o.connect(g)
  route(rc, g, 0.4)
  o.start(rc.when)
  o.stop(end + 0.02)
  return end
}
