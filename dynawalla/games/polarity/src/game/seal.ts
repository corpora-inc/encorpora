import { labelTile } from "../core/labels.ts";
import { TAU, approach, clamp } from "../core/util.ts";
import { parseInt_ } from "../math/signed.ts";
import {
  BK,
  BULLET,
  COL,
  CORE,
  EK,
  ENEMY,
  HALF_W,
  PACE,
  SCORE,
  polColor,
  polHot,
} from "./constants.ts";
import { fireChaff, fireCharge, spawnEnemy } from "./enemies.ts";
import type { Bullet, Enemy } from "./types.ts";
import {
  addBullet,
  burst,
  cue,
  flash,
  hitstop,
  punch,
  ring,
  shake,
  shockwave,
  slowmo,
  type World,
} from "./world.ts";

/**
 * The question layer, and the only place `host.next()` / `host.report()` are
 * called.
 *
 * The whole integration is motion, not UI. A Seal Bearer holds the prompt on
 * its hull and drops four ORBS carrying the answer and three mal-rule
 * distractors. An orb's SIGN is its polarity, so:
 *
 *   - you can fly straight through any orb whose sign is not yours — wrong
 *     answers of the opposite sign are ghosts;
 *   - an orb of your own sign is solid, and touching it commits you.
 *
 * So answering is: read the prompt, pick a polarity, thread the mines. There is
 * no button, no red X and no lecture — a wrong answer detonates in your face
 * and costs a shield, which is a real price, and the correct orb is still
 * sitting there waiting.
 */

const ORB_SPEED_IN = 26;
const ORB_HOLD_BASE = 7.5;
const ORB_HOLD_MIN = 4.6;

export function bearerDue(w: World): boolean {
  return !w.bossActive && w.t >= w.nextBearer;
}

export function scheduleNextBearer(w: World): void {
  const gap = Math.max(PACE.bearerEveryMin, PACE.bearerEvery - w.bearerCount * 1.1);
  w.nextBearer = w.t + gap;
}

export function launchBoss(w: World): void {
  w.bearerCount++;
  const warden = w.bearerCount % PACE.wardenEvery === 0;
  const e = spawnEnemy(w, warden ? EK.Warden : EK.Bearer);
  if (!e) return;
  const spec = ENEMY[warden ? EK.Warden : EK.Bearer];
  if (spec) {
    // bosses toughen with depth so they stay a real fight at minute 20
    const scale = 1 + Math.min(2.4, w.stratum * 0.16);
    e.hp = Math.round(spec.hp * scale);
    e.maxHp = e.hp;
  }
  w.bossActive = true;
  w.hush = 1;
  w.events.push(warden ? "warden" : "bearer");
  shockwave(w, 0, w.halfH * 0.5, 1, 0, 0.9);
}

// ---------------------------------------------------------------------------
// asking
// ---------------------------------------------------------------------------

function askQuestion(w: World, e: Enemy, orbCount: number): void {
  const q = w.host.next({ difficulty: clamp(0.14 + w.stratum * 0.06, 0, 1) });
  w.sealSerial++;
  w.seal.serial = w.sealSerial;
  w.seal.state = "asking";
  w.seal.q = q;
  w.seal.askedAt = w.t;
  w.seal.answered = "";
  e.seal = w.sealSerial;
  w.prompt = q.prompt;
  w.promptV++;
  w.stats.asked++;

  const values: number[] = [parseInt_(q.answer)];
  for (const d of q.distractors) values.push(parseInt_(d));
  const order = w.rng.shuffle(values.map((v, i) => ({ v, correct: i === 0 })));
  const n = Math.min(orbCount, order.length);

  for (let i = 0; i < n; i++) {
    const o = order[i];
    if (!o) continue;
    const b = addBullet(w);
    if (!b) continue;
    const spread = (HALF_W - 12) * 2;
    const tx = -spread / 2 + (spread * (i + 0.5)) / n;
    b.x = e.x;
    b.y = e.y - e.r * 0.4;
    b.vx = (tx - e.x) * 0.55;
    b.vy = -ORB_SPEED_IN;
    b.v = o.v;
    b.r = BULLET.orbR;
    b.kind = BK.Orb;
    b.owner = 0;
    b.life = 40;
    b.label = labelTile(o.v);
    b.seal = w.sealSerial;
    b.correct = o.correct ? 1 : 0;
    b.wob = w.rng.f() * TAU;
    b.grow = 1;
    b.dmg = 1;
  }
  ring(w, e.x, e.y, e.r * 1.6, COL.gold, 0.55, 2.2);
  burst(w, e.x, e.y, 26, 42, COL.gold, { life: 0.6, size: 1.8 });
  punch(w, 0.35);
  cue(w, "seal");
}

