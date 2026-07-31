/**
 * The run: state, rules, and every consequence.
 *
 * Shape of the loop — the arena floor says what to eat (`= 12`, `6 × ?`,
 * `> 3/4`), the water is full of numbers, and the wrong ones are not merely
 * inedible: they are the obstacle course. Eat right and you grow; eat wrong and
 * you cough up length. The board closes in as you go deeper.
 *
 * Reporting is one report per served question, always. A *trial* is resolved by
 * the next orb the player eats, whichever orb that is — which is the honest
 * question anyway: given this condition, did they take a value that satisfies
 * it? Because every question in an epoch shares one condition, the labels are
 * interchangeable and this stays exact.
 */

import type { Host, Question } from "../contract.ts";
import { TUNE } from "./tuning.ts";
import { clamp, randRange, TAU } from "./num.ts";
import {
  addTrauma,
  createCamera,
  flash,
  hitstop,
  punch,
  slowmo,
  type Camera,
} from "./fx/camera.ts";
import {
  PC_HOT,
  PC_SERPENT,
  burstBad,
  burstBubbles,
  burstDeath,
  burstDebris,
  burstEat,
  burstSpark,
  clearParticles,
  clearRings,
  createParticles,
  createRings,
  ring,
  updateParticles,
  updateRings,
  type Particles,
  type Rings,
} from "./fx/particles.ts";
import {
  BOLUS_BAD,
  BOLUS_GOOD,
  addBolus,
  createSerpent,
  grow,
  resetSerpent,
  selfHit,
  stepSerpent,
  type Serpent,
} from "./serpent.ts";
import { createOrb, molt, orbDrawRadius, placeOrb, stepOrbs, type Axes, type Orb } from "./orbs.ts";
import { arenaAspect, pullInside, rimEdge, type Edge } from "./arena.ts";
import type { Audio } from "./audio.ts";

const BEST_KEY = "serpent.best";

export type Phase = "attract" | "play" | "dead";

type Trial = { q: Question; servedAtMs: number };

export type Floater = {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  tone: 0 | 1 | 2;
};

export type World = {
  host: Host;
  audio: Audio;
  cam: Camera;
  serpent: Serpent;
  orbs: Orb[];
  particles: Particles;
  rings: Rings;
  floaters: Floater[];

  phase: Phase;
  paused: boolean;
  /**
   * Wall clock at which the current pause began, or 0 when running.
   *
   * Only `setPaused` writes it. It exists because the answer clock below is
   * wall clock, not simulation time.
   */
  pausedAt: number;
  reduced: boolean;
  time: number;
  runTime: number;

  depth: number;
  score: number;
  best: number;
  combo: number;
  bestCombo: number;
  correctEats: number;
  wrongEats: number;

  /**
   * The vent's SHORT semi-axis, in world units. It closes as a child dives.
   *
   * Called a radius for most of this pack's life and still the same number: the
   * arena is an ellipse now (see `arena.ts`) and this is the axis it was tuned
   * on, so nothing about how the game feels across the narrow way changed.
   */
  arenaR: number;
  arenaTargetR: number;
  /**
   * The vent's proportions, short axis normalised to exactly 1.
   *
   * Set from the safe rectangle by `setArenaAspect` on every layout, so the board
   * is the screen. Both are 1 until the first layout arrives, which is a circle —
   * the shape the game shipped with, and one that every later aspect contains.
   */
  aspectX: number;
  aspectY: number;

  prompt: string;
  pending: Trial[];
  goodPool: string[];
  badPool: string[];

  mutateT: number;
  mutateDur: number;
  depthPulse: number;
  scorePulse: number;
  comboPulse: number;
  grazeT: number;
  grazeGlow: number;
  invulnT: number;
  wallT: number;
  deathT: number;
  shieldPulse: number;

  /** Latency of the most recent answer, for the debug overlay. */
  lastAnswerMs: number;
};

const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

function readBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

function writeBest(v: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(v)));
  } catch {
    /* private mode is not an error */
  }
}

