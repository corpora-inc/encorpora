import type { Element, InkRole, Point } from "./scene/spec";
import { typeset } from "./scene/type";

/**
 * Label placement for the proof figures (parallelogram and AA criterion).
 * The scene layout keeps labels clear of components' strokes, but the
 * primitive segments, polygons and arcs these figures draw are not
 * obstacles to it, so each label's offset is chosen here: the first
 * position, nearest the preferred direction, whose box keeps clear of every
 * stroke, every dot and every label placed before it.
 *
 * Offsets are pixels and the drawing is in math units, so the check uses
 * the smallest scale the figure is drawn at: the compact phone width (288 px)
 * with room for labels outside the drawing. A label beside a stroke through
 * its own anchor is clear at every scale (both distances are pixels); a
 * label beside a farther stroke only gains room at a larger scale.
 */

export type Stroke = readonly [Point, Point];
/** A stroke drawn in screen pixels around a math point (a congruence tick):
 * its middle, its screen direction and half its length. */
export interface PixelStroke {
  at: Point;
  dir: readonly [number, number];
  half: number;
}
export interface LabelSpec {
  id: string;
  text: string;
  at: Point;
  /** The preferred direction from the anchor, in math axes (y up). */
  out: Point;
  font?: "math" | "sans";
  size?: "sm" | "md" | "lg";
  bold?: boolean;
  color?: InkRole;
  halo?: boolean;
}
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Chords of an arc, for collision checks. */
export function arcStrokes(
  center: Point,
  r: number,
  from: number,
  to: number,
  n = 8,
): Stroke[] {
  const at = (deg: number): Point => [
    center[0] + r * Math.cos((deg * Math.PI) / 180),
    center[1] + r * Math.sin((deg * Math.PI) / 180),
  ];
  return Array.from({ length: n }, (_, i): Stroke => [
    at(from + ((to - from) * i) / n),
    at(from + ((to - from) * (i + 1)) / n),
  ]);
}
/** The edges of a polyline (closed: a polygon). */
export function polyStrokes(
  points: readonly Point[],
  closed: boolean,
): Stroke[] {
  const out: Stroke[] = [];
  for (let i = 0; i + 1 < points.length; i++)
    out.push([points[i]!, points[i + 1]!]);
  if (closed && points.length > 2)
    out.push([points[points.length - 1]!, points[0]!]);
  return out;
}
/** Strokes of the elements a figure drew: segments, polylines, polygons
 * and arcs in math units, ticks in pixels. Text and points are skipped. */
export function strokesOf(elements: readonly Element[]): {
  strokes: Stroke[];
  pixels: PixelStroke[];
  dots: Point[];
} {
  const strokes: Stroke[] = [];
  const pixels: PixelStroke[] = [];
  const dots: Point[] = [];
  for (const e of elements) {
    if (e.type === "segment") strokes.push([e.from as Point, e.to as Point]);
    else if (e.type === "polyline")
      strokes.push(...polyStrokes(e.points as Point[], !!e.closed));
    else if (e.type === "polygon")
      strokes.push(...polyStrokes(e.points as Point[], true));
    else if (e.type === "arc")
      strokes.push(...arcStrokes(e.center as Point, e.r, e.from, e.to));
    else if (e.type === "tick") {
      const l = Math.hypot(e.dir[0], e.dir[1]) || 1;
      pixels.push({
        at: e.at as Point,
        dir: [e.dir[0] / l, e.dir[1] / l],
        half: e.length / 2,
      });
    } else if (e.type === "point") dots.push(e.at as Point);
  }
  return { strokes, pixels, dots };
}

