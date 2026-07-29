import { TAU, angDiff, approach, clamp, clamp01 } from "../core/util.ts";
import { absorbable, chainMult, overloaded, releaseYield } from "../math/signed.ts";
import {
  BK,
  BULLET,
  COL,
  CORE,
  EK,
  ENEMY,
  HALF_W,
  PACE,
  PLAYER,
  SCORE,
  polColor,
  polEdge,
  polHot,
} from "./constants.ts";
import {
  enemyDeathFx,
  enemyEscaped,
  enemyIsBoss,
  shatter,
  spawnEnemy,
  stepEnemy,
} from "./enemies.ts";
import {
  bearerDue,
  bossDefeated,
  launchBoss,
  onOrbTouched,
  stepBoss,
  stepOrb,
  tryLock,
} from "./seal.ts";
import type { Bullet, Enemy, FloatText, Particle } from "./types.ts";
import {
  addBullet,
  addText,
  burst,
  clampToField,
  cue,
  flash,
  hitstop,
  inField,
  punch,
  ring,
  shake,
  shockwave,
  slowmo,
  stepWaves,
  type World,
} from "./world.ts";

// ---------------------------------------------------------------------------
// pacing
// ---------------------------------------------------------------------------

export const speedMul = (w: World): number =>
  1 + Math.min(PACE.speedMax, w.stratum * PACE.speedPerLvl);

const UNLOCK: readonly EK[][] = [
  [EK.Mote],
  [EK.Mote, EK.Weaver],
  [EK.Mote, EK.Weaver, EK.Spinner],
  [EK.Mote, EK.Weaver, EK.Spinner, EK.Battery],
  [EK.Mote, EK.Weaver, EK.Spinner, EK.Battery, EK.Lancer],
];

/**
 * How deep the run is, and therefore how hard: spawn rate, enemy speed, which
 * enemies exist at all, and how much hull a boss has.
 *
 * **A seal broken, not a clock tick.** It used to be `floor(t / 30)`, so the
 * arithmetic got faster and more crowded every thirty seconds whether or not the
 * child had read a single answer — a child still working out `43 + 25` was being
 * charged rent for thinking. EXPERIENCE_DESIGN.md is explicit that comprehension
 * time is "not budgeted — the child's time, measured, never limited", and the
 * rest of this fleet escalates on what the child FINISHED. So does this now.
 *
 * A child who is not getting them right stays where they are, for as long as
 * they like, and the game is still a game: bearers keep arriving, the dodging is
 * still the dodging. Nothing about the run punishes a slow read.
 */
export function stratumOf(w: World): number {
  return w.stats.right;
}

/**
 * How many kinds of enemy exist yet.
 *
 * Split off the stratum on purpose. Pressure — spawn rate, speed, boss hull —
 * rises on what the child ANSWERED, and it must, or the arithmetic charges rent
 * for thinking. But a roster that also waited on answers would leave a child who
 * is flying beautifully and reading slowly alone in an empty sky with one kind
 * of mote, forever, which is not "the dodging is still the dodging" — it is the
 * floor of it.
 *
 * So the world widens on CHARGE ABSORBED: the ship's own arithmetic, performed
 * by flying, which a child accrues by playing well whether or not they have
 * broken a seal yet. Idle in the corner and nothing arrives, because nobody is
 * playing.
 */
export function rosterOf(w: World): number {
  return Math.min(UNLOCK.length - 1, Math.floor(w.stats.absorbs / 40));
}

function direct(w: World, dt: number): void {
  const lvl = stratumOf(w);
  if (lvl !== w.stratum) {
    w.stratum = lvl;
    if (lvl > 0) {
      w.events.push("stratum");
      shockwave(w, 0, 0, 0.8, 0, 1.1);
    }
  }
  if (w.bossActive) return;

  const rate = Math.min(PACE.spawnMax, PACE.spawnBase + lvl * PACE.spawnPerLvl);
  w.spawnAcc += dt * rate;
  const table = UNLOCK[rosterOf(w)] ?? UNLOCK[0];
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    if (!table) break;
    const k = w.rng.pick(table);
    // batteries arrive in pairs so there is always charge to steer the core with
    if (k === EK.Battery && w.rng.chance(0.5)) {
      spawnEnemy(w, k, -18);
      spawnEnemy(w, k, 18);
    } else if (k === EK.Mote && w.rng.chance(0.45)) {
      const x0 = w.rng.r(-HALF_W + 14, HALF_W - 14);
      for (let i = 0; i < 3; i++) spawnEnemy(w, k, x0 + (i - 1) * 11);
    } else spawnEnemy(w, k);
  }
  if (bearerDue(w)) launchBoss(w);
}

