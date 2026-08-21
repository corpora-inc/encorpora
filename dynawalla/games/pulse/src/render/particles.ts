/**
 * Pooled particles, structure-of-arrays, zero allocation in the hot loop.
 *
 * The budget is a hard cap, not a hope: when the pool is full the oldest particle is
 * recycled rather than the array growing, so a wall of sixteenths cannot walk the
 * frame time off a cliff. Sparks are drawn as *lines from last position to current* —
 * a free motion blur that costs one path segment and is the reason a burst reads as
 * speed rather than as dots.
 */

import { INK_KEYS, type Ink, INK } from "./palette.ts";
import { glow } from "./glow.ts";

export const KIND_SPARK = 0;
export const KIND_MOTE = 1;
export const KIND_SHARD = 2;

export type EmitOpts = {
  ink: Ink;
  count: number;
  speed: number;
  spread?: number;
  angle?: number;
  life?: number;
  size?: number;
  drag?: number;
  grav?: number;
  kind?: number;
};

export class Particles {
  private x: Float32Array;
  private y: Float32Array;
  private px: Float32Array;
  private py: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private rot: Float32Array;
  private rotv: Float32Array;
  private ink: Uint8Array;
  private kind: Uint8Array;
  private n = 0;
  readonly cap: number;
  private cursor = 0;

  constructor(cap: number) {
    this.cap = cap;
    const f = () => new Float32Array(cap);
    this.x = f();
    this.y = f();
    this.px = f();
    this.py = f();
    this.vx = f();
    this.vy = f();
    this.life = f();
    this.maxLife = f();
    this.size = f();
    this.drag = f();
    this.grav = f();
    this.rot = f();
    this.rotv = f();
    this.ink = new Uint8Array(cap);
    this.kind = new Uint8Array(cap);
  }

  get count(): number {
    return this.n;
  }

  clear(): void {
    this.n = 0;
  }

