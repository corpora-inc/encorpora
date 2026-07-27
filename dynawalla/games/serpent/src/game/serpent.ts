/**
 * The serpent.
 *
 * The body is not a queue of grid cells — it is a *path*. The head writes into
 * a ring buffer of positions and the segments are resampled along that path at
 * fixed arc-length intervals every frame. That is the whole reason a modern
 * snake feels like an animal rather than a train: the body follows exactly
 * where the head went, at any angle, at any speed, and the turn radius is a
 * consequence of an angular velocity limit rather than a grid.
 *
 * Swallowing is modelled as a *bolus*: a bump in radius that travels down the
 * body from head to tail after every bite. It costs one Gaussian per segment
 * and it is the single most satisfying thing in the game.
 */

import { TUNE } from "./tuning.ts";
import { angleDelta, clamp } from "./num.ts";

const PATH_CAP = 2600;
const MAX_BOLUS = 24;
const BOLUS_SPEED = 1.35;
const BOLUS_WIDTH = 0.055;

export const BOLUS_GOOD = 0;
export const BOLUS_BAD = 1;

export type Serpent = {
  x: number;
  y: number;
  heading: number;
  targetHeading: number;
  speed: number;
  boosting: boolean;
  /** 0..1, how much of the boost visual is engaged. Smoothed. */
  boostBlend: number;

  pathX: Float32Array;
  pathY: Float32Array;
  pathHead: number;
  pathCount: number;

  segments: number;
  targetSegments: number;

  bodyX: Float32Array;
  bodyY: Float32Array;
  bodyR: Float32Array;
  bodyCount: number;

  bolusS: Float32Array;
  bolusKind: Uint8Array;
  bolusCount: number;

  shield: boolean;
  shieldSpin: number;
  alive: boolean;
};

export function createSerpent(): Serpent {
  const s: Serpent = {
    x: 0,
    y: 0,
    heading: 0,
    targetHeading: 0,
    speed: TUNE.baseSpeed,
    boosting: false,
    boostBlend: 0,
    pathX: new Float32Array(PATH_CAP),
    pathY: new Float32Array(PATH_CAP),
    pathHead: 0,
    pathCount: 0,
    segments: TUNE.startSegments,
    targetSegments: TUNE.startSegments,
    bodyX: new Float32Array(TUNE.maxSegments + 2),
    bodyY: new Float32Array(TUNE.maxSegments + 2),
    bodyR: new Float32Array(TUNE.maxSegments + 2),
    bodyCount: 0,
    bolusS: new Float32Array(MAX_BOLUS),
    bolusKind: new Uint8Array(MAX_BOLUS),
    bolusCount: 0,
    shield: false,
    shieldSpin: 0,
    alive: true,
  };
  resetSerpent(s, 0, 0, 0);
  return s;
}

export function resetSerpent(s: Serpent, x: number, y: number, heading: number): void {
  s.x = x;
  s.y = y;
  s.heading = heading;
  s.targetHeading = heading;
  s.speed = TUNE.baseSpeed;
  s.boosting = false;
  s.boostBlend = 0;
  s.segments = TUNE.startSegments;
  s.targetSegments = TUNE.startSegments;
  s.bolusCount = 0;
  s.shield = false;
  s.alive = true;

  // Seed the path with a straight tail so the serpent starts whole rather than
  // sprouting out of a point.
  s.pathHead = 0;
  s.pathCount = 0;
  const back = TUNE.pathResolution;
  const n = Math.ceil((TUNE.maxSegments * TUNE.segmentSpacing) / back) + 4;
  for (let i = n; i >= 0; i--) {
    pushPath(s, x - Math.cos(heading) * back * i, y - Math.sin(heading) * back * i);
  }
  rebuildBody(s);
}

function pushPath(s: Serpent, x: number, y: number): void {
  s.pathHead = (s.pathHead + 1) % PATH_CAP;
  s.pathX[s.pathHead] = x;
  s.pathY[s.pathHead] = y;
  if (s.pathCount < PATH_CAP) s.pathCount++;
}

export function grow(s: Serpent, n: number): void {
  s.targetSegments = clamp(s.targetSegments + n, TUNE.minSegments, TUNE.maxSegments);
}

export function addBolus(s: Serpent, kind: number): void {
  if (s.bolusCount >= MAX_BOLUS) {
    // Drop the oldest rather than the newest: the newest is the one the player
    // just earned and expects to see.
    for (let i = 1; i < s.bolusCount; i++) {
      s.bolusS[i - 1] = s.bolusS[i] as number;
      s.bolusKind[i - 1] = s.bolusKind[i] as number;
    }
    s.bolusCount--;
  }
  const i = s.bolusCount++;
  s.bolusS[i] = 0;
  s.bolusKind[i] = kind;
}

export type StepOptions = {
  desiredHeading: number | null;
  wantBoost: boolean;
  depth: number;
  onBoostSpark(x: number, y: number, heading: number): void;
};