// ---------------------------------------------------------------------------
// player actions (called by the input layer)
// ---------------------------------------------------------------------------

export function flip(w: World): void {
  if (w.phase !== "play" || w.flipT > 0) return;
  const from = w.pol;
  w.pol = -from;
  w.flipT = PLAYER.flipCooldown;
  w.polMorph = 0;
  w.events.push("flip");

  // CLUTCH: did that flip turn a bullet that was about to kill you into food?
  let saved = 0;
  for (let i = 0; i < w.bulletN; i++) {
    const b = w.bullets[i] as Bullet;
    if (b.owner !== 0 || b.kind === BK.Orb) continue;
    if (absorbable(b.v, from as 1 | -1)) continue;
    if (!absorbable(b.v, w.pol as 1 | -1)) continue;
    const dx = w.px - b.x;
    const dy = w.py - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > PLAYER.clutchRadius * PLAYER.clutchRadius) continue;
    if (b.vx * dx + b.vy * dy <= 0) continue; // not closing
    saved++;
  }
  if (saved > 0) {
    w.chain += 2 + saved;
    w.stats.clutches++;
    w.stats.score += SCORE.clutch * saved * chainMult(w.chain);
    slowmo(w, 0.3, 0.82);
    hitstop(w, 0.045);
    punch(w, 0.55);
    shake(w, 0.16);
    ring(w, w.px, w.py, 3, polHot(w.pol), 0.55, 2.6);
    ring(w, w.px, w.py, 7, COL.gold, 0.42, 1.6);
    burst(w, w.px, w.py, 26, 60, COL.gold, { life: 0.6, size: 1.7 });
    w.host.haptic("success");
    w.events.push("clutch");
    cue(w, "clutch");
  } else {
    ring(w, w.px, w.py, 3.4, polColor(w.pol), 0.3, 1.5);
    burst(w, w.px, w.py, 8, 28, polEdge(w.pol), { life: 0.28, size: 1.1 });
    w.host.haptic("light");
  }
}

export function release(w: World): void {
  if (w.phase !== "play" || w.stun > 0) return;

  // an open Warden lock is graded against the exact total first
  for (let i = 0; i < w.enemyN; i++) {
    const e = w.enemies[i] as Enemy;
    if (e.kind === EK.Warden && e.lockState === 1) {
      tryLock(w, e);
      break;
    }
  }

  const mult = chainMult(w.chain);
  const { darts, score, perfect } = releaseYield(w.core, w.cap, mult);
  if (darts === 0) {
    burst(w, w.px, w.py + 2, 5, 18, polEdge(w.pol), { life: 0.2, size: 0.9 });
    w.events.push("fizzle");
    return;
  }
  const sign = w.core >= 0 ? 1 : -1;
  const col = polColor(sign);
  for (let i = 0; i < darts; i++) {
    const b = addBullet(w);
    if (!b) break;
    const a = -Math.PI / 2 + Math.PI + (i / darts - 0.5) * 2.1 + w.rng.r(-0.08, 0.08);
    b.x = w.px;
    b.y = w.py;
    b.vx = Math.cos(a) * CORE.dartSpeed * w.rng.r(0.7, 1.1);
    b.vy = Math.sin(a) * CORE.dartSpeed * w.rng.r(0.7, 1.1);
    b.v = sign;
    b.r = BULLET.dartR;
    b.kind = BK.Dart;
    b.owner = 1;
    b.life = CORE.dartLife;
    b.homing = CORE.dartTurn;
    b.dmg = CORE.dartDamage * (perfect ? 2 : 1);
    b.rot = a;
  }
  w.stats.score += score;
  w.stats.releases++;
  if (perfect) w.stats.perfects++;
  w.recoil = 1;
  w.core = 0;
  w.events.push(perfect ? "perfect" : "release");
  hitstop(w, perfect ? 0.075 : 0.03);
  punch(w, perfect ? 0.9 : 0.5);
  shake(w, perfect ? 0.42 : 0.22);
  shockwave(w, w.px, w.py, perfect ? 1.5 : 0.9, sign, perfect ? 0.8 : 0.55);
  ring(w, w.px, w.py, 4, perfect ? COL.gold : col, 0.5, perfect ? 3.2 : 1.8);
  burst(w, w.px, w.py, perfect ? 60 : 26, perfect ? 110 : 70, perfect ? COL.gold : col, {
    life: 0.7,
    size: 2.2,
    kind: 1,
  });
  if (perfect) {
    flash(w, 0.22, COL.gold);
    slowmo(w, 0.22, 0.7);
  }
  w.host.haptic(perfect ? "success" : "medium");
  cue(w, "release");
}

