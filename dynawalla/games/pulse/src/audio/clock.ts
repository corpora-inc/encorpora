/**
 * One clock, and it is the audio one.
 *
 * **The bug this exists for.** "On chromebook the timing seems to be a little
 * bit off for the music and the visual. It must be 100% in sync to work."
 *
 * `AudioContext.currentTime` is not a continuous reading of the audio hardware.
 * It is the timestamp of the last render block the audio thread finished and
 * published to the main thread, so it advances in STEPS the size of the output
 * callback and holds still in between — 128 frames (2.7 ms) where the browser
 * can manage it, and 480 or 960 frames (10–20 ms) on a device whose audio stack
 * cannot, which describes a Chromebook exactly. Read it at an arbitrary moment
 * and the answer is uniformly 0..q too small.
 *
 * The old code read it raw, twice, for two different purposes:
 *
 *   - the picture, once per frame, off `now() - outputLatency`
 *   - the judgment, at every tap, off `now() - performance.now()`
 *
 * Each read carried its own independent 0..q error, so the same tap could be
 * judged up to a full callback early, at random, and the amount depended
 * entirely on how big that device's audio callback happened to be. On a machine
 * with a 20 ms callback that is a third of the ±55 ms PERFECT window, spent on
 * nothing, and it is invisible on a Mac and obvious on a Chromebook. That is not
 * "two clocks drifting" in the textbook sense — it is worse, because a drift is
 * at least consistent.
 *
 * **The fix.** Keep ONE model of the transport: `audioTime = perfTime + offset`.
 * `performance.now()` supplies resolution and smoothness; the audio clock
 * supplies truth and is the only thing `offset` is ever derived from — it stays
 * the master, and nothing here can make the transport run at a rate the audio
 * hardware is not running at.
 *
 * `offset` is estimated as the running MAXIMUM of `currentTime - perfNow`,
 * which is the trick that recovers what the quantisation threw away: because
 * `currentTime` is only ever rounded DOWN, the largest sample in a short window
 * is the one taken closest to a block boundary, and it is the least wrong. It is
 * then allowed to fall back slowly, so a genuine difference in rate between the
 * two clocks (crystal drift, a resampled output device) is tracked rather than
 * latched, and it re-anchors outright when the two disagree by more than a
 * pause's worth — which is exactly what a suspended context looks like.
 */

/**
 * How fast `offset` may fall, in seconds per second.
 *
 * Real drift between an audio clock and `performance.now()` is on the order of
 * 100 ppm — two crystals, both good. 500 ppm tracks that five times over, and
 * it is also what sets the residual error between two lucky samples: at 500 ppm
 * the model gives away half a millisecond a second, so a boundary-aligned
 * sample every couple of seconds is enough to hold it under a millisecond.
 * Faster and the residual grows; slower and a genuine rate difference takes
 * minutes to track out.
 */
const DRIFT_PER_SEC = 0.0005;

/**
 * Disagreement above which the model is wrong rather than stale, and is thrown
 * away and rebuilt from the current reading.
 *
 * A suspended `AudioContext` freezes `currentTime` while `performance.now()`
 * keeps running, so every pause produces exactly this and it must snap back the
 * instant the context resumes rather than bleed off at the drift rate.
 */
const RESYNC_SEC = 0.2;

export type ClockSources = {
  /** The master. `AudioContext.currentTime`, in seconds. */
  audio: () => number;
  /** The interpolator. `performance.now() / 1000`. */
  perf: () => number;
};

export class TransportClock {
  private readonly src: ClockSources;
  private offset: number | null = null;
  private lastPerf = 0;
  /** Widest gap seen between a raw reading and the model, for the perf overlay. */
  private worstRawError = 0;

  constructor(src: ClockSources) {
    this.src = src;
  }

  /**
   * Re-anchor on the master and return the current offset. Cheap, and called
   * from every read, so there is no "remember to pump it once a frame" rule to
   * get wrong.
   */
  private sync(): number {
    const p = this.src.perf();
    const raw = this.src.audio() - p;
    const prev = this.offset;
    if (prev === null || raw > prev || prev - raw > RESYNC_SEC) {
      this.offset = raw;
    } else {
      const dt = Math.max(0, p - this.lastPerf);
      this.offset = Math.max(raw, prev - DRIFT_PER_SEC * dt);
      const err = this.offset - raw;
      if (err > this.worstRawError) this.worstRawError = err;
    }
    this.lastPerf = p;
    return this.offset;
  }

  /** Audio-clock time, now, at `performance.now()`'s resolution. */
  now(): number {
    return this.src.perf() + this.sync();
  }

  /**
   * Audio-clock time of a moment stamped on the `performance.now()` timeline —
   * a pointer or key event, whose `timeStamp` is exactly that.
   *
   * The whole point of routing input through the same model: a tap and the
   * picture it was aimed at are converted by one function, so they cannot
   * disagree by a quantisation error that only one of them paid.
   */
  timeAtPerf(perfSec: number): number {
    return perfSec + this.sync();
  }

  /**
   * How far the raw `currentTime` reading is currently lagging the model — i.e.
   * how much error every direct read of `currentTime` would be carrying. Zero
   * on a device whose audio clock is genuinely continuous; the size of the
   * output callback on one whose is not.
   */
  quantisationError(): number {
    return this.worstRawError;
  }
}
