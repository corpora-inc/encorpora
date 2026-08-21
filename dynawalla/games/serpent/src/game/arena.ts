/**
 * The vent, as a shape — and the frame it is fitted into.
 *
 * ## Three times asked
 *
 * The board was a circle sized off the SHORT side of the safe box, which left two
 * dead bands on a tall phone. It became an ellipse inscribed in the safe box at
 * 0.9 of each axis, which removed the bands and left four dark corners and a
 * tenth of every edge. The founder asked the same question all three times: why
 * is the board not the screen.
 *
 * It is now a **rounded rectangle fitted to the real limit**, and the real limit
 * is exactly two things:
 *
 *   1. **The safe rectangle.** Outside it is the cutout and the rounded display
 *      corner. A lethal rim under a rounded corner is a wall a child dies against
 *      and cannot see, which is what the original comment on the 0.44 circle was
 *      protecting against and it was right.
 *   2. **The host's chrome.** The host paints `<` at the top left and `?` at the
 *      top right, 44px squares, OVER the game — `hostChrome.ts` owns those
 *      numbers. In the founder's screenshot they sat on top of the board. The rim
 *      is a wall, so it clears them; the water underneath them is still water.
 *
 * Nothing else is held back. There is no fill fraction any more: the rim's own
 * ink — its stroke, its polyps, and a bounded camera shake — is measured in
 * pixels and reserved in pixels, and the board takes every pixel that is left.
 * `arena.test.ts` holds the whole rim inside the safe box and clear of both
 * chrome squares, in every frame the game can draw.
 *
 * ## Why the shape is a module and not a constant
 *
 * The rim is a wall a child can die against and grazing it is worth points, so
 * `world.ts` asks it three questions every simulated step: how far am I from the
 * wall, which way is the wall facing, and where is the nearest legal spot inside
 * it. All three go through `rimEdge` and `pullInside`, so the wall, the graze
 * band, the spawner and the orb field cannot drift apart.
 *
 * A rounded rect answers all three in closed form — clamp to the straight run, or
 * fall to the corner arc — where the ellipse it replaces needed an evolute
 * iteration. It is less code AND it covers about 98% of its own bounding box
 * instead of the ellipse's 78.5%. `arena.test.ts` still checks every answer
 * against a 60,000-point brute-force sweep of the rim, because "less code" is not
 * an argument.
 *
 * Everything is in world units: the board's SHORT half-extent is exactly
 * `world.arenaR`, so the axis the game was tuned on is untouched, and the
 * pixels-per-world-unit scale stays isotropic, so the serpent is round and turns
 * the same way in every direction.
 */

import { chromeRects, type Insets } from "../../../../packs/shared/game-chrome/index.ts";

/**
 * The corner radius, as a fraction of the board's SHORT half-extent.
 *
 * Keyed to the short axis so the corners look the same on a phone and a tablet,
 * and so an elongated board does not grow lozenge ends. At 0.30 the corners cost
 * `(4 − π)r²` — about 1.3% of the board — and land near the display's own corner
 * radius on a phone, which is why it reads as the screen rather than as a card
 * lying on it.
 *
 * It is also the exactness bound for `pullInside`: walking a margin back along
 * the normal is exact for any margin up to the corner radius, and only up to it.
 * `arena.test.ts` holds that against the largest clearance the game asks for.
 */
export const CORNER_FRACTION = 0.3;

/**
 * How far the rim's polyps ride outside the rim line, in world units.
 *
 * An absolute offset, not a multiple of the half-extent. The ellipse used
 * `1.012 × semiAxis`, which on a long board cost twice as many pixels on the long
 * axis as the short one for no reason anybody could see.
 */
export const POLYP_OUT = 0.012;

/**
 * The largest camera shake the board is allowed to be translated by, in world
 * units — half of `TUNE.shakeMax`, and enforced in `scene.ts` where the offset is
 * applied.
 *
 * Every shake the game produces while a child is still steering is already under
 * it: a wall hit is `0.55² × 0.055 = 0.0166`, a wrong answer `0.0111`, a bite
 * `0.0006`. The only thing this trims is the death slam, which keeps its hitstop,
 * its slow-motion, its flash, its punch and its debris and loses a few pixels of
 * translation on a frame where the run is already over.
 *
 * It is reserved in the layout, in pixels, which is the price of the rim being
 * provably inside the safe box in EVERY frame rather than only at rest. Reserving
 * the full `shakeMax` instead costs seven points of screen, all of it to protect
 * a frame nobody is playing.
 */
export const SHAKE_HEADROOM = 0.028;

/**
 * The most `cam.zoom` can ever be.
 *
 * The punch is a spring (`stiffness 190, damping 19`) driven by an impulse, and
 * the largest impulse in `TUNE` is 0.14. `prompt.ts` records the matching
 * undershoot, 0.990, for the same spring. `arena.test.ts` runs the real camera
 * and holds it against this, so the layout reserves a number that is checked
 * rather than believed.
 */
export const ZOOM_PEAK = 1.008;

/** The board's aspect: one axis is exactly 1, the other is the frame's ratio. */
export type Aspect = { x: number; y: number };