// ---------------------------------------------------------------------------
// core changes
// ---------------------------------------------------------------------------

function absorb(w: World, b: Bullet): void {
  w.core += b.v;
  w.chain++;
  w.chainT = 1.2;
  w.stats.absorbs++;
  if (w.chain > w.stats.bestChain) w.stats.bestChain = w.chain;
  w.stats.score += SCORE.absorb * chainMult(w.chain);

  const col = polColor(b.v);
  const big = b.kind === BK.Charge;
  burst(w, b.x, b.y, big ? 16 : 6, big ? 46 : 26, col, {
    life: big ? 0.45 : 0.3,
    size: big ? 1.7 : 1.1,
  });
  if (big) {
    ring(w, w.px, w.py, 3.2, polHot(b.v), 0.3, 1.4);
    addText(w, b.v, b.x, b.y, polHot(b.v));
    punch(w, 0.18);
    w.host.haptic("light");
  }
  b.live = false;
  w.events.push(big ? "absorb-big" : "absorb");
  cue(w, "absorb");

  if (overloaded(w.core, w.cap)) overload(w);
}

function overload(w: World): void {
  const sign = w.core >= 0 ? 1 : -1;
  w.stats.overloads++;
  w.chain = 0;
  w.core = 0;
  w.stun = CORE.ventStun;
  w.events.push("overload");
  hitstop(w, 0.06);
  shake(w, 0.55);
  punch(w, 0.7);
  flash(w, 0.2, COL.bad);
  shockwave(w, w.px, w.py, 1.3, sign, 0.7);
  ring(w, w.px, w.py, 3, COL.bad, 0.6, 3.4);
  burst(w, w.px, w.py, 46, 90, COL.bad, { life: 0.7, size: 2.1, kind: 1 });
  // the vent still clears the bullets nearest to you — a loss, not a death trap
  for (let i = 0; i < w.bulletN; i++) {
    const b = w.bullets[i] as Bullet;
    if (b.owner !== 0 || b.kind === BK.Orb) continue;
    const dx = b.x - w.px;
    const dy = b.y - w.py;
    if (dx * dx + dy * dy < 22 * 22) {
      burst(w, b.x, b.y, 3, 26, COL.bad, { life: 0.25, size: 0.9 });
      b.live = false;
    }
  }
  w.host.haptic("heavy");
}

function hurt(w: World, x: number, y: number): void {
  if (w.invuln > 0 || w.phase !== "play") return;
  w.shields--;
  w.invuln = PLAYER.invuln;
  w.chain = 0;
  w.core = Math.trunc(w.core / 2);
  w.events.push("hurt");
  hitstop(w, 0.09);
  shake(w, 0.75);
  punch(w, 0.85);
  flash(w, 0.26, COL.bad);
  shockwave(w, x, y, 1.2, 0, 0.7);
  ring(w, w.px, w.py, 4, COL.bad, 0.55, 3);
  burst(w, w.px, w.py, 40, 82, COL.bad, { life: 0.8, size: 2.2, kind: 1 });
  w.host.haptic("failure");
  if (w.shields <= 0) beginDeath(w);
}

