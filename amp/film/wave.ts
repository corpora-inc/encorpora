/**
 * The circle and the wave: a point turning on a circle, the angle it has swept,
 * and a graph traced only as far as a moving point. Pure geometry in the
 * figure's own units (y up, degrees counterclockwise from the positive x
 * direction); the stage maps it to pixels.
 */
export type Pt = [number, number];

/** Where a point on a circle is, `deg` degrees counterclockwise from "three o'clock". */
export function onCircle(center: Pt, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
}

/** The point straight below (or above) a point on the x axis: its foot. */
export function foot(p: Pt): Pt {
  return [p[0], 0];
}

/**
 * The angles, in degrees, that outline the sector swept from 0 to `deg`:
 * 0, step, 2·step, ..., ending exactly on the swept angle. A turn past 360
 * is a full disc; a negative sweep is nothing.
 */
export function sectorAngles(deg: number, step = 3.75): number[] {
  const end = Math.min(360, Math.max(0, deg));
  const out: number[] = [];
  for (let a = 0; a < end; a += step) out.push(a);
  out.push(end);
  return out;
}

/** Where a label reading the swept angle sits: on the bisector, as a direction in degrees. */
export function sweepLabelAngle(deg: number): number {
  return Math.min(360, Math.max(0, deg)) / 2;
}

/**
 * The x range a graph is drawn over: its own `from`/`to`, the view, and no
 * farther than the point it is traced up to. Null when nothing is left.
 */
export function traceRange(from: number | undefined, to: number | undefined, view: [number, number], uptoX?: number): [number, number] | null {
  const x0 = Math.max(from ?? -Infinity, view[0]);
  const x1 = Math.min(to ?? Infinity, view[1], uptoX ?? Infinity);
  return x1 > x0 ? [x0, x1] : null;
}

/** The x axis's span inside the view, kept to `xrange` when the axis should not run under something else (a circle beside the graph). */
export function axisSpan(view: [number, number], xrange?: [number, number]): [number, number] | null {
  const a = Math.max(view[0], xrange?.[0] ?? -Infinity), b = Math.min(view[1], xrange?.[1] ?? Infinity);
  return b > a ? [a, b] : null;
}

/** The value of a glided quantity at time t: its start, then each glide in order, eased. */
export function glided(start: number, glides: { t0: number; dur: number; from: number; to: number }[], t: number, ease: (u: number) => number): number {
  let v = start;
  for (const g of glides) {
    if (t < g.t0) continue;
    v = g.from + (g.to - g.from) * ease((t - g.t0) / g.dur);
  }
  return v;
}
