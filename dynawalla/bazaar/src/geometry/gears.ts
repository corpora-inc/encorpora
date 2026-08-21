/**
 * BZ-LAW-11 — a gear must be geared.
 *
 * Any rotating gear has a visible meshing neighbour, and `ω_b = −ω_a·(N_a/N_b)`
 * holds for the tooth counts that are actually drawn. This is the single rule
 * that separates a clockmakers' terrace from glued-on-cog steampunk, and unlike
 * "taste" it is checkable — `gears.test.ts` asserts it against the rendered
 * counts.
 *
 * It holds by construction here: a follower's angle is *derived* from the
 * driver's angle, so there is no code path in which a gear can turn at a ratio
 * its teeth do not support.
 */

export interface GearSpec {
  teeth: number;
  /** Direction, in degrees, from the previous gear's centre to this one. */
  bearing?: number;
}

export interface Gear {
  teeth: number;
  /** Pitch radius. */
  r: number;
  x: number;
  y: number;
  /** Rotation in radians at the reference time. */
  angle: number;
  /** Angular velocity, radians per second. */
  omega: number;
}

export interface TrainOptions {
  /** Tooth counts, driver first. Each meshes with the one before it. */
  spec: GearSpec[];
  /** Pitch diameter per tooth. Every gear in a train shares it — that is what
   *  makes them able to mesh at all. */
  module: number;
  origin: { x: number; y: number };
  /** Driver angular velocity in rad/s. */
  omega: number;
  /** Driver rotation at t = 0. */
  phase?: number;
}

const TAU = Math.PI * 2;

/**
 * Lay out a train and derive every follower from its driver.
 * `t` is seconds; call it per frame.
 */
export function gearTrain(o: TrainOptions, t: number): Gear[] {
  const out: Gear[] = [];
  let prev: Gear | null = null;
  for (let i = 0; i < o.spec.length; i++) {
    const s = o.spec[i]!;
    const r = (o.module * s.teeth) / 2;
    if (!prev) {
      out.push({
        teeth: s.teeth,
        r,
        x: o.origin.x,
        y: o.origin.y,
        angle: (o.phase ?? 0) + o.omega * t,
        omega: o.omega,
      });
      prev = out[0]!;
      continue;
    }
    const bearing = ((s.bearing ?? 0) * Math.PI) / 180;
    const x = prev.x + (prev.r + r) * Math.cos(bearing);
    const y = prev.y + (prev.r + r) * Math.sin(bearing);
    // The meshing relation. Derived, never assigned: this is the law.
    const ratio = prev.teeth / s.teeth;
    const angle =
      bearing + Math.PI - ratio * (prev.angle - bearing) + Math.PI / s.teeth;
    const g: Gear = { teeth: s.teeth, r, x, y, angle, omega: -prev.omega * ratio };
    out.push(g);
    prev = g;
  }
  return out;
}

/** Trace one gear's outline: pitch circle plus real, countable teeth. */
export function gearPath(ctx: CanvasRenderingContext2D, g: Gear): void {
  const addendum = g.r * (2.2 / g.teeth);
  const ro = g.r + addendum;
  const ri = g.r - addendum * 0.9;
  const half = TAU / (g.teeth * 4); // tooth is a quarter of the pitch
  ctx.beginPath();
  for (let k = 0; k < g.teeth; k++) {
    const c = g.angle + (TAU * k) / g.teeth;
    const a0 = c - half * 1.55;
    const a1 = c - half * 0.85;
    const a2 = c + half * 0.85;
    const a3 = c + half * 1.55;
    if (k === 0) ctx.moveTo(g.x + ri * Math.cos(a0), g.y + ri * Math.sin(a0));
    else ctx.lineTo(g.x + ri * Math.cos(a0), g.y + ri * Math.sin(a0));
    ctx.lineTo(g.x + ro * Math.cos(a1), g.y + ro * Math.sin(a1));
    ctx.lineTo(g.x + ro * Math.cos(a2), g.y + ro * Math.sin(a2));
    ctx.lineTo(g.x + ri * Math.cos(a3), g.y + ri * Math.sin(a3));
  }
  ctx.closePath();
}

export interface GearStyle {
  metal: string;
  metalShade: string;
  litEdge: string;
  cut: string;
}

export function drawGear(ctx: CanvasRenderingContext2D, g: Gear, s: GearStyle): void {
  gearPath(ctx, g);
  ctx.fillStyle = s.metal;
  ctx.fill();
  ctx.strokeStyle = s.cut;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Spokes and hub: what tells you at a glance that it is turning.
  const spokes = g.teeth >= 18 ? 6 : g.teeth >= 12 ? 4 : 3;
  ctx.strokeStyle = s.metalShade;
  ctx.lineWidth = Math.max(1.5, g.r * 0.12);
  ctx.beginPath();
  for (let k = 0; k < spokes; k++) {
    const a = g.angle + (TAU * k) / spokes;
    ctx.moveTo(g.x + g.r * 0.16 * Math.cos(a), g.y + g.r * 0.16 * Math.sin(a));
    ctx.lineTo(g.x + g.r * 0.74 * Math.cos(a), g.y + g.r * 0.74 * Math.sin(a));
  }
  ctx.stroke();

  ctx.fillStyle = s.metalShade;
  ctx.beginPath();
  ctx.arc(g.x, g.y, Math.max(1.5, g.r * 0.18), 0, TAU);
  ctx.fill();
  ctx.strokeStyle = s.litEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(g.x, g.y, Math.max(1.5, g.r * 0.18), Math.PI, TAU);
  ctx.stroke();
}
