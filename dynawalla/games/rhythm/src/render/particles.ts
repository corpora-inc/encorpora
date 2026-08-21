/**
 * Pooled particle system. Nothing in here allocates after construction — the
 * pools are typed arrays, the colours are palette indices rather than strings,
 * and dead particles are overwritten in a ring rather than spliced.
 *
 * Glow is drawn by blitting a pre-baked radial sprite per colour instead of
 * calling `arc()` a thousand times a frame. On the low tier that is the
 * difference between 60fps and 40.
 */

import { rgba, type Rgb } from "../theme.ts";

export const PAL_LANE0 = 0;
export const PAL_LANE1 = 1;
export const PAL_LANE2 = 2;
export const PAL_WHITE = 3;
export const PAL_HORIZON = 4;
export const PAL_BLOOM = 5;
export const PAL_GOLD = 6;
export const PAL_DIM = 7;
const PAL_COUNT = 8;

const SPRITE = 64;

export class Particles {
  private palette: Rgb[] = [
    [255, 156, 56],
    [255, 77, 141],
    [78, 226, 255],
    [255, 255, 255],
    [120, 205, 255],
    [70, 110, 255],
    [255, 226, 138],
    [110, 120, 150],
  ];
  private sprites: HTMLCanvasElement[] = [];

  // --- sparks (structure of arrays) ---
  private sx: Float32Array;
  private sy: Float32Array;
  private svx: Float32Array;
  private svy: Float32Array;
  private slife: Float32Array;
  private smax: Float32Array;
  private ssize: Float32Array;
  private sdrag: Float32Array;
  private sgrav: Float32Array;
  private spal: Uint8Array;
  private skind: Uint8Array; // 0 glow dot, 1 streak
  private scur = 0;
  readonly sparkCap: number;

  // --- shards ---
  private hx: Float32Array;
  private hy: Float32Array;
  private hvx: Float32Array;
  private hvy: Float32Array;
  private hrot: Float32Array;
  private hvrot: Float32Array;
  private hlife: Float32Array;
  private hmax: Float32Array;
  private hsize: Float32Array;
  private hpal: Uint8Array;
  private hcur = 0;
  readonly shardCap: number;

  // --- rings ---
  private rx: Float32Array;
  private ry: Float32Array;
  private rr0: Float32Array;
  private rr1: Float32Array;
  private rlife: Float32Array;
  private rmax: Float32Array;
  private rw: Float32Array;
  private rpal: Uint8Array;
  private rsquare: Uint8Array;
  private rcur = 0;
  readonly ringCap: number;

  // --- floating labels ---
  private fx: Float32Array;
  private fy: Float32Array;
  private fvy: Float32Array;
  private flife: Float32Array;
  private fmax: Float32Array;
  private fsize: Float32Array;
  private fpal: Uint8Array;
  private ftext: string[] = [];
  private fcur = 0;
  readonly floatCap = 20;

  constructor(sparks: number, shards: number, rings: number) {
    this.sparkCap = sparks;
    this.shardCap = shards;
    this.ringCap = rings;
    const f = (n: number) => new Float32Array(n);
    this.sx = f(sparks); this.sy = f(sparks); this.svx = f(sparks); this.svy = f(sparks);
    this.slife = f(sparks); this.smax = f(sparks); this.ssize = f(sparks);
    this.sdrag = f(sparks); this.sgrav = f(sparks);
    this.spal = new Uint8Array(sparks); this.skind = new Uint8Array(sparks);

    this.hx = f(shards); this.hy = f(shards); this.hvx = f(shards); this.hvy = f(shards);
    this.hrot = f(shards); this.hvrot = f(shards); this.hlife = f(shards);
    this.hmax = f(shards); this.hsize = f(shards); this.hpal = new Uint8Array(shards);

    this.rx = f(rings); this.ry = f(rings); this.rr0 = f(rings); this.rr1 = f(rings);
    this.rlife = f(rings); this.rmax = f(rings); this.rw = f(rings);
    this.rpal = new Uint8Array(rings); this.rsquare = new Uint8Array(rings);

    this.fx = f(this.floatCap); this.fy = f(this.floatCap); this.fvy = f(this.floatCap);
    this.flife = f(this.floatCap); this.fmax = f(this.floatCap); this.fsize = f(this.floatCap);
    this.fpal = new Uint8Array(this.floatCap);
    for (let i = 0; i < this.floatCap; i++) this.ftext.push("");

    for (let i = 0; i < PAL_COUNT; i++) this.sprites.push(this.bake(this.palette[i]!));
  }