  emit(cx: number, cy: number, o: EmitOpts): void {
    const inkIdx = Math.max(0, INK_KEYS.indexOf(o.ink));
    const spread = o.spread ?? Math.PI * 2;
    const base = o.angle ?? 0;
    const life = o.life ?? 0.5;
    const size = o.size ?? 2.2;
    const drag = o.drag ?? 2.6;
    const grav = o.grav ?? 0;
    const kind = o.kind ?? KIND_SPARK;
    for (let k = 0; k < o.count; k++) {
      let i: number;
      if (this.n < this.cap) {
        i = this.n++;
      } else {
        i = this.cursor++ % this.cap; // recycle oldest slot; budget is absolute
      }
      const a = base + (Math.random() - 0.5) * spread;
      const sp = o.speed * (0.42 + Math.random() * 0.92);
      this.x[i] = cx;
      this.y[i] = cy;
      this.px[i] = cx;
      this.py[i] = cy;
      this.vx[i] = Math.cos(a) * sp;
      this.vy[i] = Math.sin(a) * sp;
      const l = life * (0.65 + Math.random() * 0.7);
      this.life[i] = l;
      this.maxLife[i] = l;
      this.size[i] = size * (0.6 + Math.random() * 0.9);
      this.drag[i] = drag;
      this.grav[i] = grav;
      this.rot[i] = Math.random() * Math.PI * 2;
      this.rotv[i] = (Math.random() - 0.5) * 14;
      this.ink[i] = inkIdx;
      this.kind[i] = kind;
    }
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i]! - dt;
      if (l <= 0) {
        const last = --this.n;
        if (i !== last) this.swap(i, last);
        i--;
        continue;
      }
      this.life[i] = l;
      this.px[i] = this.x[i]!;
      this.py[i] = this.y[i]!;
      const d = Math.exp(-this.drag[i]! * dt);
      this.vx[i] = this.vx[i]! * d;
      this.vy[i] = this.vy[i]! * d + this.grav[i]! * dt;
      this.x[i] = this.x[i]! + this.vx[i]! * dt;
      this.y[i] = this.y[i]! + this.vy[i]! * dt;
      this.rot[i] = this.rot[i]! + this.rotv[i]! * dt;
    }
  }

  private swap(a: number, b: number): void {
    for (const arr of [
      this.x,
      this.y,
      this.px,
      this.py,
      this.vx,
      this.vy,
      this.life,
      this.maxLife,
      this.size,
      this.drag,
      this.grav,
      this.rot,
      this.rotv,
    ]) {
      const t = arr[a]!;
      arr[a] = arr[b]!;
      arr[b] = t;
    }
    for (const arr of [this.ink, this.kind]) {
      const t = arr[a]!;
      arr[a] = arr[b]!;
      arr[b] = t;
    }
  }

  /** Additive. Caller sets `globalCompositeOperation = "lighter"`. */
  draw(ctx: CanvasRenderingContext2D, motionScale = 1): void {
    // Sparks, grouped by ink so the whole burst is one stroked path per colour.
    for (let ci = 0; ci < INK_KEYS.length; ci++) {
      let opened = false;
      for (let i = 0; i < this.n; i++) {
        if (this.ink[i] !== ci || this.kind[i] !== KIND_SPARK) continue;
        if (!opened) {
          ctx.beginPath();
          opened = true;
        }
        const t = this.life[i]! / this.maxLife[i]!;
        const sx = this.px[i]!;
        const sy = this.py[i]!;
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx + (this.x[i]! - sx) * (1 + 1.4 * motionScale),
          sy + (this.y[i]! - sy) * (1 + 1.4 * motionScale),
        );
        void t;
      }
      if (opened) {
        const c = INK[INK_KEYS[ci]!];
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.85)`;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    for (let i = 0; i < this.n; i++) {
      const k = this.kind[i]!;
      if (k === KIND_SPARK) continue;
      const t = this.life[i]! / this.maxLife[i]!;
      const ink = INK_KEYS[this.ink[i]!]!;
      if (k === KIND_MOTE) {
        glow(ctx, ink, this.x[i]!, this.y[i]!, this.size[i]! * (0.5 + t * 2.4), t * 0.75);
      } else {
        const c = INK[ink];
        const s = this.size[i]! * (0.5 + t);
        ctx.save();
        ctx.translate(this.x[i]!, this.y[i]!);
        ctx.rotate(this.rot[i]!);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(t * 0.9).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-s, -s * 0.7);
        ctx.lineTo(s, 0);
        ctx.lineTo(-s, s * 0.7);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

/** Expanding shockwave rings — cheap, few, and the loudest single hit cue. */
export class Ripples {
  private rx: number[] = [];
  private ry: number[] = [];
  private t: number[] = [];
  private dur: number[] = [];
  private r0: number[] = [];
  private r1: number[] = [];
  private ink: Ink[] = [];
  private wide: number[] = [];

  add(x: number, y: number, r0: number, r1: number, dur: number, ink: Ink, wide = 1): void {
    if (this.rx.length > 48) this.pop(0);
    this.rx.push(x);
    this.ry.push(y);
    this.t.push(0);
    this.dur.push(dur);
    this.r0.push(r0);
    this.r1.push(r1);
    this.ink.push(ink);
    this.wide.push(wide);
  }

  private pop(i: number): void {
    for (const a of [this.rx, this.ry, this.t, this.dur, this.r0, this.r1, this.wide]) a.splice(i, 1);
    this.ink.splice(i, 1);
  }

  update(dt: number): void {
    for (let i = this.t.length - 1; i >= 0; i--) {
      this.t[i] = this.t[i]! + dt;
      if (this.t[i]! >= this.dur[i]!) this.pop(i);
    }
  }

  clear(): void {
    this.rx.length = 0;
    this.ry.length = 0;
    this.t.length = 0;
    this.dur.length = 0;
    this.r0.length = 0;
    this.r1.length = 0;
    this.wide.length = 0;
    this.ink.length = 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.t.length; i++) {
      const p = this.t[i]! / this.dur[i]!;
      const eased = 1 - Math.pow(1 - p, 3); // outCubic
      const r = this.r0[i]! + (this.r1[i]! - this.r0[i]!) * eased;
      const a = (1 - p) * (1 - p) * 0.9;
      const c = INK[this.ink[i]!];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
      ctx.lineWidth = Math.max(0.6, this.wide[i]! * 3 * (1 - p) + 0.6);
      ctx.beginPath();
      ctx.arc(this.rx[i]!, this.ry[i]!, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
