/**
 * The vent, as a shape.
 *
 * The arena used to be a circle sized off the **short** side of the safe box, so
 * a phone held upright played inside a disc about 0.88 screens wide with two
 * dead black bands above and below it. The founder asked the obvious question —
 * why is the board not the screen — and the answer is that it now is: the vent
 * is an **ellipse inscribed in the safe rectangle**, so it reaches the top and
 * the bottom of a tall phone and the left and right of a wide one.
 *
 * ## Why the shape is a module and not a constant
 *
 * The rim is a wall a child can die against, and grazing it is worth points, so
 * the boundary is not decoration: `world.ts` asks it three questions every
 * simulated step — how far am I from the wall, which way is the wall facing, and
 * where is the nearest legal spot inside it. On a circle all three were one line
 * of arithmetic on `Math.hypot`. On an ellipse none of them are, because the
 * nearest point on an ellipse is the root of a quartic, so the answers live here
 * and are checked in `arena.test.ts` against a brute-force sweep of the rim.
 *
 * Everything is in world units: the arena's SHORT semi-axis is exactly
 * `world.arenaR`, which is what makes this change feel like nothing on the axis
 * the game was tuned on. The long semi-axis is `arenaR × aspect`; the serpent,
 * the orbs and every radius in `TUNE` are untouched, and the pixels-per-world-unit
 * scale stays isotropic, so the snake is still round and turns the same way in
 * every direction. Only the room it swims in got bigger.
 */

import { clamp } from "./num.ts";

/**
 * How much of the safe box the arena's outer rim may use, per axis.
 *
 * The rim is not a hairline. Measured against what `scene.ts: drawRim` actually
 * puts on the glass, and what `camera.ts` can do to it, the furthest ink from the
 * centre on the short axis is
 *
 *   · the polyps, drawn at `1.012 × semiAxis` with a sprite `0.016 × scale` wide
 *     at up to 1.4× its size, so a half-sprite of `0.0112 × scale` beyond that;
 *   · all of it multiplied by `cam.zoom`, whose spring peaks at about 1.007
 *     (`prompt.ts` records the matching 0.990 undershoot);
 *   · plus `cam.shakeX × view.scale`, and `shakeMax` is 0.055.
 *
 * That is `1.0 × 1.007 × 1.012 + 0.0112 × 1.007 + 0.055 ≈ 1.086` semi-axes, so a
 * fill of 0.9 puts the worst frame at `0.45 × 1.086 = 0.489` of the safe box's
 * short side against a budget of 0.5 — the same margin the old 0.44 bought, held
 * by `arena.test.ts` rather than by belief.
 *
 * The soft halo behind the rim is deliberately outside this: it is a radial
 * gradient that is already transparent where it meets the edge, it is not
 * something a child can steer into, and the shipped 0.44 arena let it out too.
 */
export const ARENA_FILL = 0.9;

/**
 * The most elongated the vent is allowed to get.
 *
 * Not taste — curvature. `pullInside` puts a body `m` inside the rim by walking
 * `m` back along the surface normal, which is exact only while `m` stays under
 * the smallest radius of curvature the ellipse has, `min(a,b)² / max(a,b)`. At
 * the vent's floor (`TUNE.arenaFloor` = 0.62) that is `0.62 / aspect`, and the
 * largest margin anything asks for is an orb's spawn clearance, `0.062 × 2.2 =
 * 0.136`. So the shape stays exact up to an aspect of about 4.5, and this cap
 * keeps a 50% margin on it.
 *
 * Nothing a person holds is anywhere near it — the tallest phone is about 2.2:1
 * — but an iPad Slide Over is 3.7:1 and a pack frame can be resized to anything.
 * Past the cap the ellipse simply stops growing along the long axis and the game
 * is letterboxed, which is a smaller arena and never a wrong one.
 */
export const MAX_ARENA_ASPECT = 3;

/** The arena's aspect: one axis is exactly 1, the other is the safe box's ratio. */
export type Aspect = { x: number; y: number };

/**
 * Pixels per world unit, for a safe box.
 *
 * Isotropic on purpose. The stretch that fills the screen is in the arena's
 * semi-axes, never in the transform — squeezing the canvas instead would make the
 * serpent fat one way and thin the other and turn its turning circle into an egg.
 */
export function arenaScale(safeW: number, safeH: number): number {
  return (Math.max(1, Math.min(safeW, safeH)) * ARENA_FILL) / 2;
}