export function createWorld(host: Host, audio: Audio, reduced: boolean): World {
  const w: World = {
    host,
    audio,
    cam: createCamera(reduced),
    serpent: createSerpent(),
    orbs: [],
    particles: createParticles(reduced ? TUNE.particleCapReduced : TUNE.particleCap, reduced ? 0.28 : 1),
    rings: createRings(TUNE.ringCap),
    floaters: [],

    phase: "attract",
    paused: false,
    pausedAt: 0,
    reduced,
    time: 0,
    runTime: 0,

    depth: 1,
    score: 0,
    best: readBest(),
    combo: 0,
    bestCombo: 0,
    correctEats: 0,
    wrongEats: 0,

    arenaR: TUNE.arenaStart,
    arenaTargetR: TUNE.arenaStart,
    aspectX: 1,
    aspectY: 1,

    prompt: "",
    pending: [],
    goodPool: [],
    badPool: [],

    mutateT: 0,
    mutateDur: TUNE.mutateTime,
    depthPulse: 0,
    scorePulse: 0,
    comboPulse: 0,
    grazeT: 0,
    grazeGlow: 0,
    invulnT: 0,
    wallT: 0,
    deathT: 0,
    shieldPulse: 0,

    lastAnswerMs: 0,
  };
  resetRun(w, "attract");
  return w;
}

// -------------------------------------------------------------------- shape

/** The vent's semi-axes, this frame. */
export function arenaAxes(w: World): Axes {
  return { a: w.arenaR * w.aspectX, b: w.arenaR * w.aspectY };
}

/** Where the rim is from a point, which way it faces, how far away it is. */
export function arenaEdge(w: World, x: number, y: number): Edge {
  return rimEdge(w.arenaR * w.aspectX, w.arenaR * w.aspectY, x, y);
}

/**
 * Fit the vent to the safe rectangle.
 *
 * Called on every layout, so a rotation reshapes the board. That is the one
 * moment the arena can get *smaller* along an axis — portrait to landscape swaps
 * a tall ellipse for a wide one — so everything loose is walked back inside the
 * new rim rather than left stranded in the black with a wall between it and the
 * game. The serpent's recorded path is not: it is history, the head drags it back
 * within a body length, and rewriting it would put a kink in the animal.
 */
export function setArenaAspect(w: World, safeW: number, safeH: number): void {
  const next = arenaAspect(safeW, safeH);
  if (next.x === w.aspectX && next.y === w.aspectY) return;
  w.aspectX = next.x;
  w.aspectY = next.y;
  const { a, b } = arenaAxes(w);
  for (const o of w.orbs) {
    const put = pullInside(a, b, o.x, o.y, TUNE.orbRadius * 1.1);
    o.x = put.x;
    o.y = put.y;
  }
  const head = pullInside(a, b, w.serpent.x, w.serpent.y, TUNE.headRadius * 1.6);
  w.serpent.x = head.x;
  w.serpent.y = head.y;
}

// ------------------------------------------------------------------ content

function pushPool(pool: string[], label: string, cap: number): void {
  if (!pool.includes(label)) pool.push(label);
  while (pool.length > cap) pool.shift();
}

function adoptCondition(w: World, q: Question): void {
  w.prompt = q.prompt;
  w.pending = [{ q, servedAtMs: nowMs() }];
  w.goodPool = [q.answer];
  w.badPool = q.distractors.slice();
}

/**
 * Pull one question. A prompt change is the world mutating — that decision
 * belongs to the host, which is the side that will one day know the learner.
 */
function pullQuestion(w: World): boolean {
  const q = w.host.next();
  if (q.prompt !== w.prompt) {
    beginMutation(w, q);
    return true;
  }
  w.pending.push({ q, servedAtMs: nowMs() });
  pushPool(w.goodPool, q.answer, 10);
  for (const d of q.distractors) pushPool(w.badPool, d, 26);
  return false;
}

/**
 * How many orbs, and how many of them are edible.
 *
 * Both scale with the vent's AREA, which is the one gameplay consequence of the
 * board becoming the screen. `orbs.ts` says the field is the maze — "the arena is
 * dense with wrong answers you have to swim *through*, so reading the field is
 * the same act as steering through it" — and a tall phone is a 2.2× larger board,
 * so holding the counts fixed would have halved that density and quietly taken
 * the obstacle course out of the game on the device most children hold. The ratio
 * of edible to inedible is preserved exactly; only the scale changes.
 */
