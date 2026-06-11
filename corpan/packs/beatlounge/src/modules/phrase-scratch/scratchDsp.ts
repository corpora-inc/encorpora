/**
 * beatlounge — phrase-SCRATCH core DSP (pure, no audio/DOM).
 *
 * THE HEART of the real turntable: one buffer, one floating-point playhead, ONE
 * continuous signed RATE, interpolated reads. A real turntablist's hand never
 * "snaps the needle to a target and freezes between frames"; the platter is always
 * MOVING at the hand's current speed. So the engine drives the playhead by a
 * CONTINUOUS rate integrated EVERY sample:
 *
 *     playhead += rate            // every sample, continuously
 *     rate     += (targetRate − rate) * slew   // one-pole smoothing toward target
 *
 * The main thread posts a target rate (signed, buffer-samples per output-sample,
 * derived from the disc's angular speed). Between posts the worklet keeps moving at
 * the last rate, so the audio is ALWAYS gliding — never the ~3ms-then-frozen-DC buzz
 * the old snap-to-target/position engine produced. A light one-pole slew on the rate
 * removes per-frame jitter without perceptible lag.
 *
 * The phrase LOOPS: the playhead WRAPS modulo the phrase length (past the end →
 * start, past the start → end), so continuous spinning replays the phrase, exactly
 * like dropping the needle on a locked groove. (`wrapPlayhead`.)
 *
 * This is the exact math the AudioWorklet processor runs per render block, extracted
 * as pure functions so vitest can test it (it can't instantiate an AudioWorklet).
 * The processor source (a string, see `scratchProcessor.ts`) INLINES the same
 * algorithm; keep the two in lockstep (the processor has a note pointing here).
 */

/**
 * WRAP a playhead sample index into [0, length) (modulo) — the phrase LOOPS. Past
 * the end wraps to the start; past the start wraps to the end. A locked groove, not
 * a run-off. (`clampPlayhead` is kept for the rare hard-edge case but the default
 * playback wraps.)
 */
export const wrapPlayhead = (idx: number, length: number): number => {
  if (!(length > 0)) return 0
  let p = idx % length
  if (p < 0) p += length
  return p
}

/** Clamp a playhead sample index to [0, length] (hard edge — NO wrap). Retained for
 *  callers that truly want a wall; the live engine uses `wrapPlayhead` (loop). */
export const clampPlayhead = (idx: number, length: number): number => {
  if (!(length > 0)) return 0
  if (idx < 0) return 0
  if (idx > length) return length
  return idx
}

/**
 * Read a buffer at a FRACTIONAL sample index with linear interpolation. The buffer
 * is treated as a LOOP (the phrase wraps), so neighbours wrap modulo length — there
 * is no run-off discontinuity. Linear is the pragmatic baseline; `cubicSample`
 * (Catmull-Rom) is the lower-alias upgrade used when there's headroom.
 */
export const linearSample = (data: Float32Array, idx: number): number => {
  const n = data.length
  if (n === 0) return 0
  // Wrap into [0, n); interpolate against the NEXT sample (wrapping at the seam).
  let p = idx % n
  if (p < 0) p += n
  const i = p | 0
  const frac = p - i
  const a = data[i]
  const b = data[(i + 1) % n]
  return a + (b - a) * frac
}

/**
 * Catmull-Rom (Hermite) 4-point cubic interpolation — lower aliasing than linear for
 * the same fractional read, at ~4 taps. The buffer is a LOOP, so all four taps wrap
 * modulo length (continuous across the loop seam — no clicks at the wrap).
 */
export const cubicSample = (data: Float32Array, idx: number): number => {
  const n = data.length
  if (n === 0) return 0
  if (n < 4) return linearSample(data, idx)
  let p = idx % n
  if (p < 0) p += n
  const i = p | 0
  const frac = p - i
  const x0 = data[(i - 1 + n) % n]
  const x1 = data[i]
  const x2 = data[(i + 1) % n]
  const x3 = data[(i + 2) % n]
  const a0 = -0.5 * x0 + 1.5 * x1 - 1.5 * x2 + 0.5 * x3
  const a1 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3
  const a2 = -0.5 * x0 + 0.5 * x2
  const a3 = x1
  return ((a0 * frac + a1) * frac + a2) * frac + a3
}

/* ----------------------------------------------------- continuous-rate integration */

/** Default per-sample slew toward the target rate (one-pole). Bigger = snappier /
 *  closer to the finger; smaller = smoother / laggier. Tuned for "no jitter, no
 *  perceptible lag" at typical block sizes. */
export const DEFAULT_RATE_SLEW = 0.0042

export interface RateBlockResult {
  /** Playhead (wrapped sample index) at the END of the block — feeds the next block. */
  playhead: number
  /** Rate (samples/output-sample) at the END of the block, after slewing. */
  rate: number
}

/**
 * Render ONE block by integrating a CONTINUOUS rate. Each sample: read (interpolated,
 * looping) at the playhead, advance `playhead += rate` (wrapped modulo length), and
 * slew `rate` one step toward `targetRate`. This is the whole engine — finger-down,
 * spin, and coast are all just different `targetRate`s. Pure: takes channel data +
 * current playhead + rate + targetRate, fills the output, returns the new state.
 *
 *   • `targetRate` = the desired signed rate (samples/output-sample). The main thread
 *     posts it; the worklet keeps integrating the last rate between posts so the
 *     audio never freezes.
 *   • `slew` ∈ (0,1]: the per-sample one-pole coefficient toward `targetRate`. 1 =
 *     instant (no smoothing). Default `DEFAULT_RATE_SLEW`.
 *   • The phrase LOOPS (`wrapPlayhead`).
 */
export const renderRateBlock = (
  data: Float32Array,
  out: Float32Array,
  playhead: number,
  rate: number,
  targetRate: number,
  slew: number = DEFAULT_RATE_SLEW,
  interp: (d: Float32Array, idx: number) => number = linearSample
): RateBlockResult => {
  const blockSize = out.length
  const length = data.length
  if (blockSize === 0) return { playhead, rate }
  if (!(length > 0)) {
    out.fill(0)
    return { playhead: 0, rate: 0 }
  }
  const k = slew <= 0 ? 0 : slew >= 1 ? 1 : slew
  let ph = playhead
  let r = rate
  for (let s = 0; s < blockSize; s++) {
    out[s] = interp(data, ph)
    ph += r
    // Wrap inline (cheap branch; modulo only on the rare overrun) so playhead never
    // grows unbounded over a long spin.
    if (ph >= length) ph -= length
    else if (ph < 0) ph += length
    if (ph >= length || ph < 0) ph = wrapPlayhead(ph, length)
    r += (targetRate - r) * k
  }
  return { playhead: ph, rate: r }
}
