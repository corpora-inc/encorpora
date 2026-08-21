/**
 * Shared DSP tables — built ONCE per AudioContext, lazily, never per voice.
 *
 * The single biggest source of "why does the first coin stutter" is allocating
 * a noise buffer or a waveshaper curve inside a trigger. Everything expensive
 * lives here behind a memo. `warm()` builds the whole set during a loading
 * screen so nothing allocates on the hot path.
 */

import { mulberry32 } from "../rng.ts"
import type { SharedTables } from "../types.ts"

const NOISE_SECONDS = 2.0

/** White noise, mono, deterministic. Read at random offsets for variation. */
const buildWhite = (ctx: BaseAudioContext): AudioBuffer => {
  const n = Math.floor(ctx.sampleRate * NOISE_SECONDS)
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  const rnd = mulberry32(0xc0ffee)
  for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1
  return buf
}

/**
 * Pink noise via the Voss-McCartney / Paul Kellet economy filter. Pink is the
 * bed for anything that should sound like air, cloth or crowd — white noise
 * reads as "hiss from a device", pink reads as "a place".
 */
const buildPink = (ctx: BaseAudioContext): AudioBuffer => {
  const n = Math.floor(ctx.sampleRate * NOISE_SECONDS)
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  const rnd = mulberry32(0x9e3779b9)
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  return buf
}

/** Brown/red noise — the low rumble under a city bed. Leaky integrator. */
const buildBrown = (ctx: BaseAudioContext): AudioBuffer => {
  const n = Math.floor(ctx.sampleRate * NOISE_SECONDS)
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  const rnd = mulberry32(0x5bd1e995)
  let last = 0
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1
    last = (last + 0.02 * w) / 1.02
    d[i] = last * 3.5
  }
  return buf
}

/**
 * Velvet noise: sparse ±1 impulses, silence between. Perceptually as dense as
 * white but with far fewer non-zero samples, and — the reason it is here — it
 * has no low-frequency energy, so a transient built from it stays crisp instead
 * of thumping. This is what makes a "tick" read as ceramic rather than muddy.
 */
const buildVelvet = (ctx: BaseAudioContext): AudioBuffer => {
  const n = Math.floor(ctx.sampleRate * 0.5)
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  const rnd = mulberry32(0x1b873593)
  const density = 2200 // impulses per second
  const period = Math.max(2, Math.floor(ctx.sampleRate / density))
  for (let k = 0; k * period < n; k++) {
    const idx = k * period + Math.floor(rnd() * period)
    if (idx < n) d[idx] = rnd() < 0.5 ? -1 : 1
  }
  return buf
}

/**
 * Odd-symmetric soft saturation. `amount` 0..1. Built on tanh so there is no
 * hard corner (a hard corner aliases viciously at 48k with no oversampling —
 * WaveShaper's `oversample: "4x"` fixes it but costs, so keep the curve soft
 * AND set 2x on the nodes that matter).
 */
const buildSaturation = (amount: number): Float32Array<ArrayBuffer> => {
  const N = 2048
  const curve = new Float32Array(N)
  const k = 1 + amount * 14
  const norm = Math.tanh(k)
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1
    curve[i] = Math.tanh(k * x) / norm
  }
  return curve
}

/**
 * Master safety clipper. Transparent below -3 dBFS, then a smooth knee.
 *
 * This exists because DynamicsCompressorNode is NOT a limiter: it has a soft
 * knee and a finite attack, and it demonstrably lets transients past threshold
 * (measured: +2.7 dBFS with the compressor alone on a 12-impact stack).
 *
 * CEILING = 0.97, NOT 1.0. Measured trap: `WaveShaperNode` with
 * `oversample: "2x"` can output ABOVE the maximum value in its own curve,
 * because the 2x interpolation filter rings. With a 0.999 ceiling the master
 * measured +0.05 dBFS — over full scale, on a node whose entire job is to be
 * under it. 0.97 (-0.26 dBFS) absorbs the overshoot and gives the cheap DAC in
 * a tablet the inter-sample headroom it needs anyway.
 */