function beginDeath(w: World): void {
  w.phase = "dying";
  w.stun = 99;
  w.events.push("death");
  hitstop(w, 0.2);
  slowmo(w, 1.4, 0.9);
  shake(w, 1);
  punch(w, 1);
  flash(w, 0.3, COL.bad);
  shockwave(w, w.px, w.py, 2, 0, 1.3);
  shatter(w, w.px, w.py, polColor(w.pol), 44);
}

// ---------------------------------------------------------------------------
// the step
// ---------------------------------------------------------------------------

export function step(w: World, dtWall: number): void {
  const fx = w.fx;
  w.wall += dtWall;

  // hit-stop: the whole world freezes solid. Impact reads as weight.
  if (fx.hitstop > 0) {
    fx.hitstop -= dtWall;
    decayFx(w, dtWall, true);
    return;
  }

  // slow motion
  let scale = 1;
  if (fx.slowFor > 0) {
    fx.slowT += dtWall;
    const k = clamp01(fx.slowT / fx.slowFor);
    const depth = fx.slow;
    scale = 1 - depth * (1 - k) * (1 - k);
    if (fx.slowT >= fx.slowFor) {
      fx.slowFor = 0;
      fx.slow = 0;
      scale = 1;
    }
  }
  const dt = Math.min(0.05, dtWall * scale);
  if (w.phase === "play") w.t += dt;
  w.stats.depth = w.t;

  if (w.phase === "play") direct(w, dt);
  const spd = speedMul(w);

  stepPlayer(w, dt);
  stepEnemies(w, dt, spd);
  stepBullets(w, dt, spd);
  stepParticles(w, dt);
  stepTexts(w, dt);
  decayFx(w, dtWall, false);

  if (w.phase === "dying" && fx.slowFor === 0) {
    w.phase = "revive";
    w.events.push("revive-offer");
  }
}

function decayFx(w: World, dt: number, frozen: boolean): void {
  const fx = w.fx;
  fx.trauma = Math.max(0, fx.trauma - dt * 1.9);
  fx.flash = Math.max(0, fx.flash - dt * 4.2);
  fx.ab = Math.max(0, fx.ab - dt * 3);
  fx.glow = approach(fx.glow, 0, 0.25, dt);
  if (fx.punch > 0) {
    fx.punchT += dt;
    if (fx.punchT > 0.5) fx.punch = 0;
  }
  if (!frozen) stepWaves(fx, dt);
  w.cueT = Math.max(0, w.cueT - dt);
  w.chainT = Math.max(0, w.chainT - dt);
  w.coreShown = approach(w.coreShown, w.core, 0.045, dt);
}

function stepPlayer(w: World, dt: number): void {
  if (w.phase === "dying" || w.phase === "revive" || w.phase === "over") {
    w.polMorph = Math.min(1, w.polMorph + dt * 5);
    return;
  }
  w.flipT = Math.max(0, w.flipT - dt);
  w.polMorph = Math.min(1, w.polMorph + dt * 7.5);
  w.invuln = Math.max(0, w.invuln - dt);
  w.stun = Math.max(0, w.stun - dt);
  w.recoil = Math.max(0, w.recoil - dt * 3.4);
  w.overloadWarn = clamp01(Math.abs(w.core) / w.cap);

  if (w.pointing) {
    w.px = approach(w.px, w.tx, PLAYER.chaseHalfLife, dt);
    w.py = approach(w.py, w.ty, PLAYER.chaseHalfLife, dt);
    w.pvx = 0;
    w.pvy = 0;
  } else {
    w.px += w.pvx * dt;
    w.py += w.pvy * dt;
    const f = Math.pow(PLAYER.friction, dt);
    w.pvx *= f;
    w.pvy *= f;
  }
  clampToField(w);

  // engine wake
  if (!w.reduced && w.rng.chance(0.75)) {
    burst(w, w.px + w.rng.r(-1, 1), w.py - 3.4, 1, 16, polEdge(w.pol), {
      life: 0.26,
      size: 1.1,
      dir: -Math.PI / 2,
      spread: 0.8,
    });
  }

  if (w.phase !== "play" || w.stun > 0) return;
  w.fireT -= dt;
  if (w.fireT <= 0) {
    w.fireT += PLAYER.fireEvery;
    const side = (w.stats.absorbs + Math.round(w.t * 12)) % 2 ? 1 : -1;
    for (const s of [-1, 1]) {
      const b = addBullet(w);
      if (!b) break;
      b.x = w.px + s * 2.4;
      b.y = w.py + 2.6;
      b.vx = s * 2 + w.rng.r(-1.5, 1.5);
      b.vy = PLAYER.shotSpeed;
      b.v = w.pol;
      b.r = BULLET.shotR;
      b.kind = BK.Shot;
      b.owner = 1;
      b.life = 1.6;
      b.dmg = PLAYER.shotDamage;
      b.rot = Math.PI / 2;
    }
    burst(w, w.px + side * 2.4, w.py + 3.2, 2, 26, polHot(w.pol), {
      life: 0.12,
      size: 1.2,
      dir: Math.PI / 2,
      spread: 0.7,
    });
    w.recoil = Math.max(w.recoil, 0.22);
  }
}

