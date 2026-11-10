/**
 * Where the Pathways camera goes, as plain numbers: whether a skill is
 * already comfortably in view, and the view that frames a skill (with its
 * neighbours) or a region. No three.js here, so the decisions are testable.
 *
 * Distances are along the camera's view axis, in world units. Screen
 * positions are CSS pixels from the map's top-left corner.
 */
export type Vec3 = readonly [number, number, number];
export type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
export type View = { width: number; height: number };
/** The camera's own axes: `back` points from the target to the camera. */
export type Basis = { right: Vec3; up: Vec3; back: Vec3 };

/** Vertical field of view of the map's camera, in degrees. */
export const FOV = 40;
/** Height of the map toolbar plus its inset; nothing sits under it. */
export const TOOLBAR_CLEARANCE = 64;
/**
 * Where a selected skill sits comfortably: clear of the toolbar, the gesture
 * hint and the edges, with room for its centred name below it.
 */
export const SKILL_INSETS: Insets = {
  top: TOOLBAR_CLEARANCE + 16,
  right: 85,
  bottom: 85,
  left: 85,
};
/** A neighbour or a region's skill only needs to be visibly on screen. */
export const REGION_INSETS: Insets = {
  top: TOOLBAR_CLEARANCE + 16,
  right: 48,
  bottom: 56,
  left: 48,
};
/** Below this many pixels per world unit, skill names give way to area names. */
const NAMED_SCALE = 6.5;
/** A skill reads comfortably from this many pixels per world unit. */
const READABLE_SCALE = 7;
/** A framed skill is shown at about this scale, unless its neighbours need more room. */
const COMFORTABLE_SCALE = 15;

const tangent = Math.tan(((FOV / 2) * Math.PI) / 180);

/** Pixels per world unit at a depth in front of the camera. */
export function pixelsPerUnit(height: number, depth: number) {
  return height / (2 * tangent * depth);
}
/**
 * Skill names show when the camera is closer to its target than this; farther
 * out, the map names its areas. A taller map shows more, so it is farther.
 */
export function labelDistance(height: number) {
  return height / (2 * tangent * NAMED_SCALE);
}
/** Farther than this, a skill is too small to read. */
export function readableDepth(height: number) {
  return height / (2 * tangent * READABLE_SCALE);
}
/** How close a framing comes when nothing else needs the room. */
export function comfortableDepth(height: number) {
  return Math.min(
    readableDepth(height),
    Math.max(18, height / (2 * tangent * COMFORTABLE_SCALE)),
  );
}

/**
 * A skill is comfortably framed when it is in front of the camera, close
 * enough to read, and inside the safe area of the map. Then selecting it
 * leaves the camera alone.
 */
export function isFramed(
  node: { x: number; y: number; depth: number },
  view: View,
  insets: Insets = SKILL_INSETS,
) {
  if (!(node.depth > 0) || node.depth > readableDepth(view.height))
    return false;
  const [left, right] = span(view.width, insets.left, insets.right);
  const [top, bottom] = span(view.height, insets.top, insets.bottom);
  return node.x >= left && node.x <= right && node.y >= top && node.y <= bottom;
}

