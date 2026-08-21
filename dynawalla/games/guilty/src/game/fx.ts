/**
 * Particles, debris and shockwave rings.
 *
 * Sparks are drawn as *streaks* along their own velocity rather than as dots —
 * the single cheapest trick for making a burst read as fast rather than as
 * confetti (Vlambeer's impact-effect rule: the effect should describe the
 * direction the energy went). Debris keeps a real z velocity, so shards from a
 * husk fly past the lens and grow as they come.
 */

import { project } from "../core/camera.ts";
import { drawGlow } from "../render/bake.ts";
import { PKind, type World } from "./world.ts";

function alloc(world: World) {
  const pool = world.particles;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.active) return p;
  }
  return null;
}

/** Quality scales every count so a weak device thins the fireworks, not the game. */
const budget = (world: World, n: number): number => Math.max(1, Math.round(n * world.quality));

export function sparks(
  world: World,
  x: number,
  y: number,
  z: number,
  count: number,
  speed: number,
  color: string,
  opts: { life?: number; size?: number; spread?: number; dirX?: number; dirY?: number; drag?: number } = {},
): void {
  const rng = world.rng;
  const n = budget(world, count);
  const spread = opts.spread ?? Math.PI * 2;
  const baseAngle = Math.atan2(opts.dirY ?? 0, opts.dirX ?? 1);
  for (let i = 0; i < n; i++) {
    const p = alloc(world);
    if (!p) return;
    const angle = spread >= Math.PI * 2 ? rng.range(0, Math.PI * 2) : baseAngle + rng.range(-spread / 2, spread / 2);
    const v = speed * (0.35 + rng.nextFloat() * 0.9);
    p.active = true;
    p.kind = PKind.Spark;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = Math.cos(angle) * v;
    p.vy = Math.sin(angle) * v;
    p.vz = rng.range(-0.35, 0.55) * v;
    p.max = p.life = (opts.life ?? 0.5) * rng.range(0.6, 1.25);
    p.size = opts.size ?? 1.6;
    p.color = color;
    p.drag = opts.drag ?? 2.4;
    p.gravity = -6;
    p.rot = 0;
    p.rotV = 0;
  }
}

/** Wireframe debris: the husk's own edges, thrown apart. */
export function shards(
  world: World,
  x: number,
  y: number,
  z: number,
  count: number,
  speed: number,
  color: string,
  size: number,
): void {
  const rng = world.rng;
  const n = budget(world, count);
  for (let i = 0; i < n; i++) {
    const p = alloc(world);
    if (!p) return;
    const angle = rng.range(0, Math.PI * 2);
    const v = speed * rng.range(0.3, 1.1);
    p.active = true;
    p.kind = PKind.Shard;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = Math.cos(angle) * v;
    p.vy = Math.sin(angle) * v;
    p.vz = rng.range(-0.6, 1.1) * v;
    p.max = p.life = rng.range(0.7, 1.5);
    p.size = size * rng.range(0.5, 1.1);
    p.color = color;
    p.drag = 0.85;
    p.gravity = -14;
    p.rot = rng.range(0, Math.PI);
    p.rotV = rng.range(-7, 7);
  }
}

/** Slow rising motes — the water remembers something died here. */
export function embers(world: World, x: number, y: number, z: number, count: number, color: string): void {
  const rng = world.rng;
  const n = budget(world, count);
  for (let i = 0; i < n; i++) {
    const p = alloc(world);
    if (!p) return;
    p.active = true;
    p.kind = PKind.Ember;
    p.x = x + rng.range(-10, 10);
    p.y = y + rng.range(-10, 10);
    p.z = z + rng.range(-14, 14);
    p.vx = rng.range(-7, 7);
    p.vy = rng.range(4, 16);
    p.vz = rng.range(-4, 4);
    p.max = p.life = rng.range(1.1, 2.4);
    p.size = rng.range(1.4, 3.4);
    p.color = color;
    p.drag = 0.5;
    p.gravity = 5;
    p.rot = 0;
    p.rotV = 0;
  }
}

export function ring(
  world: World,
  x: number,
  y: number,
  z: number,
  color: string,
  r0: number,
  rv: number,
  life: number,
  width = 2.4,
): void {
  for (const r of world.rings) {
    if (r.active) continue;
    r.active = true;
    r.x = x;
    r.y = y;
    r.z = z;
    r.r = r0;
    r.rv = rv;
    r.max = r.life = life;
    r.color = color;
    r.width = width;
    return;
  }
}

export function stepParticles(world: World, dt: number): void {
  for (const p of world.particles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    const d = Math.exp(-p.drag * dt);
    p.vx *= d;
    p.vy *= d;
    p.vz *= d;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.rot += p.rotV * dt;
  }
  for (const r of world.rings) {
    if (!r.active) continue;
    r.life -= dt;
    if (r.life <= 0) {
      r.active = false;
      continue;
    }
    r.r += r.rv * dt;
    r.rv *= Math.exp(-3.4 * dt);
  }
}

/** Additive pass. Caller has already set `globalCompositeOperation = "lighter"`. */
export function drawParticles(world: World): void {
  const { cam, batch, ctx } = world;
  for (const p of world.particles) {
    if (!p.active) continue;
    const t = p.life / p.max;
    const a = t * t;
    const head = project(cam, p.x, p.y, p.z);
    if (!head.ok) continue;
    const hx = head.x;
    const hy = head.y;
    const hs = head.s;

    if (p.kind === PKind.Ember) {
      drawGlow(ctx, p.color, hx, hy, p.size * hs * 1.9, a * 0.75);
      continue;
    }

    let tx: number;
    let ty: number;
    let width: number;
    if (p.kind === PKind.Spark) {
      const k = 0.045;
      const tail = project(cam, p.x - p.vx * k, p.y - p.vy * k, p.z - p.vz * k);
      tx = tail.x;
      ty = tail.y;
      width = Math.max(0.7, p.size * hs * 0.45);
    } else {
      // Debris is a *sliver*: `size` is its length, never its thickness. A
      // shard drawn as thick as it is long reads as confetti.
      const len = p.size;
      const dx = Math.cos(p.rot) * len;
      const dy = Math.sin(p.rot) * len;
      const tail = project(cam, p.x - dx, p.y - dy, p.z);
      tx = tail.x;
      ty = tail.y;
      width = Math.max(0.7, hs * 0.55);
    }
    batch.push(tx, ty, hx, hy, p.color, width, a);
  }

  for (const r of world.rings) {
    if (!r.active) continue;
    const t = r.life / r.max;
    const c = project(cam, r.x, r.y, r.z);
    if (!c.ok) continue;
    // Cubed, so the ring is a snap of light at the impact rather than a hoop
    // that keeps expanding across the whole trench.
    ctx.globalAlpha = t * t * t * 0.95;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = Math.max(0.8, r.width * c.s * t);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r.r * c.s, r.r * c.s * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