function stepEnemies(w: World, dt: number, spd: number): void {
  for (let i = 0; i < w.enemyN; ) {
    const e = w.enemies[i] as Enemy;
    if (!e.live) {
      dropEnemy(w, i);
      continue;
    }
    if (enemyIsBoss(e)) stepBoss(w, e, dt, spd);
    else stepEnemy(w, e, dt, spd);

    // ramming
    if (w.phase === "play" && w.invuln <= 0) {
      const spec = ENEMY[e.kind];
      const rr = e.r * 0.72 + PLAYER.hit;
      const dx = e.x - w.px;
      const dy = e.y - w.py;
      if ((spec?.ram || enemyIsBoss(e)) && dx * dx + dy * dy < rr * rr) {
        hurt(w, e.x, e.y);
        if (spec?.ram) e.hp = 0;
      }
    }

    if (e.hp <= 0) {
      enemyDeathFx(w, e);
      const spec = ENEMY[e.kind];
      w.stats.score += (spec?.score ?? 40) * chainMult(w.chain);
      if (enemyIsBoss(e)) {
        bossDefeated(w, e);
        hitstop(w, 0.14);
        slowmo(w, 0.6, 0.8);
        shake(w, 0.8);
        punch(w, 1);
        flash(w, 0.28, COL.gold);
      }
      e.live = false;
      dropEnemy(w, i);
      continue;
    }
    if (!enemyIsBoss(e) && enemyEscaped(w, e)) {
      e.live = false;
      dropEnemy(w, i);
      continue;
    }
    i++;
  }
}

function dropEnemy(w: World, i: number): void {
  w.enemyN--;
  const last = w.enemies[w.enemyN] as Enemy;
  w.enemies[w.enemyN] = w.enemies[i] as Enemy;
  w.enemies[i] = last;
}

