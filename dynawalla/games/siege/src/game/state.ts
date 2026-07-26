/**
 * The whole world, and the pure-ish step that advances it.
 *
 * The simulation knows nothing about canvases, DOM or audio: it calls into an
 * `Effects` sink. That is what makes it testable and what keeps the render
 * layer free to be as loud as it likes.
 */
import {
  BOARD,
  CHAIN_FALLOFF,
  CORE_MAX_HP,
  ENEMIES,
  EMBER_BASE,
  EMBER_DIFF_BONUS,
  INTERMISSION,
  OVERCHARGE_KNOCKBACK,
  OVERCHARGE_STUN,
  START_EMBERS,
  TOWERS,
  MAX_LEVEL,
  towerDamage,
  towerLinks,
  towerRange,
  towerRate,
  towerSplash,
  towerUpgradeCost,
  WARD_REDUCTION_PCT,
  type EnemyKind,
  type TowerKind,
} from "./constants.ts";
import { buildPath, type PathData, type Vec } from "./path.ts";
import { buildPlots, type Plot } from "./board.ts";
import { buildWave, mathFloor, type WaveSpec } from "./waves.ts";
import { makeRng, type Rng } from "../core/rng.ts";

export type Phase = "intermission" | "wave" | "defeat";

export type Enemy = {
  alive: boolean;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  s: number;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  armor: number;
  bounty: number;
  radius: number;
  leak: number;
  warded: boolean;
  splits: number;
  stun: number;
  hitFlash: number;
  born: number;
  phase: number;
  /** damage since the last number popped, so fast towers do not stack a column */
  popAcc: number;
  popAt: number;
};

export type Tower = {
  id: number;
  plotId: number;
  kind: TowerKind;
  level: number;
  x: number;
  y: number;
  cooldown: number;
  /** 0..1 charge, drawn as heat — the fire rate is visible without a number */
  heat: number;
  recoil: number;
  angle: number;
  shots: number;
  bornAt: number;
};

export type Shot = {
  alive: boolean;
  kind: TowerKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  dmg: number;
  splash: number;
  life: number;
  target: Enemy | null;
  /** ring buffer of the last 6 positions, for the ribbon trail */
  trail: Float32Array;
  trailN: number;
};

export type Arc = { pts: number[]; life: number; maxLife: number; dmg: number };

export type Popup = {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  tone: 0 | 1 | 2; // 0 damage, 1 embers, 2 breach
  big: boolean;
};

export type Effects = {
  fire(t: Tower, angle: number): void;
  impact(x: number, y: number, kind: TowerKind, dmg: number, splash: number): void;
  hurt(e: Enemy, dmg: number, x: number, y: number): void;
  kill(e: Enemy): void;
  leak(e: Enemy): void;
  build(t: Tower): void;
  upgrade(t: Tower): void;
  earn(amount: number, worldX: number, worldY: number): void;
  waveStart(spec: WaveSpec): void;
  waveClear(n: number): void;
  overchargeBlast(x: number, y: number, dmg: number): void;
  defeat(wave: number): void;
};

export const NO_EFFECTS: Effects = {
  fire: () => {},
  impact: () => {},
  hurt: () => {},
  kill: () => {},
  leak: () => {},
  build: () => {},
  upgrade: () => {},
  earn: () => {},
  waveStart: () => {},
  waveClear: () => {},
  overchargeBlast: () => {},
  defeat: () => {},
};

export type State = {
  seed: number;
  rng: Rng;
  path: PathData;
  plots: Plot[];
  enemies: Enemy[];
  towers: Tower[];
  shots: Shot[];
  arcs: Arc[];
  popups: Popup[];
  phase: Phase;
  wave: number;
  spec: WaveSpec;
  /** seconds into the current wave */
  waveT: number;
  spawnIdx: number;
  intermissionT: number;
  embers: number;
  coreHp: number;
  coreFlash: number;
  overcharge: number;
  /** integers, for the run summary */
  stats: { kills: number; leaked: number; earned: number; correct: number; wrong: number };
  t: number;
  nextTowerId: number;
  /** cumulative HP left to arrive this wave, for the throughput readout */
  hpRemaining: number;
};

const tmp: Vec = { x: 0, y: 0 };
const tmp2: Vec = { x: 0, y: 0 };

