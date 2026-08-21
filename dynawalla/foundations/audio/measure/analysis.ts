/**
 * Signal analysis for the measurement harness. Zero dependencies.
 *
 * Everything here is used to make claims about the kit's SOUND that are
 * numbers rather than adjectives: measured decay times, measured pitch,
 * measured loudness, measured spectral centroid, measured peak.
 */

/** In-place iterative radix-2 FFT. `re`/`im` length must be a power of two. */
export const fft = (re: Float64Array, im: Float64Array): void => {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]
        const ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr
        im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr
        im[i + k + len / 2] = ui - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

const hann = (n: number): Float64Array => {
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
  return w
}

export const db = (x: number): number => 20 * Math.log10(Math.max(1e-12, x))

export interface Metrics {
  peakDb: number
  rmsDb: number
  /** Max momentary loudness, BS.1770 K-weighted, 400 ms window. */
  lufsMax: number
  /** Seconds from onset until the envelope is 60 dB below its peak. */
  decayTo60: number
  /** Where the energy sits, Hz — the honest number behind "bright" / "dark". */
  centroidHz: number
  /** Peak / RMS in dB. Percussive material is 12-20 dB; a synth pad is < 6. */
  crestDb: number
  /** Fraction of samples at or beyond full scale. Must be 0. */
  clippedFraction: number
  /** DC offset. Anything above ~0.002 wastes headroom and thumps on start. */
  dcOffset: number
  /** Energy above 8 kHz as a fraction of total — the "air" of a sound. */
  airRatio: number
  /** Energy below 120 Hz as a fraction of total — the "weight". */
  weightRatio: number
}

/** Mono-sum, then measure. Stereo width is measured separately. */
export const toMono = (chans: Float32Array[]): Float32Array => {
  if (chans.length === 1) return chans[0]
  const n = chans[0].length
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let c = 0; c < chans.length; c++) s += chans[c][i]
    out[i] = s / chans.length
  }
  return out
}

/**
 * ITU-R BS.1770 K-weighting: a +4 dB high shelf at ~1.5 kHz followed by a
 * ~38 Hz high-pass (RLB). Coefficients are the standard 48 kHz ones; we
 * re-derive them for other rates so a 44.1 kHz device is not measured wrong.
 */
const kWeight = (x: Float32Array, sr: number): Float64Array => {
  // Stage 1: high shelf.
  const f0 = 1681.974450955533
  const G = 3.999843853973347
  const Q = 0.7071752369554196
  const K = Math.tan((Math.PI * f0) / sr)
  const Vh = Math.pow(10, G / 20)
  const Vb = Math.pow(Vh, 0.4996667741545416)
  const a0_ = 1 + K / Q + K * K
  const b0 = (Vh + (Vb * K) / Q + K * K) / a0_
  const b1 = (2 * (K * K - Vh)) / a0_
  const b2 = (Vh - (Vb * K) / Q + K * K) / a0_
  const a1 = (2 * (K * K - 1)) / a0_
  const a2 = (1 - K / Q + K * K) / a0_
  // Stage 2: RLB high-pass.
  const f0b = 38.13547087602444
  const Qb = 0.5003270373238773
  const Kb = Math.tan((Math.PI * f0b) / sr)
  const a0b = 1 + Kb / Qb + Kb * Kb
  const b0b = 1
  const b1b = -2
  const b2b = 1
  const a1b = (2 * (Kb * Kb - 1)) / a0b
  const a2b = (1 - Kb / Qb + Kb * Kb) / a0b

  const y = new Float64Array(x.length)
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = v
    y[i] = v
  }
  let u1 = 0,
    u2 = 0,
    v1 = 0,
    v2 = 0
  for (let i = 0; i < y.length; i++) {
    const u = y[i]
    const v = (b0b * u + b1b * u1 + b2b * u2 - a1b * v1 - a2b * v2) / 1
    u2 = u1
    u1 = u
    v2 = v1
    v1 = v
    y[i] = v
  }
  return y
}