function stepBullets(w: World, dt: number, spd: number): void {
  const alive = w.phase === "play";
  const absorbR2 = PLAYER.absorb * PLAYER.absorb;
  const grabR2 = (PLAYER.hit + 2.2) * (PLAYER.hit + 2.2);
  const hurry = w.seal.state === "asking" ? 1 : 2.2;

  for (let i = 0; i < w.bulletN; ) {
    const b = w.bullets[i] as Bullet;
    if (!b.live) {
      dropBullet(w, i);
      continue;
    }
    b.age += dt;
    if (b.age >= b.life) {
      if (b.seal > 0 && b.correct) {
        // the answer left the field: nothing more to do, seal.ts already reported
        b.live = false;
      }
      b.live = false;
      dropBullet(w, i);
      continue;
    }

    if (b.kind === BK.Orb) {
      stepOrb(w, b, dt, hurry);
      if (alive && absorbable(b.v, w.pol as 1 | -1)) {
        const rr = b.r * 0.8 + PLAYER.hit;
        const dx = b.x - w.px;
        const dy = b.y - w.py;
        if (dx * dx + dy * dy < rr * rr) {
          onOrbTouched(w, b);
          dropBullet(w, i);
          continue;
        }
      }
      i++;
      continue;
    }

    if (b.owner === 2) {
      // inert debris
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= Math.pow(0.2, dt);
      b.vy *= Math.pow(0.2, dt);
      b.rot += b.spin * dt;
      i++;
      continue;
    }

    if (b.homing > 0) {
      let bx = 0;
      let by = 0;
      let best = Infinity;
      for (let k = 0; k < w.enemyN; k++) {
        const e = w.enemies[k] as Enemy;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          bx = e.x;
          by = e.y;
        }
      }
      if (best < Infinity) {
        const want = Math.atan2(by - b.y, bx - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const na = cur + clamp(angDiff(cur, want), -b.homing * dt, b.homing * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp;
        b.vy = Math.sin(na) * sp;
        b.rot = na;
      }
      if (!w.reduced && w.rng.chance(0.5)) {
        burst(w, b.x, b.y, 1, 6, polEdge(b.v), { life: 0.22, size: 0.85 });
      }
    }

    const m = b.owner === 0 ? spd : 1;
    b.x += b.vx * dt * m;
    b.y += b.vy * dt * m;
    b.rot += b.spin * dt;
    if (b.grow > 0) b.grow = Math.max(0, b.grow - dt * 4);

    if (b.owner === 1) {
      // player ordnance vs enemies
      let hitOne = false;
      for (let k = 0; k < w.enemyN; k++) {
        const e = w.enemies[k] as Enemy;
        const rr = e.r + b.r;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        let dmg = b.dmg;
        if (e.pol !== 0 && e.pol !== b.v) dmg *= PLAYER.oppositeBonus; // Ikaruga's rule
        if (e.lockState === 2) dmg *= 3; // a cracked seal is soft
        e.hp -= dmg;
        e.hitFlash = 1;
        const col = polColor(b.v);
        burst(w, b.x, b.y, dmg > b.dmg ? 7 : 3, dmg > b.dmg ? 40 : 22, col, {
          life: 0.24,
          size: dmg > b.dmg ? 1.4 : 1,
        });
        if (dmg > b.dmg) w.events.push("weak");
        hitOne = true;
        break;
      }
      if (hitOne || !inField(w, b.x, b.y, 12)) {
        b.live = false;
        dropBullet(w, i);
        continue;
      }
      i++;
      continue;
    }

    // hostile bullet vs player
    if (alive) {
      const dx = b.x - w.px;
      const dy = b.y - w.py;
      const d2 = dx * dx + dy * dy;
      if (absorbable(b.v, w.pol as 1 | -1)) {
        if (d2 < absorbR2 && w.stun <= 0) {
          const d = Math.sqrt(d2) || 1;
          const pull = 1 - d / PLAYER.absorb;
          b.pull = Math.max(b.pull, pull);
          const k = 340 * pull * pull * dt;
          b.vx -= (dx / d) * k;
          b.vy -= (dy / d) * k;
          if (d2 < grabR2) {
            absorb(w, b);
            dropBullet(w, i);
            continue;
          }
        } else b.pull = Math.max(0, b.pull - dt * 3);
      } else {
        b.pull = 0;
        const rr = b.r * 0.62 + PLAYER.hit;
        if (d2 < rr * rr) {
          hurt(w, b.x, b.y);
          b.live = false;
          dropBullet(w, i);
          continue;
        }
      }
    }

    if (!inField(w, b.x, b.y, 14)) {
      b.live = false;
      dropBullet(w, i);
      continue;
    }
    i++;
  }
}

function dropBullet(w: World, i: number): void {
  w.bulletN--;
  const last = w.bullets[w.bulletN] as Bullet;
  w.bullets[w.bulletN] = w.bullets[i] as Bullet;
  w.bullets[i] = last;
}

function stepParticles(w: World, dt: number): void {
  for (let i = 0; i < w.partN; ) {
    const p = w.parts[i] as Particle;
    p.age += dt;
    if (p.age >= p.life) {
      p.live = false;
      w.partN--;
      const last = w.parts[w.partN] as Particle;
      w.parts[w.partN] = p;
      w.parts[i] = last;
      continue;
    }
    if (p.kind !== 2) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const f = Math.pow(p.drag, dt * 60);
      p.vx *= f;
      p.vy *= f;
      p.rot += p.spin * dt;
    }
    i++;
  }
}

