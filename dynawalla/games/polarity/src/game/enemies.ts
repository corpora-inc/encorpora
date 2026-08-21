import { TAU, approach, clamp } from "../core/util.ts";
import { BK, BULLET, COL, EK, ENEMY, HALF_W, polColor } from "./constants.ts";
import type { Bullet, Enemy } from "./types.ts";
import { addBullet, addEnemy, burst, inField, ring, type World } from "./world.ts";

// ---------------------------------------------------------------------------
// firing helpers
// ---------------------------------------------------------------------------

export function fireChaff(
  w: World,
  x: number,
  y: number,
  ang: number,
  speed: number,
  pol: number,
  mag = 1,
): Bullet | null {
  const b = addBullet(w);
  if (!b) return null;
  b.x = x;
  b.y = y;
  b.vx = Math.cos(ang) * speed;
  b.vy = Math.sin(ang) * speed;
  b.v = pol * mag;
  b.r = BULLET.chaffR;
  b.kind = BK.Chaff;
  b.owner = 0;
  b.life = 12;
  b.dmg = 1;
  b.rot = ang;
  b.spin = pol > 0 ? 2.2 : -1.4;
  // a ±1 speck is not arithmetic worth reading; anything bigger prints
  b.labelled = mag > 1 ? 1 : 0;
  return b;
}

export function fireCharge(
  w: World,
  x: number,
  y: number,
  ang: number,
  speed: number,
  value: number,
): Bullet | null {
  const b = addBullet(w);
  if (!b) return null;
  b.x = x;
  b.y = y;
  b.vx = Math.cos(ang) * speed;
  b.vy = Math.sin(ang) * speed;
  b.v = value;
  b.r = BULLET.chargeR;
  b.kind = BK.Charge;
  b.owner = 0;
  b.life = 14;
  b.dmg = 1;
  b.rot = 0;
  b.spin = value > 0 ? 1.1 : -0.8;
  b.labelled = 1;
  b.grow = 1;
  return b;
}

export function fireLance(w: World, x: number, y: number, ang: number, speed: number, pol: number): void {
  const b = addBullet(w);
  if (!b) return;
  b.x = x;
  b.y = y;
  b.vx = Math.cos(ang) * speed;
  b.vy = Math.sin(ang) * speed;
  b.v = pol;
  b.r = BULLET.lanceR;
  b.kind = BK.Lance;
  b.owner = 0;
  b.life = 6;
  b.dmg = 1;
  b.rot = ang;
}

// ---------------------------------------------------------------------------
// spawning
// ---------------------------------------------------------------------------

export function spawnEnemy(w: World, kind: EK, x?: number): Enemy | null {
  const e = addEnemy(w);
  if (!e) return null;
  const spec = ENEMY[kind] ?? ENEMY[EK.Mote];
  if (!spec) return null;
  e.kind = kind;
  e.hp = spec.hp;
  e.maxHp = spec.hp;
  e.r = spec.r;
  e.pol = w.rng.sign();
  e.x = x ?? w.rng.r(-HALF_W + 10, HALF_W - 10);
  e.y = w.halfH + spec.r + 4;
  e.ax = e.x;
  e.ay = w.halfH * 0.42;
  e.vx = 0;
  e.vy = 0;
  e.spin = 0;

  switch (kind) {
    case EK.Mote:
      e.vy = -20;
      e.spin = w.rng.r(-1.4, 1.4);
      break;
    case EK.Weaver:
      e.vy = -15;
      break;
    case EK.Spinner:
      e.vy = -22;
      e.ay = w.rng.r(w.halfH * 0.16, w.halfH * 0.5);
      e.spin = w.rng.sign() * 1.15;
      break;
    case EK.Battery:
      e.vy = -12;
      e.ay = w.rng.r(w.halfH * 0.42, w.halfH * 0.66);
      break;
    case EK.Lancer:
      e.vy = -34;
      e.pol = w.rng.sign();
      break;
    case EK.Bearer:
      e.x = 0;
      e.ax = 0;
      e.ay = w.halfH * 0.44;
      e.vy = -26;
      e.hp = spec.hp;
      e.maxHp = spec.hp;
      break;
    case EK.Warden:
      e.x = 0;
      e.ax = 0;
      e.ay = w.halfH * 0.5;
      e.vy = -20;
      e.pol = 1;
      break;
  }
  ring(w, e.x, e.y, e.r * 1.4, polColor(e.pol), 0.4, 1.1);
  return e;
}

// ---------------------------------------------------------------------------
// per-kind behaviour
// ---------------------------------------------------------------------------

const aim = (e: Enemy, w: World): number => Math.atan2(w.py - e.y, w.px - e.x);

