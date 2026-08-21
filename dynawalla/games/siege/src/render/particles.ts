/**
 * Pooled particle system. Fixed-size struct-of-arrays, zero allocation after
 * construction, hard ceiling. When the pool is full the oldest particle is
 * recycled — the burst you just asked for always lands, the frame budget never
 * moves.
 */
import { MAX_PARTICLES } from "../game/constants.ts";

export const enum PKind {
  Spark = 0, // additive hot streak, gravity, shrinks
  Shard = 1, // cold obsidian debris, tumbles, opaque
  Smoke = 2, // dark soft puff, rises, big
  Ring = 3, // expanding shock ring
  Ember = 4, // slow drifting mote
  Bolt = 5, // straight bright line segment
}

export class Particles {
  private n = 0;
  private head = 0;
  readonly kind = new Uint8Array(MAX_PARTICLES);
  readonly x = new Float32Array(MAX_PARTICLES);
  readonly y = new Float32Array(MAX_PARTICLES);
  readonly vx = new Float32Array(MAX_PARTICLES);
  readonly vy = new Float32Array(MAX_PARTICLES);
  readonly life = new Float32Array(MAX_PARTICLES);
  readonly maxLife = new Float32Array(MAX_PARTICLES);
  readonly size = new Float32Array(MAX_PARTICLES);
  readonly rot = new Float32Array(MAX_PARTICLES);
  readonly spin = new Float32Array(MAX_PARTICLES);
  readonly hue = new Float32Array(MAX_PARTICLES); // 0..1 lerps within a kind's ramp
  readonly drag = new Float32Array(MAX_PARTICLES);
  readonly grav = new Float32Array(MAX_PARTICLES);

  get count(): number {
    return this.n;
  }

  clear(): void {
    this.n = 0;
    this.head = 0;
  }

  private slot(): number {
    if (this.n < MAX_PARTICLES) return this.n++;
    const i = this.head;
    this.head = (this.head + 1) % MAX_PARTICLES;
    return i;
  }

  spawn(
    kind: PKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    hue: number,
    grav = 0,
    drag = 1.6,
    spin = 0,
  ): void {
    const i = this.slot();
    this.kind[i] = kind;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.hue[i] = hue;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.rot[i] = 0;
    this.spin[i] = spin;
  }

  update(dt: number): void {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      const l = (this.life[i] as number) - dt;
      if (l <= 0) continue;
      const d = Math.exp(-(this.drag[i] as number) * dt);
      const nvx = (this.vx[i] as number) * d;
      const nvy = (this.vy[i] as number) * d + (this.grav[i] as number) * dt;
      const nx = (this.x[i] as number) + nvx * dt;
      const ny = (this.y[i] as number) + nvy * dt;
      if (w !== i) {
        this.kind[w] = this.kind[i] as number;
        this.maxLife[w] = this.maxLife[i] as number;
        this.size[w] = this.size[i] as number;
        this.hue[w] = this.hue[i] as number;
        this.grav[w] = this.grav[i] as number;
        this.drag[w] = this.drag[i] as number;
        this.spin[w] = this.spin[i] as number;
      }
      this.life[w] = l;
      this.vx[w] = nvx;
      this.vy[w] = nvy;
      this.x[w] = nx;
      this.y[w] = ny;
      this.rot[w] = (this.rot[i] as number) + (this.spin[i] as number) * dt;
      w++;
    }
    this.n = w;
    this.head = 0;
  }
}

// ---------------------------------------------------------------------------
// burst recipes — the vocabulary the game speaks in
// ---------------------------------------------------------------------------

export function burstSparks(
  p: Particles,
  x: number,
  y: number,
  n: number,
  power: number,
  rand: () => number,
): void {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const sp = power * (0.35 + rand() * 0.9);
    p.spawn(
      PKind.Spark,
      x,
      y,
      Math.cos(a) * sp,
      Math.sin(a) * sp,
      0.22 + rand() * 0.4,
      2 + rand() * 3.4,
      rand(),
      260,
      2.4,
    );
  }
}

export function burstShatter(
  p: Particles,
  x: number,
  y: number,
  n: number,
  power: number,
  radius: number,
  rand: () => number,
): void {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const sp = power * (0.4 + rand() * 1.0);
    p.spawn(
      PKind.Shard,
      x,
      y,
      Math.cos(a) * sp,
      Math.sin(a) * sp,
      0.45 + rand() * 0.55,
      radius * (0.18 + rand() * 0.3),
      rand(),
      420,
      1.1,
      (rand() - 0.5) * 22,
    );
  }
  for (let i = 0; i < Math.ceil(n / 3); i++) {
    const a = rand() * Math.PI * 2;
    p.spawn(
      PKind.Smoke,
      x,
      y,
      Math.cos(a) * power * 0.2,
      Math.sin(a) * power * 0.2 - 14,
      0.6 + rand() * 0.6,
      radius * (0.5 + rand() * 0.7),
      rand(),
      -8,
      1.5,
    );
  }
}

export function ring(p: Particles, x: number, y: number, size: number, life: number, hue: number): void {
  p.spawn(PKind.Ring, x, y, 0, 0, life, size, hue, 0, 0);
}

export function emberMote(p: Particles, x: number, y: number, rand: () => number): void {
  p.spawn(
    PKind.Ember,
    x,
    y,
    (rand() - 0.5) * 26,
    -14 - rand() * 30,
    1.2 + rand() * 1.4,
    1.4 + rand() * 2.2,
    rand(),
    -6,
    0.5,
  );
}
