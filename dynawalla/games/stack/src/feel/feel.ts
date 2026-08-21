/**
 * Screenshake, springs, hit-stop and a rate-limited flash.
 *
 * Techniques from Jan Willem Nijman's "Art of Screenshake", by name:
 * SLEEP (hit-stop), SCREENSHAKE (trauma-squared, translational + rotational),
 * CAMERA KICK, SCALE PUNCH (squash released by an overshooting spring),
 * PERMANENCE (debris that survives the moment that made it), BRIGHT FRAMES
 * (capped hard, because this is a children's product).
 */

/** Trauma-based shake — Squirrel Eiserloh's model. Squared falloff, no jitter floor. */
export class Shake {
  trauma = 0;
  private t = 0;
  x = 0;
  y = 0;
  rot = 0;
  /** 0 disables translation and rotation but keeps the API alive. */
  scale = 1;

  add(v: number): void {
    this.trauma = Math.min(1, this.trauma + v);
  }

  update(dt: number, decay: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - decay * dt);
    const s = this.trauma * this.trauma * this.scale;
    if (s <= 0.0001) {
      this.x = 0;
      this.y = 0;
      this.rot = 0;
      return;
    }
    // Three detuned sines read as noise but are deterministic and allocation-free.
    const f = this.t * 41;
    this.x = s * (Math.sin(f) * 0.6 + Math.sin(f * 2.37 + 1.7) * 0.3 + Math.sin(f * 4.11 + 0.3) * 0.1);
    this.y = s * (Math.sin(f * 1.13 + 2.1) * 0.6 + Math.sin(f * 2.71 + 0.9) * 0.3 + Math.sin(f * 5.3) * 0.1);
    this.rot = s * (Math.sin(f * 0.87 + 4.2) * 0.7 + Math.sin(f * 3.19 + 2.4) * 0.3);
  }
}

/** Critically-ish damped spring toward a target; overshoots when under-damped. */
export class Spring {
  value: number;
  target: number;
  vel = 0;
  stiffness: number;
  damping: number;
  constructor(v = 0, stiffness = 180, damping = 16) {
    this.value = v;
    this.target = v;
    this.stiffness = stiffness;
    this.damping = damping;
  }
  set(v: number): void {
    this.value = v;
    this.target = v;
    this.vel = 0;
  }
  punch(v: number): void {
    this.value = v;
  }
  kick(v: number): void {
    this.vel += v;
  }
  update(dt: number): number {
    // Sub-step so a long frame cannot make the spring explode.
    let left = dt;
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      const a = (this.target - this.value) * this.stiffness - this.vel * this.damping;
      this.vel += a * h;
      this.value += this.vel * h;
      left -= h;
    }
    return this.value;
  }
}

/** Freeze the world for a few milliseconds so an impact lands. */
export class HitStop {
  private left = 0;
  hit(ms: number): void {
    this.left = Math.max(this.left, ms / 1000);
  }
  /** Returns the dt the simulation should actually see. */
  consume(dt: number): number {
    if (this.left <= 0) return dt;
    this.left -= dt;
    if (this.left > 0) return 0;
    const rest = -this.left;
    this.left = 0;
    return rest;
  }
  get frozen(): boolean {
    return this.left > 0;
  }
}

/**
 * A white flash, hard-limited: never brighter than `maxAlpha`, never more often
 * than `minGapMs`. Children's product — three flashes per second is the ceiling
 * we design to, and this clamps well under it.
 */
export class Flash {
  alpha = 0;
  private last = -1e9;
  private maxAlpha: number;
  private minGapMs: number;
  private fadeMs: number;
  constructor(maxAlpha: number, minGapMs: number, fadeMs: number) {
    this.maxAlpha = maxAlpha;
    this.minGapMs = minGapMs;
    this.fadeMs = fadeMs;
  }
  fire(now: number, strength = 1): void {
    if (now - this.last < this.minGapMs) return;
    this.last = now;
    this.alpha = Math.max(this.alpha, this.maxAlpha * Math.max(0, Math.min(1, strength)));
  }
  update(dt: number): number {
    if (this.alpha > 0) this.alpha = Math.max(0, this.alpha - (dt * 1000) / this.fadeMs * this.maxAlpha);
    return this.alpha;
  }
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Frame-rate independent exponential approach. */
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  b + (a - b) * Math.exp(-lambda * dt);
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