function fieldTargets(w: World): { count: number; good: number } {
  const area = w.aspectX * w.aspectY;
  return {
    count: Math.round(
      Math.min(TUNE.orbMaxCount, TUNE.orbBaseCount + (w.depth - 1) * TUNE.orbPerDepth) * area,
    ),
    good: Math.round(Math.min(TUNE.goodMax, TUNE.goodBase + Math.floor((w.depth - 1) / 3)) * area),
  };
}

function pickLabel(w: World, good: boolean): string {
  const pool = good ? w.goodPool : w.badPool;
  if (pool.length === 0) return good ? "?" : "?";
  // Prefer something not already on the field, so the arena reads as varied.
  for (let i = 0; i < 8; i++) {
    const label = pool[Math.floor(Math.random() * pool.length)] as string;
    if (!w.orbs.some((o) => o.label === label)) return label;
  }
  return pool[Math.floor(Math.random() * pool.length)] as string;
}

function addOrb(w: World, good: boolean): Orb {
  const orb = createOrb();
  orb.label = pickLabel(w, good);
  orb.good = good;
  orb.hunter = w.depth >= TUNE.hunterFromDepth && Math.random() < TUNE.hunterChance;
  placeOrb(orb, w.orbs, arenaAxes(w), w.serpent.x, w.serpent.y);
  w.orbs.push(orb);
  return orb;
}

function ensureField(w: World): void {
  const t = fieldTargets(w);
  let guard = 0;
  while (w.pending.length < t.good + 1 && guard++ < 6) {
    if (pullQuestion(w)) break;
  }
  let good = w.orbs.filter((o) => o.good).length;
  while (w.orbs.length < t.count) {
    const wantGood = good < t.good;
    addOrb(w, wantGood);
    if (wantGood) good++;
  }
  // Safety net: if the quota is short and the field is full, an orb changes its
  // mind. The molt animation makes that legible rather than a silent swap.
  if (good < t.good && w.mutateT <= 0) {
    let best: Orb | null = null;
    let bestD = -1;
    for (const o of w.orbs) {
      if (o.good || o.moltT > 0) continue;
      const d = Math.hypot(o.x - w.serpent.x, o.y - w.serpent.y);
      if (d > bestD) {
        bestD = d;
        best = o;
      }
    }
    if (best) molt(best, pickLabel(w, true), true, 0.45);
  }
}

function beginMutation(w: World, q: Question): void {
  adoptCondition(w, q);
  w.mutateT = TUNE.mutateTime;
  w.mutateDur = TUNE.mutateTime;

  const t = fieldTargets(w);
  let good = 0;
  for (const o of w.orbs) {
    const wantGood = good < t.good;
    if (wantGood) good++;
    molt(o, pickLabel(w, wantGood), wantGood, TUNE.mutateTime * 0.8);
  }
  slowmo(w.cam, TUNE.slowmoMutateTime, TUNE.slowmoMutateScale);
  addTrauma(w.cam, 0.18);
  flash(w.cam, "#4ff0d6", 0.1);
  const reach = w.arenaR * Math.max(w.aspectX, w.aspectY);
  ring(w.rings, 0, 0, reach * 0.05, reach * 0.9, 0.7, 0.02, 2);
  w.audio.mutate();
  if (w.phase === "play") w.host.haptic("medium");
}

// -------------------------------------------------------------------- pause

/**
 * Stop the water, or start it again — and keep the answer clock honest across
 * the gap.
 *
 * **Why this is a function and not `w.paused = true`.** Latency here is *wall*
 * clock: a trial carries the `performance.now()` it was served at, and a bite
 * bills the child `now − servedAt`. The simulation stopping does nothing to
 * that. So a child who pauses — their own P key, the host's sheet, or the
 * how-to-play manual they opened *because they were stuck* — and reads for two
 * minutes comes back, eats one orb, and puts a 120,000ms answer on their record
 * for a question they were never looking at. Reading the rules must not be
 * evidence about a child.
 *
 * Every live trial's start therefore moves forward by exactly the length of the
 * pause, so the gap is spent by nobody. Idempotent in both directions: a second
 * pause does not move the mark and a resume of a running world is nothing.
 */
export function setPaused(w: World, paused: boolean): void {
  if (w.paused === paused) return;
  w.paused = paused;
  if (paused) {
    w.pausedAt = nowMs();
    return;
  }
  const held = Math.max(0, nowMs() - w.pausedAt);
  for (const p of w.pending) p.servedAtMs += held;
  w.pausedAt = 0;
}

