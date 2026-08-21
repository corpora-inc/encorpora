/**
 * The clock. Owns hitstop, slow-motion and the player's fast-forward, and hands
 * the simulation a fixed step so physics never depends on frame rate.
 */
import { clamp, damp } from "./easing.ts";

export const FIXED_DT = 1 / 60;

export class Clock {
  /** wall-clock seconds since start — animations that must not freeze use this */
  wall = 0;
  /** simulation seconds — hitstop and slow-mo bend this */
  sim = 0;
  /** player fast-forward, 1 or 2 */
  speed = 1;
  /** externally driven slow-motion target (1 = normal) */
  slowTarget = 1;
  /** smoothed slow-motion, so the ramp back out is felt, not switched */
  private slow = 1;
  /** remaining freeze in WALL seconds — render keeps running, sim does not */
  private stopFor = 0;
  private accumulator = 0;
  /** true while the sim is frozen; the renderer uses it to punch harder */
  frozen = false;

  /** freeze the simulation for `ms` — the single most valuable juice primitive */
  hitstop(ms: number): void {
    const s = ms / 1000;
    if (s > this.stopFor) this.stopFor = s;
  }

  reset(): void {
    this.wall = 0;
    this.sim = 0;
    this.speed = 1;
    this.slowTarget = 1;
    this.slow = 1;
    this.stopFor = 0;
    this.accumulator = 0;
    this.frozen = false;
  }

  /**
   * Advance by a real frame delta. Returns how many fixed sim steps to run.
   * Caps the accumulator so a backgrounded tab does not spiral on return.
   */
  advance(rawDt: number): number {
    const dt = clamp(rawDt, 0, 0.05);
    this.wall += dt;

    if (this.stopFor > 0) {
      this.stopFor -= dt;
      this.frozen = true;
      return 0;
    }
    this.frozen = false;

    this.slow = damp(this.slow, this.slowTarget, 6.5, dt);
    if (Math.abs(this.slow - this.slowTarget) < 0.004) this.slow = this.slowTarget;

    this.accumulator += dt * this.slow * this.speed;
    if (this.accumulator > 0.25) this.accumulator = 0.25;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 8) {
      this.accumulator -= FIXED_DT;
      steps++;
    }
    this.sim += steps * FIXED_DT;
    return steps;
  }

  /** current effective rate, for audio pitch and UI tinting */
  get scale(): number {
    return this.frozen ? 0 : this.slow * this.speed;
  }
}