/** The usable stretch of one axis; a small map keeps at least its middle 40%. */
function span(size: number, start: number, end: number): [number, number] {
  const k = Math.min(1, (0.6 * size) / Math.max(1e-6, start + end));
  return [start * k, size - end * k];
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const minus = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

type Interval = [number, number];
/** Where the target may sit on each camera axis so that every point shows. */
function window(
  points: { r: number; u: number; b: number }[],
  distance: number,
  view: View,
  insets: Insets,
) {
  const tanH = (tangent * view.width) / view.height;
  const [left, right] = span(view.width, insets.left, insets.right);
  const [top, bottom] = span(view.height, insets.top, insets.bottom);
  // Normalised device coordinates of the safe area, as slopes.
  const xl = ((2 * left) / view.width - 1) * tanH,
    xr = ((2 * right) / view.width - 1) * tanH,
    yt = (1 - (2 * top) / view.height) * tangent,
    yb = (1 - (2 * bottom) / view.height) * tangent;
  const x: Interval = [-Infinity, Infinity],
    y: Interval = [-Infinity, Infinity];
  for (const p of points) {
    const depth = distance - p.b;
    if (depth <= 1) continue;
    x[0] = Math.max(x[0], p.r - xr * depth);
    x[1] = Math.min(x[1], p.r - xl * depth);
    y[0] = Math.max(y[0], p.u - yt * depth);
    y[1] = Math.min(y[1], p.u - yb * depth);
  }
  return { x, y, fits: x[0] <= x[1] && y[0] <= y[1] };
}
const middle = ([lo, hi]: Interval) =>
  Number.isFinite(lo) && Number.isFinite(hi)
    ? (lo + hi) / 2
    : Number.isFinite(lo)
      ? lo
      : Number.isFinite(hi)
        ? hi
        : 0;

/**
 * Where a skill that the camera moves to ends up: the middle of the map,
 * clear of the controls, so it reads as the subject of the view.
 */
export function centralInsets(view: View): Insets {
  return {
    top: Math.max(SKILL_INSETS.top, view.height * 0.3),
    right: Math.max(SKILL_INSETS.right, view.width * 0.28),
    bottom: Math.max(SKILL_INSETS.bottom, view.height * 0.25),
    left: Math.max(SKILL_INSETS.left, view.width * 0.28),
  };
}

/**
 * The closest view, between `near` and `far`, that shows every point. With
 * an `anchor`, the anchor always sits in `anchorInsets`, and when the points
 * can't all fit at `far` the nearest of them are kept in view. A `distance`
 * holds the zoom and only pans.
 */
export function fit({
  anchor,
  points,
  basis,
  view,
  near,
  far,
  distance,
  anchorInsets = centralInsets(view),
  insets = REGION_INSETS,
}: {
  anchor?: Vec3;
  points: readonly Vec3[];
  basis: Basis;
  view: View;
  near: number;
  far: number;
  distance?: number;
  anchorInsets?: Insets;
  insets?: Insets;
}) {
  const origin: Vec3 = anchor ?? [
    points.reduce((s, p) => s + p[0], 0) / Math.max(1, points.length),
    points.reduce((s, p) => s + p[1], 0) / Math.max(1, points.length),
    points.reduce((s, p) => s + p[2], 0) / Math.max(1, points.length),
  ];
  const local = (p: Vec3) => {
    const d = minus(p, origin);
    return {
      r: dot(d, basis.right),
      u: dot(d, basis.up),
      b: dot(d, basis.back),
    };
  };
  // Nearest first: the ones kept when not all fit.
  const others = points
    .map(local)
    .sort((a, b) => Math.hypot(a.r, a.u) - Math.hypot(b.r, b.u));
  const solve = (d: number, list = others) => {
    const region = window(list, d, view, insets);
    if (!anchor) return region;
    const own = window([{ r: 0, u: 0, b: 0 }], d, view, anchorInsets);
    const x: Interval = [
      Math.max(region.x[0], own.x[0]),
      Math.min(region.x[1], own.x[1]),
    ];
    const y: Interval = [
      Math.max(region.y[0], own.y[0]),
      Math.min(region.y[1], own.y[1]),
    ];
    return { x, y, fits: x[0] <= x[1] && y[0] <= y[1] };
  };
  let d = distance ?? far;
  if (distance === undefined && solve(near).fits) d = near;
  else if (distance === undefined && solve(far).fits) {
    let lo = near,
      hi = far;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (solve(mid).fits) hi = mid;
      else lo = mid;
    }
    d = hi;
  }
  let at = solve(d);
  let complete = at.fits;
  if (!at.fits && anchor) {
    // Keep the nearest neighbours that fit around the anchor.
    const kept: typeof others = [];
    for (const p of others) if (solve(d, [...kept, p]).fits) kept.push(p);
    at = solve(d, kept);
  }
  // Everything fits: centre it. A region too big to fit centres on where
  // most of it is (its centroid, the origin) rather than on its outliers.
  const cx = at.fits ? middle(at.x) : 0;
  const cy = at.fits ? middle(at.y) : 0;
  const target: Vec3 = [
    origin[0] + cx * basis.right[0] + cy * basis.up[0],
    origin[1] + cx * basis.right[1] + cy * basis.up[1],
    origin[2] + cx * basis.right[2] + cy * basis.up[2],
  ];
  return { target, distance: d, complete };
}

/**
 * The view that frames a selected skill and, where they fit, the skills it
 * builds on and leads to. A readable zoom is kept (the camera only pans); a
 * map zoomed out too far to read is zoomed in. Never zooms out.
 */
export function frameSkill({
  node,
  neighbors,
  basis,
  view,
  distance,
}: {
  node: Vec3;
  neighbors: readonly Vec3[];
  basis: Basis;
  view: View;
  /** The camera's current distance to its target: the map's zoom. */
  distance: number;
}) {
  const far = readableDepth(view.height);
  return fit({
    anchor: node,
    points: neighbors,
    basis,
    view,
    near: comfortableDepth(view.height),
    far,
    distance: distance <= far ? distance : undefined,
  });
}

/** Ease in and out: a glide that starts and settles gently. */
export function ease(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * How long a glide takes: 400 ms for a small move, up to 700 ms for one that
 * crosses the screen or changes the zoom a lot.
 */
export function glideDuration(
  /** Target travel, in screen heights at the start. */
  travel: number,
  /** Distance ratio, end over start. */
  zoom: number,
) {
  const effort = travel + Math.abs(Math.log(Math.max(1e-6, zoom))) * 0.6;
  return Math.round(400 + 300 * Math.min(1, effort / 1.6));
}