const SAFETY_CEILING = 0.97

const buildSafetyClip = (): Float32Array<ArrayBuffer> => {
  const N = 4096
  const curve = new Float32Array(N)
  const t = 0.7 // linear below this
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1
    const a = Math.abs(x)
    let y: number
    if (a <= t) y = a
    else {
      const over = (a - t) / (1 - t)
      // 1 - (1-x)^2 knee: smooth first derivative at the join, asymptotic at 1.
      y = t + (SAFETY_CEILING - t) * (1 - Math.pow(1 - Math.min(over, 1), 2))
    }
    curve[i] = Math.sign(x) * y
  }
  return curve
}

/**
 * Procedural reverb impulse.
 *
 * Not a convolution of a real room — we ship no assets. This is noise shaped by
 * a decay envelope whose high frequencies die faster than its lows (a one-pole
 * whose coefficient walks closed over the tail), plus sparse early reflections.
 * "tile" is a hard, bright, small courtyard; "courtyard" is bigger and darker;
 * "plate" is dense and metallic with almost no early structure.
 */
const buildImpulse = (
  ctx: BaseAudioContext,
  kind: "tile" | "courtyard" | "plate",
  seconds: number,
): AudioBuffer => {
  const sr = ctx.sampleRate
  const n = Math.max(1, Math.floor(sr * seconds))
  const buf = ctx.createBuffer(2, n, sr)
  const rnd = mulberry32(kind === "tile" ? 0x7a1e : kind === "courtyard" ? 0x2b0d : 0x51f3)

  // Character per kind.
  const cfg = {
    tile: { hfDamp: 0.55, preDelay: 0.006, erCount: 14, erGain: 0.55, curve: 2.4 },
    courtyard: { hfDamp: 0.82, preDelay: 0.018, erCount: 22, erGain: 0.42, curve: 1.9 },
    plate: { hfDamp: 0.35, preDelay: 0.001, erCount: 3, erGain: 0.2, curve: 2.9 },
  }[kind]

  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    const pre = Math.floor(cfg.preDelay * sr * (ch === 0 ? 1 : 1.13))
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / (n - pre)
      // Tail envelope: exponential-ish, steeper for plate.
      const env = Math.pow(1 - t, cfg.curve)
      // HF damping walks closed as the tail decays -> late tail is dark.
      const a = cfg.hfDamp * (1 - t * 0.85)
      const w = rnd() * 2 - 1
      lp = lp + a * (w - lp)
      d[i] = lp * env
    }
    // Early reflections: sparse, decorrelated taps. This is what makes a space
    // read as a courtyard of tile rather than a generic wash.
    for (let k = 0; k < cfg.erCount; k++) {
      const tt = 0.004 + Math.pow(rnd(), 1.6) * 0.09
      const idx = pre + Math.floor(tt * sr)
      if (idx < n) d[idx] += (rnd() < 0.5 ? -1 : 1) * cfg.erGain * Math.pow(1 - tt / 0.1, 1.5)
    }
  }
  return buf
}

/**
 * Pre-baked grain buffers: band-passed, Hann-windowed noise at 8 centre
 * frequencies x 4 amplitudes.
 *
 * MEASURED REASON THIS EXISTS. The obvious granular implementation is
 * BufferSource -> BiquadFilter -> Gain -> StereoPanner per grain: four nodes
 * each. At 140 grains/s that measured **49.3% of one core** on an M-series Mac
 * — for a shimmer effect. The cost is node-graph bookkeeping, not DSP.
 *
 * Baking the band-pass and the window into the buffer, and baking amplitude
 * into a small set of pre-scaled variants, gets a grain down to ONE node
 * (a BufferSource fired into a shared panner). Same sound, a quarter of the
 * graph.
 */
const GRAIN_BANDS = [1400, 2000, 2800, 3900, 5400, 7200, 9600, 12800]
const GRAIN_AMPS = [0.25, 0.45, 0.7, 1.0]

