import type { GlowField } from "./fields.ts";

/**
 * One pooled, struct-of-arrays particle system for the whole game.
 *
 * Fixed capacity, free-list, zero allocation after construction. Particles
 * scroll with the world so debris genuinely travels past you rather than
 * hanging in space, and shards that land on the deck *stick* — Nijman's
 * "permanence": the wreckage of a mistake is still behind you when you look.
 */

const KIND_SOFT = 0;
const KIND_RING = 1;
const KIND_STAR = 2;
const KIND_BAR = 3;

export class Particles {
  private cap: number;
  private x: Float32Array;
  private y: Float32Array;
  private z: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private size: Float32Array;
  private grow: Float32Array;
  private r: Float32Array;
  private g: Float32Array;
  private b: Float32Array;
  private kind: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private stretch: Float32Array;
  /** 1 = sticks to the deck on contact and scrolls away with the world. */
  private stick: Float32Array;
  private alive: Uint8Array;
  private free: Int32Array;
  private freeN: number;
  private liveCount = 0;

  constructor(capacity: number) {
    this.cap = capacity;
    const f = () => new Float32Array(capacity);
    this.x = f(); this.y = f(); this.z = f();
    this.vx = f(); this.vy = f(); this.vz = f();
    this.life = f(); this.max = f(); this.size = f(); this.grow = f();
    this.r = f(); this.g = f(); this.b = f();
    this.kind = f(); this.drag = f(); this.grav = f(); this.stretch = f(); this.stick = f();
    this.alive = new Uint8Array(capacity);
    this.free = new Int32Array(capacity);
    for (let i = 0; i < capacity; i++) this.free[i] = capacity - 1 - i;
    this.freeN = capacity;
  }

  get count(): number {
    return this.liveCount;
  }

  clear(): void {
    this.alive.fill(0);
    this.freeN = this.cap;
    for (let i = 0; i < this.cap; i++) this.free[i] = this.cap - 1 - i;
    this.liveCount = 0;
  }

  private spawn(): number {
    if (this.freeN === 0) return -1;
    const i = this.free[--this.freeN];
    this.alive[i] = 1;
    this.liveCount++;
    return i;
  }

  private set(
    i: number,
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    life: number, size: number, grow: number,
    r: number, g: number, b: number,
    kind: number, drag: number, grav: number, stretch: number, stick: number,
  ): void {
    this.x[i] = x; this.y[i] = y; this.z[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = life; this.max[i] = life;
    this.size[i] = size; this.grow[i] = grow;
    this.r[i] = r; this.g[i] = g; this.b[i] = b;
    this.kind[i] = kind; this.drag[i] = drag; this.grav[i] = grav;
    this.stretch[i] = stretch; this.stick[i] = stick;
  }

  /* -------------------------------- emitters ------------------------------ */

  /** A hard omnidirectional burst. The bread and butter. */
  burst(
    x: number, y: number, z: number,
    n: number, speed: number, life: number, size: number,
    r: number, g: number, b: number,
    forward = 0,
  ): void {
    for (let k = 0; k < n; k++) {
      const i = this.spawn();
      if (i < 0) return;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.35 + Math.random() * 0.85);
      this.set(
        i, x, y, z,
        Math.sin(ph) * Math.cos(th) * sp,
        Math.abs(Math.sin(ph) * Math.sin(th)) * sp * 0.9,
        Math.cos(ph) * sp * 0.6 + forward,
        life * (0.6 + Math.random() * 0.7),
        size * (0.5 + Math.random()), -0.55,
        r, g, b, KIND_SOFT, 1.6, -7, 1, 0,
      );
    }
  }