/** The aspect of the ellipse inscribed in a safe box, short axis normalised to 1. */
export function arenaAspect(safeW: number, safeH: number): Aspect {
  const short = Math.max(1, Math.min(safeW, safeH));
  const long = Math.max(1, Math.max(safeW, safeH));
  const k = clamp(long / short, 1, MAX_ARENA_ASPECT);
  return safeW >= safeH ? { x: k, y: 1 } : { x: 1, y: k };
}

/**
 * The point on the rim nearest `(px, py)`.
 *
 * The evolute iteration: from a guess on the rim, step to the point whose normal
 * line passes through the query, using the centre of curvature as the pivot. It
 * is the standard construction and it converges quadratically. Six rounds, which
 * is two more than the point where the eccentricities this game can produce stop
 * moving; `arena.test.ts` checks the answer against an exhaustive sweep of the
 * rim, and the count against the residual it leaves behind.
 *
 * Solved in the first quadrant and mirrored back, because the ellipse is
 * symmetric in both axes and the iteration is only well behaved there.
 */
export function closestOnRim(a: number, b: number, px: number, py: number): { x: number; y: number } {
  const sx = px < 0 ? -1 : 1;
  const sy = py < 0 ? -1 : 1;
  const qx0 = Math.abs(px);
  const qy0 = Math.abs(py);
  const aa = a * a;
  const bb = b * b;
  let tx = Math.SQRT1_2;
  let ty = Math.SQRT1_2;
  for (let i = 0; i < 6; i++) {
    // The centre of curvature under the current guess — a point on the evolute.
    const ex = ((aa - bb) * tx * tx * tx) / a;
    const ey = ((bb - aa) * ty * ty * ty) / b;
    const rx = a * tx - ex;
    const ry = b * ty - ey;
    const qx = qx0 - ex;
    const qy = qy0 - ey;
    const q = Math.hypot(qx, qy);
    // The query sits exactly on the evolute: every direction is as good as any
    // other and the next step would divide by zero. The guess in hand is already
    // a nearest point.
    if (q < 1e-12) break;
    const r = Math.hypot(rx, ry);
    tx = clamp((qx * (r / q) + ex) / a, 0, 1);
    ty = clamp((qy * (r / q) + ey) / b, 0, 1);
    const t = Math.hypot(tx, ty);
    if (t < 1e-12) break;
    tx /= t;
    ty /= t;
  }
  return { x: a * tx * sx, y: b * ty * sy };
}

export type Edge = {
  /** The nearest point on the rim. */
  x: number;
  y: number;
  /** The outward unit normal of the rim there. */
  nx: number;
  ny: number;
  /** Distance from the query to the rim: positive inside the vent, negative outside. */
  gap: number;
};

/** Where the rim is from here, which way it faces, and how far away it is. */
export function rimEdge(a: number, b: number, px: number, py: number): Edge {
  const c = closestOnRim(a, b, px, py);
  // The gradient of x²/a² + y²/b² points out of the ellipse.
  let nx = c.x / (a * a);
  let ny = c.y / (b * b);
  const n = Math.hypot(nx, ny);
  if (n > 1e-12) {
    nx /= n;
    ny /= n;
  } else {
    nx = 1;
    ny = 0;
  }
  const d = Math.hypot(px - c.x, py - c.y);
  const inside = (px / a) ** 2 + (py / b) ** 2 <= 1;
  return { x: c.x, y: c.y, nx, ny, gap: inside ? d : -d };
}

/** Is this point inside the vent at all? */
export function insideRim(a: number, b: number, px: number, py: number): boolean {
  return (px / a) ** 2 + (py / b) ** 2 <= 1;
}

/**
 * The nearest legal spot at least `margin` inside the rim.
 *
 * A point already deep enough is returned untouched; anything nearer (or outside)
 * is put on the inward normal at exactly `margin`. Every "keep this thing off the
 * wall" in the game goes through here, so a spawn, an orb bouncing off the edge
 * and a serpent thrown back by a wall hit all agree about where the wall is —
 * which is the whole failure mode a stretched arena invites.
 */
export function pullInside(
  a: number,
  b: number,
  px: number,
  py: number,
  margin: number,
): { x: number; y: number } {
  const e = rimEdge(a, b, px, py);
  if (e.gap >= margin) return { x: px, y: py };
  return { x: e.x - e.nx * margin, y: e.y - e.ny * margin };
}
