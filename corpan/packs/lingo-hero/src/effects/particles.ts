import { rgba, type Rgb } from "./palette";

/**
 * Fixed-capacity particle pool. Allocation-free at steady state: particles are
 * recycled out of a ring buffer, so a long combo run never thrashes the GC
 * (critical for sustained 60fps on mobile). Each particle is a tiny additive
 * spark/shard; we draw with a single globalCompositeOperation="lighter" pass so
 * overlaps bloom into white-hot cores without per-particle shadow blur.
 */
export type ParticleShape = "spark" | "shard" | "ring" | "star";

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** seconds */
  life: number;
  maxLife: number;
  size: number;
  /** radians, for shards/stars */
  rot: number;
  vr: number;
  gravity: number;
  drag: number;
  color: Rgb;
  shape: ParticleShape;
  /** additive intensity multiplier */
  glow: number;
}

export interface BurstOptions {
  count: number;
  speedMin: number;
  speedMax: number;
  sizeMin: number;
  sizeMax: number;
  lifeMin: number;
  lifeMax: number;
  gravity?: number;
  drag?: number;
  spread?: number; // radians, full cone width; default 2π
  angle?: number; // center angle; default -π/2 (up)
  shape?: ParticleShape;
  color: Rgb;
  glow?: number;
}

const TAU = Math.PI * 2;

export class ParticleSystem {
  private pool: Particle[] = [];
  private head = 0; // next slot to (re)use
  private liveCount = 0;

  constructor(capacity = 480) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        rot: 0,
        vr: 0,
        gravity: 0,
        drag: 0,
        color: { r: 255, g: 255, b: 255 },
        shape: "spark",
        glow: 1,
      });
    }
  }

  get count(): number {
    return this.liveCount;
  }

  private spawnOne(): Particle {
    // Ring-buffer reuse: overwrite oldest if we wrap (graceful overflow).
    let p = this.pool[this.head];
    this.head = (this.head + 1) % this.pool.length;
    if (!p.active) this.liveCount++;
    p.active = true;
    return p;
  }

  burst(x: number, y: number, opts: BurstOptions): void {
    const spread = opts.spread ?? TAU;
    const baseAngle = opts.angle ?? -Math.PI / 2;
    const shape = opts.shape ?? "spark";
    const glow = opts.glow ?? 1;
    for (let i = 0; i < opts.count; i++) {
      const p = this.spawnOne();
      const a = baseAngle + (Math.random() - 0.5) * spread;
      const speed = lerp(opts.speedMin, opts.speedMax, Math.random());
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.maxLife = lerp(opts.lifeMin, opts.lifeMax, Math.random());
      p.life = p.maxLife;
      p.size = lerp(opts.sizeMin, opts.sizeMax, Math.random());
      p.rot = Math.random() * TAU;
      p.vr = (Math.random() - 0.5) * 12;
      p.gravity = opts.gravity ?? 0;
      p.drag = opts.drag ?? 0.9;
      p.color = opts.color;
      p.shape = shape;
      p.glow = glow;
    }
  }

  /** Single directional trail mote (cheap, for note trails). */
  emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    size: number,
    life: number,
    color: Rgb,
    shape: ParticleShape = "spark"
  ): void {
    const p = this.spawnOne();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.maxLife = life;
    p.life = life;
    p.size = size;
    p.rot = Math.random() * TAU;
    p.vr = (Math.random() - 0.5) * 6;
    p.gravity = 0;
    p.drag = 0.92;
    p.color = color;
    p.shape = shape;
    p.glow = 1;
  }

  update(dt: number): void {
    if (this.liveCount === 0) return;
    // Clamp dt so a tab-switch hitch doesn't fling particles off-screen.
    const step = Math.min(dt, 0.05);
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= step;
      if (p.life <= 0) {
        p.active = false;
        this.liveCount--;
        continue;
      }
      const dragF = Math.pow(p.drag, step * 60);
      p.vx *= dragF;
      p.vy = p.vy * dragF + p.gravity * step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.rot += p.vr * step;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.liveCount === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife; // 1 -> 0
      const alpha = t * t; // ease-out fade, keeps cores bright then snaps
      const a = alpha * p.glow;
      const size = p.shape === "ring" ? p.size * (1 + (1 - t) * 2.2) : p.size * (0.4 + t * 0.6);

      switch (p.shape) {
        case "ring": {
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, TAU);
          ctx.strokeStyle = rgba(p.color, a * 0.9);
          ctx.lineWidth = Math.max(1, p.size * 0.18 * t);
          ctx.stroke();
          break;
        }
        case "shard": {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = rgba(p.color, a);
          const h = size * 2.4;
          ctx.fillRect(-size * 0.35, -h * 0.5, size * 0.7, h);
          ctx.restore();
          break;
        }
        case "star": {
          drawStar(ctx, p.x, p.y, size, p.rot, rgba(p.color, a));
          break;
        }
        default: {
          // spark: soft radial dot
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, TAU);
          ctx.fillStyle = rgba(p.color, a);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
    this.liveCount = 0;
    this.head = 0;
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number,
  fill: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  const spikes = 4;
  const inner = r * 0.42;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const ang = (i / (spikes * 2)) * TAU;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
