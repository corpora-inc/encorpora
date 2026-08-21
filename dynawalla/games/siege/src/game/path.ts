/**
 * The lava channel. A serpentine polyline with rounded corners, resampled to a
 * dense arc-length table so an enemy's position is a single array lookup.
 *
 * Lanes sit on odd grid rows; the rows between them are the buildable plots, so
 * a well-placed tower covers the lane above AND the lane below. That is the
 * whole placement decision and it is legible without a word of tutorial.
 */
import { BOARD, CELL } from "./constants.ts";

export type Vec = { x: number; y: number };

const R = 62; // corner radius

/** lane rows 0,2,4,6,8 → y centres; connectors at column 7.5 / 1.5 alternating */
function waypoints(): Vec[] {
  const y = (row: number) => (row + 0.5) * CELL;
  const x = (col: number) => (col + 0.5) * CELL;
  return [
    { x: -70, y: y(0) },
    { x: x(7), y: y(0) },
    { x: x(7), y: y(2) },
    { x: x(1), y: y(2) },
    { x: x(1), y: y(4) },
    { x: x(7), y: y(4) },
    { x: x(7), y: y(6) },
    { x: x(1), y: y(6) },
    { x: x(1), y: y(8) },
    { x: BOARD / 2, y: y(8) },
  ];
}

function roundCorners(pts: Vec[], radius: number): Vec[] {
  const out: Vec[] = [pts[0] as Vec];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i] as Vec;
    const a = pts[i - 1] as Vec;
    const b = pts[i + 1] as Vec;
    const d1 = Math.hypot(p.x - a.x, p.y - a.y);
    const d2 = Math.hypot(b.x - p.x, b.y - p.y);
    const r = Math.min(radius, d1 / 2, d2 / 2);
    const u1 = { x: (a.x - p.x) / d1, y: (a.y - p.y) / d1 };
    const u2 = { x: (b.x - p.x) / d2, y: (b.y - p.y) / d2 };
    const s = { x: p.x + u1.x * r, y: p.y + u1.y * r };
    const e = { x: p.x + u2.x * r, y: p.y + u2.y * r };
    out.push(s);
    const STEPS = 9;
    for (let k = 1; k < STEPS; k++) {
      const t = k / STEPS;
      const mt = 1 - t;
      out.push({
        x: mt * mt * s.x + 2 * mt * t * p.x + t * t * e.x,
        y: mt * mt * s.y + 2 * mt * t * p.y + t * t * e.y,
      });
    }
    out.push(e);
  }
  out.push(pts[pts.length - 1] as Vec);
  return out;
}

export type PathData = {
  pts: readonly Vec[];
  /** cumulative arc length at each point */
  cum: readonly number[];
  length: number;
  /** where the forge core sits */
  core: Vec;
  /** where the rift spits enemies out */
  rift: Vec;
  at(s: number, out: Vec): Vec;
  /** unit tangent at arc length s */
  dirAt(s: number, out: Vec): Vec;
  /** shortest distance from a point to the channel centre line */
  distanceTo(x: number, y: number): number;
};

export function buildPath(): PathData {
  const pts = roundCorners(waypoints(), R);
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Vec;
    const b = pts[i] as Vec;
    cum.push((cum[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const length = cum[cum.length - 1] as number;

  const seek = (s: number): number => {
    // binary search the cumulative table
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if ((cum[mid] as number) <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  const at = (s: number, out: Vec): Vec => {
    const c = Math.max(0, Math.min(length, s));
    const i = seek(c);
    const a = pts[i] as Vec;
    const b = (pts[i + 1] ?? a) as Vec;
    const seg = (cum[i + 1] ?? (cum[i] as number)) - (cum[i] as number);
    const t = seg > 0 ? (c - (cum[i] as number)) / seg : 0;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    return out;
  };

  const dirAt = (s: number, out: Vec): Vec => {
    const c = Math.max(0, Math.min(length - 0.01, s));
    const i = seek(c);
    const a = pts[i] as Vec;
    const b = (pts[i + 1] ?? a) as Vec;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const m = Math.hypot(dx, dy) || 1;
    out.x = dx / m;
    out.y = dy / m;
    return out;
  };

  const distanceTo = (x: number, y: number): number => {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as Vec;
      const b = pts[i + 1] as Vec;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const d = Math.hypot(x - px, y - py);
      if (d < best) best = d;
    }
    return best;
  };

  const core = pts[pts.length - 1] as Vec;
  const rift = pts[0] as Vec;
  return { pts, cum, length, core, rift, at, dirAt, distanceTo };
}