// --------------------------------------------------------------------- run

export function resetRun(w: World, phase: Phase): void {
  w.phase = phase;
  w.paused = false;
  w.pausedAt = 0;
  w.runTime = 0;
  w.depth = 1;
  w.score = 0;
  w.combo = 0;
  w.bestCombo = 0;
  w.correctEats = 0;
  w.wrongEats = 0;
  w.arenaR = TUNE.arenaStart;
  w.arenaTargetR = TUNE.arenaStart;
  w.orbs = [];
  w.pending = [];
  w.goodPool = [];
  w.badPool = [];
  w.prompt = "";
  w.mutateT = 0;
  w.grazeT = 0;
  w.grazeGlow = 0;
  w.invulnT = 0;
  w.wallT = 0;
  w.deathT = 0;
  w.floaters.length = 0;
  clearParticles(w.particles);
  clearRings(w.rings);
  resetSerpent(w.serpent, 0, 0, randRange(0, TAU));

  adoptCondition(w, w.host.next());
  ensureField(w);
  for (const o of w.orbs) o.scale = 1;
}

export function startRun(w: World): void {
  resetRun(w, "play");
  w.audio.resume();
  w.audio.ambient(true);
  w.host.haptic("light");
  punch(w.cam, 0.05);
  ring(w.rings, 0, 0, 0.02, 0.4, 0.5, 0.014, 2);
}

// ------------------------------------------------------------------ events

function floater(w: World, x: number, y: number, text: string, tone: 0 | 1 | 2): void {
  if (w.floaters.length > 22) w.floaters.shift();
  w.floaters.push({ x, y, vy: -0.16, life: 0.9, maxLife: 0.9, text, tone });
}

function eatOrb(w: World, index: number): void {
  const orb = w.orbs[index];
  if (!orb) return;
  const correct = orb.good;
  const s = w.serpent;

  if (w.phase === "play") {
    const trial = w.pending.shift() ?? { q: w.host.next(), servedAtMs: nowMs() };
    const ms = Math.max(0, Math.round(nowMs() - trial.servedAtMs));
    w.lastAnswerMs = ms;
    w.host.report({ questionId: trial.q.id, correct, ms, answered: orb.label });
    // The next trial goes live the moment this one is answered — in a
    // continuous game the clock that matters is "how long since the last bite",
    // not "how long since the question was generated".
    const t0 = nowMs();
    for (const p of w.pending) p.servedAtMs = t0;
  }

  if (correct) {
    w.combo = Math.min(TUNE.comboMax, w.combo + 1);
    w.bestCombo = Math.max(w.bestCombo, w.combo);
    w.correctEats++;
    const gain = 10 * w.combo;
    w.score += gain;
    w.scorePulse = 1;
    w.comboPulse = 1;

    grow(s, TUNE.growPerCorrect);
    addBolus(s, BOLUS_GOOD);
    burstEat(w.particles, orb.x, orb.y, w.combo / TUNE.comboMax);
    ring(w.rings, orb.x, orb.y, TUNE.orbRadius * 0.6, TUNE.orbRadius * 3.4, 0.34, 0.008, 0);
    floater(w, orb.x, orb.y, `+${gain}`, 0);
    hitstop(w.cam, TUNE.hitstopEatMs);
    addTrauma(w.cam, TUNE.traumaEat);
    punch(w.cam, TUNE.punchEat);
    w.audio.eat(w.combo - 1);
    if (w.phase === "play") w.host.haptic("light");

    if (!s.shield && w.combo > 0 && w.combo % TUNE.shieldAtCombo === 0) {
      s.shield = true;
      w.shieldPulse = 1;
      ring(w.rings, s.x, s.y, TUNE.headRadius, TUNE.headRadius * 7, 0.5, 0.01, 3);
      w.audio.shield();
      if (w.phase === "play") w.host.haptic("success");
    }

    if (w.correctEats > 0 && w.correctEats % TUNE.correctPerDepth === 0) descend(w);
  } else {
    w.wrongEats++;
    w.combo = 0;
    grow(s, -TUNE.shrinkPerWrong);
    addBolus(s, BOLUS_BAD);
    burstBad(w.particles, orb.x, orb.y);
    burstDebris(w.particles, s.x, s.y, s.heading, TUNE.shrinkPerWrong);
    ring(w.rings, orb.x, orb.y, TUNE.orbRadius * 0.4, TUNE.orbRadius * 5, 0.45, 0.014, 1);
    floater(w, orb.x, orb.y, `−${TUNE.shrinkPerWrong}`, 1);
    hitstop(w.cam, TUNE.hitstopWrongMs);
    addTrauma(w.cam, TUNE.traumaWrong);
    punch(w.cam, TUNE.punchWrong);
    flash(w.cam, "#c46bff", 0.16);
    w.audio.wrong();
    if (w.phase === "play") w.host.haptic("heavy");
  }

  w.orbs.splice(index, 1);
  const t = fieldTargets(w);
  const good = w.orbs.filter((o) => o.good).length;
  addOrb(w, good < t.good);
  ensureField(w);
}

