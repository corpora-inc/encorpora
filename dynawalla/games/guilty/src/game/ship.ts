/**
 * The ship, its gun, and the sight line.
 *
 * The sight line is the single most important piece of interface in the game
 * and it is not text: a thin beam runs from the nose to whatever the next shot
 * will hit, and brackets close around that husk. It is always drawn, from the
 * first frame of a run, so a child can stand still and read the beam and the
 * numbers for as long as they like before anything happens at all.
 *
 * **The gun does not fire by itself.** It used to, from a standstill, which
 * made the first thirty seconds of this game a burst of answers nobody chose to
 * give. Now `tryFire` is called by a tap, a click or the space bar and by
 * nothing else, and `FIRE_INTERVAL` is only a rate limit on how fast the player
 * may ask.
 */

import { project } from "../core/camera.ts";
import {
  BULLET_R,
  BULLET_SPEED,
  FIRE_INTERVAL,
  FIRE_SPEED_GATE,
  SHIP_HALF_W,
  SHIP_MAX_SPEED,
  SHIP_Y,
  VIEW_HALF_H,
} from "../core/config.ts";
import { C } from "../core/palette.ts";
import { drawGlow } from "../render/bake.ts";
import { clamp, damp, ease } from "../render/draw.ts";
import { sparks } from "./fx.ts";
import { Mode, type Husk, type World } from "./world.ts";

const HULL: ReadonlyArray<readonly [number, number, number]> = [
  [0, 13, 0],
  [-9.5, -7, 0],
  [0, -2.5, 0],
  [9.5, -7, 0],
  [0, -1, 8],
];
const HULL_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [0, 4],
  [4, 2],
  [4, 1],
  [4, 3],
];

const px = new Float32Array(5);
const py = new Float32Array(5);

export function updateShip(world: World, dt: number, realDt: number): void {
  const ship = world.ship;
  const limit = world.cam.playHalfW + 6;
  ship.targetX = clamp(ship.targetX, -limit, limit);

  // Position tracking is on *real* time: slow motion is a gift to the player,
  // not a handicap on their own hands.
  const dx = ship.targetX - ship.x;
  const step = clamp(dx * 16, -SHIP_MAX_SPEED, SHIP_MAX_SPEED);
  ship.vx = damp(ship.vx, step, 18, realDt);
  ship.x = clamp(ship.x + ship.vx * realDt, -limit, limit);
  ship.bank = damp(ship.bank, clamp(ship.vx / SHIP_MAX_SPEED, -1, 1), 9, realDt);
  ship.recoil = damp(ship.recoil, 0, 16, realDt);
  ship.muzzle = Math.max(0, ship.muzzle - realDt * 9);
  ship.invuln = Math.max(0, ship.invuln - realDt);

  if (!ship.alive) return;

  // Steadiness, as a readout and nothing more: the sight brightens and the
  // brackets close as the ship comes to rest. It does not fire anything.
  const moving = Math.abs(ship.vx) > FIRE_SPEED_GATE;
  const was = ship.settled;
  ship.settled = moving ? 0 : Math.min(1, ship.settled + realDt / 0.11);
  if (was < 1 && ship.settled >= 1) world.audio.lock();
  ship.fireCd = Math.max(0, ship.fireCd - realDt);

  // Thruster wake, on world time so it stretches beautifully in slow motion.
  if (world.rng.nextFloat() < dt * 62) {
    sparks(world, ship.x + world.rng.range(-4, 4), SHIP_Y - 8, 0, 1, 26, C.thrust, {
      life: 0.3,
      size: 1.1,
      spread: 0.9,
      dirX: 0,
      dirY: -1,
      drag: 5,
    });
  }
}

/**
 * The player asked for a shot. Returns true if one left the nose.
 *
 * The only path to a bullet. It refuses only while the gun is on its cooldown
 * or the ship is gone — never because the ship is moving, because a tap the
 * game silently swallows is exactly as confusing as a shot the child never
 * asked for.
 */
