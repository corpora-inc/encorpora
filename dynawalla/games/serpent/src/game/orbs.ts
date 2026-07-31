/**
 * The orb field — plankton carrying numbers.
 *
 * Correctness is never encoded in an orb's appearance. Every orb is the same
 * creature; the only thing that differs is the value printed on it. That is the
 * point: the arena is dense with wrong answers you have to swim *through*, so
 * reading the field is the same act as steering through it. The maze is the
 * maths.
 *
 * Hunters (from depth 5) are a different creature, and they can be right or
 * wrong — a hunter carrying the value you need, closing on you, is the best
 * decision in the game.
 */

import { TAU, randRange } from "./num.ts";
import { TUNE } from "./tuning.ts";
import { pullInside, rimEdge } from "./arena.ts";

/** The vent's semi-axes this frame. The short one is `world.arenaR`; see `arena.ts`. */
export type Axes = { a: number; b: number };

export type Orb = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: string;
  good: boolean;
  hunter: boolean;
  phase: number;
  /** 0..1 pop-in / molt-out envelope. */
  scale: number;
  /** >0 while molting: shrink to nothing, swap the label, grow back. */
  moltT: number;
  moltDur: number;
  nextLabel: string;
  nextGood: boolean;
  bob: number;
};

export function createOrb(): Orb {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    label: "",
    good: false,
    hunter: false,
    phase: 0,
    scale: 0,
    moltT: 0,
    moltDur: 0,
    nextLabel: "",
    nextGood: false,
    bob: 0,
  };
}

/**
 * Place an orb somewhere legal: inside the arena, clear of the serpent's head,
 * and not on top of another orb. Falls back to the best of N tries rather than
 * looping forever.
 */
export function placeOrb(orb: Orb, orbs: Orb[], axes: Axes, headX: number, headY: number): void {
  let bestX = 0;
  let bestY = 0;
  let bestScore = -1;
  const clear = TUNE.orbRadius * 2.2;
  // Candidates are drawn from the vent shrunk by the clearance, which is uniform
  // over the ellipse rather than over a disc; the `pullInside` at the end is what
  // actually guarantees the clearance, because a concentric ellipse is not the
  // same curve as the rim offset inward and only one of those is the rule.
  const sa = Math.max(TUNE.orbRadius, axes.a - clear);
  const sb = Math.max(TUNE.orbRadius, axes.b - clear);
  for (let attempt = 0; attempt < 14; attempt++) {
    const a = randRange(0, TAU);
    const r = Math.sqrt(Math.random());
    const x = Math.cos(a) * r * sa;
    const y = Math.sin(a) * r * sb;
    const dHead = Math.hypot(x - headX, y - headY);
    if (dHead < TUNE.spawnClearance && attempt < 10) continue;
    let nearest = dHead;
    for (const o of orbs) {
      if (o === orb || o.scale <= 0) continue;
      nearest = Math.min(nearest, Math.hypot(x - o.x, y - o.y) * 1.6);
    }
    if (nearest > bestScore) {
      bestScore = nearest;
      bestX = x;
      bestY = y;
    }
    if (bestScore > TUNE.spawnClearance) break;
  }
  const put = pullInside(axes.a, axes.b, bestX, bestY, clear);
  orb.x = put.x;
  orb.y = put.y;
  const a = randRange(0, TAU);
  const s = randRange(0.3, 1) * TUNE.orbDrift;
  orb.vx = Math.cos(a) * s;
  orb.vy = Math.sin(a) * s;
  orb.phase = randRange(0, TAU);
  orb.bob = randRange(0.6, 1.5);
  orb.scale = 0.001;
  orb.moltT = 0;
}

export function molt(orb: Orb, label: string, good: boolean, dur: number): void {
  orb.nextLabel = label;
  orb.nextGood = good;
  orb.moltT = dur;
  orb.moltDur = dur;
}

export type OrbStepOptions = {
  dt: number;
  axes: Axes;
  headX: number;
  headY: number;
  /** Rotating current, from depth 4. 0 disables it. */
  current: number;
  time: number;
};

export function stepOrbs(orbs: Orb[], o: OrbStepOptions): void {
  const { dt } = o;
  for (const orb of orbs) {
    if (orb.moltT > 0) {
      const before = orb.moltT;
      orb.moltT = Math.max(0, orb.moltT - dt);
      const half = orb.moltDur * 0.5;
      if (before > half && orb.moltT <= half) {
        orb.label = orb.nextLabel;
        orb.good = orb.nextGood;
      }
      const k = orb.moltT / orb.moltDur;
      orb.scale = Math.abs(k - 0.5) * 2;
    } else if (orb.scale < 1) {
      orb.scale = Math.min(1, orb.scale + dt * 3.4);
    }

    orb.phase += dt * orb.bob;

    if (orb.hunter) {
      const dx = o.headX - orb.x;
      const dy = o.headY - orb.y;
      const d = Math.hypot(dx, dy) || 1;
      orb.vx += (dx / d) * TUNE.hunterSpeed * dt * 2.2;
      orb.vy += (dy / d) * TUNE.hunterSpeed * dt * 2.2;
      const sp = Math.hypot(orb.vx, orb.vy);
      if (sp > TUNE.hunterSpeed) {
        orb.vx = (orb.vx / sp) * TUNE.hunterSpeed;
        orb.vy = (orb.vy / sp) * TUNE.hunterSpeed;
      }
    }

    if (o.current !== 0) {
      // A slow curl field. Orbs drift with the water; it makes the arena feel
      // alive without taking the wheel out of the player's hands.
      orb.vx += Math.sin(orb.y * 2.1 + o.time * 0.21) * o.current * dt;
      orb.vy += Math.cos(orb.x * 2.3 - o.time * 0.17) * o.current * dt;
    }

    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;

    // The rim contains the field too, and by the same shape the serpent hits.
    const limit = TUNE.orbRadius * 1.1;
    const e = rimEdge(o.axes.a, o.axes.b, orb.x, orb.y);
    if (e.gap < limit) {
      orb.x = e.x - e.nx * limit;
      orb.y = e.y - e.ny * limit;
      const dot = orb.vx * e.nx + orb.vy * e.ny;
      // Only a drift that is still heading OUT is turned around. Reflecting
      // unconditionally would flip an orb that the line above has already sent
      // inward straight back at the wall, and it would sit there buzzing.
      if (dot > 0) {
        orb.vx -= 2 * dot * e.nx;
        orb.vy -= 2 * dot * e.ny;
      }
    }
  }
}

export function orbDrawRadius(orb: Orb): number {
  return TUNE.orbRadius * orb.scale * (1 + Math.sin(orb.phase * 1.7) * 0.06);
}