/** Orb flight: glide to the presentation band, hover and weave, then leave. */
export function stepOrb(w: World, b: Bullet, dt: number, hurry: number): void {
  const band = -w.halfH * 0.06;
  b.wob += dt * 1.15;
  if (b.y > band) {
    b.y += b.vy * dt * hurry;
    b.vx = approach(b.vx, 0, 0.4, dt);
    b.x += b.vx * dt;
  } else {
    b.y = approach(b.y, band + Math.sin(b.wob * 1.3) * 5.5, 0.5, dt);
    b.x += Math.cos(b.wob * 0.9 + b.v) * 11 * dt * hurry;
    b.x = clamp(b.x, -HALF_W + b.r, HALF_W - b.r);
  }
  b.rot += (b.v > 0 ? 0.9 : -0.7) * dt;
  if (b.grow > 0) b.grow = Math.max(0, b.grow - dt * 3.4);
}

// ---------------------------------------------------------------------------
// resolution
// ---------------------------------------------------------------------------

function killSealOrbs(w: World, serial: number, correctToo: boolean): void {
  for (let i = 0; i < w.bulletN; i++) {
    const b = w.bullets[i] as Bullet;
    if (b.seal !== serial) continue;
    if (!correctToo && b.correct) continue;
    burst(w, b.x, b.y, 12, 40, polColor(b.v), { life: 0.45, size: 1.6, kind: 1 });
    b.live = false;
  }
}

export function onOrbTouched(w: World, b: Bullet): void {
  const q = w.seal.q;
  const first = w.seal.state === "asking";
  const correct = b.correct === 1;

  if (first && q) {
    w.seal.answered = String(b.v);
    w.seal.state = correct ? "won" : "lost";
    w.host.report({
      questionId: q.id,
      correct,
      ms: Math.max(1, Math.round((w.t - w.seal.askedAt) * 1000)),
      answered: w.seal.answered,
    });
    if (correct) w.stats.right++;
  }

  if (correct) sealBroken(w, b);
  else sealWrong(w, b);
}

function sealBroken(w: World, b: Bullet): void {
  const serial = b.seal;
  const col = polColor(b.v);

  // the answer is worth real charge — and it can never overload you
  const before = w.core;
  w.core = clamp(w.core + b.v, -w.cap, w.cap);
  const spilled = Math.abs(before + b.v) - Math.abs(w.core);
  w.chain += 6;
  w.stats.absorbs++;
  const mult = Math.min(9, 1 + Math.floor(w.chain / 6));
  w.stats.score += SCORE.sealCorrect * mult + Math.max(0, spilled) * 60;

  b.live = false;
  killSealOrbs(w, serial, true);

  hitstop(w, 0.1);
  slowmo(w, 0.42, 0.72);
  punch(w, 1);
  shake(w, 0.5);
  flash(w, 0.3, COL.gold);
  shockwave(w, b.x, b.y, 1.4, b.v > 0 ? 1 : -1, 0.85);
  ring(w, b.x, b.y, 4, COL.gold, 0.7, 3.4);
  ring(w, b.x, b.y, 9, polHot(b.v), 0.55, 2.2);
  burst(w, b.x, b.y, 70, 110, COL.gold, { life: 1, size: 2.6, kind: 1 });
  burst(w, b.x, b.y, 34, 60, col, { life: 0.7, size: 2 });
  w.host.haptic("success");
  w.events.push("seal-won");

  // crack the bearer open
  for (let i = 0; i < w.enemyN; i++) {
    const e = w.enemies[i] as Enemy;
    if (e.seal !== serial) continue;
    e.lockState = 2; // vulnerable
    e.hitFlash = 1;
    e.fireT = 1.6;
    if (e.kind === EK.Bearer) e.hp = Math.min(e.hp, Math.ceil(e.maxHp * 0.34));
    else e.hp = Math.min(e.hp, Math.ceil(e.maxHp * 0.62));
  }
}

