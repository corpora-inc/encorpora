/**
 * A polyphony budget with an injected clock.
 *
 * Every game here counted voices with `this.voices++` and a `setTimeout` that
 * decremented it. Two things go wrong with that. The counter is checked
 * against a cap of 26 that no cue could realistically reach, so it never fired;
 * and cues that built their envelope inline instead of through the game's
 * `env()` helper never touched the counter at all — in MOSAIC that was
 * `clear()`, `power()`, `forgeRight()` and `chargeFull()`, which is to say the
 * four loudest sounds in the game were the four that were not counted.
 *
 * This has no timers. It is a list of expiry times and a clock the caller
 * passes in, which means a test can play a thousand overlapping hits in a
 * microsecond and assert exactly what came out.
 */

import { MAX_VOICES, voiceScale } from "./ceiling.ts"

export class VoiceBudget {
  private readonly max: number
  /** Expiry times, seconds on the caller's clock. Kept sorted-ish by pruning. */
  private expiries: number[] = []

  constructor(max: number = MAX_VOICES) {
    this.max = Math.max(1, Math.floor(max))
  }

  /** How many voices are live as of `now`. */
  live(now: number): number {
    this.prune(now)
    return this.expiries.length
  }

  /**
   * Ask for a voice lasting `seconds` from `now`.
   *
   * Returns the gain multiplier to apply to it: 1 when the bus is quiet, less
   * as it fills, and 0 when the budget is spent — 0 meaning "do not play this",
   * which the caller must honour by not building the node at all.
   */
  take(seconds: number, now: number): number {
    this.prune(now)
    if (this.expiries.length >= this.max) return 0
    this.expiries.push(now + Math.max(0, seconds))
    return voiceScale(this.expiries.length)
  }

  /** Drop everything — a level restart, a mute, a context teardown. */
  clear(): void {
    this.expiries.length = 0
  }

  private prune(now: number): void {
    if (this.expiries.length === 0) return
    const keep: number[] = []
    for (const e of this.expiries) if (e > now) keep.push(e)
    this.expiries = keep
  }
}