const buildGrains = (ctx: BaseAudioContext): AudioBuffer[][] => {
  const sr = ctx.sampleRate
  const n = Math.floor(sr * 0.06)
  const rnd = mulberry32(0x6ea1)
  const out: AudioBuffer[][] = []
  for (let b = 0; b < GRAIN_BANDS.length; b++) {
    // 2-pole resonator excited by noise = a band-passed grain, computed in f64
    // here on the main thread once, never at play time.
    const f = GRAIN_BANDS[b]
    const t60 = 0.02
    const r = Math.pow(10, -3 / (t60 * sr))
    const w = (2 * Math.PI * f) / sr
    const c1 = 2 * r * Math.cos(w)
    const c2 = -(r * r)
    const raw = new Float64Array(n)
    let y1 = 0
    let y2 = 0
    let peak = 1e-9
    for (let i = 0; i < n; i++) {
      const x = i < 24 ? rnd() * 2 - 1 : 0
      const y = c1 * y1 + c2 * y2 + Math.sin(w) * x
      y2 = y1
      y1 = y
      raw[i] = y
      const a = Math.abs(y)
      if (a > peak) peak = a
    }
    const amps: AudioBuffer[] = []
    for (const amp of GRAIN_AMPS) {
      const buf = ctx.createBuffer(1, n, sr)
      const d = buf.getChannelData(0)
      for (let i = 0; i < n; i++) {
        // Hann window baked in: no per-grain envelope automation at all.
        const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
        d[i] = (raw[i] / peak) * win * amp
      }
      amps.push(buf)
    }
    out.push(amps)
  }
  return out
}

const memo = new WeakMap<BaseAudioContext, SharedTables>()

/** Get (and lazily build) the shared table set for a context. */
export const tablesFor = (ctx: BaseAudioContext): SharedTables => {
  const hit = memo.get(ctx)
  if (hit) return hit

  let white: AudioBuffer | null = null
  let pink: AudioBuffer | null = null
  let brown: AudioBuffer | null = null
  let velvet: AudioBuffer | null = null
  let safety: Float32Array<ArrayBuffer> | null = null
  let grains: AudioBuffer[][] | null = null
  const sat = new Map<number, Float32Array<ArrayBuffer>>()
  const irs = new Map<string, AudioBuffer>()

  const t: SharedTables = {
    white: () => (white ??= buildWhite(ctx)),
    pink: () => (pink ??= buildPink(ctx)),
    brown: () => (brown ??= buildBrown(ctx)),
    velvet: () => (velvet ??= buildVelvet(ctx)),
    saturation(amount) {
      const key = Math.round(amount * 20)
      let c = sat.get(key)
      if (!c) {
        c = buildSaturation(key / 20)
        sat.set(key, c)
      }
      return c
    },
    safetyClip: () => (safety ??= buildSafetyClip()),
    grain(band, amp) {
      grains ??= buildGrains(ctx)
      const b = grains[Math.max(0, Math.min(grains.length - 1, band))]
      return b[Math.max(0, Math.min(b.length - 1, amp))]
    },
    impulse(kind, seconds) {
      const key = `${kind}:${seconds.toFixed(2)}`
      let b = irs.get(key)
      if (!b) {
        b = buildImpulse(ctx, kind, seconds)
        irs.set(key, b)
      }
      return b
    },
  }
  memo.set(ctx, t)
  return t
}

/**
 * Force-build everything a tier can use. Call during a loading screen: it costs
 * tens of milliseconds ONCE instead of a frame hitch mid-play.
 */
export const warmTables = (ctx: BaseAudioContext, reverbSeconds: number): void => {
  const t = tablesFor(ctx)
  t.white()
  t.pink()
  t.brown()
  t.velvet()
  t.saturation(0.35)
  t.saturation(0.6)
  t.safetyClip()
  t.grain(0, 0)
  if (reverbSeconds > 0) {
    t.impulse("tile", reverbSeconds)
  }
}