function sealWrong(w: World, b: Bullet): void {
  const serial = b.seal;
  b.live = false;
  burst(w, b.x, b.y, 44, 96, COL.bad, { life: 0.75, size: 2.3, kind: 1 });
  ring(w, b.x, b.y, 5, COL.bad, 0.5, 3);
  shockwave(w, b.x, b.y, 1.1, 0, 0.6);
  w.events.push("seal-wrong");
  // the remaining orbs get harder to reach, and the bearer answers back
  for (let i = 0; i < w.bulletN; i++) {
    const o = w.bullets[i] as Bullet;
    if (o.seal === serial) o.wob += 1.4;
  }
  for (let i = 0; i < w.enemyN; i++) {
    const e = w.enemies[i] as Enemy;
    if (e.seal !== serial) continue;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      fireChaff(w, e.x, e.y, a, 34, k % 2 ? 1 : -1);
    }
  }
}

export function sealTimedOut(w: World): void {
  const q = w.seal.q;
  if (w.seal.state !== "asking" || !q) return;
  w.seal.state = "lost";
  w.host.report({
    questionId: q.id,
    correct: false,
    ms: Math.max(1, Math.round((w.t - w.seal.askedAt) * 1000)),
    answered: "",
  });
}

// ---------------------------------------------------------------------------
// bearer + warden choreography
// ---------------------------------------------------------------------------

export function stepBoss(w: World, e: Enemy, dt: number, spd: number): void {
  e.age += dt;
  if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
  e.fireT -= dt;
  e.rot += dt * (e.kind === EK.Warden ? 0.5 : 0.32);

  e.y = approach(e.y, e.ay, 0.85, dt);
  e.x = approach(e.x, e.ax + Math.sin(e.age * 0.6 + e.seed) * 13, 0.9, dt);

  if (e.kind === EK.Bearer) stepBearer(w, e, dt, spd);
  else stepWarden(w, e, dt, spd);
}

function stepBearer(w: World, e: Enemy, _dt: number, spd: number): void {
  if (e.phase === 0 && e.age > 1.15) {
    e.phase = 1;
    askQuestion(w, e, 4);
    e.lockState = 0;
    e.fireT = 1.2;
  }
  if (e.phase === 1) {
    const hold = Math.max(ORB_HOLD_MIN, ORB_HOLD_BASE - w.bearerCount * 0.35);
    if (w.t - w.seal.askedAt > hold + 3 && w.seal.state === "asking") {
      sealTimedOut(w);
      killSealOrbs(w, e.seal, true);
      e.phase = 2;
      e.lockState = 2;
    } else if (w.seal.state !== "asking") {
      e.phase = 2;
    }
    // light suppressing fire so the puzzle is not a rest stop
    if (e.fireT <= 0) {
      e.fireT = 1.5 / spd;
      const a = Math.atan2(w.py - e.y, w.px - e.x);
      fireChaff(w, e.x - e.r * 0.7, e.y, a, 30 * spd, 1);
      fireChaff(w, e.x + e.r * 0.7, e.y, a, 30 * spd, -1);
    }
  }
  if (e.phase === 2 && e.fireT <= 0) {
    e.fireT = 0.85 / spd;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.3 + Math.sin(e.age) * 0.3;
      fireChaff(w, e.x, e.y - e.r * 0.5, a, 42 * spd, i % 2 ? 1 : -1);
    }
  }
}

/**
 * The Warden is the deep end: it locks itself to an exact core value taken from
 * a host question, and only a RELEASE at that exact total breaks the lock.
 * Getting within two still does real damage, so a younger player still makes
 * progress; exactness is worth three times as much.
 */
