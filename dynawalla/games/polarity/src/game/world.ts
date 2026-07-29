import type { Host } from "../contract.ts";
import { makeRng, type Rng } from "../core/rng.ts";
import type { Tier } from "../core/tier.ts";
import { TAU, clamp, clamp01 } from "../core/util.ts";
import { BK, CORE, EK, HALF_W, MAX_HALF_H, MIN_HALF_H, PLAYER } from "./constants.ts";
import type { Bullet, Enemy, FloatText, Particle, Phase, RunStats, Seal } from "./types.ts";

// ---------------------------------------------------------------------------
// screen feel — written by the sim, read by the renderer
// ---------------------------------------------------------------------------

export type Fx = {
  /** Art-of-Screenshake trauma: shake is trauma², so it decays perceptually. */
  trauma: number;
  /** one-shot scale punch */
  punch: number;
  punchT: number;
  /** rotational kick */
  tilt: number;
  /** frames frozen solid on impact */
  hitstop: number;
  /** 0..1, how far into slow-motion we are */
  slow: number;
  slowT: number;
  slowFor: number;
  /** full-screen wash: alpha, rgb. Rate-limited — children's product. */
  flash: number;
  flashR: number;
  flashG: number;
  flashB: number;
  flashAt: number;
  flashCount: number;
  flashWindow: number;
  /** chromatic aberration amount 0..1 */
  ab: number;
  /** additive bloom drive */
  glow: number;
  /** shockwave rings: x,y,age,life,strength,pol */
  waves: Float32Array;
  waveN: number;
};

const WAVE_STRIDE = 6;
const WAVE_MAX = 24;

export function makeFx(): Fx {
  return {
    trauma: 0,
    punch: 0,
    punchT: 0,
    tilt: 0,
    hitstop: 0,
    slow: 0,
    slowT: 0,
    slowFor: 0,
    flash: 0,
    flashR: 1,
    flashG: 1,
    flashB: 1,
    flashAt: -99,
    flashCount: 0,
    flashWindow: 0,
    ab: 0,
    glow: 0,
    waves: new Float32Array(WAVE_MAX * WAVE_STRIDE),
    waveN: 0,
  };
}

// ---------------------------------------------------------------------------
// world
// ---------------------------------------------------------------------------

export type World = {
  host: Host;
  rng: Rng;
  tier: Tier;
  reduced: boolean;

  phase: Phase;
  /** seconds of simulated play (excludes pauses, includes slow-motion at real rate) */
  t: number;
  /** wall time, for cadence that should not be slowed */
  wall: number;
  halfH: number;

  // player
  px: number;
  py: number;
  pvx: number;
  pvy: number;
  /** pointer/keyboard target */
  tx: number;
  ty: number;
  pointing: boolean;
  pol: number;
  polMorph: number;
  flipT: number;
  fireT: number;
  shields: number;
  invuln: number;
  stun: number;
  recoil: number;
  bank: number;

  // core
  core: number;
  coreShown: number;
  cap: number;
  chain: number;
  chainT: number;
  overloadWarn: number;

  // pools
  bullets: Bullet[];
  bulletN: number;
  enemies: Enemy[];
  enemyN: number;
  parts: Particle[];
  partN: number;
  texts: FloatText[];
  textN: number;

  // director
  spawnAcc: number;
  nextBearer: number;
  bearerCount: number;
  stratum: number;
  bossActive: boolean;
  hush: number;

  seal: Seal;
  sealSerial: number;
  /** current question text; the renderer bakes a texture when `promptV` changes */
  prompt: string;
  promptV: number;

  stats: RunStats;
  fx: Fx;

  /** one-shot UI cues, shown at most once ever */
  cues: Set<string>;
  cueNow: string;
  cueT: number;

  /** set by the sim, consumed by the shell */
  events: string[];
};

const mkBullet = (): Bullet => ({
  live: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  v: 0,
  r: 1,
  kind: BK.Chaff,
  owner: 0,
  rot: 0,
  spin: 0,
  age: 0,
  life: 8,
  labelled: 0,
  homing: 0,
  pull: 0,
  seal: 0,
  correct: 0,
  dmg: 1,
  wob: 0,
  grow: 0,
});

const mkEnemy = (): Enemy => ({
  live: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  kind: EK.Mote,
  pol: 1,
  hp: 1,
  maxHp: 1,
  r: 3,
  age: 0,
  fireT: 0,
  phase: 0,
  rot: 0,
  spin: 0,
  hitFlash: 0,
  seed: 0,
  ax: 0,
  ay: 0,
  lockWant: 0,
  lockState: 0,
  seal: 0,
  dying: 0,
});

const mkPart = (): Particle => ({
  live: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  age: 0,
  life: 1,
  size: 1,
  size2: 1,
  r: 1,
  g: 1,
  b: 1,
  a: 1,
  rot: 0,
  spin: 0,
  drag: 1,
  kind: 0,
});

const mkText = (): FloatText => ({
  live: false,
  x: 0,
  y: 0,
  vy: 0,
  age: 0,
  life: 1,
  value: 0,
  size: 1,
  r: 1,
  g: 1,
  b: 1,
});