export function createState(seed: number): State {
  const path = buildPath();
  const plots = buildPlots(path);
  const spec = buildWave(1, seed);
  return {
    seed,
    rng: makeRng(seed ^ 0x51e6e),
    path,
    plots,
    enemies: [],
    towers: [],
    shots: [],
    arcs: [],
    popups: [],
    phase: "intermission",
    wave: 1,
    spec,
    waveT: 0,
    spawnIdx: 0,
    intermissionT: INTERMISSION,
    embers: START_EMBERS,
    coreHp: CORE_MAX_HP,
    coreFlash: 0,
    overcharge: 0,
    stats: { kills: 0, leaked: 0, earned: 0, correct: 0, wrong: 0 },
    t: 0,
    nextTowerId: 1,
    hpRemaining: spec.totalHp,
  };
}

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------

export function towerDps(t: Tower): number {
  const dmg = towerDamage(t.kind, t.level);
  const rate = towerRate(t.kind, t.level);
  const links = towerLinks(t.kind, t.level);
  // chain's later links are weaker; count them at falloff so the readout is honest
  let mult = 1;
  if (links > 1) {
    mult = 0;
    for (let i = 0; i < links; i++) mult += Math.pow(CHAIN_FALLOFF, i);
  }
  return Math.round(dmg * rate * mult);
}

export function totalDps(s: State): number {
  let d = 0;
  for (const t of s.towers) d += towerDps(t);
  return d;
}

export function towerAt(s: State, plotId: number): Tower | null {
  const p = s.plots[plotId];
  if (!p || p.towerId < 0) return null;
  return s.towers.find((t) => t.id === p.towerId) ?? null;
}

export function upgradeCost(t: Tower): number | null {
  return towerUpgradeCost(t.kind, t.level);
}

export function emberReward(difficulty: number): number {
  return EMBER_BASE + Math.round(EMBER_DIFF_BONUS * Math.max(0, Math.min(1, difficulty)));
}

// ---------------------------------------------------------------------------
// mutations
// ---------------------------------------------------------------------------

export function tryBuild(s: State, plotId: number, kind: TowerKind, fx: Effects): boolean {
  const plot = s.plots[plotId];
  if (!plot || plot.towerId >= 0) return false;
  const spec = TOWERS[kind];
  if (s.embers < spec.cost) return false;
  s.embers -= spec.cost;
  const t: Tower = {
    id: s.nextTowerId++,
    plotId,
    kind,
    level: 0,
    x: plot.x,
    y: plot.y,
    cooldown: 0.35,
    heat: 0,
    recoil: 0,
    angle: -Math.PI / 2,
    shots: 0,
    bornAt: s.t,
  };
  s.towers.push(t);
  plot.towerId = t.id;
  fx.build(t);
  return true;
}

export function applyUpgrade(s: State, tower: Tower, fx: Effects): boolean {
  const cost = upgradeCost(tower);
  if (cost === null || s.embers < cost || tower.level >= MAX_LEVEL) return false;
  s.embers -= cost;
  tower.level++;
  fx.upgrade(tower);
  return true;
}

export function grantEmbers(s: State, amount: number, x: number, y: number, fx: Effects): void {
  s.embers += amount;
  s.stats.earned += amount;
  fx.earn(amount, x, y);
}

export function callWaveEarly(s: State): number {
  if (s.phase !== "intermission") return 0;
  const bonus = Math.max(0, Math.floor(s.intermissionT));
  s.intermissionT = 0;
  return bonus;
}

// ---------------------------------------------------------------------------
// damage
// ---------------------------------------------------------------------------

/** exact integer damage: armour is flat, wards are a percentage, floor is 1 */
export function computeDamage(base: number, e: Enemy, singleTarget: boolean): number {
  let d = base - e.armor;
  if (singleTarget && e.warded) d = Math.floor((d * WARD_REDUCTION_PCT) / 100);
  return d < 1 ? 1 : d;
}

function pushPopup(s: State, x: number, y: number, text: string, tone: 0 | 1 | 2, big: boolean): void {
  let p = s.popups.find((q) => !q.alive);
  if (!p) {
    if (s.popups.length >= 90) return;
    p = {
      alive: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0,
      text: "",
      tone: 0,
      big: false,
    };
    s.popups.push(p);
  }
  p.alive = true;
  p.x = x;
  p.y = y;
  p.vx = s.rng.r(-44, 44);
  p.vy = -64 - s.rng.f() * 34;
  p.maxLife = big ? 1.0 : 0.7;
  p.life = p.maxLife;
  p.text = text;
  p.tone = tone;
  p.big = big;
}

