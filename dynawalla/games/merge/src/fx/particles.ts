import { Rng } from "../core/rng.ts";
import type { SpriteCache } from "./sprites.ts";
import { rgb, type Rgb } from "./palette.ts";

/**
 * Pooled particles in flat typed arrays.
 *
 * One allocation at construction, none afterwards. Draws are batched by kind so
 * the composite mode and stroke style are set a handful of times per frame
 * rather than once per particle — that, not the particle count, is what costs
 * frames in Canvas2D.
 */

export const KIND_STREAK = 0;
export const KIND_DOT = 1;
export const KIND_SHARD = 2;
export const KIND_EMBER = 3;

export class Particles {
  private cap: number;
  private x: Float32Array;
  private y: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private size: Float32Array;
  private rot: Float32Array;
  private spin: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private kind: Uint8Array;
  private r: Uint8Array;
  private g: Uint8Array;
  private b: Uint8Array;
  private n = 0;
  private rng: Rng;

  /** raised while the run is quiet, lowered when the frame budget is tight */
  budget = 1;

  constructor(cap = 1100, seed = 20260726) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.size = new Float32Array(cap);
    this.rot = new Float32Array(cap);
    this.spin = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.kind = new Uint8Array(cap);
    this.r = new Uint8Array(cap);
    this.g = new Uint8Array(cap);
    this.b = new Uint8Array(cap);
    this.rng = new Rng(seed);
  }

  get count(): number {
    return this.n;
  }

  clear(): void {
    this.n = 0;
  }

  private spawn(): number {
    if (this.n < this.cap) return this.n++;
    // Full: recycle the particle with the least life left, so a big burst
    // never gets silently swallowed by a stale ember field.
    let worst = 0;
    let worstLife = Infinity;
    for (let i = 0; i < this.n; i += 7) {
      if (this.life[i]! < worstLife) {
        worstLife = this.life[i]!;
        worst = i;
      }
    }
    return worst;
  }

  private put(
    i: number,
    k: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    c: Rgb,
    drag: number,
    grav: number,
    spin: number,
  ): void {
    this.kind[i] = k;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.drag[i] = drag;
    this.grav[i] = grav;
    this.rot[i] = this.rng.int(628) / 100;
    this.spin[i] = spin;
    this.r[i] = c[0];
    this.g[i] = c[1];
    this.b[i] = c[2];
  }

  /** A hard radial burst — the fuse. */
  burst(x: number, y: number, c: Rgb, power: number, count: number): void {
    const n = Math.max(1, Math.round(count * this.budget));
    for (let i = 0; i < n; i++) {
      const idx = this.spawn();
      const a = (this.rng.int(6283) / 1000) as number;
      const sp = power * (0.35 + this.rng.int(100) / 100);
      this.put(
        idx,
        this.rng.chance(3, 4) ? KIND_STREAK : KIND_DOT,
        x,
        y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        0.28 + this.rng.int(45) / 100,
        2 + this.rng.int(4),
        c,
        2.6,
        900,
        0,
      );
    }
  }

  /** Chunks of a destroyed chip, with spin and gravity. */
  shards(x: number, y: number, c: Rgb, size: number, count: number): void {
    const n = Math.max(1, Math.round(count * this.budget));
    for (let i = 0; i < n; i++) {
      const idx = this.spawn();
      const a = (this.rng.int(6283) / 1000) as number;
      const sp = 90 + this.rng.int(340);
      this.put(
        idx,
        KIND_SHARD,
        x,
        y,
        Math.cos(a) * sp,
        Math.sin(a) * sp - 120,
        0.55 + this.rng.int(50) / 100,
        size * (0.14 + this.rng.int(16) / 100),
        c,
        0.7,
        1500,
        (this.rng.int(200) - 100) / 12,
      );
    }
  }

  /** Slow drifting motes — the ambient reactor haze. */
  ember(x: number, y: number, c: Rgb, count: number): void {
    const n = Math.max(1, Math.round(count * this.budget));
    for (let i = 0; i < n; i++) {
      const idx = this.spawn();
      this.put(
        idx,
        KIND_EMBER,
        x + this.rng.int(40) - 20,
        y + this.rng.int(40) - 20,
        this.rng.int(40) - 20,
        -20 - this.rng.int(50),
        1.1 + this.rng.int(90) / 100,
        1.5 + this.rng.int(3),
        c,
        0.5,
        -30,
        0,
      );
    }
  }

  /** A directional spray — impact dust when a chip lands. */
  spray(x: number, y: number, c: Rgb, dir: number, spread: number, count: number, power: number): void {
    const n = Math.max(1, Math.round(count * this.budget));
    for (let i = 0; i < n; i++) {
      const idx = this.spawn();
      const a = dir + (this.rng.int(1000) / 1000 - 0.5) * spread;
      const sp = power * (0.4 + this.rng.int(100) / 100);
      this.put(
        idx,
        KIND_STREAK,
        x,
        y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        0.2 + this.rng.int(28) / 100,
        1.5 + this.rng.int(3),
        c,
        3.4,
        700,
        0,
      );
    }
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.n) {
      const l = this.life[i]! - dt;
      if (l <= 0) {
        const last = --this.n;
        if (i !== last) {
          this.x[i] = this.x[last]!;
          this.y[i] = this.y[last]!;
          this.vx[i] = this.vx[last]!;
          this.vy[i] = this.vy[last]!;
          this.life[i] = this.life[last]!;
          this.max[i] = this.max[last]!;
          this.size[i] = this.size[last]!;
          this.rot[i] = this.rot[last]!;
          this.spin[i] = this.spin[last]!;
          this.drag[i] = this.drag[last]!;
          this.grav[i] = this.grav[last]!;
          this.kind[i] = this.kind[last]!;
          this.r[i] = this.r[last]!;
          this.g[i] = this.g[last]!;
          this.b[i] = this.b[last]!;
        }
        continue;
      }
      this.life[i] = l;
      const d = Math.max(0, 1 - this.drag[i]! * dt);
      this.vx[i] = this.vx[i]! * d;
      this.vy[i] = this.vy[i]! * d + this.grav[i]! * dt;
      this.x[i] = this.x[i]! + this.vx[i]! * dt;
      this.y[i] = this.y[i]! + this.vy[i]! * dt;
      this.rot[i] = this.rot[i]! + this.spin[i]! * dt;
      i++;
    }
  }

  draw(g: CanvasRenderingContext2D, sprites: SpriteCache): void {
    if (this.n === 0) return;
    g.save();
    g.globalCompositeOperation = "lighter";

    // streaks + embers: strokes, one path per colour-ish run
    g.lineCap = "round";
    for (let i = 0; i < this.n; i++) {
      const k = this.kind[i]!;
      if (k !== KIND_STREAK && k !== KIND_EMBER) continue;
      const t = this.life[i]! / this.max[i]!;
      const a = k === KIND_EMBER ? t * 0.5 : t;
      const x = this.x[i]!;
      const y = this.y[i]!;
      const len = k === KIND_EMBER ? 0.004 : 0.018;
      g.strokeStyle = `rgba(${this.r[i]},${this.g[i]},${this.b[i]},${a})`;
      g.lineWidth = this.size[i]! * (0.35 + t * 0.8);
      g.beginPath();
      g.moveTo(x - this.vx[i]! * len, y - this.vy[i]! * len);
      g.lineTo(x, y);
      g.stroke();
    }

    // dots: cached glow blits
    for (let i = 0; i < this.n; i++) {
      if (this.kind[i] !== KIND_DOT) continue;
      const t = this.life[i]! / this.max[i]!;
      const s = this.size[i]! * 5 * (0.4 + t);
      const spr = sprites.glow([this.r[i]!, this.g[i]!, this.b[i]!] as Rgb, 40);
      g.globalAlpha = t;
      g.drawImage(spr as CanvasImageSource, this.x[i]! - s / 2, this.y[i]! - s / 2, s, s);
    }
    g.globalAlpha = 1;

    // shards: little rotating slabs, drawn solid over the additive pass
    g.globalCompositeOperation = "source-over";
    for (let i = 0; i < this.n; i++) {
      if (this.kind[i] !== KIND_SHARD) continue;
      const t = this.life[i]! / this.max[i]!;
      const s = this.size[i]!;
      g.save();
      g.translate(this.x[i]!, this.y[i]!);
      g.rotate(this.rot[i]!);
      g.fillStyle = `rgba(${this.r[i]},${this.g[i]},${this.b[i]},${Math.min(1, t * 1.6)})`;
      g.fillRect(-s / 2, -s / 2, s, s * 0.7);
      g.restore();
    }
    g.restore();
  }
}