function fill<T>(n: number, f: () => T): T[] {
  const a: T[] = new Array(n);
  for (let i = 0; i < n; i++) a[i] = f();
  return a;
}

export function makeWorld(host: Host, tier: Tier, seed: number): World {
  const w: World = {
    host,
    rng: makeRng(seed),
    tier,
    reduced: host.prefersReducedMotion(),
    phase: "title",
    t: 0,
    wall: 0,
    halfH: 70,
    px: 0,
    py: -40,
    pvx: 0,
    pvy: 0,
    tx: 0,
    ty: -40,
    pointing: false,
    pol: 1,
    polMorph: 1,
    flipT: 0,
    fireT: 0,
    shields: PLAYER.shields,
    invuln: 0,
    stun: 0,
    recoil: 0,
    bank: 1,
    core: 0,
    coreShown: 0,
    cap: CORE.capBase,
    chain: 0,
    chainT: 0,
    overloadWarn: 0,
    bullets: fill(tier.bullets, mkBullet),
    bulletN: 0,
    enemies: fill(48, mkEnemy),
    enemyN: 0,
    parts: fill(tier.particles, mkPart),
    partN: 0,
    texts: fill(64, mkText),
    textN: 0,
    spawnAcc: 0,
    nextBearer: 0,
    bearerCount: 0,
    stratum: 0,
    bossActive: false,
    hush: 0,
    seal: { serial: 0, state: "idle", q: null, askedAt: 0, answered: "" },
    sealSerial: 0,
    prompt: "",
    promptV: 0,
    stats: {
      score: 0,
      best: 0,
      depth: 0,
      absorbs: 0,
      clutches: 0,
      bestChain: 0,
      asked: 0,
      right: 0,
      releases: 0,
      perfects: 0,
      overloads: 0,
    },
    fx: makeFx(),
    cues: new Set(),
    cueNow: "",
    cueT: 0,
    events: [],
  };
  return w;
}

/** Re-pool when the tier changes; keeps everything that is currently alive. */
export function repool(w: World, tier: Tier): void {
  w.tier = tier;
  while (w.bullets.length < tier.bullets) w.bullets.push(mkBullet());
  while (w.parts.length < tier.particles) w.parts.push(mkPart());
  w.bulletN = Math.min(w.bulletN, tier.bullets);
  w.partN = Math.min(w.partN, tier.particles);
}

export function setAspect(w: World, aspect: number): void {
  w.halfH = clamp(HALF_W * aspect, MIN_HALF_H, MAX_HALF_H);
}

// ---------------------------------------------------------------------------
// pool acquire — swap-remove compaction keeps every live entity contiguous
// ---------------------------------------------------------------------------

export function addBullet(w: World): Bullet | null {
  const cap = w.tier.bullets;
  if (w.bulletN >= cap) return null;
  const b = w.bullets[w.bulletN] as Bullet;
  w.bulletN++;
  b.live = true;
  b.age = 0;
  b.life = 9;
  b.labelled = 0;
  b.homing = 0;
  b.pull = 0;
  b.seal = 0;
  b.correct = 0;
  b.dmg = 1;
  b.wob = 0;
  b.grow = 0;
  b.spin = 0;
  b.rot = 0;
  b.owner = 0;
  b.v = 0;
  return b;
}

export function addEnemy(w: World): Enemy | null {
  if (w.enemyN >= w.enemies.length) return null;
  const e = w.enemies[w.enemyN] as Enemy;
  w.enemyN++;
  e.live = true;
  e.age = 0;
  e.fireT = 0;
  e.phase = 0;
  e.hitFlash = 0;
  e.rot = 0;
  e.spin = 0;
  e.dying = 0;
  e.lockWant = 0;
  e.lockState = 0;
  e.seal = 0;
  e.seed = w.rng.f() * 1000;
  return e;
}

export function addPart(w: World): Particle | null {
  if (w.partN >= w.tier.particles) return null;
  const p = w.parts[w.partN] as Particle;
  w.partN++;
  p.live = true;
  p.age = 0;
  p.drag = 1;
  p.rot = 0;
  p.spin = 0;
  p.kind = 0;
  p.size2 = 0;
  return p;
}

export function addText(w: World, value: number, x: number, y: number, c: readonly number[]): void {
  if (w.textN >= w.texts.length) return;
  const t = w.texts[w.textN] as FloatText;
  w.textN++;
  t.live = true;
  t.x = x;
  t.y = y;
  t.vy = 26;
  t.age = 0;
  t.life = 0.95;
  t.value = value;
  t.size = 6.4;
  t.r = c[0] as number;
  t.g = c[1] as number;
  t.b = c[2] as number;
}

// ---------------------------------------------------------------------------
// fx helpers
// ---------------------------------------------------------------------------

export function shake(w: World, amount: number): void {
  if (w.reduced) return;
  w.fx.trauma = Math.min(1, w.fx.trauma + amount);
}

export function punch(w: World, amount: number): void {
  if (w.reduced) amount *= 0.3;
  if (amount > w.fx.punch) {
    w.fx.punch = Math.min(1, amount);
    w.fx.punchT = 0;
  }
}