export function tryFire(world: World): boolean {
  const ship = world.ship;
  if (!ship.alive || ship.fireCd > 0) return false;
  ship.fireCd = FIRE_INTERVAL;
  fire(world);
  return true;
}

function fire(world: World): void {
  const ship = world.ship;
  for (const b of world.bullets) {
    if (b.active) continue;
    b.active = true;
    b.enemy = false;
    b.x = ship.x;
    b.y = SHIP_Y + 13;
    b.prevY = b.y;
    b.z = 0;
    b.vy = BULLET_SPEED;
    b.vx = ship.vx * 0.06;
    b.age = 0;
    ship.recoil = 3.4;
    ship.muzzle = 1;
    world.audio.shoot(world.shotStep++);
    sparks(world, ship.x, SHIP_Y + 14, 0, 3, 60, C.shipCore, { life: 0.16, size: 1.2, spread: 1.5, dirX: 0, dirY: 1 });
    return;
  }
}

export function fireBolt(world: World, x: number, y: number): void {
  for (const b of world.bullets) {
    if (b.active) continue;
    b.active = true;
    b.enemy = true;
    b.x = x;
    b.y = y;
    b.prevY = y;
    b.z = 0;
    b.vy = -150;
    b.vx = 0;
    b.age = 0;
    return;
  }
}

export function stepBullets(world: World, dt: number): void {
  const top = VIEW_HALF_H + 60;
  for (const b of world.bullets) {
    if (!b.active) continue;
    b.prevY = b.y;
    b.y += b.vy * dt;
    b.x += b.vx * dt;
    b.age += dt;
    if (b.y > top || b.y < SHIP_Y - 30) b.active = false;
  }
}

/** The husk the next shot will hit, or null. */
export function findTarget(world: World): Husk | null {
  let best: Husk | null = null;
  for (const h of world.husks) {
    if (!h.active || h.mode === Mode.Dying) continue;
    if (h.y < SHIP_Y) continue;
    if (Math.abs(h.x - world.ship.x) > h.radius + BULLET_R) continue;
    if (!best || h.y < best.y) best = h;
  }
  return best;
}

export function drawSight(world: World, target: Husk | null): void {
  const { cam, batch, ctx } = world;
  const ship = world.ship;
  const topY = target ? target.y : VIEW_HALF_H + 20;
  const a = project(cam, ship.x, SHIP_Y + 14, 0);
  const ax = a.x;
  const ay = a.y;
  const b = project(cam, ship.x, topY, 0);
  // Never fully dark. The beam is the answer to "which number will this tap
  // destroy", and that question is asked hardest by a child who has not decided
  // to shoot yet — so it is legible while crossing and blazing once settled.
  const ready = 0.45 + ship.settled * 0.55;
  const locked = target !== null;
  batch.push(
    ax,
    ay,
    b.x,
    b.y,
    locked && ready >= 1 ? C.cyan : C.cyanDim,
    locked ? 1 + ready * 0.6 : 1,
    (locked ? 0.12 + ready * 0.2 : 0.06 + ready * 0.07),
  );

  if (!target) return;
  // Brackets: four corners closing on the number that is about to die. They
  // travel in as the gun settles, so "am I about to shoot" is a *shape*.
  const r = target.radius * (2.3 - ready * 0.8);
  const cxp = project(cam, target.x, target.y, 0);
  const s = cxp.s;
  const bx = cxp.x;
  const by = cxp.y;
  const k = r * s;
  const arm = k * 0.42;
  const pulse = (0.2 + ready * 0.45) + Math.sin(world.time * 9) * 0.12 * ready;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    batch.push(bx + dx * k, by + dy * k, bx + dx * (k - arm), by + dy * k, C.cyan, 1.7, pulse);
    batch.push(bx + dx * k, by + dy * k, bx + dx * k, by + dy * (k - arm), C.cyan, 1.7, pulse);
  }
  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, C.cyan, bx, by, k * 1.5, 0.07);
  ctx.globalCompositeOperation = "source-over";
}