function descend(w: World): void {
  w.depth++;
  w.depthPulse = 1;
  w.arenaTargetR = Math.max(TUNE.arenaFloor, w.arenaTargetR - TUNE.arenaShrinkPerDepth);
  w.score += 50 * w.depth;
  w.scorePulse = 1;
  addTrauma(w.cam, TUNE.traumaDepth);
  punch(w.cam, TUNE.punchDepth);
  // Out to the LONG axis, so the "the water is closing in" beat sweeps the whole
  // board rather than stopping halfway up a tall one.
  const reach = w.arenaR * Math.max(w.aspectX, w.aspectY);
  ring(w.rings, 0, 0, reach * 1.02, reach * 0.55, 0.75, 0.02, 4);
  burstBubbles(w.particles, w.serpent.x, w.serpent.y, 12);
  w.audio.depth(w.depth);
  if (w.phase === "play") w.host.haptic("medium");
  ensureField(w);
}

/** Slam into the vent wall: bounce inward, pay for it, keep the run. */
function hitWall(w: World, e: Edge): void {
  const s = w.serpent;
  // The wall's own normal at the point that was actually hit, not the direction
  // back to the middle. On a circle those were the same vector and the code could
  // not tell; on an ellipse they differ by up to about 30°, and using the wrong
  // one would slide the serpent along the rim instead of off it and put the
  // debris burst somewhere the serpent never touched.
  const nx = e.nx;
  const ny = e.ny;
  const px = e.x;
  const py = e.y;

  // Deflect along the wall, never *reflect* off it. A mirror bounce at normal
  // incidence turns the head through 180° and drives it straight back into its
  // own neck — an instant death handed out for touching a wall, which is the
  // opposite of the point. Sliding picks the tangent the serpent was already
  // closest to and adds a little inward drift.
  s.x = px - nx * TUNE.headRadius * 1.6;
  s.y = py - ny * TUNE.headRadius * 1.6;
  const hx = Math.cos(s.heading);
  const hy = Math.sin(s.heading);
  const sign = hx * -ny + hy * nx >= 0 ? 1 : -1;
  const tx = -ny * sign;
  const ty = nx * sign;
  s.heading = Math.atan2(ty * 0.7 - ny * 0.72, tx * 0.7 - nx * 0.72);
  s.targetHeading = s.heading;

  w.wallT = 0.55;
  // The recovery must not be punished by a self-hit the player could not avoid.
  w.invulnT = Math.max(w.invulnT, 0.28);
  w.combo = 0;
  grow(s, -TUNE.shrinkPerWall);
  burstDebris(w.particles, px, py, Math.atan2(ny, nx), TUNE.shrinkPerWall);
  burstBad(w.particles, px, py);
  ring(w.rings, px, py, 0.01, 0.34, 0.5, 0.016, 5);
  floater(w, px - nx * 0.08, py - ny * 0.08, `−${TUNE.shrinkPerWall}`, 1);
  hitstop(w.cam, TUNE.hitstopWallMs);
  addTrauma(w.cam, TUNE.traumaWall);
  punch(w.cam, TUNE.punchWrong);
  flash(w.cam, "#ff7a5c", 0.14);
  w.grazeGlow = 1;
  w.audio.wall();
  if (w.phase === "play") w.host.haptic("heavy");
}

