/**
 * Hitstop — Vlambeer's "Art of Screenshake", with the one adjustment a rhythm game
 * demands.
 *
 * A normal action game freezes the whole simulation for a few frames on impact. Here
 * the simulation is *music*: freeze it and the groove desynchronises, which is worse
 * than no juice at all. So hitstop dilates only the **effects clock** — particles,
 * ripples, the camera punch, the trail decay — while notes and audio stay welded to
 * the audio clock. You get the slam without ever dropping a beat.
 */

export class Hitstop {
  private remaining = 0;
  private scale = 1;

  /**
   * @param ms      how long the effects clock is dilated
   * @param factor  0 = frozen, 0.25 = quarter speed
   */
  hit(ms: number, factor = 0): void {
    const secs = ms / 1000;
    if (secs <= this.remaining && factor >= this.scale) return;
    this.remaining = Math.max(this.remaining, secs);
    this.scale = Math.min(this.scale, factor);
  }

  /** Consume real dt, return the dt the effects layer should use. */
  step(dt: number): number {
    if (this.remaining <= 0) {
      this.scale = 1;
      return dt;
    }
    const used = Math.min(dt, this.remaining);
    this.remaining -= dt;
    if (this.remaining <= 0) {
      const rest = -this.remaining;
      this.remaining = 0;
      const out = used * this.scale + rest;
      this.scale = 1;
      return out;
    }
    return dt * this.scale;
  }

  get active(): boolean {
    return this.remaining > 0;
  }

  reset(): void {
    this.remaining = 0;
    this.scale = 1;
  }
}