export function drawBullets(world: World): void {
  const { cam, batch } = world;
  for (const b of world.bullets) {
    if (!b.active) continue;
    const color = b.enemy ? C.hostile : C.cyan;
    const tailY = b.enemy ? b.y + 5.5 : b.y - 8;
    const head = project(cam, b.x, b.y, b.z);
    const hx = head.x;
    const hy = head.y;
    const hs = head.s;
    const tail = project(cam, b.x, tailY, b.z);
    batch.push(tail.x, tail.y, hx, hy, color, 1.5 * hs, 0.4);
    batch.push(tail.x, tail.y, hx, hy, C.white, 0.5 * hs, 0.9);
    world.ctx.globalCompositeOperation = "lighter";
    drawGlow(world.ctx, color, hx, hy, 5 * hs, 0.4);
    world.ctx.globalCompositeOperation = "source-over";
  }
}

export function drawShip(world: World): void {
  const { cam, batch, ctx } = world;
  const ship = world.ship;
  if (!ship.alive) return;
  const blink = ship.invuln > 0 && Math.floor(world.time * 14) % 2 === 0;
  const alpha = blink ? 0.35 : 1;

  const roll = ship.bank * 0.5;
  const yaw = ship.bank * 0.55;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  const baseY = SHIP_Y - ship.recoil;

  for (let i = 0; i < HULL.length; i++) {
    const v = HULL[i];
    const x0 = v[0];
    const y0 = v[1];
    const z0 = v[2];
    // Yaw about Y, then roll about Z.
    const x1 = x0 * cosY - z0 * sinY;
    const z1 = x0 * sinY + z0 * cosY;
    const x2 = x1 * cosR - y0 * sinR;
    const y2 = x1 * sinR + y0 * cosR;
    const p = project(cam, ship.x + x2, baseY + y2, z1);
    px[i] = p.x;
    py[i] = p.y;
  }

  const centre = project(cam, ship.x, baseY + 2, 0);
  const cxp = centre.x;
  const cyp = centre.y;
  const scale = centre.s;

  ctx.beginPath();
  ctx.moveTo(px[0], py[0]);
  ctx.lineTo(px[1], py[1]);
  ctx.lineTo(px[2], py[2]);
  ctx.lineTo(px[3], py[3]);
  ctx.closePath();
  ctx.fillStyle = "rgba(20,14,48,0.82)";
  ctx.globalAlpha = alpha;
  ctx.fill();
  ctx.globalAlpha = 1;

  for (const e of HULL_EDGES) {
    batch.push(px[e[0]], py[e[0]], px[e[1]], py[e[1]], C.ship, 1.9 * scale, alpha * 0.95);
  }

  ctx.globalCompositeOperation = "lighter";
  const charged = world.focus >= 1 ? 1 : world.focus;
  // The core is the gun's readiness: dark while you cross, blazing when settled.
  const ready = ship.settled;
  drawGlow(
    ctx,
    C.shipCore,
    cxp,
    cyp,
    11 * scale * (0.55 + ready * 0.5 + charged * 0.6),
    (0.1 + ready * 0.34 + charged * 0.3) * alpha,
  );
  if (ready >= 1) {
    const nose = project(cam, ship.x, SHIP_Y + 13, 0);
    drawGlow(ctx, C.cyan, nose.x, nose.y, 7 * scale, 0.35 * alpha);
  }
  if (ship.muzzle > 0) {
    const m = ease.outCubic(ship.muzzle);
    const nose = project(cam, ship.x, SHIP_Y + 15, 0);
    drawGlow(ctx, C.white, nose.x, nose.y, 11 * scale * m, 0.5 * m * alpha);
  }
  // Thruster
  const thrust = 0.6 + Math.sin(world.time * 33) * 0.16;
  const back = project(cam, ship.x, baseY - 8, 0);
  drawGlow(ctx, C.thrust, back.x, back.y, 9 * scale * thrust, 0.34 * alpha);
  ctx.globalCompositeOperation = "source-over";
}

export function shipHalfWidth(): number {
  return SHIP_HALF_W;
}
