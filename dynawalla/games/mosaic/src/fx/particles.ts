/**
 * Particles. Pooled, capped, batched.
 *
 * Everything is allocated once at construction and recycled forever — no
 * allocation on the hot path, so no GC sawtooth in the middle of a multiball.
 * Drawing is batched by colour into one path per jewel per system, which keeps
 * a 500-shard detonation at a couple of dozen canvas state changes instead of a
 * thousand.
 *
 * Shards settle instead of vanishing. Broken glass drifts to the floor and
 * *stays there*, so a wall you have worked over leaves a pile of coloured glass
 * along the bottom of the screen — permanence, the cheapest and most convincing
 * juice technique there is.
 */
import { JEWELS } from "./palette.ts";

const SHARD_CAP = 620;
const SETTLED_CAP = 260;
const SPARK_CAP = 760;
const RING_CAP = 28;
const FLOAT_CAP = 28;
const MOTE_COUNT = 46;

type Shard = {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  size: number;
  life: number;
  max: number;
  colour: number;
  shape: number;
  glint: number;
};

type Spark = {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  colour: string;
  len: number;
  w: number;
};

type Ring = {
  live: boolean;
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  colour: string;
  w: number;
};

type Floater = {
  live: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  size: number;
  colour: string;
};

type Mote = { x: number; y: number; vx: number; vy: number; r: number; a: number };

const make = <T>(n: number, f: () => T): T[] => Array.from({ length: n }, f);

export class Particles {
  private shards: Shard[] = make(SHARD_CAP, () => ({
    live: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    size: 0,
    life: 0,
    max: 1,
    colour: 0,
    shape: 0,
    glint: 0,
  }));
  private settled: Shard[] = [];
  private sparks: Spark[] = make(SPARK_CAP, () => ({
    live: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    colour: "#fff",
    len: 0,
    w: 1,
  }));
  private rings: Ring[] = make(RING_CAP, () => ({
    live: false,
    x: 0,
    y: 0,
    r0: 0,
    r1: 0,
    life: 0,
    max: 1,
    colour: "#fff",
    w: 2,
  }));
  private floats: Floater[] = make(FLOAT_CAP, () => ({
    live: false,
    x: 0,
    y: 0,
    vy: 0,
    life: 0,
    max: 1,
    text: "",
    size: 30,
    colour: "#fff",
  }));
  private motes: Mote[] = [];

  private si = 0;
  private ki = 0;
  private ri = 0;
  private fi = 0;

  /** 1 normally, ~0.32 under reduced motion. */
  density = 1;
  floorY = 0;

  constructor(private vw: number) {
    for (let i = 0; i < MOTE_COUNT; i++) {
      this.motes.push({
        x: Math.random() * vw,
        y: Math.random() * 1400,
        vx: (Math.random() - 0.5) * 6,
        vy: -3 - Math.random() * 7,
        r: 1 + Math.random() * 2.6,
        a: 0.08 + Math.random() * 0.22,
      });
    }
  }

  clearAll(): void {
    for (const s of this.shards) s.live = false;
    for (const s of this.sparks) s.live = false;
    for (const r of this.rings) r.live = false;
    for (const f of this.floats) f.live = false;
    this.settled.length = 0;
  }

  // -- emitters -------------------------------------------------------------

  /** A tile shatters: glass out along the impact normal, plus a bright core. */
  shatter(x: number, y: number, w: number, h: number, colour: number, nx: number, ny: number, force = 1): void {
    const n = Math.round((10 + Math.random() * 5) * this.density * Math.min(1.6, force));
    for (let i = 0; i < n; i++) {
      const s = this.shards[this.si++ % SHARD_CAP]!;
      s.live = true;
      s.x = x + (Math.random() - 0.5) * w;
      s.y = y + (Math.random() - 0.5) * h;
      const spread = Math.random() * Math.PI * 2;
      const speed = (90 + Math.random() * 320) * force;
      s.vx = Math.cos(spread) * speed * 0.55 + nx * speed * 0.55;
      s.vy = Math.sin(spread) * speed * 0.55 + ny * speed * 0.55 - 60;
      s.rot = Math.random() * Math.PI * 2;
      s.spin = (Math.random() - 0.5) * 15;
      s.size = (h * 0.16 + Math.random() * h * 0.3) * (0.7 + force * 0.3);
      s.max = 2.6 + Math.random() * 3.4;
      s.life = s.max;
      s.colour = colour;
      s.shape = (Math.random() * 3) | 0;
      s.glint = Math.random();
    }
  }