/* ---------- shockwave rings ---------- */

export type Ring = {
  x: number;
  y: number;
  r0: number;
  r1: number;
  t: number;
  dur: number;
  w: number;
  c: Rgb;
  alive: boolean;
};

export class Rings {
  private pool: Ring[] = [];
  constructor(cap = 40) {
    for (let i = 0; i < cap; i++)
      this.pool.push({ x: 0, y: 0, r0: 0, r1: 0, t: 0, dur: 1, w: 2, c: [255, 255, 255], alive: false });
  }
  add(x: number, y: number, r0: number, r1: number, dur: number, w: number, c: Rgb): void {
    let slot = this.pool.find((p) => !p.alive);
    if (!slot) slot = this.pool[0] as Ring;
    slot.x = x;
    slot.y = y;
    slot.r0 = r0;
    slot.r1 = r1;
    slot.t = 0;
    slot.dur = dur;
    slot.w = w;
    slot.c = c;
    slot.alive = true;
  }
  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.t >= p.dur) p.alive = false;
    }
  }
  clear(): void {
    for (const p of this.pool) p.alive = false;
  }
  draw(g: CanvasRenderingContext2D): void {
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.t / p.dur;
      const e = 1 - (1 - t) ** 3;
      const r = p.r0 + (p.r1 - p.r0) * e;
      // A shockwave is a thinning, fading front — not an outline. The alpha
      // falls off faster than the radius grows, so a dozen at once still reads
      // as one blast rather than a stack of circles.
      const a = (1 - t) ** 2.6;
      g.strokeStyle = rgb(p.c, a * 0.85);
      g.lineWidth = Math.max(0.6, p.w * (1 - t) ** 1.6);
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.stroke();
      if (a > 0.25) {
        g.strokeStyle = rgb(p.c, a * 0.3);
        g.lineWidth = Math.max(1, p.w * 2.2 * (1 - t) ** 1.6);
        g.stroke();
      }
    }
    g.restore();
  }
}

