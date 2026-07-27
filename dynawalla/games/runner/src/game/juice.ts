/**
 * Feel primitives, straight off Jan Willem Nijman's "Art of Screenshake" list.
 * Named here so the technique is auditable rather than vibes:
 *
 *   screenshake (trauma-squared, decaying)  · camera kick   · sleep / hitstop
 *   easing + tweening                       · squash&stretch· recoil
 *   speed lines                             · permanence    · sound variety
 *
 * Everything here answers to `reduced`, which is not a dimmer switch: it
 * removes camera motion entirely and routes the same information through
 * colour-plus-shape overlays that do not move.
 */

/* ---------------------------------- easing --------------------------------- */

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutBack = (t: number) => {
  const c = 2.2;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
export const easeOutElastic = (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const p = (2 * Math.PI) / 3;
  return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * p) + 1;
};
/** Frame-rate independent exponential approach. `rate` is roughly 1/seconds. */
export const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

/* ------------------------------- screenshake ------------------------------- */

/** Cheap smooth pseudo-noise; three incommensurate sines beat a lookup table. */
function wobble(t: number, seed: number): number {
  return (
    Math.sin(t * 27.3 + seed * 5.1) * 0.55 +
    Math.sin(t * 11.9 + seed * 12.7) * 0.31 +
    Math.sin(t * 47.1 + seed * 3.3) * 0.14
  );
}

export class Shake {
  /** 0..1. Shake amplitude is trauma^2 so small hits stay quiet. */
  trauma = 0;
  decay = 1.9;
  x = 0;
  y = 0;
  roll = 0;
  private t = 0;

  add(amount: number): void {
    this.trauma = clamp01(this.trauma + amount);
  }

  update(dt: number, reduced: boolean, intensity = 1): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
    if (reduced || this.trauma <= 0) {
      this.x = 0;
      this.y = 0;
      this.roll = 0;
      return;
    }
    const s = this.trauma * this.trauma * intensity;
    this.x = wobble(this.t, 1) * s * 0.62;
    this.y = wobble(this.t, 2) * s * 0.44;
    this.roll = wobble(this.t, 3) * s * 0.075;
  }
}

/* ---------------------------------- hitstop -------------------------------- */

/**
 * "Sleep": a few frames of near-freeze on impact. Never a true zero — a real
 * zero reads as a dropped frame, a 6% crawl reads as weight.
 */
export class HitStop {
  private remaining = 0;
  private strength = 0.06;

  hit(seconds: number, strength = 0.06): void {
    this.remaining = Math.max(this.remaining, seconds);
    this.strength = strength;
  }

  /** Returns the time-scale to apply this frame. */
  scale(dt: number): number {
    if (this.remaining <= 0) return 1;
    this.remaining -= dt;
    return this.strength;
  }

  get active(): boolean {
    return this.remaining > 0;
  }
}

/* ----------------------------------- flash --------------------------------- */

export type FlashColor = readonly [number, number, number];

/**
 * Full-viewport luminance changes, rate-limited.
 *
 * This is a children's product, so the WCAG general-flash threshold is a hard
 * ceiling and not a guideline: at most three flashes per second, each with a
 * rise and fall of at least ~90ms, and amplitude is scaled *down* when requests
 * arrive faster rather than being dropped (a dropped flash loses information;
 * a quiet one does not).
 */
export class FlashBus {
  private level = 0;
  private target = 0;
  private col: [number, number, number] = [1, 1, 1];
  private stamps: number[] = [];
  private now = 0;
  /** Longest a single flash may take to rise, in seconds. */
  private static RISE = 0.09;

  fire(amount: number, color: FlashColor, reduced: boolean): void {
    // Trim the 1s window.
    while (this.stamps.length && this.now - this.stamps[0] > 1) this.stamps.shift();
    const recent = this.stamps.length;
    // 0 recent -> full, 1 -> 60%, 2 -> 35%, 3+ -> 18% and no further growth.
    const allowance = recent === 0 ? 1 : recent === 1 ? 0.6 : recent === 2 ? 0.35 : 0.18;
    const a = clamp01(amount) * allowance * (reduced ? 0.45 : 1);
    if (a <= this.target) {
      // Never let a weaker request cut a stronger one short.
      this.col = [color[0], color[1], color[2]];
      return;
    }
    this.stamps.push(this.now);
    this.target = a;
    this.col = [color[0], color[1], color[2]];
  }

  update(dt: number): void {
    this.now += dt;
    if (this.target > this.level) {
      this.level = Math.min(this.target, this.level + dt / FlashBus.RISE);
      if (this.level >= this.target) this.target = 0;
    } else {
      this.level = Math.max(0, this.level - dt * 3.4);
      this.target = 0;
    }
  }

  get value(): number {
    return this.level;
  }
  get color(): readonly [number, number, number] {
    return this.col;
  }
}

/* --------------------------------- tweening -------------------------------- */

/** A scalar that springs to its target. Used for FOV, HUD punch, camera lean. */
export class Springy {
  value: number;
  target: number;
  private vel = 0;
  stiffness: number;
  damping: number;

  constructor(v: number, stiffness = 150, damping = 18) {
    this.value = v;
    this.target = v;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  kick(v: number): void {
    this.vel += v;
  }

  update(dt: number): number {
    // Sub-step at a fixed 120Hz and cap the total simulated time. Capping the
    // step *count* instead still hands the integrator an h of 0.125s after a
    // half-second hitch, which diverges — a tab returning from the background
    // would fling the camera across the world.
    const total = Math.min(dt, 0.1);
    const steps = Math.max(1, Math.ceil(total / (1 / 120)));
    const h = total / steps;
    for (let i = 0; i < steps; i++) {
      const a = (this.target - this.value) * this.stiffness - this.vel * this.damping;
      this.vel += a * h;
      this.value += this.vel * h;
    }
    return this.value;
  }
}