/** Speed scaling from the director, so every pattern ramps together. */
export function stepEnemy(w: World, e: Enemy, dt: number, spd: number): void {
  e.age += dt;
  e.rot += e.spin * dt;
  if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
  e.fireT -= dt;

  switch (e.kind) {
    case EK.Mote: {
      e.x += Math.sin(e.age * 1.7 + e.seed) * 13 * dt;
      e.y += e.vy * dt * spd;
      if (e.fireT <= 0 && e.y < w.halfH - 6) {
        e.fireT = 1.5 / spd;
        fireChaff(w, e.x, e.y - e.r, aim(e, w), 40 * spd, e.pol, w.stratum >= 6 ? 2 : 1);
        e.hitFlash = Math.max(e.hitFlash, 0.35);
      }
      break;
    }
    case EK.Weaver: {
      e.x = e.ax + Math.sin(e.age * 1.25 + e.seed) * (HALF_W - 12);
      e.y += e.vy * dt * spd;
      if (e.fireT <= 0 && e.y < w.halfH - 6) {
        e.fireT = 1.45 / spd;
        const a = aim(e, w);
        for (let i = -1; i <= 1; i++) {
          fireChaff(w, e.x, e.y - e.r, a + i * 0.24, 44 * spd, i === 0 ? e.pol : -e.pol);
        }
        e.hitFlash = 0.4;
      }
      break;
    }
    case EK.Spinner: {
      e.y = approach(e.y, e.ay, 0.7, dt);
      e.x += Math.sin(e.age * 0.8 + e.seed) * 9 * dt;
      if (e.fireT <= 0 && e.y < w.halfH - 4) {
        e.fireT = 0.15 / spd;
        // two counter-signed arms — the classic weave-through-the-spiral
        for (let arm = 0; arm < 2; arm++) {
          const a = e.rot + arm * Math.PI;
          fireChaff(w, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, 33 * spd, arm ? -1 : 1);
        }
      }
      break;
    }
    case EK.Battery: {
      e.y = approach(e.y, e.ay, 0.9, dt);
      e.x = approach(e.x, e.ax + Math.sin(e.age * 0.55 + e.seed) * 20, 0.6, dt);
      if (e.fireT <= 0 && e.y < w.halfH - 4) {
        e.fireT = 2.15 / spd;
        const n = w.stratum >= 4 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const sign = w.rng.sign();
          const mag = w.rng.i(2, Math.min(9, 3 + w.stratum));
          const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42 + w.rng.r(-0.08, 0.08);
          fireCharge(w, e.x, e.y - e.r * 0.6, a, 26 * spd, sign * mag);
        }
        e.hitFlash = 0.6;
        burst(w, e.x, e.y - e.r, 6, 22, polColor(e.pol), { life: 0.3, size: 1.1 });
      }
      break;
    }
    case EK.Lancer: {
      // lock onto the player's column, then dive
      if (e.age < 0.55) {
        e.x = approach(e.x, w.px, 0.18, dt);
        e.y += -10 * dt;
      } else {
        e.y += e.vy * 2.4 * dt * spd;
        if (e.fireT <= 0) {
          e.fireT = 0.34;
          fireLance(w, e.x, e.y - e.r, -Math.PI / 2, 78 * spd, e.pol);
        }
      }
      break;
    }
    case EK.Bearer:
    case EK.Warden:
      // driven by seal.ts / warden.ts
      break;
  }
}

/** True when the enemy has left the bottom of the field for good. */
export function enemyEscaped(w: World, e: Enemy): boolean {
  return e.y < -w.halfH - e.r - 6 || !inField(w, e.x, e.y, e.r + 30);
}

export function enemyDeathFx(w: World, e: Enemy): void {
  const col = polColor(e.pol);
  const big = e.r > 6;
  burst(w, e.x, e.y, big ? 46 : 16, big ? 78 : 46, col, {
    life: big ? 0.8 : 0.5,
    size: big ? 2.6 : 1.7,
    kind: 1,
  });
  burst(w, e.x, e.y, big ? 26 : 9, big ? 44 : 26, COL.posHot, { life: 0.32, size: 1.2 });
  ring(w, e.x, e.y, e.r * 1.1, col, big ? 0.6 : 0.36, big ? 2.4 : 1.3);
}

/** A single spinning debris shard field, used for the player's death. */
export function shatter(w: World, x: number, y: number, col: readonly number[], n = 40): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + w.rng.r(-0.2, 0.2);
    const s = w.rng.r(24, 96);
    const p = addBullet(w);
    if (p) {
      // reuse the bullet pool for inert debris so the shatter is dense
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.v = 0;
      p.r = w.rng.r(0.7, 2.1);
      p.kind = BK.Shot;
      p.owner = 2; // inert
      p.life = w.rng.r(0.6, 1.5);
      p.rot = a;
      p.spin = w.rng.r(-9, 9);
    }
  }
  burst(w, x, y, 60, 90, col, { life: 1.1, size: 2.4, kind: 1 });
}

export const enemyIsBoss = (e: Enemy): boolean => e.kind === EK.Bearer || e.kind === EK.Warden;

export const enemyHpFrac = (e: Enemy): number => clamp(e.hp / e.maxHp, 0, 1);