  /** Sector colours change; re-bake only the two that depend on the sector. */
  setSectorColors(horizon: Rgb, bloom: Rgb): void {
    this.palette[PAL_HORIZON] = horizon;
    this.palette[PAL_BLOOM] = bloom;
    this.sprites[PAL_HORIZON] = this.bake(horizon);
    this.sprites[PAL_BLOOM] = this.bake(bloom);
  }

  private bake(c: Rgb): HTMLCanvasElement {
    const cv = document.createElement("canvas");
    cv.width = cv.height = SPRITE;
    const g = cv.getContext("2d")!;
    const grd = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
    grd.addColorStop(0, rgba(c, 1));
    grd.addColorStop(0.35, rgba(c, 0.55));
    grd.addColorStop(1, rgba(c, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, SPRITE, SPRITE);
    return cv;
  }

  /* ------------------------------------------------------------ */

  spark(x: number, y: number, vx: number, vy: number, life: number, size: number, pal: number, kind = 0, drag = 2.2, grav = 0): void {
    const i = this.scur;
    this.scur = (i + 1) % this.sparkCap;
    this.sx[i] = x; this.sy[i] = y; this.svx[i] = vx; this.svy[i] = vy;
    this.slife[i] = life; this.smax[i] = life; this.ssize[i] = size;
    this.spal[i] = pal; this.skind[i] = kind; this.sdrag[i] = drag; this.sgrav[i] = grav;
  }

  burst(x: number, y: number, n: number, pal: number, power: number, rnd: () => number, streaks = false): void {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const sp = (0.35 + rnd() * 1.0) * power;
      this.spark(
        x, y,
        Math.cos(a) * sp, Math.sin(a) * sp,
        0.28 + rnd() * 0.5,
        3 + rnd() * 7 * (power / 300),
        pal,
        streaks && rnd() < 0.4 ? 1 : 0,
        2.0 + rnd() * 2,
        rnd() * 260,
      );
    }
  }

  shard(x: number, y: number, vx: number, vy: number, life: number, size: number, pal: number, vrot: number): void {
    const i = this.hcur;
    this.hcur = (i + 1) % this.shardCap;
    this.hx[i] = x; this.hy[i] = y; this.hvx[i] = vx; this.hvy[i] = vy;
    this.hrot[i] = 0; this.hvrot[i] = vrot;
    this.hlife[i] = life; this.hmax[i] = life; this.hsize[i] = size; this.hpal[i] = pal;
  }

  ring(x: number, y: number, r0: number, r1: number, life: number, w: number, pal: number, square = false): void {
    const i = this.rcur;
    this.rcur = (i + 1) % this.ringCap;
    this.rx[i] = x; this.ry[i] = y; this.rr0[i] = r0; this.rr1[i] = r1;
    this.rlife[i] = life; this.rmax[i] = life; this.rw[i] = w;
    this.rpal[i] = pal; this.rsquare[i] = square ? 1 : 0;
  }

  floater(x: number, y: number, text: string, size: number, pal: number): void {
    const i = this.fcur;
    this.fcur = (i + 1) % this.floatCap;
    this.fx[i] = x; this.fy[i] = y; this.fvy[i] = -70;
    this.flife[i] = 0.72; this.fmax[i] = 0.72; this.fsize[i] = size; this.fpal[i] = pal;
    this.ftext[i] = text;
  }

  /* ------------------------------------------------------------ */