/**
 * The board: half-extents and corner radius, in world units.
 *
 * Named `Board` and not `Rect` because `game-chrome` exports a `Rect` of its own
 * (x/y/w/h, for the host's chrome squares) and a file that reads both must not
 * have to guess which one it is holding.
 */
export type Board = { a: number; b: number; r: number };

/** The board at a given short half-extent (`world.arenaR`) and aspect. */
export function arenaBoard(short: number, aspect: Aspect): Board {
  return { a: short * aspect.x, b: short * aspect.y, r: short * CORNER_FRACTION };
}

/**
 * How far the rim's outermost ink reaches beyond the rim line, in pixels.
 *
 * Mirrors `scene.ts: drawRim` exactly — the stroke straddles the line by half its
 * width, the polyps ride `POLYP_OUT` outside it with half a sprite beyond that —
 * plus the bounded shake, which translates all of it. The soft halo is
 * deliberately not here: it is a radial gradient that has faded out before it
 * reaches its own edge, and it is not something a child can steer into.
 */
export function rimReach(scale: number): number {
  const S = scale * ZOOM_PEAK;
  const stroke = Math.max(2.5, S * (0.014 + 0.016)) / 2;
  const polyps = S * (POLYP_OUT + 0.016 * 1.4 * 0.5);
  return Math.max(stroke, polyps) + scale * SHAKE_HEADROOM;
}

/**
 * The half-extent a board may have, given the room it has and what sits outside it.
 *
 * `ZOOM_PEAK` divides rather than multiplies because the camera's punch scales the
 * whole scene about the board's own centre: a board laid out flush at rest slides
 * its top edge `halfExtent × (zoom − 1)` upward on the frame the punch peaks, which
 * on a phone is a pixel and a half of lethal rim under the host's back button. It
 * costs eight tenths of one percent of the board to be right about it.
 */
function halfExtent(room: number, reach: number): number {
  return Math.max(1, (room / 2 - reach) / ZOOM_PEAK);
}

/**
 * The band across the top of the safe box that the host's chrome sits in.
 *
 * Read off `hostChrome.ts` rather than copied from it, so the day the host moves
 * its controls this moves with them. Only chrome in the top third counts toward a
 * TOP band; anything else would be reserved from the wrong edge, and
 * `arena.test.ts` asserts the rim clears every chrome rect wherever they are, so
 * a host that grows a bottom control fails loudly here instead of quietly on a
 * device.
 */
export function topChromeBand(viewportW: number, safeY: number, safeH: number, insets: Insets): number {
  let band = 0;
  for (const c of chromeRects(viewportW, insets)) {
    if (c.y - safeY > safeH / 3) continue;
    band = Math.max(band, c.y + c.h - safeY);
  }
  return Math.max(0, Math.min(band, safeH * 0.5));
}

export type Frame = {
  /** Pixels per world unit. Isotropic: the stretch is in the board, never the transform. */
  scale: number;
  aspect: Aspect;
  /** The board's centre, relative to the safe box's origin. */
  cx: number;
  cy: number;
  /** The reserve this frame was solved for, in pixels. */
  reach: number;
};

/**
 * Fit the board to a safe box with a chrome band across its top.
 *
 * The reserve depends on the scale and the scale depends on the reserve, so it is
 * a fixed point rather than an expression. The map contracts by about 0.05 per
 * round — the reserve is a twentieth of the scale — so six rounds are past
 * machine precision, and `arena.test.ts` checks the answer by feeding it back in.
 */
