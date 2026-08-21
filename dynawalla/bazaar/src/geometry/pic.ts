/**
 * Hankin's polygons-in-contact — one engine, three visual languages.
 *
 *   1. Tile the plane edge-to-edge with polygons of equal edge length.
 *   2. At the MIDPOINT of every edge, emit two rays into the tile at the
 *      contact angle to that edge.
 *   3. Propagate each ray until it meets another; the two terminate against
 *      each other in a mitre.
 *   4. The union of all segments is the pattern. Delete the tile outlines —
 *      they were scaffolding, exactly as they were for the craftsmen.
 *
 * Because every tile shares the same edge length and the same contact angle,
 * straps always meet across tile boundaries. That is the whole trick, and it
 * is why this is construction rather than wallpaper.
 *
 *   contactAngle 54° → the 5-fold girih family
 *   contactAngle 45° → the 8-fold khatem family
 *   contactAngle 60° → the 6- and 12-fold families
 */

export type Pt = { x: number; y: number };
export type Polygon = Pt[];
export interface Segment {
  a: Pt;
  b: Pt;
  /** Where this segment touches a tile edge, if it does. Used by the gate. */
  edgeAnchor?: Pt;
  /** Angle in degrees between the segment and the edge it springs from. */
  edgeAngle?: number;
}

const EPS = 1e-7;

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

interface Ray {
  o: Pt; // origin, an edge midpoint
  d: Pt; // unit direction, pointing into the tile
  edgeAngle: number; // degrees to the edge, signed positive
}

function polygonCentroid(p: Polygon): Pt {
  let x = 0;
  let y = 0;
  for (const q of p) {
    x += q.x;
    y += q.y;
  }
  return { x: x / p.length, y: y / p.length };
}

/** Intersection parameter of two rays, or null if they diverge. */
function raysMeet(a: Ray, b: Ray): { t: number; s: number; p: Pt } | null {
  const det = a.d.x * -b.d.y - a.d.y * -b.d.x;
  if (Math.abs(det) < EPS) return null;
  const rx = b.o.x - a.o.x;
  const ry = b.o.y - a.o.y;
  const t = (rx * -b.d.y - ry * -b.d.x) / det;
  const s = (a.d.x * ry - a.d.y * rx) / det;
  if (t <= EPS || s <= EPS) return null;
  return { t, s, p: { x: a.o.x + a.d.x * t, y: a.o.y + a.d.y * t } };
}

/**
 * Rays for one polygon: two per edge, at ±contactAngle to the edge, both
 * leaning into the tile.
 */
function raysFor(poly: Polygon, contactAngle: number): Ray[] {
  const c = polygonCentroid(poly);
  const rad = (contactAngle * Math.PI) / 180;
  const out: Ray[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i]!;
    const p1 = poly[(i + 1) % poly.length]!;
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const ex = p1.x - p0.x;
    const ey = p1.y - p0.y;
    const el = Math.hypot(ex, ey);
    if (el < EPS) continue;
    const ux = ex / el;
    const uy = ey / el;
    // Inward normal: pick the perpendicular that points at the centroid.
    let nx = -uy;
    let ny = ux;
    if (nx * (c.x - mid.x) + ny * (c.y - mid.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    // A ray at `contactAngle` to the edge is cos(a) along the edge and
    // sin(a) along the inward normal.
    const ca = Math.cos(rad);
    const sa = Math.sin(rad);
    out.push({
      o: mid,
      d: { x: ux * ca + nx * sa, y: uy * ca + ny * sa },
      edgeAngle: contactAngle,
    });
    out.push({
      o: mid,
      d: { x: -ux * ca + nx * sa, y: -uy * ca + ny * sa },
      edgeAngle: contactAngle,
    });
  }
  return out;
}

/**
 * The pattern for one tiling. Each returned pair of segments is a strap
 * running from one edge midpoint, through the mitre, to another.
 */
export function pic(tiling: Polygon[], contactAngle: number): Segment[] {
  const segments: Segment[] = [];
  for (const poly of tiling) {
    const rays = raysFor(poly, contactAngle);
    const n = rays.length;
    // Nearest-meeting candidates, greedily matched shortest-first. Where three
    // or more rays converge this resolves pairs in order of shortest path,
    // which is what the craftsmen's mitres do.
    const cands: { i: number; j: number; t: number; s: number; p: Pt }[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = rays[i]!;
        const b = rays[j]!;
        if (dist(a.o, b.o) < EPS) continue; // siblings off one midpoint
        const hit = raysMeet(a, b);
        if (!hit) continue;
        cands.push({ i, j, t: hit.t, s: hit.s, p: hit.p });
      }
    }
    cands.sort((p, q) => Math.max(p.t, p.s) - Math.max(q.t, q.s));
    const used = new Array<boolean>(n).fill(false);
    for (const c of cands) {
      if (used[c.i] || used[c.j]) continue;
      used[c.i] = true;
      used[c.j] = true;
      const a = rays[c.i]!;
      const b = rays[c.j]!;
      segments.push({
        a: { ...a.o },
        b: { ...c.p },
        edgeAnchor: { ...a.o },
        edgeAngle: a.edgeAngle,
      });
      segments.push({
        a: { ...b.o },
        b: { ...c.p },
        edgeAnchor: { ...b.o },
        edgeAngle: b.edgeAngle,
      });
    }
  }
  return segments;
}

/** Every edge midpoint of a tiling, deduplicated. Used by the gate. */
export function edgeMidpoints(tiling: Polygon[]): Pt[] {
  const seen = new Map<string, Pt>();
  for (const poly of tiling) {
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i]!;
      const p1 = poly[(i + 1) % poly.length]!;
      const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      seen.set(`${mid.x.toFixed(4)},${mid.y.toFixed(4)}`, mid);
    }
  }
  return [...seen.values()];
}

/** Transform helpers used by the tiling builders. */
export const rotate = (p: Pt, deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

export const translate = (p: Pt, dx: number, dy: number): Pt => ({
  x: p.x + dx,
  y: p.y + dy,
});

export const scalePoly = (poly: Polygon, k: number): Polygon =>
  poly.map((p) => ({ x: p.x * k, y: p.y * k }));

/** A regular n-gon of edge length `L`, centred at `c`, first vertex at `phase`. */
export function regular(n: number, L: number, c: Pt = { x: 0, y: 0 }, phase = 0): Polygon {
  const R = L / (2 * Math.sin(Math.PI / n));
  const out: Polygon = [];
  for (let i = 0; i < n; i++) {
    const a = ((phase + (360 / n) * i) * Math.PI) / 180;
    out.push({ x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) });
  }
  return out;
}

/** Signed area; positive is counter-clockwise in a y-down canvas frame. */
export function signedArea(poly: Polygon): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}
