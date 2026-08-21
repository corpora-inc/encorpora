/**
 * The Arbiter. Every fifth wave.
 *
 * Three interlocking gimbal rings around a core, with the candidate pods in
 * orbit. Its shield only breaks to a *correct* answer — bullets into the hull
 * do nothing at all, which is the whole point: there is no way past it except
 * arithmetic. Getting one wrong buys a volley.
 */

import { project } from "../core/camera.ts";
import { C, rgba } from "../core/palette.ts";
import { drawGlow } from "../render/bake.ts";
import { ease } from "../render/draw.ts";
import type { World } from "./world.ts";

const SEGMENTS = 18;

export function drawBoss(world: World): void {
  const boss = world.boss;
  if (!boss.active) return;
  const { cam, batch, ctx } = world;
  const dying = boss.dying > 0;
  const collapse = dying ? ease.outCubic(Math.min(1, boss.dying / 1.1)) : 0;
  // Never wider than the trench it is hunting in — a phone in portrait has a
  // third of the lane width a laptop does.
  const base = Math.min(40, cam.playHalfW * 0.62) * (1 - collapse * 0.6);
  const flash = boss.flash;
  const color = flash > 0.3 ? C.white : C.boss;

  const rings: Array<[number, number, number, number, number, number, number]> = [
    // ux,uy,uz, vx,vy,vz, radius
    [1, 0, 0, 0, Math.cos(boss.spin * 1.0), Math.sin(boss.spin * 1.0), base],
    [Math.cos(boss.spin * 1.4), 0, Math.sin(boss.spin * 1.4), 0, 1, 0, base * 0.78],
    [Math.cos(-boss.spin * 0.8), Math.sin(-boss.spin * 0.8), 0, 0, 0, 1, base * 0.56],
  ];

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    const radius = ring[6];
    let prevX = 0;
    let prevY = 0;
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      const ca = Math.cos(a) * radius;
      const sa = Math.sin(a) * radius;
      const wx = boss.x + ring[0] * ca + ring[3] * sa;
      const wy = boss.y + ring[1] * ca + ring[4] * sa;
      const wz = ring[2] * ca + ring[5] * sa;
      const p = project(cam, wx, wy, wz);
      if (i > 0) {
        // Rings nearer the lens are brighter — cheap depth cueing that makes
        // three flat circles read as a gimbal.
        const depth = 0.62 + (wz / (radius + 1)) * 0.3;
        batch.push(
          prevX,
          prevY,
          p.x,
          p.y,
          color,
          (1.9 + flash * 2.4) * depth,
          (0.75 + flash * 0.25 - collapse * 0.6) * depth,
        );
      }
      prevX = p.x;
      prevY = p.y;
    }
  }

  const centre = project(cam, boss.x, boss.y, 0);
  const cx = centre.x;
  const cy = centre.y;
  const s = centre.s;

  // Shield: a hexagonal shell that shows how much of the fight is left.
  if (boss.shield > 0.01 && !dying) {
    const shieldR = base * 1.32;
    let prevX = 0;
    let prevY = 0;
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + boss.spin * 0.3;
      const p = project(cam, boss.x + Math.cos(a) * shieldR, boss.y + Math.sin(a) * shieldR * 0.9, 0);
      if (i > 0) {
        batch.push(prevX, prevY, p.x, p.y, C.boss, 2.4, boss.shield * 0.55);
      }
      prevX = p.x;
      prevY = p.y;
    }
  }

  ctx.globalCompositeOperation = "lighter";
  const pulse = 0.5 + Math.sin(world.time * 2.4) * 0.12;
  drawGlow(ctx, C.boss, cx, cy, base * s * 1.1 * (1 + flash), (0.24 + flash * 0.4) * pulse * (1 - collapse));
  drawGlow(ctx, C.white, cx, cy, base * s * 0.22 * (1 + flash * 1.5), (0.12 + flash * 0.4) * (1 - collapse));
  ctx.globalCompositeOperation = "source-over";

  // Health, as filled cells under the crown — inside the trench, never clipped
  // off the top of the viewport.
  const cellY = boss.y - base * 1.35;
  for (let i = 0; i < boss.maxHp; i++) {
    const x = boss.x + (i - (boss.maxHp - 1) / 2) * 15;
    const p = project(cam, x, cellY, 0);
    const filled = i < boss.hp;
    const r = 5 * p.s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - r);
    ctx.lineTo(p.x + r, p.y);
    ctx.lineTo(p.x, p.y + r);
    ctx.lineTo(p.x - r, p.y);
    ctx.closePath();
    ctx.fillStyle = rgba(C.boss, filled ? 0.85 : 0.14);
    ctx.fill();
  }
}