function die(w: World, x: number, y: number): void {
  const s = w.serpent;
  if (s.shield) {
    s.shield = false;
    w.invulnT = 0.95;
    w.shieldPulse = 1;
    hitstop(w.cam, TUNE.hitstopShieldMs);
    addTrauma(w.cam, TUNE.traumaShield);
    punch(w.cam, TUNE.punchWrong);
    flash(w.cam, "#9df6ff", 0.14);
    ring(w.rings, s.x, s.y, TUNE.headRadius, TUNE.headRadius * 12, 0.6, 0.016, 3);
    burstDebris(w.particles, s.x, s.y, s.heading, 10);
    w.audio.shieldBreak();
    if (w.phase === "play") w.host.haptic("heavy");
    // Shove the head back toward open water so the shield actually buys time.
    const d = Math.hypot(s.x, s.y) || 1;
    s.heading = Math.atan2(-s.y / d, -s.x / d) + randRange(-0.5, 0.5);
    s.targetHeading = s.heading;
    return;
  }

  s.alive = false;
  w.deathT = 0;
  burstDeath(w.particles, x, y);
  for (let i = 0; i < s.bodyCount; i += 3) {
    burstDebris(w.particles, s.bodyX[i] as number, s.bodyY[i] as number, s.heading + randRange(-3, 3), 1);
  }
  ring(w.rings, x, y, 0.02, 0.8, 0.9, 0.02, 3);
  hitstop(w.cam, TUNE.hitstopDeathMs);
  addTrauma(w.cam, TUNE.traumaDeath);
  punch(w.cam, TUNE.punchDeath);
  slowmo(w.cam, TUNE.slowmoDeathTime, TUNE.slowmoDeathScale);
  flash(w.cam, "#ff7a5c", 0.18);
  w.audio.setBoost(false);
  w.audio.death();

  if (w.phase === "play") {
    w.host.haptic("failure");
    if (w.score > w.best) {
      w.best = w.score;
      writeBest(w.best);
    }
    w.phase = "dead";
  } else {
    // The attract loop never stops: it just starts over.
    resetRun(w, "attract");
  }
}

// -------------------------------------------------------------------- step

/** Attract-mode pilot. It plays the game so the player never reads a rule. */
function autoHeading(w: World): number {
  const s = w.serpent;
  // Turn away from the rim before anything else — straight off the wall it is
  // near, which on a long vent is nothing like "toward the middle".
  const e = arenaEdge(w, s.x, s.y);
  if (e.gap < TUNE.headRadius * 7) return Math.atan2(-e.ny, -e.nx) + Math.sin(w.time * 0.7) * 0.5;
  let best: Orb | null = null;
  let bestD = Infinity;
  for (const o of w.orbs) {
    if (!o.good || o.scale < 0.6) continue;
    const dist = Math.hypot(o.x - s.x, o.y - s.y);
    if (dist < bestD) {
      bestD = dist;
      best = o;
    }
  }
  if (!best) return s.heading;
  // Nudge around its own body rather than driving straight through it.
  let ax = best.x - s.x;
  let ay = best.y - s.y;
  for (let i = TUNE.neckSegments; i < s.bodyCount; i += 4) {
    const bx = (s.bodyX[i] as number) - s.x;
    const by = (s.bodyY[i] as number) - s.y;
    const dd = bx * bx + by * by;
    if (dd < 0.05 && dd > 1e-6) {
      ax -= (bx / dd) * 0.004;
      ay -= (by / dd) * 0.004;
    }
  }
  return Math.atan2(ay, ax);
}

export type StepInput = {
  heading: number | null;
  boost: boolean;
};

