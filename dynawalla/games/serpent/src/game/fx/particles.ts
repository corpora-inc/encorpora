/**
 * Pooled particles. Structure-of-arrays, swap-remove, fixed cap, zero
 * allocation after construction — the budget is a hard number, not a hope.
 *
 * Four kinds, all drawn from four pre-rendered sprites, so the whole system is
 * one `drawImage` per particle with `lighter` compositing and no per-frame
 * gradient construction anywhere.
 */

import { TAU, randRange } from "../num.ts";

export const PK_MOTE = 0;
export const PK_SPARK = 1;
export const PK_SHARD = 2;
export const PK_BUBBLE = 3;

export const PC_GOOD = 0;
export const PC_BAD = 1;
export const PC_SERPENT = 2;
export const PC_WHITE = 3;
export const PC_PLANKTON = 4;
export const PC_HOT = 5;

export type Particles = {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  size: Float32Array;
  rot: Float32Array;
  spin: Float32Array;
  kind: Uint8Array;
  color: Uint8Array;
  count: number;
  cap: number;
  /** 0..1 multiplier on every spawn count. Reduced motion turns this down. */
  density: number;
};

export function createParticles(cap: number, density = 1): Particles {
  return {
    x: new Float32Array(cap),
    y: new Float32Array(cap),
    vx: new Float32Array(cap),
    vy: new Float32Array(cap),
    life: new Float32Array(cap),
    maxLife: new Float32Array(cap),
    size: new Float32Array(cap),
    rot: new Float32Array(cap),
    spin: new Float32Array(cap),
    kind: new Uint8Array(cap),
    color: new Uint8Array(cap),
    count: 0,
    cap,
    density,
  };
}

export function clearParticles(p: Particles): void {
  p.count = 0;
}

function spawn(
  p: Particles,
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
  size: number,
  kind: number,
  color: number,
): void {
  if (p.count >= p.cap) return;
  const i = p.count++;
  p.x[i] = x;
  p.y[i] = y;
  p.vx[i] = vx;
  p.vy[i] = vy;
  p.life[i] = life;
  p.maxLife[i] = life;
  p.size[i] = size;
  p.rot[i] = randRange(0, TAU);
  p.spin[i] = randRange(-7, 7);
  p.kind[i] = kind;
  p.color[i] = color;
}

const scaled = (p: Particles, n: number): number => Math.max(1, Math.round(n * p.density));

/** A correct bite: a tight gold bloom that reads instantly at any zoom. */
export function burstEat(p: Particles, x: number, y: number, power: number): void {
  const n = scaled(p, 14 + power * 8);
  for (let i = 0; i < n; i++) {
    const a = randRange(0, TAU);
    const s = randRange(0.14, 0.5) * (0.8 + power * 0.5);
    spawn(p, x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(0.25, 0.6), randRange(0.006, 0.017), PK_SPARK, PC_GOOD);
  }
  for (let i = 0; i < scaled(p, 6); i++) {
    const a = randRange(0, TAU);
    const s = randRange(0.03, 0.14);
    spawn(p, x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(0.5, 1.1), randRange(0.02, 0.045), PK_MOTE, PC_GOOD);
  }
}

/** A wrong bite: violet shards thrown outward, plus the length you coughed up. */
export function burstBad(p: Particles, x: number, y: number): void {
  const n = scaled(p, 20);
  for (let i = 0; i < n; i++) {
    const a = randRange(0, TAU);
    const s = randRange(0.2, 0.72);
    spawn(p, x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(0.35, 0.85), randRange(0.01, 0.03), PK_SHARD, PC_BAD);
  }
  for (let i = 0; i < scaled(p, 8); i++) {
    const a = randRange(0, TAU);
    const s = randRange(0.02, 0.1);
    spawn(p, x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(0.6, 1.4), randRange(0.025, 0.06), PK_MOTE, PC_BAD);
  }
}

/** Body you lost, spat out along the heading so the cost is legible. */
export function burstDebris(p: Particles, x: number, y: number, heading: number, n: number): void {
  for (let i = 0; i < scaled(p, n); i++) {
    const a = heading + Math.PI + randRange(-0.7, 0.7);
    const s = randRange(0.16, 0.44);
    spawn(p, x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(0.7, 1.5), randRange(0.014, 0.028), PK_MOTE, PC_SERPENT);
  }
}

export function burstSpark(p: Particles, x: number, y: number, heading: number, color: number): void {
  const a = heading + Math.PI + randRange(-0.5, 0.5);
  const s = randRange(0.05, 0.22);
  spawn(p, x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(0.18, 0.42), randRange(0.005, 0.013), PK_SPARK, color);
}

