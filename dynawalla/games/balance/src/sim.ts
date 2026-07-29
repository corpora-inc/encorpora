// Physics. Floats live here and only here: the beam angle is a picture of the
// arithmetic, never the arithmetic itself. Whether a puzzle is solved is decided
// in `puzzle.ts` on exact rationals, and the beam is then *told* to level.

import type { Frac } from "./frac.ts";
import { toNumber } from "./frac.ts";
import type { Side } from "./puzzle.ts";
import type { Layout } from "./layout.ts";
import { armDistance, beamPoint } from "./layout.ts";

export const MAX_TILT = 0.30; // radians at the hard stop, ~17 degrees

export type BodyState = "rack" | "seated" | "drag" | "fly" | "eject" | "gone";

export type Body = {
  id: string;
  value: Frac;
  /** negative weight: drawn as a foil balloon, pulls up */
  balloon: boolean;
  crate: boolean;
  /** part of the puzzle statement — the player cannot take it out */
  fixed: boolean;
  state: BodyState;
  side: Side;
  peg: number;
  slot: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** squash: sx = 1 + sq, sy = 1 - sq */
  sq: number;
  sqVel: number;
  rot: number;
  rotVel: number;
  t: number;
  dur: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  arc: number;
  glow: number;
  trot: number;
  seatedAt: number;
  bob: number;
};

let nextId = 1;

export function makeBody(init: Partial<Body> & { value: Frac }): Body {
  return {
    id: `b${nextId++}`,
    balloon: toNumber(init.value) < 0,
    crate: false,
    fixed: false,
    state: "seated",
    side: 1,
    peg: 3,
    slot: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    sq: 0,
    sqVel: 0,
    rot: 0,
    rotVel: 0,
    trot: 0,
    t: 0,
    dur: 0.3,
    fx: 0,
    fy: 0,
    tx: 0,
    ty: 0,
    arc: 0,
    glow: 0,
    seatedAt: 0,
    bob: Math.random() * Math.PI * 2,
    ...init,
  };
}

export type Beam = {
  theta: number;
  omega: number;
  /** the brass safety pin holds the arm dead level while a crate is unopened */
  pinned: boolean;
  /** 0..1 how far the pin has withdrawn */
  pinOut: number;
  panPhi: [number, number]; // [left, right]
  panVel: [number, number];
  /** level lock after a solve: the beam is *told* the exact truth */
  locked: boolean;
};

export function makeBeam(): Beam {
  return {
    theta: 0,
    omega: 0,
    pinned: false,
    pinOut: 0,
    panPhi: [0, 0],
    panVel: [0, 0],
    locked: false,
  };
}

export type BeamEvents = {
  onStop?: (force: number) => void;
};

/**
 * `net` is the exact moment converted to a float purely for the picture.
 * tanh gives a beam that reads "slightly off" at one unit and "slammed" at
 * five or more, which is the discrimination a child actually needs.
 */
export function stepBeam(
  beam: Beam,
  net: number,
  dt: number,
  ev: BeamEvents = {},
): void {
  if (dt <= 0) return;
  const target = beam.pinned
    ? 0
    : beam.locked
      ? 0
      : MAX_TILT * Math.tanh(net * 0.42);

  const k = beam.pinned ? 190 : 26;
  const damp = beam.pinned ? 16 : 3.05;
  beam.omega += (target - beam.theta) * k * dt;
  beam.omega *= Math.exp(-damp * dt);
  beam.theta += beam.omega * dt;

  if (beam.theta > MAX_TILT) {
    const force = Math.abs(beam.omega);
    beam.theta = MAX_TILT;
    beam.omega = -beam.omega * 0.24;
    if (force > 0.35) ev.onStop?.(Math.min(1, force / 2.2));
  } else if (beam.theta < -MAX_TILT) {
    const force = Math.abs(beam.omega);
    beam.theta = -MAX_TILT;
    beam.omega = -beam.omega * 0.24;
    if (force > 0.35) ev.onStop?.(Math.min(1, force / 2.2));
  }

  // Dishes are pendulums hung off a moving pivot: they lag, then catch up.
  for (let i = 0; i < 2; i++) {
    const phiTarget = -beam.omega * 0.42;
    beam.panVel[i] += (phiTarget - beam.panPhi[i]) * 88 * dt;
    beam.panVel[i] *= Math.exp(-6.4 * dt);
    beam.panPhi[i] += beam.panVel[i] * dt;
    if (beam.panPhi[i] > 0.42) {
      beam.panPhi[i] = 0.42;
      beam.panVel[i] *= -0.3;
    }
    if (beam.panPhi[i] < -0.42) {
      beam.panPhi[i] = -0.42;
      beam.panVel[i] *= -0.3;
    }
  }

  beam.pinOut += ((beam.pinned ? 0 : 1) - beam.pinOut) * Math.min(1, dt * 9);
}