export function hitstop(w: World, seconds: number): void {
  w.fx.hitstop = Math.max(w.fx.hitstop, w.reduced ? seconds * 0.4 : seconds);
}

export function slowmo(w: World, seconds: number, depth = 1): void {
  const s = w.reduced ? seconds * 0.5 : seconds;
  if (s > w.fx.slowFor - w.fx.slowT) {
    w.fx.slowFor = s;
    w.fx.slowT = 0;
    w.fx.slow = depth;
  }
}

/**
 * A full-screen wash. Hard-limited to 3 per second and to a modest alpha —
 * this is a children's product and photosensitivity is not negotiable.
 */
export function flash(w: World, a: number, c: readonly number[]): void {
  const fx = w.fx;
  if (w.wall - fx.flashWindow > 1) {
    fx.flashWindow = w.wall;
    fx.flashCount = 0;
  }
  if (fx.flashCount >= 3) return;
  fx.flashCount++;
  fx.flashAt = w.wall;
  const cap = w.reduced ? 0.14 : 0.4;
  fx.flash = Math.max(fx.flash, Math.min(cap, a));
  fx.flashR = c[0] as number;
  fx.flashG = c[1] as number;
  fx.flashB = c[2] as number;
}

export function shockwave(
  w: World,
  x: number,
  y: number,
  strength: number,
  pol: number,
  life = 0.6,
): void {
  const fx = w.fx;
  if (fx.waveN >= WAVE_MAX) return;
  const i = fx.waveN * WAVE_STRIDE;
  fx.waves[i] = x;
  fx.waves[i + 1] = y;
  fx.waves[i + 2] = 0;
  fx.waves[i + 3] = life;
  fx.waves[i + 4] = strength;
  fx.waves[i + 5] = pol;
  fx.waveN++;
}

export function stepWaves(fx: Fx, dt: number): void {
  for (let i = 0; i < fx.waveN; ) {
    const o = i * WAVE_STRIDE;
    fx.waves[o + 2] = (fx.waves[o + 2] as number) + dt;
    if ((fx.waves[o + 2] as number) >= (fx.waves[o + 3] as number)) {
      fx.waveN--;
      const l = fx.waveN * WAVE_STRIDE;
      for (let k = 0; k < WAVE_STRIDE; k++) fx.waves[o + k] = fx.waves[l + k] as number;
    } else i++;
  }
}

// ---------------------------------------------------------------------------
// particle bursts
// ---------------------------------------------------------------------------

export function burst(
  w: World,
  x: number,
  y: number,
  n: number,
  speed: number,
  col: readonly number[],
  opts?: { life?: number; size?: number; kind?: number; spread?: number; dir?: number },
): void {
  const count = Math.max(1, Math.round(n * w.tier.partScale * (w.reduced ? 0.4 : 1)));
  const life = opts?.life ?? 0.55;
  const size = opts?.size ?? 1.5;
  const kind = opts?.kind ?? 0;
  const spread = opts?.spread ?? TAU;
  const dir = opts?.dir ?? 0;
  for (let i = 0; i < count; i++) {
    const p = addPart(w);
    if (!p) return;
    const a = dir + (w.rng.f() - 0.5) * spread;
    const s = speed * (0.35 + w.rng.f() * 0.9);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = life * (0.6 + w.rng.f() * 0.8);
    p.size = size * (0.55 + w.rng.f() * 0.9);
    p.size2 = p.size;
    p.r = col[0] as number;
    p.g = col[1] as number;
    p.b = col[2] as number;
    p.a = 1;
    p.kind = kind;
    p.rot = w.rng.f() * TAU;
    p.spin = (w.rng.f() - 0.5) * 14;
    p.drag = 0.86;
  }
}

export function ring(
  w: World,
  x: number,
  y: number,
  r0: number,
  col: readonly number[],
  life = 0.42,
  width = 1.4,
): void {
  const p = addPart(w);
  if (!p) return;
  p.x = x;
  p.y = y;
  p.vx = 0;
  p.vy = 0;
  p.life = life;
  p.size = r0;
  p.size2 = width;
  p.r = col[0] as number;
  p.g = col[1] as number;
  p.b = col[2] as number;
  p.a = 1;
  p.kind = 2;
  p.rot = 0;
  p.spin = 0;
  p.drag = 1;
}

export function cue(w: World, key: string, seconds = 2.2): void {
  if (w.cues.has(key)) return;
  w.cues.add(key);
  w.cueNow = key;
  w.cueT = seconds;
}

export const inField = (w: World, x: number, y: number, pad = 8): boolean =>
  x > -HALF_W - pad && x < HALF_W + pad && y > -w.halfH - pad && y < w.halfH + pad;

export const clampToField = (w: World): void => {
  const m = 3;
  w.px = clamp(w.px, -HALF_W + m, HALF_W - m);
  w.py = clamp(w.py, -w.halfH + m, w.halfH - m);
};

export const chainAlpha = (w: World): number => clamp01(w.chainT / 1.2);