export function burstDeath(p: Particles, x: number, y: number): void {
  for (let i = 0; i < scaled(p, 46); i++) {
    const a = randRange(0, TAU);
    const s = randRange(0.1, 0.9);
    spawn(p, x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(0.8, 2.2), randRange(0.008, 0.03), PK_SPARK, PC_WHITE);
  }
  for (let i = 0; i < scaled(p, 24); i++) {
    const a = randRange(0, TAU);
    const s = randRange(0.04, 0.3);
    spawn(p, x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(1.2, 2.6), randRange(0.02, 0.055), PK_MOTE, PC_SERPENT);
  }
}

export function burstBubbles(p: Particles, x: number, y: number, n: number): void {
  for (let i = 0; i < scaled(p, n); i++) {
    spawn(
      p,
      x + randRange(-0.03, 0.03),
      y + randRange(-0.03, 0.03),
      randRange(-0.03, 0.03),
      randRange(-0.14, -0.05),
      randRange(0.9, 1.8),
      randRange(0.004, 0.011),
      PK_BUBBLE,
      PC_PLANKTON,
    );
  }
}

export function updateParticles(p: Particles, dt: number): void {
  const drag = Math.exp(-2.1 * dt);
  for (let i = 0; i < p.count; i++) {
    const life = (p.life[i] as number) - dt;
    if (life <= 0) {
      const last = --p.count;
      if (i !== last) {
        p.x[i] = p.x[last] as number;
        p.y[i] = p.y[last] as number;
        p.vx[i] = p.vx[last] as number;
        p.vy[i] = p.vy[last] as number;
        p.life[i] = p.life[last] as number;
        p.maxLife[i] = p.maxLife[last] as number;
        p.size[i] = p.size[last] as number;
        p.rot[i] = p.rot[last] as number;
        p.spin[i] = p.spin[last] as number;
        p.kind[i] = p.kind[last] as number;
        p.color[i] = p.color[last] as number;
      }
      i--;
      continue;
    }
    p.life[i] = life;
    const k = p.kind[i] as number;
    let vx = p.vx[i] as number;
    let vy = p.vy[i] as number;
    if (k === PK_BUBBLE) {
      vy -= 0.05 * dt;
      vx += Math.sin(life * 6 + (p.rot[i] as number)) * 0.02 * dt;
    } else {
      vx *= drag;
      vy *= drag;
    }
    p.vx[i] = vx;
    p.vy[i] = vy;
    p.x[i] = (p.x[i] as number) + vx * dt;
    p.y[i] = (p.y[i] as number) + vy * dt;
    p.rot[i] = (p.rot[i] as number) + (p.spin[i] as number) * dt;
  }
}

// ---------------------------------------------------------------- shockwaves

export type Rings = {
  x: Float32Array;
  y: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  from: Float32Array;
  to: Float32Array;
  width: Float32Array;
  color: Uint8Array;
  count: number;
  cap: number;
};

export function createRings(cap: number): Rings {
  return {
    x: new Float32Array(cap),
    y: new Float32Array(cap),
    life: new Float32Array(cap),
    maxLife: new Float32Array(cap),
    from: new Float32Array(cap),
    to: new Float32Array(cap),
    width: new Float32Array(cap),
    color: new Uint8Array(cap),
    count: 0,
    cap,
  };
}

export function ring(
  r: Rings,
  x: number,
  y: number,
  from: number,
  to: number,
  life: number,
  width: number,
  color: number,
): void {
  if (r.count >= r.cap) return;
  const i = r.count++;
  r.x[i] = x;
  r.y[i] = y;
  r.from[i] = from;
  r.to[i] = to;
  r.life[i] = life;
  r.maxLife[i] = life;
  r.width[i] = width;
  r.color[i] = color;
}

export function updateRings(rg: Rings, dt: number): void {
  for (let i = 0; i < rg.count; i++) {
    const life = (rg.life[i] as number) - dt;
    if (life <= 0) {
      const last = --rg.count;
      if (i !== last) {
        rg.x[i] = rg.x[last] as number;
        rg.y[i] = rg.y[last] as number;
        rg.life[i] = rg.life[last] as number;
        rg.maxLife[i] = rg.maxLife[last] as number;
        rg.from[i] = rg.from[last] as number;
        rg.to[i] = rg.to[last] as number;
        rg.width[i] = rg.width[last] as number;
        rg.color[i] = rg.color[last] as number;
      }
      i--;
      continue;
    }
    rg.life[i] = life;
  }
}

export function clearRings(r: Rings): void {
  r.count = 0;
}