/** The centre of a hanging dish, in screen pixels. */
export function dishCentre(
  L: Layout,
  beam: Beam,
  side: Side,
): { x: number; y: number; phi: number } {
  const p = beamPoint(L, beam.theta, side, L.arm);
  const phi = beam.panPhi[side < 0 ? 0 : 1];
  return {
    x: p.x + Math.sin(phi) * L.drop,
    y: p.y + Math.cos(phi) * L.drop,
    phi,
  };
}

/** Where a seated body wants to be, given everything currently on its side. */
export function seatTarget(
  L: Layout,
  beam: Beam,
  mode: "pans" | "beam",
  side: Side,
  slot: number,
  countOnSide: number,
): { x: number; y: number; rot: number } {
  if (mode === "beam") {
    return { x: 0, y: 0, rot: 0 }; // filled in by seatTargetPeg
  }
  const dish = dishCentre(L, beam, side);
  const r = L.weightR;
  const perRow = Math.min(5, Math.max(3, Math.ceil(countOnSide / Math.ceil(countOnSide / 5))));
  const row = Math.floor(slot / perRow);
  const inRow = slot % perRow;
  const nInRow = Math.min(perRow, countOnSide - row * perRow);
  const spacing = Math.min(r * 1.78, (L.dishW - r * 1.3) / Math.max(1, nInRow - 1));
  const dx = (inRow - (nInRow - 1) / 2) * spacing;
  // seated INSIDE the bowl, not perched on the rim: the base of the cylinder
  // sits below the rim ellipse so brass and dish visibly overlap
  const dy = -r * 0.46 - row * r * 1.42 - (inRow % 2) * r * 0.05;
  const c = Math.cos(dish.phi);
  const s = Math.sin(dish.phi);
  return {
    x: dish.x + dx * c - dy * s,
    y: dish.y + dx * s + dy * c,
    rot: dish.phi,
  };
}

/** Where a body hung on a numbered peg wants to be. */
export function seatTargetPeg(
  L: Layout,
  beam: Beam,
  side: Side,
  peg: number,
  slot: number,
): { x: number; y: number; rot: number } {
  const p = beamPoint(L, beam.theta, side, armDistance(L, "beam", peg));
  const hang = L.weightR * 1.55 + slot * L.weightR * 2.05;
  const phi = beam.panPhi[side < 0 ? 0 : 1] * 0.7;
  return {
    x: p.x + Math.sin(phi) * hang,
    y: p.y + Math.cos(phi) * hang,
    rot: phi,
  };
}

export type BodyEvents = {
  onLand?: (b: Body) => void;
  onArriveRack?: (b: Body) => void;
};

/**
 * The largest step the seat spring survives, and why this constant exists.
 *
 * A seated body is pulled home by a stiff spring integrated with semi-implicit
 * Euler at k = 1000, c = 46. Writing the step as a matrix on (velocity, error):
 *
 *     [ 1 − c·dt         −k·dt      ]
 *     [ dt·(1 − c·dt)   1 − k·dt²   ]
 *
 * its eigenvalues sit inside the unit circle only while
 *
 *     1000·dt² + 92·dt − 4 < 0     ⟹     dt < 0.0322 s
 *
 * — thirty-one frames a second. The frame loop clamped dt at 1/20 and handed
 * 0.05 straight in, which is 1.55× past that limit, so **every value between
 * 31 fps and the clamp is exponential runaway** rather than a spring. Measured
 * on the unfixed integrator, 400 steps from a 141 px displacement:
 *
 *     dt = 1/60  →  x = 100      (home)
 *     dt = 1/30  →  x = −2.10e21
 *     dt = 1/20  →  x = −1.21e204
 *
 * That is the reported "the weights go nuts and fritz out and drift off": one
 * stalled frame — a WebView resume, a GC pause, a thermal downclock to 30 fps —
 * and the seated pile is at 1e21 px and never comes back, because nothing in
 * the old code could pull it home again.
 *
 * The fix is not a tighter clamp on dt (that drops simulated time and still
 * leaves 30 fps devices broken). It is substepping: whatever the frame took,
 * the integrator only ever advances in slices this size, so the spring is
 * unconditionally inside its stability region. 1/120 keeps a 3.9× margin.
 */
export const MAX_BODY_DT = 1 / 120;

/**
 * A ceiling on substeps so a pathological dt costs a bounded amount of work.
 * Sixteen covers 0.133 s, well past the 1/20 the frame loop clamps to; beyond
 * that the simulation runs slow rather than unstable, which is the right way
 * round for a game a child is holding.
 */
const MAX_SUBSTEPS = 16;

/**
 * Advance one body. Substeps so the seat spring is stable at any frame rate.
 *
 * See `MAX_BODY_DT`. `stepBodyOnce` is the old body of this function, unchanged
 * except that it is now only ever called with a step it is stable at.
 */
