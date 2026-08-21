/**
 * Envelope and parameter-automation helpers.
 *
 * WebAudio's automation API has three sharp edges that bite every newcomer and
 * cause 90% of "my synth clicks":
 *
 *  1. `exponentialRampToValueAtTime` cannot start at 0 and cannot end at 0.
 *     Ramping a gain from 0 exponentially silently does nothing useful.
 *  2. `setTargetAtTime` NEVER reaches its target. If you stop the source at
 *     "when the decay ends" you cut a still-audible tail = click.
 *  3. Automation events queue; a second trigger on the same param without
 *     cancelling produces a fight, not a retrigger.
 *
 * These helpers close all three. Every preset uses them; no preset calls
 * `gain.gain.*` directly.
 */

/** -60dB in natural log units. `setTargetAtTime` reaches -60dB at 6.9078·tau. */
export const T60_TAUS = 6.907755278982137

/** Decay time (to -60dB) -> setTargetAtTime time constant. */
export const tauFor = (t60: number): number => t60 / T60_TAUS

/** Smallest gain we treat as silence. Below this nothing is audible at any sane level. */
export const SILENCE = 1e-4

/**
 * Percussive attack/decay on a gain param.
 *
 * Attack is LINEAR (a 1-3ms linear rise is inaudible as a ramp but removes the
 * discontinuity that makes a click). Decay is `setTargetAtTime` — the natural
 * shape of everything that is struck, plucked or dropped — and is then forced
 * to exactly zero at the -60dB point so the voice can be reclaimed with no tail
 * chop.
 *
 * Returns the context time the envelope is truly silent.
 */
export const percEnv = (
  p: AudioParam,
  when: number,
  peak: number,
  attack: number,
  decay: number,
): number => {
  const a = Math.max(0.0005, attack)
  p.cancelScheduledValues(when)
  p.setValueAtTime(0, when)
  p.linearRampToValueAtTime(peak, when + a)
  p.setTargetAtTime(0, when + a, tauFor(decay))
  const end = when + a + decay
  // Guarantee true zero. Without this the param asymptotes forever and a
  // long-lived node (a filter's gain, a bus) keeps a DC-ish crumb alive.
  p.setValueAtTime(0, end)
  return end
}

/**
 * Sustained attack/hold/release. Returns a `release(at)` and the natural end if
 * never released.
 */
export const adsrEnv = (
  p: AudioParam,
  when: number,
  peak: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
): { release(at: number): number; naturalEnd: number } => {
  const a = Math.max(0.001, attack)
  p.cancelScheduledValues(when)
  p.setValueAtTime(0, when)
  p.linearRampToValueAtTime(peak, when + a)
  p.setTargetAtTime(peak * sustain, when + a, tauFor(Math.max(0.01, decay)))
  return {
    release(at: number) {
      const t = Math.max(at, when + a)
      holdCurrent(p, t)
      p.setTargetAtTime(0, t, tauFor(release))
      const end = t + release
      p.setValueAtTime(0, end)
      return end
    },
    naturalEnd: Infinity,
  }
}

/**
 * Cancel pending automation but keep the value the param has RIGHT NOW.
 *
 * `cancelAndHoldAtTime` is the correct call and exists in Chrome and Safari;
 * Firefox shipped it late and some WebViews still lack it. The fallback reads
 * `.value` (which reflects the computed automation value) and pins it. Without
 * this, a duck that fires mid-release jumps to the pre-ramp value = a thump.
 */
export const holdCurrent = (p: AudioParam, at: number): void => {
  const anyP = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => void }
  if (typeof anyP.cancelAndHoldAtTime === "function") {
    anyP.cancelAndHoldAtTime(at)
  } else {
    const v = p.value
    p.cancelScheduledValues(at)
    p.setValueAtTime(v, at)
  }
}

/**
 * Exponential glide that tolerates zero endpoints — the workhorse for pitch
 * sweeps, filter sweeps and "chunk" pitch drops.
 */
export const glide = (
  p: AudioParam,
  when: number,
  from: number,
  to: number,
  time: number,
): void => {
  const f = Math.max(1e-5, from)
  const t = Math.max(1e-5, to)
  p.cancelScheduledValues(when)
  p.setValueAtTime(f, when)
  p.exponentialRampToValueAtTime(t, when + Math.max(0.001, time))
}

/**
 * A smooth "chunk" pitch drop: fast exponential fall then a short settle. This
 * two-stage shape is the difference between a satisfying woody thock and a
 * cartoon slide-whistle.
 */
export const thock = (
  p: AudioParam,
  when: number,
  start: number,
  end: number,
  fall: number,
): void => {
  p.cancelScheduledValues(when)
  p.setValueAtTime(Math.max(1e-5, start), when)
  p.exponentialRampToValueAtTime(Math.max(1e-5, end * 1.06), when + fall * 0.7)
  p.exponentialRampToValueAtTime(Math.max(1e-5, end), when + fall)
}