function stepWarden(w: World, e: Enemy, _dt: number, spd: number): void {
  const hpf = e.hp / e.maxHp;

  if (e.phase === 0 && e.age > 1.1) {
    e.phase = 1;
    e.fireT = 0.4;
  }

  // phase 1 — alternating polarity walls you fly INTO
  if (e.phase === 1) {
    if (e.fireT <= 0) {
      e.fireT = 0.62 / spd;
      e.lockState = 0;
      const pol = ((e.age * 1.6) | 0) % 2 ? 1 : -1;
      const gap = Math.sin(e.age * 0.9) * (HALF_W * 0.45);
      for (let i = -8; i <= 8; i++) {
        const x = (i / 8) * (HALF_W - 4);
        if (Math.abs(x - gap) < 9) continue;
        fireChaff(w, x, e.y - e.r * 0.7, -Math.PI / 2, 40 * spd, pol);
      }
    }
    if (e.age > 6.5) {
      e.phase = 2;
      askQuestion(w, e, 0); // no orbs — the lock IS the answer
      e.lockWant = clamp(parseInt_(w.seal.q?.answer ?? "0"), -w.cap, w.cap);
      e.lockState = 1;
      e.fireT = 0.6;
      cue(w, "lock");
      ring(w, e.x, e.y, e.r * 1.8, COL.gold, 0.7, 3);
      w.events.push("lock-open");
    }
  }

  // phase 2 — the lock: it feeds you charge, you steer the total, you vent
  if (e.phase === 2) {
    if (e.fireT <= 0) {
      e.fireT = 1.25 / spd;
      for (let i = 0; i < 3; i++) {
        const sign = i === 1 ? Math.sign(e.lockWant - w.core) || 1 : w.rng.sign();
        const mag = w.rng.i(2, 8);
        const a = -Math.PI / 2 + (i - 1) * 0.5;
        fireCharge(w, e.x, e.y - e.r * 0.5, a, 24 * spd, sign * mag);
      }
      for (let i = 0; i < 4; i++) {
        fireChaff(w, e.x, e.y, -Math.PI / 2 + (i - 1.5) * 0.7, 32 * spd, w.rng.sign());
      }
    }
    if (w.t - w.seal.askedAt > 15) {
      sealTimedOut(w);
      e.phase = 3;
      e.lockState = 0;
      e.fireT = 0.2;
    }
  }

  // phase 3 — enrage, then loop back
  if (e.phase === 3) {
    if (e.fireT <= 0) {
      e.fireT = 0.1 / spd;
      const a = e.rot * 3.4;
      for (let arm = 0; arm < 3; arm++) {
        const t = a + (arm / 3) * TAU;
        fireChaff(w, e.x, e.y, t, 38 * spd, arm % 2 ? 1 : -1, hpf < 0.4 ? 2 : 1);
      }
    }
    if (e.age > 0 && w.t - w.seal.askedAt > 22) {
      e.phase = 1;
      e.age = 0;
      e.fireT = 0.5;
    }
  }
}

/** Called from the sim when the player releases while a lock is open. */
export function tryLock(w: World, e: Enemy): "exact" | "near" | "miss" {
  const d = Math.abs(w.core - e.lockWant);
  const res = d === 0 ? "exact" : d <= 2 ? "near" : "miss";
  if (res === "miss") {
    ring(w, e.x, e.y, e.r * 1.4, COL.bad, 0.45, 2.4);
    burst(w, e.x, e.y, 20, 50, COL.bad, { life: 0.5, size: 1.8 });
    shake(w, 0.22);
    return res;
  }
  const exact = res === "exact";
  e.hp -= exact ? Math.ceil(e.maxHp * 0.42) : Math.ceil(e.maxHp * 0.14);
  e.hitFlash = 1;
  e.phase = 3;
  e.lockState = 0;
  w.stats.score += exact ? SCORE.wardenLockExact : SCORE.wardenLockNear;
  if (exact && w.seal.state === "asking" && w.seal.q) {
    w.seal.state = "won";
    w.stats.right++;
    w.host.report({
      questionId: w.seal.q.id,
      correct: true,
      ms: Math.max(1, Math.round((w.t - w.seal.askedAt) * 1000)),
      answered: String(w.core),
    });
  }
  hitstop(w, exact ? 0.13 : 0.06);
  slowmo(w, exact ? 0.5 : 0.2, 0.7);
  punch(w, exact ? 1 : 0.5);
  shake(w, exact ? 0.65 : 0.3);
  flash(w, exact ? 0.34 : 0.16, COL.gold);
  shockwave(w, e.x, e.y, exact ? 1.8 : 1, 0, 1);
  burst(w, e.x, e.y, exact ? 90 : 40, exact ? 130 : 70, COL.gold, {
    life: 1,
    size: 2.8,
    kind: 1,
  });
  w.host.haptic(exact ? "success" : "medium");
  w.events.push(exact ? "lock-exact" : "lock-near");
  return res;
}

export function bossDefeated(w: World, e: Enemy): void {
  if (w.seal.state === "asking" && e.seal === w.seal.serial) {
    sealTimedOut(w);
    killSealOrbs(w, e.seal, true);
  }
  w.bossActive = false;
  w.hush = 0;
  w.stats.score += e.kind === EK.Warden ? SCORE.wardenLockExact : SCORE.bearerKill;
  scheduleNextBearer(w);
  // grow the band every boss — the arithmetic gets more room to breathe
  w.cap = Math.min(CORE.capMax, w.cap + CORE.capStep);
  w.events.push("boss-down");
}
