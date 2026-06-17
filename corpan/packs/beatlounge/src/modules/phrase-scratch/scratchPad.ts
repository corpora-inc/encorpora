/**
 * beatlounge — phrase-SCRATCH loop padding (rev-quantized, click-free).
 *
 * THE LOOP-ANGLE FIX. The phrase used to loop at its own raw duration, which is
 * almost never a whole number of `SECONDS_PER_REV` disc turns — so the phrase START
 * landed at a DIFFERENT angle on the disc every loop (the needle "in a different
 * place every time"). The fix (the founder's): pad the decoded wave with trailing
 * SILENCE up to an INTEGER number of revolutions (`paddedLoopSeconds`). The engine
 * wraps at this padded length, so after each loop the playhead returns to 0 at a
 * whole number of full turns → the phrase start comes back under the 3 o'clock
 * needle at the SAME angle, every loop. Time-per-revolution stays fixed; the mapping
 * is NOT scaled by duration.
 *
 * A short equal-power-ish fade at the phrase↔silence boundary (fade-OUT into the
 * trailing pad, fade-IN at the very start) is baked into the padded buffer so
 * looping through the silent gap is click-free even on a hard transient.
 *
 * The channel math is pure (operates on Float32Array, no AudioContext) so it is
 * unit-testable; `padBufferToRevolution` wraps it to build a real AudioBuffer.
 */

import { paddedLoopSeconds } from "./scratchMath"

/** Fade time (seconds) baked at each phrase↔silence boundary. ~22ms: inaudible as a
 *  level change, long enough to kill a click looping through the silent pad. */
export const BOUNDARY_FADE_SEC = 0.022

/**
 * Build the padded channel data for ONE channel: the real samples followed by
 * trailing zeros out to `paddedLength`, with a short fade-IN at the very start and a
 * fade-OUT into the trailing silence baked in. Pure — returns a new Float32Array of
 * `paddedLength`. If there's no padding (already a whole number of revs) the fades
 * still apply at the loop seam (end→start), so the wrap stays click-free.
 */
export const padChannelToLength = (
  src: Float32Array,
  realLength: number,
  paddedLength: number,
  fadeSamples: number
): Float32Array => {
  const out = new Float32Array(Math.max(0, paddedLength))
  const real = Math.min(realLength, src.length, out.length)
  out.set(src.subarray(0, real), 0)
  // tail past `real` is already zero (silence pad).
  const fade = Math.max(0, Math.min(fadeSamples, Math.floor(real / 2)))
  if (fade > 0) {
    // Fade IN at the very start (t=0) — the groove the needle drops onto each loop.
    for (let i = 0; i < fade; i++) {
      out[i] *= i / fade
    }
    // Fade OUT across the last `fade` samples of the real audio into the pad.
    for (let i = 0; i < fade; i++) {
      const idx = real - 1 - i
      if (idx >= 0) out[idx] *= i / fade
    }
  }
  return out
}

/**
 * Pad a decoded AudioBuffer with trailing silence to a WHOLE number of revolutions
 * and bake in the boundary fades. Returns a NEW AudioBuffer (same channel count +
 * sample rate) whose `duration` is `paddedLoopSeconds(original.duration)`. The deck
 * loads this padded buffer; the engine wraps at its length → rev-quantized loop.
 *
 * Safe: if the context can't create a buffer (or the source is empty) it returns the
 * original buffer unchanged, so the load never crashes.
 */
export const padBufferToRevolution = (
  ctx: BaseAudioContext,
  buffer: AudioBuffer
): AudioBuffer => {
  const sr = buffer.sampleRate
  const realLength = buffer.length
  if (!(sr > 0) || realLength <= 0) return buffer
  const paddedLength = Math.round(paddedLoopSeconds(buffer.duration) * sr)
  if (paddedLength <= realLength) return buffer
  const fadeSamples = Math.floor(BOUNDARY_FADE_SEC * sr)
  let padded: AudioBuffer
  try {
    padded = ctx.createBuffer(buffer.numberOfChannels, paddedLength, sr)
  } catch {
    return buffer
  }
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const out = padChannelToLength(src, realLength, paddedLength, fadeSamples)
    padded.getChannelData(c).set(out)
  }
  return padded
}