export function stepWorld(w: World, dt: number, input: StepInput): void {
  w.time += dt;
  const s = w.serpent;

  if (w.mutateT > 0) w.mutateT = Math.max(0, w.mutateT - dt);
  w.depthPulse = Math.max(0, w.depthPulse - dt * 1.6);
  w.scorePulse = Math.max(0, w.scorePulse - dt * 3.2);
  w.comboPulse = Math.max(0, w.comboPulse - dt * 2.6);
  w.shieldPulse = Math.max(0, w.shieldPulse - dt * 1.8);
  w.invulnT = Math.max(0, w.invulnT - dt);
  w.arenaR += (w.arenaTargetR - w.arenaR) * Math.min(1, dt / TUNE.arenaShrinkTime);

  updateParticles(w.particles, dt);
  updateRings(w.rings, dt);
  for (let i = w.floaters.length - 1; i >= 0; i--) {
    const f = w.floaters[i] as Floater;
    f.life -= dt;
    f.y += f.vy * dt;
    f.vy *= Math.exp(-2.4 * dt);
    if (f.life <= 0) w.floaters.splice(i, 1);
  }

  if (w.phase === "dead") {
    w.deathT += dt;
    stepOrbs(w.orbs, {
      dt,
      axes: arenaAxes(w),
      headX: s.x,
      headY: s.y,
      current: 0,
      time: w.time,
    });
    return;
  }

  w.runTime += dt;

  const attract = w.phase === "attract";
  const heading = attract ? autoHeading(w) : input.heading;
  const boost = attract ? false : input.boost;

  stepSerpent(s, dt, {
    desiredHeading: heading,
    wantBoost: boost,
    depth: w.depth,
    onBoostSpark: (x, y, h) => {
      if (Math.random() < 0.65) burstSpark(w.particles, x, y, h, PC_SERPENT);
    },
  });
  w.audio.setBoost(s.boosting);

  stepOrbs(w.orbs, {
    dt,
    axes: arenaAxes(w),
    headX: s.x,
    headY: s.y,
    current: w.depth >= 4 ? 0.03 : 0,
    time: w.time,
  });

  // --- eating, from a mouth that faces forward
  const biteX = s.x + Math.cos(s.heading) * TUNE.headRadius * TUNE.biteOffset;
  const biteY = s.y + Math.sin(s.heading) * TUNE.headRadius * TUNE.biteOffset;
  for (let i = w.orbs.length - 1; i >= 0; i--) {
    const o = w.orbs[i] as Orb;
    const r = orbDrawRadius(o);
    // A transforming orb is not food. Without this, an orb that still carries
    // its old label for the first half of a molt can be eaten and judged
    // against the *new* condition — reporting `18` as correct for `= 79`.
    if (o.moltT > 0) continue;
    if (r < TUNE.orbRadius * 0.35) continue;
    const reach = r * TUNE.orbCoreFactor + TUNE.headRadius * TUNE.headBiteFactor;
    if ((o.x - biteX) ** 2 + (o.y - biteY) ** 2 <= reach * reach) {
      eatOrb(w, i);
      break; // one bite per frame keeps every bite legible
    }
  }

  // --- grazing the rim, which is worth points precisely because it is stupid
  //
  // One measurement of the rim serves the graze band, the wall and nothing else,
  // so the band a child is paid for and the line they are punished on are the
  // same curve by construction rather than by two expressions agreeing.
  const edge = arenaEdge(w, s.x, s.y);
  const grazing = edge.gap < TUNE.grazeBand;
  w.grazeGlow = clamp(w.grazeGlow + (grazing ? dt * 6 : -dt * 3), 0, 1);
  if (grazing && s.alive) {
    w.grazeT += dt;
    if (w.grazeT >= TUNE.grazeInterval) {
      w.grazeT = 0;
      w.score += 3;
      burstSpark(w.particles, s.x, s.y, s.heading + Math.PI / 2, PC_HOT);
      w.audio.graze();
    }
  } else {
    w.grazeT = 0;
  }

  // --- the rim hurts; your own body kills
  //
  // Measured over twenty simulated minutes of a competent pilot: 58 deaths,
  // 58 of them on the wall and none on the serpent's own body. The wall was
  // the entire failure mode — you die while reading a number, which is the
  // least interesting death a snake game can offer. So the rim now costs
  // length and throws you back, and the only thing that can end a run is
  // outgrowing your own turning circle. That is also what makes the arena
  // closing in mean something: it squeezes you into yourself.
  w.wallT = Math.max(0, w.wallT - dt);
  if (edge.gap < TUNE.headRadius * 0.75 && w.wallT <= 0) {
    hitWall(w, edge);
  } else if (w.invulnT <= 0 && selfHit(s)) {
    die(w, s.x, s.y);
  }

  if (Math.random() < dt * 2.4) {
    const a = randRange(0, TAU);
    const r = Math.sqrt(Math.random());
    const { a: ax, b: ay } = arenaAxes(w);
    burstBubbles(w.particles, Math.cos(a) * r * ax, Math.sin(a) * r * ay, 1);
  }
}

export function confirmPressed(w: World): void {
  if (w.phase === "attract") {
    startRun(w);
  } else if (w.phase === "dead" && w.deathT > 0.55) {
    startRun(w);
  }
}