function hits(x1: number, y1: number, x2: number, y2: number, b: Box) {
  let t0 = 0,
    t1 = 1;
  const dx = x2 - x1,
    dy = y2 - y1;
  for (const [p, q] of [
    [-dx, x1 - b.x0],
    [dx, b.x1 - x1],
    [-dy, y1 - b.y0],
    [dy, b.y1 - y1],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}
const overlaps = (a: Box, b: Box) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const grow = (b: Box, g: number): Box => ({
  x0: b.x0 - g,
  y0: b.y0 - g,
  x1: b.x1 + g,
  y1: b.y1 + g,
});
const turn = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
};

/** Text elements for the labels, in order, each at its first clear spot. */
export function placeLabels(
  labels: readonly LabelSpec[],
  drawn: { strokes: Stroke[]; pixels: PixelStroke[]; dots: Point[] },
  /** The drawing's extent in math units (labels excluded). */
  extent: { w: number; h: number },
): Element[] {
  // The compact width is 288 px (4 px padding each side); labels outside
  // the drawing shrink it further, so take a smaller scale still.
  const s = 0.8 * Math.min(280 / extent.w, 312 / extent.h);
  const px = ([x, y]: Point): [number, number] => [x * s, -y * s];
  const segments = [
    ...drawn.strokes.map(([a, b]) => [...px(a), ...px(b)] as const),
    ...drawn.pixels.map((t) => {
      const [x, y] = px(t.at);
      return [
        x - t.dir[0] * t.half,
        y - t.dir[1] * t.half,
        x + t.dir[0] * t.half,
        y + t.dir[1] * t.half,
      ] as const;
    }),
  ];
  const dots = drawn.dots.map((d) => {
    const [x, y] = px(d);
    return { x0: x - 4, y0: y - 4, x1: x + 4, y1: y + 4 };
  });
  const placed: Box[] = [];
  const out: Element[] = [];
  const angles = Array.from({ length: 36 }, (_, i) => (i * Math.PI) / 18);
  for (const l of labels) {
    const t = typeset(l.text, l.font ?? "math", l.size ?? "md", !!l.bold);
    const w = t.width,
      h = t.ascent + t.descent;
    const [ax, ay] = px(l.at);
    const want = Math.atan2(-l.out[1], l.out[0]);
    const order = [...angles].sort((a, b) => turn(a, want) - turn(b, want));
    const clear = (b: Box) =>
      !segments.some((sg) => hits(sg[0], sg[1], sg[2], sg[3], grow(b, 3))) &&
      !dots.some((d) => overlaps(d, grow(b, 2))) &&
      !placed.some((o) => overlaps(o, grow(b, 4)));
    let chosen: { dx: number; dy: number; box: Box } | null = null;
    let fallback: { dx: number; dy: number; box: Box } | null = null;
    for (const gap of [3, 7, 12, 18, 26]) {
      for (const th of order) {
        const ux = Math.cos(th),
          uy = Math.sin(th);
        const edge = Math.min(
          Math.abs(ux) > 1e-9 ? w / 2 / Math.abs(ux) : Infinity,
          Math.abs(uy) > 1e-9 ? h / 2 / Math.abs(uy) : Infinity,
        );
        const d = edge + gap;
        const dx = ux * d,
          dy = uy * d;
        const box = {
          x0: ax + dx - w / 2,
          y0: ay + dy - h / 2,
          x1: ax + dx + w / 2,
          y1: ay + dy + h / 2,
        };
        if (!fallback) fallback = { dx, dy, box };
        if (clear(box)) {
          chosen = { dx, dy, box };
          break;
        }
      }
      if (chosen) break;
    }
    const at = chosen ?? fallback!;
    placed.push(at.box);
    out.push({
      type: "text",
      id: l.id,
      at: l.at,
      text: l.text,
      font: l.font ?? "math",
      ...(l.size ? { size: l.size } : {}),
      ...(l.bold ? { bold: true } : {}),
      ...(l.color ? { color: l.color } : {}),
      ...(l.halo ? { halo: true } : {}),
      align: [0, 0],
      offset: [Math.round(at.dx * 10) / 10, Math.round(at.dy * 10) / 10],
    });
  }
  return out;
}

/** The extent of a set of points, in math units. */
export function extentOf(points: readonly Point[]) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  return {
    w: Math.max(...xs) - Math.min(...xs) || 1,
    h: Math.max(...ys) - Math.min(...ys) || 1,
  };
}