function stepTexts(w: World, dt: number): void {
  for (let i = 0; i < w.textN; ) {
    const t = w.texts[i] as FloatText;
    t.age += dt;
    if (t.age >= t.life) {
      t.live = false;
      w.textN--;
      const last = w.texts[w.textN] as FloatText;
      w.texts[w.textN] = t;
      w.texts[i] = last;
      continue;
    }
    t.y += t.vy * dt;
    t.vy *= Math.pow(0.06, dt);
    i++;
  }
}

// ---------------------------------------------------------------------------
// run lifecycle
// ---------------------------------------------------------------------------

export function startRun(w: World): void {
  w.phase = "play";
  w.t = 0;
  w.px = 0;
  w.py = -w.halfH * 0.62;
  w.tx = w.px;
  w.ty = w.py;
  w.pvx = 0;
  w.pvy = 0;
  w.pol = 1;
  w.polMorph = 1;
  w.shields = PLAYER.shields;
  w.invuln = 1.2;
  w.stun = 0;
  w.core = 0;
  w.coreShown = 0;
  w.cap = CORE.capBase;
  w.chain = 0;
  w.bulletN = 0;
  w.enemyN = 0;
  w.partN = 0;
  w.textN = 0;
  w.spawnAcc = 0;
  w.stratum = 0;
  w.bearerCount = 0;
  w.bossActive = false;
  w.bank = 1;
  w.nextBearer = PACE.firstBearer;
  w.seal.state = "idle";
  w.seal.q = null;
  w.fx.waveN = 0;
  w.stats.score = 0;
  w.stats.absorbs = 0;
  w.stats.clutches = 0;
  w.stats.bestChain = 0;
  w.stats.asked = 0;
  w.stats.right = 0;
  w.stats.releases = 0;
  w.stats.perfects = 0;
  w.stats.overloads = 0;
  w.events.push("start");
  shockwave(w, w.px, w.py, 1.2, 1, 0.8);
}

export function revive(w: World): void {
  w.phase = "play";
  w.shields = PLAYER.shields;
  w.invuln = 2.4;
  w.stun = 0;
  w.core = 0;
  w.bank = 0;
  w.events.push("revive");
  // clear the field and pay for every bullet cleared
  let cleared = 0;
  for (let i = 0; i < w.bulletN; i++) {
    const b = w.bullets[i] as Bullet;
    if (b.owner !== 0) continue;
    burst(w, b.x, b.y, 3, 40, COL.gold, { life: 0.5, size: 1.2 });
    b.live = false;
    cleared++;
  }
  w.stats.score += cleared * 40;
  hitstop(w, 0.12);
  slowmo(w, 0.5, 0.7);
  shake(w, 0.7);
  punch(w, 1);
  flash(w, 0.3, COL.gold);
  shockwave(w, w.px, w.py, 2.4, 0, 1.2);
  for (let r = 0; r < 4; r++) ring(w, w.px, w.py, 4 + r * 9, COL.gold, 0.7 + r * 0.1, 2.6);
  burst(w, w.px, w.py, 90, 130, COL.gold, { life: 1, size: 2.6, kind: 1 });
  w.host.haptic("success");
}

export function endRun(w: World): void {
  w.phase = "over";
  if (w.stats.score > w.stats.best) w.stats.best = w.stats.score;
  w.events.push("over");
}

/** Absorb-radius aura pulse used by the renderer; kept here so tests can see it. */
export const auraPulse = (w: World): number =>
  0.55 + 0.45 * Math.sin(w.wall * 3.1) * (1 - clamp01(w.overloadWarn));

export const chainMultiplier = (w: World): number => chainMult(w.chain);
export const TAU_ = TAU;