export function stepSerpent(s: Serpent, dt: number, o: StepOptions): void {
  const canBoost = o.wantBoost && s.targetSegments > TUNE.boostMinSegments;
  s.boosting = canBoost;
  s.boostBlend = clamp(s.boostBlend + (canBoost ? dt * 7 : -dt * 6), 0, 1);

  if (o.desiredHeading !== null) s.targetHeading = o.desiredHeading;

  const turnRate = TUNE.turnRate + (TUNE.boostTurnRate - TUNE.turnRate) * s.boostBlend;
  const d = angleDelta(s.heading, s.targetHeading);
  const maxTurn = turnRate * dt;
  s.heading += clamp(d, -maxTurn, maxTurn);

  const base = Math.min(TUNE.baseSpeed + TUNE.speedPerDepth * o.depth, TUNE.maxSpeed);
  s.speed = base * (1 + (TUNE.boostFactor - 1) * s.boostBlend);

  const step = s.speed * dt;
  s.x += Math.cos(s.heading) * step;
  s.y += Math.sin(s.heading) * step;

  const lx = s.pathX[s.pathHead] as number;
  const ly = s.pathY[s.pathHead] as number;
  if ((s.x - lx) ** 2 + (s.y - ly) ** 2 >= TUNE.pathResolution * TUNE.pathResolution) {
    pushPath(s, s.x, s.y);
  }

  if (canBoost) {
    s.targetSegments = Math.max(TUNE.minSegments, s.targetSegments - TUNE.boostDrain * dt);
    const tail = s.bodyCount > 0 ? s.bodyCount - 1 : 0;
    o.onBoostSpark(s.bodyX[tail] as number, s.bodyY[tail] as number, s.heading);
  }

  // The visible length chases the target so growth is a swell, not a jump.
  const diff = s.targetSegments - s.segments;
  const maxDelta = TUNE.growRate * dt;
  s.segments += clamp(diff, -maxDelta, maxDelta);

  for (let i = 0; i < s.bolusCount; i++) {
    const next = (s.bolusS[i] as number) + BOLUS_SPEED * dt;
    if (next > s.segments * TUNE.segmentSpacing + BOLUS_WIDTH * 2) {
      const last = --s.bolusCount;
      s.bolusS[i] = s.bolusS[last] as number;
      s.bolusKind[i] = s.bolusKind[last] as number;
      i--;
      continue;
    }
    s.bolusS[i] = next;
  }

  s.shieldSpin += dt * 2.4;
  rebuildBody(s);
}

/**
 * Resample the path into evenly spaced body points, newest first. One pass over
 * the path, no allocation. This is the hot loop; at 210 segments it walks about
 * 470 path points.
 */
export function rebuildBody(s: Serpent): void {
  const spacing = TUNE.segmentSpacing;
  const want = Math.min(TUNE.maxSegments, Math.max(2, Math.round(s.segments)));

  s.bodyX[0] = s.x;
  s.bodyY[0] = s.y;
  let out = 1;

  let px = s.x;
  let py = s.y;
  let acc = 0;
  let need = spacing;

  for (let k = 0; k < s.pathCount && out < want; k++) {
    const idx = (s.pathHead - k + PATH_CAP) % PATH_CAP;
    const cx = s.pathX[idx] as number;
    const cy = s.pathY[idx] as number;
    let dx = cx - px;
    let dy = cy - py;
    const d = Math.hypot(dx, dy);
    if (d <= 1e-9) continue;
    dx /= d;
    dy /= d;
    while (acc + d >= need && out < want) {
      const t = need - acc;
      s.bodyX[out] = px + dx * t;
      s.bodyY[out] = py + dy * t;
      out++;
      need += spacing;
    }
    acc += d;
    px = cx;
    py = cy;
  }

  // Ran out of recorded path (only possible in the first frames): extend
  // straight back so the body never collapses to a stub.
  while (out < want) {
    s.bodyX[out] = px - Math.cos(s.heading) * spacing * (out - 1);
    s.bodyY[out] = py - Math.sin(s.heading) * spacing * (out - 1);
    out++;
  }
  s.bodyCount = out;

  // Radius profile: a thick neck, a long taper, and a Gaussian bump per bolus.
  const inv = 1 / Math.max(1, out - 1);
  for (let i = 0; i < out; i++) {
    const u = i * inv;
    // Near-uniform down the length with a rounded stub for a tail. Tapering
    // smoothly to a point is what made this read as a dart instead of an eel —
    // a snake is a tube, and the silhouette has to say so.
    const taper = u < 0.8 ? 1 - 0.1 * u : 0.92 - 0.36 * ((u - 0.8) / 0.2) ** 1.5;
    const neck = 1 + 0.2 * Math.exp(-((u / 0.07) ** 2));
    let r = TUNE.bodyRadius * taper * neck;
    const si = i * spacing;
    for (let b = 0; b < s.bolusCount; b++) {
      const z = (si - (s.bolusS[b] as number)) / BOLUS_WIDTH;
      if (z > -3 && z < 3) r += TUNE.bodyRadius * 0.85 * Math.exp(-z * z);
    }
    s.bodyR[i] = r;
  }
}

/** Distance from the head to the nearest body point that can kill it. */
export function selfHit(s: Serpent): boolean {
  const lethal = TUNE.headRadius * TUNE.selfHitFactor;
  const r2 = lethal * lethal;
  for (let i = TUNE.neckSegments; i < s.bodyCount; i++) {
    const dx = (s.bodyX[i] as number) - s.x;
    const dy = (s.bodyY[i] as number) - s.y;
    if (dx * dx + dy * dy < r2) return true;
  }
  return false;
}

export function bolusTintAt(s: Serpent, i: number): number {
  const si = i * TUNE.segmentSpacing;
  let bad = 0;
  for (let b = 0; b < s.bolusCount; b++) {
    if (s.bolusKind[b] !== BOLUS_BAD) continue;
    const z = (si - (s.bolusS[b] as number)) / (BOLUS_WIDTH * 1.6);
    if (z > -3 && z < 3) bad = Math.max(bad, Math.exp(-z * z));
  }
  return bad;
}
