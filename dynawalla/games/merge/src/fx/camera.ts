import type { Rgb } from "./palette.ts";

/**
 * The screenshake module, in the Vlambeer sense.
 *
 * Trauma-based shake (Squirrel Eiserloh's model: store trauma, shake by
 * trauma^2 so small hits are subtle and big ones are violent), a spring-damped
 * zoom punch, hitstop, and a slow-motion time scale. Every one of these is a
 * *feel* channel and every one degrades to nothing under reduced motion —
 * without ever removing information, because none of them carry any.
 */

export type Flash = { a: number; c: Rgb; t: number };

const TAU = Math.PI * 2;

export class Camera {
  trauma = 0;
  /** additive zoom, 0 = neutral */
  zoom = 0;
  private zoomV = 0;
  rot = 0;
  x = 0;
  y = 0;

  /** ms of frozen logic remaining */
  hitstop = 0;
  /** current time scale applied to logic */
  timeScale = 1;
  private slowUntil = 0;
  private slowAmount = 1;

  flashes: Flash[] = [];
  private flashTimes: number[] = [];

  reduced = false;
  private seed = 1337;
  private clock = 0;

  private noise(t: number, o: number): number {
    // cheap deterministic value noise: sum of two sines with irrational-ish
    // ratios. No allocation, no Math.random, stable per frame.
    const a = Math.sin((t * 21.7 + o * 13.3) * 0.001 * TAU * 6.3 + this.seed);
    const b = Math.sin((t * 9.1 + o * 41.7) * 0.001 * TAU * 11.9 - this.seed);
    return a * 0.62 + b * 0.38;
  }

  shake(amount: number): void {
    if (this.reduced) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  punch(amount: number): void {
    if (this.reduced) {
      return;
    }
    this.zoomV += amount;
  }

  stop(ms: number): void {
    // Hitstop survives reduced motion at a fraction: it is a *timing* device,
    // not a motion device, and it carries the weight of an impact. Capped hard.
    this.hitstop = Math.max(this.hitstop, this.reduced ? Math.min(ms, 40) : ms);
  }

  slowmo(scale: number, ms: number): void {
    if (this.reduced) return;
    this.slowAmount = Math.min(this.slowAmount, scale);
    this.slowUntil = Math.max(this.slowUntil, this.clock + ms);
  }

  /**
   * Full-screen flash, rate limited.
   *
   * This is a children's product: never more than 3 flashes in any second, and
   * never above 0.34 alpha, which keeps the luminance swing well under the
   * WCAG 2.3.1 general-flash threshold at any plausible screen brightness.
   * Under reduced motion there are no flashes at all.
   */
  flash(c: Rgb, a: number): void {
    if (this.reduced) return;
    const now = this.clock;
    this.flashTimes = this.flashTimes.filter((t) => now - t < 1000);
    if (this.flashTimes.length >= 3) return;
    this.flashTimes.push(now);
    this.flashes.push({ a: Math.min(0.34, a), c, t: 0 });
  }

  /** Advance. `dt` is real seconds. Returns the logic dt after hitstop/slowmo. */
  update(dt: number): number {
    this.clock += dt * 1000;

    let logic = dt;
    if (this.hitstop > 0) {
      const used = Math.min(this.hitstop, dt * 1000);
      this.hitstop -= used;
      logic = Math.max(0, dt - used / 1000);
    }

    if (this.clock < this.slowUntil) {
      this.timeScale += (this.slowAmount - this.timeScale) * Math.min(1, dt * 26);
    } else {
      this.slowAmount = 1;
      this.timeScale += (1 - this.timeScale) * Math.min(1, dt * 7);
    }
    logic *= this.timeScale;

    this.trauma = Math.max(0, this.trauma - dt * 1.85);
    const s = this.trauma * this.trauma;
    if (s > 0) {
      this.x = this.noise(this.clock, 0) * s * 30;
      this.y = this.noise(this.clock, 7) * s * 26;
      this.rot = this.noise(this.clock, 19) * s * 0.028;
    } else {
      this.x = 0;
      this.y = 0;
      this.rot = 0;
    }

    // zoom spring: stiff, slightly underdamped, so it overshoots once
    const k = 190;
    const c = 17;
    this.zoomV += (-k * this.zoom - c * this.zoomV) * dt;
    this.zoom += this.zoomV * dt;
    if (Math.abs(this.zoom) < 0.0002 && Math.abs(this.zoomV) < 0.002) {
      this.zoom = 0;
      this.zoomV = 0;
    }

    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < 0.22);

    return logic;
  }

  flashAlpha(): { a: number; c: Rgb } | null {
    if (this.flashes.length === 0) return null;
    let best: Flash | null = null;
    let bestA = 0;
    for (const f of this.flashes) {
      const a = f.a * Math.max(0, 1 - f.t / 0.22) ** 2;
      if (a > bestA) {
        bestA = a;
        best = f;
      }
    }
    return best ? { a: bestA, c: best.c } : null;
  }

  reset(): void {
    this.trauma = 0;
    this.zoom = 0;
    this.zoomV = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.slowUntil = 0;
    this.slowAmount = 1;
    this.flashes = [];
    this.flashTimes = [];
  }
}

/* ---- easing, by name ---- */

export const ease = {
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  outQuint: (t: number) => 1 - (1 - t) ** 5,
  inCubic: (t: number) => t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number) => {
    const c1 = 2.2;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outElastic: (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const p = 0.36;
    return 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / p / 3.2) + 1;
  },
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inQuad: (t: number) => t * t,
};

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