  /** Angular shards that arc, fall, and stay where they land. */
  shards(
    x: number, y: number, z: number,
    n: number, speed: number,
    r: number, g: number, b: number,
    forward = 0,
  ): void {
    for (let k = 0; k < n; k++) {
      const i = this.spawn();
      if (i < 0) return;
      const th = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random());
      this.set(
        i, x, y, z,
        Math.cos(th) * sp, 2 + Math.random() * speed * 0.8, Math.sin(th) * sp * 0.5 + forward,
        1.5 + Math.random() * 1.9,
        0.22 + Math.random() * 0.5, -0.12,
        r, g, b, KIND_BAR, 0.35, -26, 1.6, 1,
      );
    }
  }

  /** An expanding shockwave ring. Sells scale better than any number of dots. */
  ring(x: number, y: number, z: number, size: number, life: number, r: number, g: number, b: number, grow = 46): void {
    const i = this.spawn();
    if (i < 0) return;
    this.set(i, x, y, z, 0, 0, 0, life, size, grow, r, g, b, KIND_RING, 0, 0, 1, 0);
  }

  star(x: number, y: number, z: number, size: number, life: number, r: number, g: number, b: number): void {
    const i = this.spawn();
    if (i < 0) return;
    this.set(i, x, y, z, 0, 0, 0, life, size, -size * 0.6, r, g, b, KIND_STAR, 0, 0, 1, 0);
  }

  /** A single soft puff with explicit velocity. Used for thruster trails. */
  puff(
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    life: number, size: number, grow: number,
    r: number, g: number, b: number, stretch = 1,
  ): void {
    const i = this.spawn();
    if (i < 0) return;
    this.set(i, x, y, z, vx, vy, vz, life, size, grow, r, g, b, KIND_SOFT, 2.2, 0, stretch, 0);
  }

  /** A vertical light column, used for lane markers and gate pillars. */
  bar(x: number, y: number, z: number, w: number, h: number, life: number, r: number, g: number, b: number): void {
    const i = this.spawn();
    if (i < 0) return;
    this.set(i, x, y, z, 0, 0, 0, life, w, -w * 0.7, r, g, b, KIND_BAR, 0, 0, h / Math.max(0.001, w), 0);
  }

  /* --------------------------------- update ------------------------------- */

  update(dt: number, scroll: number): void {
    const x = this.x, y = this.y, z = this.z;
    const vx = this.vx, vy = this.vy, vz = this.vz;
    for (let i = 0; i < this.cap; i++) {
      if (this.alive[i] === 0) continue;
      const l = (this.life[i] -= dt);
      if (l <= 0) {
        this.alive[i] = 0;
        this.free[this.freeN++] = i;
        this.liveCount--;
        continue;
      }
      if (this.stick[i] === 1 && y[i] <= 0.06 && vy[i] <= 0) {
        // Landed. Freeze it and let the world carry it away.
        vx[i] = 0; vy[i] = 0; vz[i] = 0;
        y[i] = 0.06;
        this.grav[i] = 0;
        this.stick[i] = 2;
      } else if (this.stick[i] !== 2) {
        const d = 1 - Math.min(0.95, this.drag[i] * dt);
        vx[i] *= d; vy[i] *= d; vz[i] *= d;
        vy[i] += this.grav[i] * dt;
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
      }
      z[i] += vz[i] * dt + scroll;
      this.size[i] = Math.max(0.01, this.size[i] + this.grow[i] * dt);
      // Behind the camera: recycle immediately rather than pay for it.
      if (z[i] > 26) {
        this.alive[i] = 0;
        this.free[this.freeN++] = i;
        this.liveCount--;
      }
    }
  }

  draw(field: GlowField, dim: number): void {
    for (let i = 0; i < this.cap; i++) {
      if (this.alive[i] === 0) continue;
      const t = this.life[i] / this.max[i];
      // Bright and hard for the first third, then a long soft tail.
      const a = (t > 0.7 ? 1 : t / 0.7) * (t < 0.35 ? t / 0.35 : 1) * dim;
      if (a <= 0.004) continue;
      field.add(
        this.x[i], this.y[i], this.z[i],
        this.size[i], a, this.stretch[i], this.kind[i],
        this.r[i], this.g[i], this.b[i],
      );
      if (field.free <= 0) return;
    }
  }
}