export function damageEnemy(
  s: State,
  e: Enemy,
  base: number,
  singleTarget: boolean,
  fx: Effects,
  showNumber = true,
): void {
  if (!e.alive) return;
  const d = computeDamage(base, e, singleTarget);
  e.hp -= d;
  e.hitFlash = 0.11;
  if (showNumber) {
    // batch: six shots a second from four towers is a column of unreadable
    // numbers. One bigger number every 140 ms says more and costs less.
    e.popAcc += d;
    if (s.t - e.popAt >= 0.14) {
      pushPopup(s, e.x, e.y - e.radius, String(e.popAcc), 0, e.kind === "boss");
      e.popAcc = 0;
      e.popAt = s.t;
    }
  }
  fx.hurt(e, d, e.x, e.y);
  if (e.hp <= 0) killEnemy(s, e, fx);
}

export function killEnemy(s: State, e: Enemy, fx: Effects): void {
  if (!e.alive) return;
  e.alive = false;
  if (e.popAcc > 0) {
    pushPopup(s, e.x, e.y - e.radius, String(e.popAcc), 0, e.kind === "boss");
    e.popAcc = 0;
  }
  s.stats.kills++;
  s.embers += e.bounty;
  s.stats.earned += e.bounty;
  pushPopup(s, e.x, e.y - e.radius - 10, `+${e.bounty}`, 1, false);
  fx.kill(e);
  if (e.splits > 0) {
    for (let i = 0; i < e.splits; i++) {
      const child = spawnEnemy(s, "shard", Math.max(1, Math.round(e.maxHp * 0.3)));
      child.s = Math.max(0, e.s - 8 - i * 16);
      child.speed *= 1.16;
      refreshPosition(s, child);
    }
  }
}

export function spawnEnemy(s: State, kind: EnemyKind, hp: number): Enemy {
  const base = ENEMIES[kind];
  let e = s.enemies.find((q) => !q.alive);
  if (!e) {
    e = {
      alive: false,
      kind,
      hp: 0,
      maxHp: 0,
      s: 0,
      x: 0,
      y: 0,
      dirX: 1,
      dirY: 0,
      speed: 0,
      armor: 0,
      bounty: 0,
      radius: 0,
      leak: 0,
      warded: false,
      splits: 0,
      stun: 0,
      hitFlash: 0,
      born: 0,
      phase: 0,
      popAcc: 0,
      popAt: 0,
    };
    s.enemies.push(e);
  }
  e.alive = true;
  e.kind = kind;
  e.hp = hp;
  e.maxHp = hp;
  e.s = 0;
  e.speed = base.speed;
  e.armor = base.armor;
  e.bounty = base.bounty;
  e.radius = base.radius;
  e.leak = base.leak;
  e.warded = base.warded ?? false;
  e.splits = base.splits ?? 0;
  e.stun = 0;
  e.hitFlash = 0;
  e.born = s.t;
  e.phase = s.rng.r(0, Math.PI * 2);
  e.popAcc = 0;
  e.popAt = 0;
  refreshPosition(s, e);
  return e;
}

function refreshPosition(s: State, e: Enemy): void {
  s.path.at(e.s, tmp);
  s.path.dirAt(e.s, tmp2);
  e.x = tmp.x;
  e.y = tmp.y;
  e.dirX = tmp2.x;
  e.dirY = tmp2.y;
}

// ---------------------------------------------------------------------------
// the step
// ---------------------------------------------------------------------------

function acquire(s: State, t: Tower): Enemy | null {
  const range = towerRange(t.kind, t.level);
  const r2 = range * range;
  let best: Enemy | null = null;
  let bestS = -1;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const dx = e.x - t.x;
    const dy = e.y - t.y;
    if (dx * dx + dy * dy > r2) continue;
    if (e.s > bestS) {
      bestS = e.s;
      best = e;
    }
  }
  return best;
}

function makeShot(s: State): Shot {
  let sh = s.shots.find((q) => !q.alive);
  if (!sh) {
    sh = {
      alive: false,
      kind: "bolt",
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      dmg: 0,
      splash: 0,
      life: 0,
      target: null,
      trail: new Float32Array(12),
      trailN: 0,
    };
    s.shots.push(sh);
  }
  sh.trailN = 0;
  return sh;
}