  burst(x: number, y: number, count: number, colour: string, speed = 320, life = 0.5, len = 9): void {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const s = this.sparks[this.ki++ % SPARK_CAP]!;
      s.live = true;
      s.x = x;
      s.y = y;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.85);
      s.vx = Math.cos(a) * v;
      s.vy = Math.sin(a) * v;
      s.max = life * (0.6 + Math.random() * 0.7);
      s.life = s.max;
      s.colour = colour;
      s.len = len;
      s.w = 1 + Math.random() * 1.8;
    }
  }

  /** A directed cone — used for the paddle strike, so the hit has a direction. */
  cone(x: number, y: number, count: number, colour: string, dirX: number, dirY: number, spread = 0.8): void {
    const n = Math.round(count * this.density);
    const base = Math.atan2(dirY, dirX);
    for (let i = 0; i < n; i++) {
      const s = this.sparks[this.ki++ % SPARK_CAP]!;
      s.live = true;
      s.x = x;
      s.y = y;
      const a = base + (Math.random() - 0.5) * spread;
      const v = 180 + Math.random() * 380;
      s.vx = Math.cos(a) * v;
      s.vy = Math.sin(a) * v;
      s.max = 0.22 + Math.random() * 0.3;
      s.life = s.max;
      s.colour = colour;
      s.len = 11;
      s.w = 1 + Math.random() * 2;
    }
  }

  ring(x: number, y: number, r0: number, r1: number, colour: string, life = 0.42, w = 3): void {
    const r = this.rings[this.ri++ % RING_CAP]!;
    r.live = true;
    r.x = x;
    r.y = y;
    r.r0 = r0;
    r.r1 = r1;
    r.max = life;
    r.life = life;
    r.colour = colour;
    r.w = w;
  }

  floater(x: number, y: number, text: string, colour: string, size = 34): void {
    const f = this.floats[this.fi++ % FLOAT_CAP]!;
    f.live = true;
    f.x = x;
    f.y = y;
    f.vy = -78;
    f.max = 0.95;
    f.life = f.max;
    f.text = text;
    f.size = size;
    f.colour = colour;
  }

  // -- step -----------------------------------------------------------------

  update(dt: number, vh: number): void {
    this.floorY = vh - 8;
    const g = 980;

    for (const s of this.shards) {
      if (!s.live) continue;
      s.life -= dt;
      s.vy += g * dt;
      s.vx *= 1 - 0.7 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt;
      if (s.y > this.floorY) {
        // Land it. The drift of broken glass along the bottom is the record of
        // everything this run has destroyed.
        s.live = false;
        s.y = this.floorY - Math.random() * 5;
        s.vx = 0;
        s.vy = 0;
        s.spin = 0;
        s.life = 1;
        const copy: Shard = { ...s };
        this.settled.push(copy);
        if (this.settled.length > SETTLED_CAP) this.settled.shift();
        continue;
      }
      if (s.life <= 0) s.live = false;
    }

    for (const s of this.sparks) {
      if (!s.live) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.live = false;
        continue;
      }
      s.vx *= 1 - 2.4 * dt;
      s.vy = s.vy * (1 - 2.4 * dt) + 420 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }

    for (const r of this.rings) {
      if (!r.live) continue;
      r.life -= dt;
      if (r.life <= 0) r.live = false;
    }

    for (const f of this.floats) {
      if (!f.live) continue;
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 1 - 1.7 * dt;
      if (f.life <= 0) f.live = false;
    }

    for (const m of this.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < -20) {
        m.y = vh + 20;
        m.x = Math.random() * this.vw;
      }
      if (m.x < -20) m.x = this.vw + 20;
      if (m.x > this.vw + 20) m.x = -20;
    }
  }

  // -- draw -----------------------------------------------------------------

  drawMotes(ctx: CanvasRenderingContext2D, brightness: number): void {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ffe9c4";
    for (const m of this.motes) {
      ctx.globalAlpha = m.a * (0.35 + brightness * 0.9);
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  drawSettled(ctx: CanvasRenderingContext2D): void {
    if (!this.settled.length) return;
    for (let c = 0; c < JEWELS.length; c++) {
      let opened = false;
      for (const s of this.settled) {
        if (s.colour !== c) continue;
        if (!opened) {
          ctx.beginPath();
          opened = true;
        }
        polygon(ctx, s.x, s.y, s.size * 0.85, s.rot, s.shape);
      }
      if (opened) {
        ctx.fillStyle = JEWELS[c]!.shard;
        ctx.globalAlpha = 0.5;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawShards(ctx: CanvasRenderingContext2D): void {
    for (let c = 0; c < JEWELS.length; c++) {
      let opened = false;
      for (const s of this.shards) {
        if (!s.live || s.colour !== c) continue;
        if (!opened) {
          ctx.beginPath();
          opened = true;
        }
        polygon(ctx, s.x, s.y, s.size, s.rot, s.shape);
      }
      if (opened) {
        ctx.fillStyle = JEWELS[c]!.shard;
        ctx.globalAlpha = 0.92;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Glints: a few shards catch the light as they tumble.
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#fff8e6";
    for (const s of this.shards) {
      if (!s.live || s.glint < 0.72) continue;
      const a = Math.max(0, Math.sin(s.rot * 2.1) ) * (s.life / s.max);
      if (a <= 0.05) continue;
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /**
   * One stroke per colour in flight — typically two or three draw calls for the
   * whole system. Per-spark fade is carried by the segment *length* rather than
   * per-spark alpha, because alpha would force a state change per particle and
   * a shortening additive streak reads identically.
   */
  drawSparks(ctx: CanvasRenderingContext2D): void {
    const colours = this.sparkColours;
    colours.length = 0;
    for (const s of this.sparks) {
      if (!s.live) continue;
      if (!colours.includes(s.colour)) colours.push(s.colour);
      if (colours.length >= 8) break;
    }
    if (!colours.length) return;

    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.82;
    for (const colour of colours) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      for (const s of this.sparks) {
        if (!s.live || s.colour !== colour) continue;
        const t = s.life / s.max;
        const m = Math.hypot(s.vx, s.vy) || 1;
        const lx = (s.vx / m) * s.len * t;
        const ly = (s.vy / m) * s.len * t;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - lx - 0.01, s.y - ly);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private sparkColours: string[] = [];

  drawRings(ctx: CanvasRenderingContext2D): void {
    ctx.globalCompositeOperation = "lighter";
    for (const r of this.rings) {
      if (!r.live) continue;
      const t = 1 - r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - t, 3));
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.strokeStyle = r.colour;
      ctx.lineWidth = r.w * (1 - t) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  drawFloaters(ctx: CanvasRenderingContext2D, font: string): void {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floats) {
      if (!f.live) continue;
      const t = f.life / f.max;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.font = `700 ${f.size}px ${font}`;
      ctx.fillStyle = f.colour;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  get liveCount(): number {
    let n = this.settled.length;
    for (const s of this.shards) if (s.live) n++;
    for (const s of this.sparks) if (s.live) n++;
    return n;
  }
}

/** Three irregular glass silhouettes — never a circle, never a square. */
function polygon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, shape: number): void {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const pts = SHAPES[shape % SHAPES.length]!;
  for (let i = 0; i < pts.length; i += 2) {
    const px = pts[i]! * r;
    const py = pts[i + 1]! * r;
    const wx = x + px * cos - py * sin;
    const wy = y + px * sin + py * cos;
    if (i === 0) ctx.moveTo(wx, wy);
    else ctx.lineTo(wx, wy);
  }
  ctx.closePath();
}

const SHAPES: number[][] = [
  [-1, -0.5, 0.9, -1, 0.6, 0.9],
  [-0.9, -0.8, 1, -0.3, 0.3, 1, -0.7, 0.6],
  [0, -1.1, 1, 0.2, -0.2, 0.9, -0.9, -0.1],
];