export function arenaFrame(safeW: number, safeH: number, chromeBand: number): Frame {
  const boxW = Math.max(2, safeW);
  const boxH = Math.max(2, safeH - chromeBand);
  let reach = 0;
  let hw = boxW / 2;
  let hh = boxH / 2;
  for (let i = 0; i < 6; i++) {
    hw = halfExtent(boxW, reach);
    hh = halfExtent(boxH, reach);
    reach = rimReach(Math.min(hw, hh));
  }
  const scale = Math.min(hw, hh);
  return {
    scale,
    aspect: { x: hw / scale, y: hh / scale },
    // The centre is placed so the board's WIDEST frame — punched to `ZOOM_PEAK`,
    // shaken to the clamp, with the rim's ink on the outside of that — lands
    // exactly on the safe box, and on the host's band at the top.
    cx: reach + hw * ZOOM_PEAK,
    cy: chromeBand + reach + hh * ZOOM_PEAK,
    reach,
  };
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

/**
 * Where the rim is from here, which way it faces, and how far away it is.
 *
 * Closed form, in three cases. Fold the query into the first quadrant; then it is
 * either past both straight runs (the corner arc, so the answer is radial about
 * that corner's centre) or past at most one of them (a straight side, so the
 * answer is axis-aligned and the nearer side wins).
 */
export function rimEdge(k: Board, px: number, py: number): Edge {
  const sx = px < 0 ? -1 : 1;
  const sy = py < 0 ? -1 : 1;
  const ax = Math.abs(px);
  const ay = Math.abs(py);
  const ix = k.a - k.r;
  const iy = k.b - k.r;
  const qx = ax - ix;
  const qy = ay - iy;

  if (qx > 0 && qy > 0) {
    const d = Math.hypot(qx, qy);
    // Dead on the corner's centre of curvature: every direction is equally near.
    const nx = d > 1e-12 ? qx / d : 1;
    const ny = d > 1e-12 ? qy / d : 0;
    return {
      x: sx * (ix + nx * k.r),
      y: sy * (iy + ny * k.r),
      nx: sx * nx,
      ny: sy * ny,
      gap: k.r - d,
    };
  }

  const dx = k.a - ax;
  const dy = k.b - ay;
  if (dx <= dy) return { x: sx * k.a, y: py, nx: sx, ny: 0, gap: dx };
  return { x: px, y: sy * k.b, nx: 0, ny: sy, gap: dy };
}

/** Is this point inside the vent at all? */
export function insideRim(k: Board, px: number, py: number): boolean {
  const qx = Math.max(0, Math.abs(px) - (k.a - k.r));
  const qy = Math.max(0, Math.abs(py) - (k.b - k.r));
  return Math.hypot(qx, qy) <= k.r;
}

/**
 * The nearest legal spot at least `margin` inside the rim.
 *
 * A point already deep enough is returned untouched; anything nearer (or outside)
 * is put on the inward normal at exactly `margin`. Every "keep this thing off the
 * wall" in the game goes through here, so a spawn, an orb bouncing off the edge
 * and a serpent thrown back by a wall hit all agree about where the wall is.
 *
 * Exact for any `margin` up to `k.r`: the rounded rect inset by `m` is the rounded
 * rect with half-extents `(a−m, b−m)` and corner radius `r−m`, and that stops
 * being true when the corners run out. `arena.test.ts` holds the corner radius at
 * the vent's floor against the largest margin the game asks for.
 */
export function pullInside(
  k: Board,
  px: number,
  py: number,
  margin: number,
): { x: number; y: number } {
  const e = rimEdge(k, px, py);
  if (e.gap >= margin) return { x: px, y: py };
  return { x: e.x - e.nx * margin, y: e.y - e.ny * margin };
}

/** The rim's length, in world units. */
export function rimPerimeter(k: Board): number {
  return 4 * (k.a - k.r) + 4 * (k.b - k.r) + 2 * Math.PI * k.r;
}

/**
 * Walk `n` points evenly spaced BY ARC LENGTH around the rim, with their normals.
 *
 * Evenly by arc length and not by angle, because there is no angle: the rim is
 * four straight runs and four quarter-circles, and a parameterisation that
 * bunched samples into the corners would make the glow crawl as the serpent
 * passed one. The walk starts at the middle of the right-hand side's lower half
 * and goes counter-clockwise; nothing depends on where it starts, because the
 * rim's heat is found by distance to the head's own point on the rim.
 *
 * Fills caller-owned arrays: this runs every frame and must not allocate.
 */
export function sampleRim(
  k: Board,
  n: number,
  outX: Float32Array,
  outY: Float32Array,
  outNX: Float32Array,
  outNY: Float32Array,
): void {
  const ix = k.a - k.r;
  const iy = k.b - k.r;
  const r = k.r;
  const arc = (Math.PI / 2) * r;
  const side = 2 * iy;
  const top = 2 * ix;
  const P = 2 * side + 2 * top + 4 * arc;
  const c0 = side;
  const c1 = c0 + arc;
  const c2 = c1 + top;
  const c3 = c2 + arc;
  const c4 = c3 + side;
  const c5 = c4 + arc;
  const c6 = c5 + top;
  for (let i = 0; i < n; i++) {
    const s = (i / n) * P;
    let x = 0;
    let y = 0;
    let nx = 0;
    let ny = 0;
    if (s < c0) {
      x = k.a;
      y = -iy + s;
      nx = 1;
    } else if (s < c1) {
      const a = (s - c0) / r;
      nx = Math.cos(a);
      ny = Math.sin(a);
      x = ix + nx * r;
      y = iy + ny * r;
    } else if (s < c2) {
      x = ix - (s - c1);
      y = k.b;
      ny = 1;
    } else if (s < c3) {
      const a = Math.PI / 2 + (s - c2) / r;
      nx = Math.cos(a);
      ny = Math.sin(a);
      x = -ix + nx * r;
      y = iy + ny * r;
    } else if (s < c4) {
      x = -k.a;
      y = iy - (s - c3);
      nx = -1;
    } else if (s < c5) {
      const a = Math.PI + (s - c4) / r;
      nx = Math.cos(a);
      ny = Math.sin(a);
      x = -ix + nx * r;
      y = -iy + ny * r;
    } else if (s < c6) {
      x = -ix + (s - c5);
      y = -k.b;
      ny = -1;
    } else {
      const a = 1.5 * Math.PI + (s - c6) / r;
      nx = Math.cos(a);
      ny = Math.sin(a);
      x = ix + nx * r;
      y = -iy + ny * r;
    }
    outX[i] = x;
    outY[i] = y;
    outNX[i] = nx;
    outNY[i] = ny;
  }
}
