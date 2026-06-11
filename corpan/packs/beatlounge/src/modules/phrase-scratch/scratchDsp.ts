/**
 * beatlounge — phrase-SCRATCH core DSP (pure, no audio/DOM).
 *
 * THE HEART of the real turntable: one buffer, one floating-point playhead, a
 * signed variable rate, interpolated reads. This is the exact math the AudioWorklet
 * processor runs per render block — but extracted as pure functions so vitest can
 * test the DSP even though it can't instantiate an AudioWorklet. The processor
 * source (a string, see `scratchProcessor.ts`) INLINES the same algorithm; keep
 * the two in lockstep (the processor has a short note pointing here).
 *
 * Two control modes drive the single playhead:
 *   • POSITION (finger in contact): the main thread posts the exact buffer position
 *     the needle should be at each frame; the block advances the playhead LINEARLY
 *     from its current value toward that target — the emergent per-sample rate IS
 *     the finger's signed speed → real scratch, forward and reverse, natural pitch.
 *   • INERTIA (released): integrate `playhead += velocity` per sample with friction
 *     decay so the disc — and the audio — coast and slow to rest.
 *
 * No grains, no looping. The playhead clamps to [0, length]; past either end is
 * silence (run-off / lead-in), never a wrap. |rate|≈0 → silence (a held record).
 */

/** Sample-frames per second the friction is expressed in (release coast). */

/**
 * Read a buffer at a FRACTIONAL sample index with linear interpolation. Out of
 * range → 0 (silence past the run-off / lead-in; a real record does not wrap).
 * Linear is the pragmatic baseline; `cubicSample` (Catmull-Rom) is the lower-alias
 * upgrade used when there's headroom.
 */
export const linearSample = (data: Float32Array, idx: number): number => {
  const n = data.length
  if (n === 0) return 0
  if (idx <= 0) return idx < -1 ? 0 : data[0] * (1 + idx) // tiny lead-in ramp toward 0
  if (idx >= n - 1) return idx > n ? 0 : data[n - 1] * (1 - (idx - (n - 1)))
  const i = idx | 0
  const frac = idx - i
  const a = data[i]
  const b = data[i + 1]
  return a + (b - a) * frac
}

/**
 * Catmull-Rom (Hermite) 4-point cubic interpolation — lower aliasing than linear
 * for the same fractional read, at ~4 taps. Edges fall back to clamped neighbours
 * (and to silence fully out of range), so it never wraps and never reads garbage.
 */
export const cubicSample = (data: Float32Array, idx: number): number => {
  const n = data.length
  if (n === 0) return 0
  if (idx < -1 || idx > n) return 0
  if (idx <= 0) return data[0] * Math.max(0, 1 + idx)
  if (idx >= n - 1) return data[n - 1] * Math.max(0, 1 - (idx - (n - 1)))
  const i = idx | 0
  const frac = idx - i
  const x0 = data[i - 1 >= 0 ? i - 1 : 0]
  const x1 = data[i]
  const x2 = data[i + 1 < n ? i + 1 : n - 1]
  const x3 = data[i + 2 < n ? i + 2 : n - 1]
  // Catmull-Rom basis.
  const a0 = -0.5 * x0 + 1.5 * x1 - 1.5 * x2 + 0.5 * x3
  const a1 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3
  const a2 = -0.5 * x0 + 0.5 * x2
  const a3 = x1
  return ((a0 * frac + a1) * frac + a2) * frac + a3
}

/** Clamp a playhead sample index to [0, length] (NO wrap — a real record runs off). */
export const clampPlayhead = (idx: number, length: number): number => {
  if (!(length > 0)) return 0
  if (idx < 0) return 0
  if (idx > length) return length
  return idx
}

/* ---------------------------------------------------------------- POSITION mode */

export interface PositionBlockResult {
  /** Playhead (sample index) at the END of the block — feeds the next block. */
  playhead: number
  /** The signed per-sample increment used across the block (the emergent rate). */
  increment: number
}

/**
 * Advance the playhead LINEARLY across one render block toward `target`, computing
 * the per-sample increment = (target − playhead) / blockSize, and write the
 * interpolated samples into `out`. The emergent rate is the finger's signed speed.
 * Returns the playhead at the block end. `interp` selects linear vs cubic.
 *
 * Pure: takes the channel data + current playhead + target, fills the output. The
 * processor calls this per channel per block; the test calls it directly.
 */
export const renderPositionBlock = (
  data: Float32Array,
  out: Float32Array,
  playhead: number,
  target: number,
  interp: (d: Float32Array, idx: number) => number = linearSample
): PositionBlockResult => {
  const blockSize = out.length
  if (blockSize === 0) return { playhead, increment: 0 }
  const length = data.length
  const clampedTarget = clampPlayhead(target, length)
  const increment = (clampedTarget - playhead) / blockSize
  let ph = playhead
  for (let s = 0; s < blockSize; s++) {
    out[s] = interp(data, ph)
    ph += increment
  }
  return { playhead: clampPlayhead(clampedTarget, length), increment }
}

/* ----------------------------------------------------------------- INERTIA mode */

export interface InertiaBlockResult {
  playhead: number
  /** Velocity (samples/sample) at the END of the block, after friction decay. */
  velocity: number
}

/**
 * The per-render-block friction multiplier for a coast: keep `frictionPerSec` of
 * the velocity per second of real time, applied over `blockSize` samples at
 * `sampleRate`. Frame-rate independent (exponential).
 */
export const blockFriction = (
  frictionPerSec: number,
  blockSize: number,
  sampleRate: number
): number => {
  if (!(sampleRate > 0)) return 1
  return Math.pow(frictionPerSec, blockSize / sampleRate)
}

/**
 * Integrate the playhead over one block in INERTIA mode: advance by `velocity`
 * (samples per output-sample) each sample, decaying the velocity smoothly across
 * the block by `blockMul` (from `blockFriction`). Reads interpolated samples into
 * `out`. Below `stopSamplesPerSample` the coast is dead → the result velocity is 0
 * (silence, a held record — not a frozen DC tone). Clamps at the ends (run-off).
 */
export const renderInertiaBlock = (
  data: Float32Array,
  out: Float32Array,
  playhead: number,
  velocity: number,
  blockMul: number,
  stopSamplesPerSample: number,
  interp: (d: Float32Array, idx: number) => number = linearSample
): InertiaBlockResult => {
  const blockSize = out.length
  const length = data.length
  if (blockSize === 0) return { playhead, velocity }
  if (Math.abs(velocity) < stopSamplesPerSample) {
    out.fill(0)
    return { playhead, velocity: 0 }
  }
  // Decay velocity smoothly per-sample so the block end matches blockMul exactly.
  const perSampleMul = Math.pow(blockMul, 1 / blockSize)
  let ph = playhead
  let v = velocity
  for (let s = 0; s < blockSize; s++) {
    out[s] = interp(data, ph)
    ph += v
    v *= perSampleMul
    if (ph <= 0 || ph >= length) {
      // Hit the run-off / lead-in: stop dead there (no wrap, no bounce).
      ph = clampPlayhead(ph, length)
      v = 0
      // Zero the remainder of the block (silence past the edge).
      for (let r = s + 1; r < blockSize; r++) out[r] = 0
      break
    }
  }
  const endV = Math.abs(v) < stopSamplesPerSample ? 0 : v
  return { playhead: clampPlayhead(ph, length), velocity: endV }
}