  update(dt: number): void {
    for (let i = 0; i < this.sparkCap; i++) {
      const l = this.slife[i]!;
      if (l <= 0) continue;
      this.slife[i] = l - dt;
      const d = Math.exp(-this.sdrag[i]! * dt);
      this.svx[i] = this.svx[i]! * d;
      this.svy[i] = this.svy[i]! * d + this.sgrav[i]! * dt;
      this.sx[i] = this.sx[i]! + this.svx[i]! * dt;
      this.sy[i] = this.sy[i]! + this.svy[i]! * dt;
    }
    for (let i = 0; i < this.shardCap; i++) {
      const l = this.hlife[i]!;
      if (l <= 0) continue;
      this.hlife[i] = l - dt;
      this.hvy[i] = this.hvy[i]! + 900 * dt;
      this.hvx[i] = this.hvx[i]! * Math.exp(-0.6 * dt);
      this.hx[i] = this.hx[i]! + this.hvx[i]! * dt;
      this.hy[i] = this.hy[i]! + this.hvy[i]! * dt;
      this.hrot[i] = this.hrot[i]! + this.hvrot[i]! * dt;
    }
    for (let i = 0; i < this.ringCap; i++) {
      if (this.rlife[i]! <= 0) continue;
      this.rlife[i] = this.rlife[i]! - dt;
    }
    for (let i = 0; i < this.floatCap; i++) {
      if (this.flife[i]! <= 0) continue;
      this.flife[i] = this.flife[i]! - dt;
      this.fy[i] = this.fy[i]! + this.fvy[i]! * dt;
      this.fvy[i] = this.fvy[i]! * Math.exp(-2.4 * dt);
    }
  }

  draw(ctx: CanvasRenderingContext2D, font: (px: number, w?: number) => string): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // sparks — glow blits
    for (let i = 0; i < this.sparkCap; i++) {
      const l = this.slife[i]!;
      if (l <= 0) continue;
      const t = l / this.smax[i]!;
      const s = this.ssize[i]! * (0.4 + t * 1.4);
      ctx.globalAlpha = t * t;
      if (this.skind[i] === 1) {
        const x = this.sx[i]!, y = this.sy[i]!;
        const px = x - this.svx[i]! * 0.035, py = y - this.svy[i]! * 0.035;
        ctx.strokeStyle = rgba(this.palette[this.spal[i]!]!, 1);
        ctx.lineWidth = Math.max(1, s * 0.5);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        const sp = this.sprites[this.spal[i]!]!;
        ctx.drawImage(sp, this.sx[i]! - s, this.sy[i]! - s, s * 2, s * 2);
      }
    }

    // rings
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < this.ringCap; i++) {
      const l = this.rlife[i]!;
      if (l <= 0) continue;
      const t = 1 - l / this.rmax[i]!;
      const e = 1 - Math.pow(1 - t, 3);
      const r = this.rr0[i]! + (this.rr1[i]! - this.rr0[i]!) * e;
      ctx.globalAlpha = (1 - t) * (1 - t) * 0.9;
      ctx.strokeStyle = rgba(this.palette[this.rpal[i]!]!, 1);
      ctx.lineWidth = this.rw[i]! * (1 - t * 0.7);
      ctx.beginPath();
      if (this.rsquare[i] === 1) ctx.rect(this.rx[i]! - r, this.ry[i]! - r, r * 2, r * 2);
      else ctx.arc(this.rx[i]!, this.ry[i]!, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.stroke();
    }

    // shards — solid geometry reads better than glow for broken glass
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < this.shardCap; i++) {
      const l = this.hlife[i]!;
      if (l <= 0) continue;
      const t = l / this.hmax[i]!;
      const s = this.hsize[i]!;
      ctx.save();
      ctx.translate(this.hx[i]!, this.hy[i]!);
      ctx.rotate(this.hrot[i]!);
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.fillStyle = rgba(this.palette[this.hpal[i]!]!, 0.85);
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.6);
      ctx.lineTo(s * 0.8, -s);
      ctx.lineTo(s, s * 0.7);
      ctx.lineTo(-s * 0.5, s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // floaters
    ctx.globalCompositeOperation = "lighter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < this.floatCap; i++) {
      const l = this.flife[i]!;
      if (l <= 0) continue;
      const t = l / this.fmax[i]!;
      ctx.globalAlpha = Math.min(1, t * 1.8);
      ctx.font = font(this.fsize[i]! * (1 + (1 - t) * 0.15), 900);
      ctx.fillStyle = rgba(this.palette[this.fpal[i]!]!, 1);
      ctx.fillText(this.ftext[i]!, this.fx[i]!, this.fy[i]!);
    }

    ctx.restore();
  }

  clear(): void {
    this.slife.fill(0);
    this.hlife.fill(0);
    this.rlife.fill(0);
    this.flife.fill(0);
  }

  /** live count, for the perf HUD */
  get liveSparks(): number {
    let n = 0;
    for (let i = 0; i < this.sparkCap; i++) if (this.slife[i]! > 0) n++;
    return n;
  }
}
