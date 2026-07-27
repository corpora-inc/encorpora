/**
 * The trench itself: water, light from a surface too far away to see, drifting
 * plankton, a seabed grid receding into the dark, and the gate line the husks
 * must never cross.
 *
 * All of it is projected through the same camera as the gameplay, so the world
 * shakes as one thing. The gradient and the light shafts are baked at resize;
 * per frame the background costs two blits, one grid of batched lines and a few
 * hundred one-pixel plankton streaks.
 */

import { project, type Camera } from "../core/camera.ts";
import { GATE_Y, VIEW_HALF_H } from "../core/config.ts";
import { C, rgba } from "../core/palette.ts";
import { drawGlow } from "../render/bake.ts";
import type { World } from "./world.ts";

const FLOOR_Y = -178;
const FLOOR_NEAR = -34;
const FLOOR_FAR = -268;

let gradient: HTMLCanvasElement | null = null;
let shaft: HTMLCanvasElement | null = null;

export function bakeScene(w: number, h: number): void {
  const g = document.createElement("canvas");
  g.width = Math.max(1, Math.ceil(w));
  g.height = Math.max(1, Math.ceil(h));
  const gc = g.getContext("2d") as CanvasRenderingContext2D;
  const grad = gc.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#02060d");
  grad.addColorStop(0.2, "#02070e");
  grad.addColorStop(0.6, "#030c15");
  grad.addColorStop(0.88, "#05161f");
  grad.addColorStop(1, "#020a11");
  gc.fillStyle = grad;
  gc.fillRect(0, 0, w, h);
  // A cold sheen from the surface, far above and to one side.
  const sheen = gc.createRadialGradient(w * 0.32, -h * 0.4, 0, w * 0.32, -h * 0.4, h * 0.95);
  sheen.addColorStop(0, rgba(C.surface, 0.17));
  sheen.addColorStop(1, rgba(C.surface, 0));
  gc.fillStyle = sheen;
  gc.fillRect(0, 0, w, h);
  gradient = g;

  const s = document.createElement("canvas");
  s.width = 128;
  s.height = 512;
  const sc = s.getContext("2d") as CanvasRenderingContext2D;
  const sg = sc.createLinearGradient(0, 0, 0, 512);
  sg.addColorStop(0, rgba(C.plankton, 0.1));
  sg.addColorStop(0.5, rgba(C.plankton, 0.032));
  sg.addColorStop(1, rgba(C.plankton, 0));
  sc.fillStyle = sg;
  sc.beginPath();
  sc.moveTo(46, 0);
  sc.lineTo(82, 0);
  sc.lineTo(126, 512);
  sc.lineTo(2, 512);
  sc.closePath();
  sc.fill();
  shaft = s;
}

export function seedMotes(world: World, count: number): void {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = world.rng.range(-260, 260);
    data[i * 4 + 1] = world.rng.range(-190, 190);
    data[i * 4 + 2] = world.rng.range(-250, -12);
    data[i * 4 + 3] = world.rng.range(0, Math.PI * 2);
  }
  world.motes = data;
  world.moteCount = count;
}

export function drawBackground(world: World): void {
  const { ctx, w, h, time } = world;
  if (gradient) ctx.drawImage(gradient, 0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  if (shaft && world.quality > 0.55) {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const drift = Math.sin(time * 0.11 + i * 2.1) * w * 0.07;
      const x = w * (0.2 + i * 0.3) + drift;
      const scale = 0.8 + Math.sin(time * 0.17 + i) * 0.18;
      ctx.globalAlpha = 0.42 + Math.sin(time * 0.23 + i * 1.7) * 0.16;
      ctx.drawImage(shaft, x - w * 0.14 * scale, -h * 0.06, w * 0.28 * scale, h * 1.06);
    }
    ctx.globalAlpha = 1;
  }

  drawMotes(world);
  ctx.globalCompositeOperation = "source-over";
}

function drawMotes(world: World): void {
  const { motes, moteCount, cam, batch, time } = world;
  for (let i = 0; i < moteCount; i++) {
    const bx = motes[i * 4];
    const by = motes[i * 4 + 1];
    const bz = motes[i * 4 + 2];
    const phase = motes[i * 4 + 3];
    const y = ((by + time * (5 + (i % 7)) + 190) % 380) - 190;
    const x = bx + Math.sin(time * 0.4 + phase) * 6;
    const p = project(cam, x, y, bz);
    if (!p.ok) continue;
    const depth = 1 - Math.min(1, -bz / 260);
    const alpha = 0.05 + depth * 0.22;
    batch.push(p.x, p.y - 0.6 - depth, p.x, p.y + 0.6 + depth, C.plankton, 0.6 + depth * 1.2, alpha);
  }
  batch.flush(world.ctx);
}

/** Seabed grid + the gate. Drawn under everything alive. */
export function drawFloor(world: World): void {
  const { cam, batch, ctx, time } = world;
  const halfW = Math.min(280, cam.worldHalfW * 1.6);
  const rows = 9;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const z = FLOOR_NEAR + (FLOOR_FAR - FLOOR_NEAR) * t * t;
    const a = project(cam, -halfW, FLOOR_Y, z);
    const ax = a.x;
    const ay = a.y;
    const b = project(cam, halfW, FLOOR_Y, z);
    batch.push(ax, ay, b.x, b.y, C.cyanDim, 1.1, 0.34 - t * 0.24);
  }
  const cols = 13;
  for (let i = 0; i <= cols; i++) {
    const x = -halfW + (halfW * 2 * i) / cols;
    const a = project(cam, x, FLOOR_Y, FLOOR_NEAR);
    const ax = a.x;
    const ay = a.y;
    const b = project(cam, x, FLOOR_Y, FLOOR_FAR);
    batch.push(ax, ay, b.x, b.y, C.cyanDim, 1, 0.2);
  }

  // The gate: cross it and a life is gone. It breathes, and it flares when
  // something is close — the pulse is the warning, not a word.
  const danger = world.gateDanger;
  const pulse = 0.42 + Math.sin(time * 2.1) * 0.08 + danger * 0.5;
  const gw = cam.playHalfW + 14;
  const a = project(cam, -gw, GATE_Y, 0);
  const ax = a.x;
  const ay = a.y;
  const b = project(cam, gw, GATE_Y, 0);
  const bx = b.x;
  const by = b.y;
  const color = danger > 0.35 ? C.hostile : C.cyan;
  batch.push(ax, ay, bx, by, color, 1.6 + danger * 2.4, pulse);
  for (let i = -6; i <= 6; i++) {
    const x = (gw * i) / 6;
    const t0 = project(cam, x, GATE_Y, 0);
    const tx = t0.x;
    const ty = t0.y;
    const t1 = project(cam, x, GATE_Y - 4.5, 0);
    batch.push(tx, ty, t1.x, t1.y, color, 1.2, pulse * 0.7);
  }
  batch.flush(ctx);

  ctx.globalCompositeOperation = "lighter";
  const mid = project(cam, 0, GATE_Y, 0);
  drawGlow(ctx, color, mid.x, mid.y, (bx - ax) * 0.55, 0.1 + danger * 0.34);
  ctx.globalCompositeOperation = "source-over";
}

/** Screen-space vignette, drawn last. */
export function drawVignette(world: World, vignette: HTMLCanvasElement | null): void {
  if (!vignette) return;
  world.ctx.drawImage(vignette, 0, 0, world.w, world.h);
}

export function worldTop(cam: Camera): number {
  return cam.y + VIEW_HALF_H;
}