/* ---------- floating score pops ---------- */

export type Pop = { x: number; y: number; vy: number; t: number; dur: number; text: string; c: Rgb; size: number; alive: boolean };

export class Pops {
  private pool: Pop[] = [];
  constructor(cap = 32) {
    for (let i = 0; i < cap; i++)
      this.pool.push({ x: 0, y: 0, vy: 0, t: 0, dur: 1, text: "", c: [255, 255, 255], size: 20, alive: false });
  }
  add(x: number, y: number, text: string, c: Rgb, size: number, dur = 0.9): void {
    let slot = this.pool.find((p) => !p.alive);
    if (!slot) slot = this.pool[0] as Pop;
    slot.x = x;
    slot.y = y;
    slot.vy = -90;
    slot.t = 0;
    slot.dur = dur;
    slot.text = text;
    slot.c = c;
    slot.size = size;
    slot.alive = true;
  }
  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.t += dt;
      p.y += p.vy * dt;
      p.vy += 130 * dt;
      if (p.t >= p.dur) p.alive = false;
    }
  }
  clear(): void {
    for (const p of this.pool) p.alive = false;
  }
  draw(g: CanvasRenderingContext2D, sprites: SpriteCache): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.t / p.dur;
      const pop = t < 0.16 ? 0.5 + (t / 0.16) * 0.72 : 1.22 - (t - 0.16) * 0.22;
      const a = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      g.save();
      g.translate(p.x, p.y);
      g.scale(pop, pop);
      sprites.drawText(g, p.text, p.size, p.c, 0, 0, 900, a);
      g.restore();
    }
  }
}
