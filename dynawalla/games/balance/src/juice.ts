// Camera and particles.
//
// The camera follows Squirrel Eiserloh's trauma model: callers add *trauma*,
// never a displacement, and the shake is trauma squared so small events barely
// register and big ones hit hard. Hitstop is a frozen simulation with a live
// render, which is the single cheapest way to make an impact feel like it has
// mass (Nijman, "The Art of Screenshake"). Slow motion is separate from hitstop
// and stacks after it.
//
// Particles are a fixed pool. Nothing is allocated during play.

import { clamp01, easeOutCubic, easeOutQuint } from "./ease.ts";

export type ParticleKind = 0 | 1 | 2 | 3; // dust | spark | mote | shard

const POOL = 420;

export class Particles {
  readonly x = new Float32Array(POOL);
  readonly y = new Float32Array(POOL);
  readonly vx = new Float32Array(POOL);
  readonly vy = new Float32Array(POOL);
  readonly life = new Float32Array(POOL);
  readonly maxLife = new Float32Array(POOL);
  readonly size = new Float32Array(POOL);
  readonly rot = new Float32Array(POOL);
  readonly spin = new Float32Array(POOL);
  readonly kind = new Uint8Array(POOL);
  readonly hue = new Float32Array(POOL);
  readonly drag = new Float32Array(POOL);
  readonly grav = new Float32Array(POOL);
  private cursor = 0;
  live = 0;

  spawn(
    kind: ParticleKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    hue: number,
    grav = 900,
    drag = 1.4,
  ): void {
    // Ring allocation: the oldest particle is recycled once the pool is full,
    // so a burst can never allocate and can never grow the frame budget.
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % POOL;
    if (this.life[i] <= 0) this.live++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.rot[i] = Math.random() * Math.PI * 2;
    this.spin[i] = (Math.random() - 0.5) * 12;
    this.kind[i] = kind;
    this.hue[i] = hue;
    this.grav[i] = grav;
    this.drag[i] = drag;
  }

  step(dt: number): void {
    let live = 0;
    for (let i = 0; i < POOL; i++) {
      const l = this.life[i];
      if (l <= 0) continue;
      const nl = l - dt;
      if (nl <= 0) {
        this.life[i] = 0;
        continue;
      }
      this.life[i] = nl;
      const d = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= d;
      this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.spin[i] * dt;
      live++;
    }
    this.live = live;
  }

  clear(): void {
    this.life.fill(0);
    this.live = 0;
  }
}

export class Camera {
  trauma = 0;
  private shakeSeed = Math.random() * 1000;
  private t = 0;
  /** extra zoom above 1 */
  punch = 0;
  private punchVel = 0;
  offsetX = 0;
  offsetY = 0;
  zoom = 1;
  rot = 0;
  /** remaining frozen-simulation time, seconds */
  hitstop = 0;
  /** simulation rate multiplier once hitstop has expired */
  timeScale = 1;
  private timeScaleUntil = 0;
  private flashAmount = 0;
  private lastFlashAt = -999;
  reduced = false;

  addTrauma(v: number): void {
    if (this.reduced) return;
    this.trauma = Math.min(1, this.trauma + v);
  }

  addPunch(v: number): void {
    if (this.reduced) return;
    this.punchVel += v;
  }

  freeze(seconds: number): void {
    this.hitstop = Math.max(this.hitstop, this.reduced ? seconds * 0.3 : seconds);
  }

  slowmo(scale: number, seconds: number): void {
    if (this.reduced) return;
    this.timeScale = scale;
    this.timeScaleUntil = this.t + seconds;
  }

  /**
   * A single soft bloom, never a strobe. Children's product: at most one flash
   * every 500 ms and never above 0.3 alpha, which keeps the luminance change
   * well under the 3-per-second photosensitivity limit with a wide margin.
   */
  flash(amount: number): void {
    if (this.t - this.lastFlashAt < 0.5) return;
    this.lastFlashAt = this.t;
    this.flashAmount = Math.min(this.reduced ? 0.12 : 0.3, amount);
  }

  get flashAlpha(): number {
    return this.flashAmount;
  }

  /** Returns the simulation dt for this frame after hitstop and slow motion. */
  step(dtReal: number): number {
    this.t += dtReal;
    if (this.t > this.timeScaleUntil) this.timeScale = 1;

    let simDt = dtReal;
    if (this.hitstop > 0) {
      this.hitstop -= dtReal;
      simDt = 0;
    } else {
      simDt = dtReal * this.timeScale;
    }

    this.trauma = Math.max(0, this.trauma - dtReal * 1.7);
    const s = this.trauma * this.trauma;
    const f = this.t * 34 + this.shakeSeed;
    this.offsetX = s * 26 * noise(f);
    this.offsetY = s * 22 * noise(f + 17.3);
    this.rot = s * 0.022 * noise(f + 41.1);

    // punch: critically damped spring back to zero
    this.punchVel += -this.punch * 130 * dtReal;
    this.punchVel *= Math.exp(-9 * dtReal);
    this.punch += this.punchVel * dtReal;
    this.zoom = 1 + this.punch;

    this.flashAmount = Math.max(0, this.flashAmount - dtReal * 0.9);
    return simDt;
  }

  reset(): void {
    this.trauma = 0;
    this.punch = 0;
    this.punchVel = 0;
    this.hitstop = 0;
    this.timeScale = 1;
    this.flashAmount = 0;
  }
}

/** Cheap smooth pseudo-noise in [-1, 1]. */
function noise(t: number): number {
  return (
    Math.sin(t * 1.0) * 0.6 + Math.sin(t * 2.31 + 1.7) * 0.3 + Math.sin(t * 4.7 + 3.1) * 0.1
  );
}

/** A tween that a caller can poll. Cheaper than a promise, and cancellable. */
export class Timeline {
  private start = 0;
  private dur = 1;
  private running = false;
  t = 0;

  play(durationSeconds: number): void {
    this.start = 0;
    this.dur = Math.max(0.0001, durationSeconds);
    this.running = true;
    this.t = 0;
  }
  step(dt: number): void {
    if (!this.running) return;
    this.start += dt;
    this.t = clamp01(this.start / this.dur);
    if (this.t >= 1) this.running = false;
  }
  get active(): boolean {
    return this.running;
  }
  get done(): boolean {
    return !this.running && this.t >= 1;
  }
  eased(): number {
    return easeOutCubic(this.t);
  }
  easedQuint(): number {
    return easeOutQuint(this.t);
  }
  cancel(): void {
    this.running = false;
    this.t = 0;
  }
}