function fireTower(s: State, t: Tower, target: Enemy, fx: Effects): void {
  const dmg = towerDamage(t.kind, t.level);
  const angle = Math.atan2(target.y - t.y, target.x - t.x);
  t.angle = angle;
  t.recoil = 1;
  t.shots++;
  fx.fire(t, angle);

  if (t.kind === "chain") {
    // instant arc: hop to the nearest un-hit enemy each link, damage falls off
    const links = towerLinks(t.kind, t.level);
    const hit: Enemy[] = [];
    let cur: Enemy | null = target;
    let d = dmg;
    const pts: number[] = [t.x, t.y];
    while (cur && hit.length < links) {
      hit.push(cur);
      pts.push(cur.x, cur.y);
      damageEnemy(s, cur, d, false, fx);
      d = Math.max(1, Math.floor(d * CHAIN_FALLOFF));
      let nx: Enemy | null = null;
      let nd = 190 * 190;
      for (const e of s.enemies) {
        if (!e.alive || hit.includes(e)) continue;
        const ddx = e.x - cur.x;
        const ddy = e.y - cur.y;
        const q = ddx * ddx + ddy * ddy;
        if (q < nd) {
          nd = q;
          nx = e;
        }
      }
      cur = nx;
    }
    s.arcs.push({ pts, life: 0.19, maxLife: 0.19, dmg });
    if (s.arcs.length > 26) s.arcs.shift();
    return;
  }

  const sh = makeShot(s);
  sh.alive = true;
  sh.kind = t.kind;
  sh.x = t.x + Math.cos(angle) * 22;
  sh.y = t.y + Math.sin(angle) * 22;
  sh.dmg = dmg;
  sh.splash = t.kind === "mortar" ? towerSplash(t.kind, t.level) : 0;
  sh.target = t.kind === "bolt" ? target : null;

  if (t.kind === "bolt") {
    const sp = 820;
    sh.vx = Math.cos(angle) * sp;
    sh.vy = Math.sin(angle) * sp;
    sh.life = 1.1;
  } else {
    // mortar leads the target: aim where it will be when the shell lands
    const flight = Math.hypot(target.x - t.x, target.y - t.y) / 430;
    sh.tx = target.x + target.dirX * target.speed * flight;
    sh.ty = target.y + target.dirY * target.speed * flight;
    const d = Math.hypot(sh.tx - sh.x, sh.ty - sh.y) || 1;
    sh.vx = ((sh.tx - sh.x) / d) * 430;
    sh.vy = ((sh.ty - sh.y) / d) * 430;
    sh.life = d / 430;
  }
}

function splashAt(s: State, x: number, y: number, radius: number, dmg: number, fx: Effects): void {
  const r2 = radius * radius;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const q = dx * dx + dy * dy;
    if (q > r2) continue;
    // full damage at the centre, two thirds at the rim — integers throughout
    const falloff = 100 - Math.round((Math.sqrt(q) / radius) * 34);
    damageEnemy(s, e, Math.max(1, Math.floor((dmg * falloff) / 100)), false, fx);
  }
}

export function detonateOvercharge(s: State, fx: Effects): number {
  const dmg = 60 + s.wave * 14;
  const cx = s.path.core.x;
  const cy = s.path.core.y;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    e.stun = OVERCHARGE_STUN;
    e.s = Math.max(0, e.s - OVERCHARGE_KNOCKBACK);
    refreshPosition(s, e);
    damageEnemy(s, e, dmg, false, fx, false);
  }
  fx.overchargeBlast(cx, cy, dmg);
  return dmg;
}

