/**
 * The numbers, and the arithmetic behind them. No Web Audio in this file —
 * everything here is a pure function, so the safety rules can be tested
 * without a device, a browser, or an `AudioContext`.
 *
 * Why this exists: a nine-year-old said MOSAIC almost made his ears explode.
 * It measured +7.4 dBFS on a single `clear()` and +22.9 dBFS when six of them
 * overlapped — 2.3x and 14x full scale. Those samples do not get quieter on
 * the way out; they get *clipped*, and a clipped transient is a burst of
 * broadband square wave arriving in about a millisecond. On headphones that is
 * the sound that hurts.
 *
 * Three separate things have to be true for that never to happen again, and
 * each has a constant here:
 *
 *   CEILING     nothing leaves the pack above this, ever, for any input.
 *   MIN_ATTACK  nothing rises from silence to peak faster than this.
 *   MAX_VOICES  no number of simultaneous hits can sum without bound.
 *
 * None of them is a volume knob. Turning a game down is the wrong fix and the
 * founder has said so: the direction is MORE juice. A limiter plus a shaped
 * attack usually makes a hit feel *punchier* while measuring lower, because
 * the transient stops clipping and starts being heard.
 */

/**
 * The absolute peak sample a pack may emit, linear, 0..1.
 *
 * -1 dBFS. Left under 1.0 on purpose: inter-sample peaks in a reconstructed
 * analogue signal can sit above the highest digital sample, and a DAC asked
 * for exactly 1.0 has nowhere to put them.
 */
export const CEILING = 0.89

/**
 * Where the output saturation curve stops being a straight line.
 *
 * Below this a signal passes through bit-for-bit — which is nearly all of the
 * time, since a typical single game cue measures 0.1..0.5. Above it the curve
 * bends over to CEILING. The bend is what makes the guarantee cheap: quiet
 * play is untouched, loud play is caught.
 */
export const KNEE = 0.5

/**
 * The shortest attack any envelope may use, in seconds.
 *
 * 6 ms. Games here were writing 0.001 — at 44.1 kHz that is 44 samples from
 * silence to full level, which is a step function with a click on it, and the
 * click is most of what a child hears as "too loud". 6 ms is still perceptually
 * instantaneous (the ear needs roughly 10 ms to resolve onset order) but it is
 * long enough that the limiter downstream has actually engaged by the time the
 * peak arrives.
 */
export const MIN_ATTACK = 0.006

/** No more than this many envelopes may be live at once, per bus. */
export const MAX_VOICES = 12

/**
 * Voices below this many are not attenuated at all. A cue built as
 * transient + body + tail is three voices and must sound exactly as authored.
 */
export const FREE_VOICES = 4

/** Clamp an envelope attack to something that is not a step function. */
export function safeAttack(seconds: number): number {
  if (!Number.isFinite(seconds)) return MIN_ATTACK
  return Math.max(MIN_ATTACK, seconds)
}

/**
 * How much to scale one voice when `live` of them are sounding together.
 *
 * Equal-power, not equal-amplitude: N voices scaled by sqrt(FREE/N) sum to
 * sqrt(FREE * N) rather than N, so twelve simultaneous hits are ~7x one hit
 * instead of 12x — still obviously "a lot happened", but bounded. The first
 * FREE_VOICES are free so the ordinary case is bit-identical to before.
 */
export function voiceScale(live: number): number {
  if (!Number.isFinite(live) || live <= FREE_VOICES) return 1
  return Math.sqrt(FREE_VOICES / live)
}

/**
 * The output saturation curve, sampled for a `WaveShaperNode`.
 *
 * Shape, for x in [-1, 1]:
 *   |x| <= KNEE      y = x                     (exactly transparent)
 *   |x| >  KNEE      y bends to CEILING with slope 0 at |x| = 1
 *
 * The exponent is chosen so the slope is continuous at the knee — a corner
 * there would be audible as its own distortion.
 *
 * The guarantee lives in the Web Audio spec: a WaveShaper given an input
 * outside [-1, 1] uses the nearest curve value. So the last entry of this
 * array is the peak the node can produce for *any* input, however absurd —
 * which is why CEILING is a fact about the graph and not a hope about it.
 */
export function shaperCurve(
  samples = 2048,
  ceiling = CEILING,
  knee = KNEE,
): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(samples * 4))
  const span = 1 - knee
  // Slope 1 at the knee requires (ceiling - knee) * p / span === 1.
  const p = span / (ceiling - knee)
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1
    curve[i] = shape(x, ceiling, knee, p)
  }
  return curve
}

/** The curve as a function, so a test can assert it without an array index. */
export function shape(x: number, ceiling = CEILING, knee = KNEE, p?: number): number {
  const span = 1 - knee
  const exp = p ?? span / (ceiling - knee)
  const a = Math.abs(x)
  const sign = x < 0 ? -1 : 1
  if (a <= knee) return x
  if (a >= 1) return sign * ceiling
  const u = (a - knee) / span
  return sign * (knee + (ceiling - knee) * (1 - Math.pow(1 - u, exp)))
}

/** Linear amplitude to dBFS, for reporting. */
export function dbfs(linear: number): number {
  return 20 * Math.log10(Math.abs(linear) || 1e-9)
}