export const analyse = (chans: Float32Array[], sr: number): Metrics => {
  const x = toMono(chans)
  const n = x.length
  let peak = 0
  let sum = 0
  let dc = 0
  let clipped = 0
  for (let i = 0; i < n; i++) {
    const a = Math.abs(x[i])
    if (a > peak) peak = a
    if (a >= 0.99999) clipped++
    sum += x[i] * x[i]
    dc += x[i]
  }
  const rms = Math.sqrt(sum / n)

  // Momentary loudness, 400 ms blocks, 100 ms hop.
  const k = kWeight(x, sr)
  const block = Math.floor(sr * 0.4)
  const hop = Math.floor(sr * 0.1)
  let lufsMax = -Infinity
  for (let s = 0; s + block <= n; s += hop) {
    let e = 0
    for (let i = s; i < s + block; i++) e += k[i] * k[i]
    const l = -0.691 + 10 * Math.log10(Math.max(1e-12, e / block))
    if (l > lufsMax) lufsMax = l
  }
  if (!isFinite(lufsMax) && n > 0) {
    let e = 0
    for (let i = 0; i < n; i++) e += k[i] * k[i]
    lufsMax = -0.691 + 10 * Math.log10(Math.max(1e-12, e / n))
  }

  // Decay to -60 dB from peak, measured on a 5 ms RMS envelope.
  const win = Math.max(1, Math.floor(sr * 0.005))
  let peakEnv = 0
  let peakIdx = 0
  const envN = Math.floor(n / win)
  const env = new Float64Array(envN)
  for (let b = 0; b < envN; b++) {
    let e = 0
    for (let i = b * win; i < (b + 1) * win; i++) e += x[i] * x[i]
    env[b] = Math.sqrt(e / win)
    if (env[b] > peakEnv) {
      peakEnv = env[b]
      peakIdx = b
    }
  }
  let decayTo60 = (n - peakIdx * win) / sr
  const target = peakEnv * 0.001
  for (let b = peakIdx; b < envN; b++) {
    if (env[b] < target) {
      decayTo60 = ((b - peakIdx) * win) / sr
      break
    }
  }

  // Spectral centroid + band ratios over the first 4096-sample window at peak.
  const N = 4096
  const start = Math.min(Math.max(0, peakIdx * win), Math.max(0, n - N))
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  const w = hann(N)
  for (let i = 0; i < N; i++) re[i] = (x[start + i] ?? 0) * w[i]
  fft(re, im)
  let num = 0
  let den = 0
  let air = 0
  let weight = 0
  for (let bin = 1; bin < N / 2; bin++) {
    const mag = Math.hypot(re[bin], im[bin])
    const f = (bin * sr) / N
    num += f * mag
    den += mag
    if (f > 8000) air += mag
    if (f < 120) weight += mag
  }

  return {
    peakDb: db(peak),
    rmsDb: db(rms),
    lufsMax,
    decayTo60,
    centroidHz: den > 0 ? num / den : 0,
    crestDb: db(peak) - db(rms),
    clippedFraction: clipped / n,
    dcOffset: dc / n,
    airRatio: den > 0 ? air / den : 0,
    weightRatio: den > 0 ? weight / den : 0,
  }
}

/**
 * Fundamental frequency, McLeod (NSDF) method.
 *
 * MEASUREMENT TRAP, HIT AND FIXED: the obvious implementation — raw
 * autocorrelation, take the largest value in [minLag, maxLag] — is WRONG for
 * any decaying sound. Raw autocorrelation falls monotonically with lag because
 * the signal is getting quieter, so the maximum lands on the lower bound of the
 * search and you "measure" whatever `maxHz` you passed in. The first run of
 * this harness reported every plucked string as exactly 1.7045x its true
 * pitch — a perfectly consistent, perfectly wrong number, which is the most
 * dangerous kind.
 *
 * The NSDF normalises by the energy in BOTH windows, which removes the decay
 * bias entirely, and then picks the first peak within 88% of the global max
 * (rather than the global max itself) so an octave error cannot occur.
 */
export const estimatePitch = (x: Float32Array, sr: number, minHz = 60, maxHz = 4000): number => {
  const minLag = Math.max(2, Math.floor(sr / maxHz))
  const maxLag = Math.min(Math.floor(sr / minHz), Math.floor(x.length / 2) - 1)
  if (maxLag <= minLag) return 0
  const n = x.length
  const nsdf = new Float64Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let r = 0
    let m = 0
    const lim = n - lag
    for (let i = 0; i < lim; i++) {
      const a = x[i]
      const b = x[i + lag]
      r += a * b
      m += a * a + b * b
    }
    nsdf[lag] = m > 0 ? (2 * r) / m : 0
  }
  let globalMax = 0
  for (let lag = minLag; lag <= maxLag; lag++) if (nsdf[lag] > globalMax) globalMax = nsdf[lag]
  if (globalMax <= 0) return 0
  const threshold = globalMax * 0.88
  let bestLag = -1
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1] && nsdf[lag] >= threshold) {
      bestLag = lag
      break
    }
  }
  if (bestLag < 0) return 0
  // Parabolic interpolation for sub-sample precision (the difference between
  // "within 3 cents" and "within 40 cents").
  const y0 = nsdf[bestLag - 1]
  const y1 = nsdf[bestLag]
  const y2 = nsdf[bestLag + 1]
  const denom = y0 - 2 * y1 + y2
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0
  return sr / (bestLag + shift)
}

/** Cents between two frequencies. */
export const centsBetween = (a: number, b: number): number => 1200 * Math.log2(a / b)

/**
 * T20-style decay estimate: fit the dB envelope between -5 and -25 dB below
 * peak and extrapolate to -60. Far more robust than "when did it cross -60",
 * which any noise floor ruins.
 */
export const measureT60 = (x: Float32Array, sr: number): number => {
  const win = Math.max(1, Math.floor(sr * 0.005))
  const envN = Math.floor(x.length / win)
  const env: number[] = []
  for (let b = 0; b < envN; b++) {
    let e = 0
    for (let i = b * win; i < (b + 1) * win; i++) e += x[i] * x[i]
    env.push(Math.sqrt(e / win))
  }
  let peak = 0
  let peakIdx = 0
  for (let i = 0; i < env.length; i++)
    if (env[i] > peak) {
      peak = env[i]
      peakIdx = i
    }
  const pts: [number, number][] = []
  for (let i = peakIdx; i < env.length; i++) {
    const d = db(env[i] / peak)
    if (d <= -5 && d >= -25) pts.push([((i - peakIdx) * win) / sr, d])
    if (d < -25) break
  }
  if (pts.length < 4) return NaN
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0
  for (const [t, d] of pts) {
    sx += t
    sy += d
    sxx += t * t
    sxy += t * d
  }
  const nn = pts.length
  const slope = (nn * sxy - sx * sy) / (nn * sxx - sx * sx)
  if (slope >= 0) return NaN
  return -60 / slope
}