export function step(s: State, dt: number, fx: Effects): void {
  s.t += dt;
  s.coreFlash = Math.max(0, s.coreFlash - dt * 2.4);

  // -- phase ---------------------------------------------------------------
  if (s.phase === "intermission") {
    s.intermissionT -= dt;
    if (s.intermissionT <= 0) {
      s.phase = "wave";
      s.waveT = 0;
      s.spawnIdx = 0;
      s.hpRemaining = s.spec.totalHp;
      fx.waveStart(s.spec);
    }
  } else if (s.phase === "wave") {
    s.waveT += dt;
    while (s.spawnIdx < s.spec.orders.length) {
      const o = s.spec.orders[s.spawnIdx];
      if (!o || o.at > s.waveT) break;
      spawnEnemy(s, o.kind, o.hp);
      s.spawnIdx++;
    }
    const anyAlive = s.enemies.some((e) => e.alive);
    if (s.spawnIdx >= s.spec.orders.length && !anyAlive) {
      fx.waveClear(s.wave);
      s.wave++;
      s.spec = buildWave(s.wave, s.seed);
      s.phase = "intermission";
      s.intermissionT = INTERMISSION;
    }
  }

  // -- enemies -------------------------------------------------------------
  let liveHp = 0;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.stun > 0) {
      e.stun -= dt;
    } else {
      e.s += e.speed * dt;
    }
    if (e.s >= s.path.length) {
      e.alive = false;
      s.stats.leaked++;
      s.coreHp -= e.leak;
      s.coreFlash = 1;
      fx.leak(e);
      if (s.coreHp <= 0 && s.phase !== "defeat") {
        s.coreHp = 0;
        s.phase = "defeat";
        fx.defeat(s.wave);
      }
      continue;
    }
    refreshPosition(s, e);
    liveHp += e.hp;
  }
  // health still to arrive, so the throughput readout means something
  let pending = 0;
  for (let i = s.spawnIdx; i < s.spec.orders.length; i++) pending += s.spec.orders[i]?.hp ?? 0;
  s.hpRemaining = liveHp + (s.phase === "wave" ? pending : s.spec.totalHp);

  if (s.phase === "defeat") return;

  // -- towers --------------------------------------------------------------
  for (const t of s.towers) {
    const rate = towerRate(t.kind, t.level);
    t.recoil = Math.max(0, t.recoil - dt / 0.12);
    if (t.cooldown > 0) t.cooldown -= dt;
    t.heat = t.cooldown <= 0 ? 1 : 1 - t.cooldown * rate;
    if (t.cooldown > 0) continue;
    const target = acquire(s, t);
    if (!target) continue;
    t.cooldown = 1 / rate;
    fireTower(s, t, target, fx);
  }

  // -- shots ---------------------------------------------------------------
  for (const sh of s.shots) {
    if (!sh.alive) continue;
    // trail ring buffer, newest first
    for (let i = 10; i >= 0; i -= 2) {
      sh.trail[i + 2] = sh.trail[i] as number;
      sh.trail[i + 3] = sh.trail[i + 1] as number;
    }
    sh.trail[0] = sh.x;
    sh.trail[1] = sh.y;
    if (sh.trailN < 6) sh.trailN++;

    if (sh.kind === "bolt") {
      const tgt = sh.target;
      if (tgt && tgt.alive) {
        // light homing: reads as a guided bolt, never as a missed shot
        const a = Math.atan2(tgt.y - sh.y, tgt.x - sh.x);
        const cur = Math.atan2(sh.vy, sh.vx);
        let d = a - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + Math.max(-9 * dt, Math.min(9 * dt, d));
        sh.vx = Math.cos(na) * 820;
        sh.vy = Math.sin(na) * 820;
      }
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.life -= dt;
      if (tgt && tgt.alive) {
        const dx = tgt.x - sh.x;
        const dy = tgt.y - sh.y;
        if (dx * dx + dy * dy < (tgt.radius + 9) * (tgt.radius + 9)) {
          fx.impact(sh.x, sh.y, "bolt", sh.dmg, 0);
          damageEnemy(s, tgt, sh.dmg, true, fx);
          sh.alive = false;
          continue;
        }
      }
      if (sh.life <= 0 || sh.x < -80 || sh.x > BOARD + 80 || sh.y < -80 || sh.y > BOARD + 80) {
        sh.alive = false;
      }
    } else {
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.life -= dt;
      if (sh.life <= 0) {
        fx.impact(sh.tx, sh.ty, "mortar", sh.dmg, sh.splash);
        splashAt(s, sh.tx, sh.ty, sh.splash, sh.dmg, fx);
        sh.alive = false;
      }
    }
  }

  // -- arcs and popups -----------------------------------------------------
  for (let i = s.arcs.length - 1; i >= 0; i--) {
    const a = s.arcs[i] as Arc;
    a.life -= dt;
    if (a.life <= 0) s.arcs.splice(i, 1);
  }
  for (const p of s.popups) {
    if (!p.alive) continue;
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 130 * dt;
    if (p.life <= 0) p.alive = false;
  }
}

export function mathFloorFor(wave: number): number {
  return mathFloor(wave);
}

export { INTERMISSION };