export function stepBody(b: Body, dt: number, ev: BodyEvents = {}): void {
  if (!(dt > 0)) return;
  let steps = Math.ceil(dt / MAX_BODY_DT);
  if (!Number.isFinite(steps) || steps > MAX_SUBSTEPS) steps = MAX_SUBSTEPS;
  const h = Math.min(MAX_BODY_DT, dt / steps);
  for (let i = 0; i < steps; i++) stepBodyOnce(b, h, ev);
  settle(b);
}

/**
 * Last line of defence: a body whose numbers have stopped being numbers.
 *
 * A single NaN is permanent — every later frame propagates it — and it draws as
 * nothing, so a weight that was part of the *statement of the problem* silently
 * vanishes. Divides that can reach here at all: `t / b.dur` in the fly arc and
 * the two `/ dur` in `toss` (both now floored), plus anything a caller writes
 * into `tx`/`ty` from a layout measured on a zero-sized canvas. Rather than
 * hunt every producer forever, a body that has left the number line is put back
 * on its seat, at rest.
 */
function settle(b: Body): void {
  if (
    Number.isFinite(b.x) &&
    Number.isFinite(b.y) &&
    Number.isFinite(b.vx) &&
    Number.isFinite(b.vy) &&
    Number.isFinite(b.rot) &&
    Number.isFinite(b.sq)
  ) {
    return;
  }
  b.x = Number.isFinite(b.tx) ? b.tx : 0;
  b.y = Number.isFinite(b.ty) ? b.ty : 0;
  b.vx = 0;
  b.vy = 0;
  b.rot = Number.isFinite(b.trot) ? b.trot : 0;
  b.rotVel = 0;
  b.sq = 0;
  b.sqVel = 0;
  if (b.state === "fly") b.state = "seated";
}

function stepBodyOnce(b: Body, dt: number, ev: BodyEvents): void {
  // squash-and-stretch spring, always running
  b.sqVel += -b.sq * 360 * dt;
  b.sqVel *= Math.exp(-11 * dt);
  b.sq += b.sqVel * dt;
  b.glow = Math.max(0, b.glow - dt * 2.2);
  b.bob += dt * 2.1;

  switch (b.state) {
    case "fly": {
      b.t += dt;
      const t = Math.min(1, b.t / b.dur);
      const e = 1 - (1 - t) * (1 - t); // easeOutQuad on the travel
      b.x = b.fx + (b.tx - b.fx) * e;
      b.y = b.fy + (b.ty - b.fy) * e - Math.sin(Math.PI * t) * b.arc;
      b.rot += b.rotVel * dt;
      b.rotVel *= Math.exp(-3 * dt);
      if (t >= 1) {
        b.state = "seated";
        b.sq = 0.34;
        b.sqVel = 0;
        b.vx = 0;
        b.vy = 0;
        ev.onLand?.(b);
      }
      break;
    }
    case "eject": {
      b.t += dt;
      b.vy += 1750 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.rotVel * dt;
      if (b.t >= b.dur) {
        b.state = "gone";
        ev.onArriveRack?.(b);
      }
      break;
    }
    case "drag":
    case "rack":
    case "gone":
      break;
    case "seated": {
      // stiff spring to the seat, so a lurching dish makes the pile jostle
      const k = 1000;
      const c = 46;
      b.vx += (b.tx - b.x) * k * dt - b.vx * c * dt;
      b.vy += (b.ty - b.y) * k * dt - b.vy * c * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rotVel += (b.trot - b.rot) * 300 * dt - b.rotVel * 24 * dt;
      b.rot += b.rotVel * dt;
      break;
    }
  }
}

export function launch(
  b: Body,
  toX: number,
  toY: number,
  dur: number,
  arc: number,
): void {
  b.fx = b.x;
  b.fy = b.y;
  b.tx = toX;
  b.ty = toY;
  // `t / b.dur` is the arc parameter: a zero duration makes it 0/0 and the body
  // is at NaN for the rest of the run.
  b.dur = Math.max(1e-3, dur);
  b.arc = arc;
  b.t = 0;
  b.state = "fly";
  b.rotVel = (Math.random() - 0.5) * 5;
}

/** Ballistic toss with a guaranteed landing point. */
export function toss(
  b: Body,
  toX: number,
  toY: number,
  dur: number,
  gravity = 1750,
): void {
  const d = Math.max(1e-3, dur);
  // Recorded even though the ballistic path does not read them: `settle` puts a
  // body that has gone non-finite back on `tx`/`ty`, and without these it would
  // put an ejecting weight back in the dish rather than on the rack rail.
  b.tx = toX;
  b.ty = toY;
  b.vx = (toX - b.x) / d;
  b.vy = (toY - b.y) / d - 0.5 * gravity * d;
  b.rotVel = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 6);
  b.t = 0;
  b.dur = d;
  b.state = "eject";
}
