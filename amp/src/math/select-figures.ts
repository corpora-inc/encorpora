import type { Element, Scene } from "./scene/spec";
import { sceneSchema } from "./scene/spec";

/**
 * Lettered panels for "select every figure that ..." families. Each panel is a
 * list of scene elements drawn around its own origin; the panels sit on a grid
 * and a bold letter under each names it. Geometry is exact: the caller
 * computes every statement's truth from the same coordinates it draws.
 */
export type Pt = readonly [number, number];

export function shift(el: Element, dx: number, dy: number): Element {
  const mv = (p: Pt): [number, number] => [p[0] + dx, p[1] + dy];
  switch (el.type) {
    case "polygon":
    case "polyline":
      return { ...el, points: el.points.map((p) => mv(p)) };
    case "segment":
    case "arrow":
      return { ...el, from: mv(el.from), to: mv(el.to) };
    case "arc":
    case "circle":
      return { ...el, center: mv(el.center) };
    case "text":
    case "point":
    case "tick":
      return { ...el, at: mv(el.at) };
    case "rect":
      return { ...el, at: mv(el.at) };
    case "solid":
    case "isoSolid": {
      const at = el.at ?? [0, 0];
      return { ...el, at: mv(at as Pt) };
    }
    default:
      throw new Error(`Cannot place a ${el.type} in a panel`);
  }
}

export interface PanelSpec {
  letter: string;
  elements: Element[];
}
export function panelScene(o: {
  title: string;
  panels: PanelSpec[];
  columns: number;
  cell: [number, number];
  width?: number;
  maxHeight?: number;
  /** Height reserved under each figure for its letter, in scene units. */
  band?: number;
}): Scene {
  const [cw, ch] = o.cell;
  const band = o.band ?? 1.5;
  const rows = Math.ceil(o.panels.length / o.columns);
  const elements: Element[] = [];
  o.panels.forEach((p, i) => {
    const col = i % o.columns;
    const row = Math.floor(i / o.columns);
    const cx = cw * (col + 0.5);
    const cy = ch * (rows - row - 0.5);
    for (const el of p.elements) elements.push(shift(el, cx, cy + band / 2));
    elements.push({
      type: "text",
      id: `label${p.letter}`,
      at: [cx, cy - ch / 2 + 0.15],
      text: p.letter,
      font: "sans",
      size: "md",
      bold: true,
      align: [0, 1],
    });
  });
  return sceneSchema.parse({
    v: 1,
    title: o.title,
    width: o.width ?? 340,
    maxHeight: o.maxHeight ?? 360,
    elements,
  });
}

/** A rectangular prism in isometric view with its three edges labeled in
 * centimeters, drawn from its true edge lengths at `scale` units per cm. */
export function isoBox(
  l: number,
  w: number,
  h: number,
  scale: number,
): Element[] {
  const C = Math.sqrt(3) / 2;
  const at = (x: number, y: number, z: number): [number, number] => [
    (x - y) * C * scale,
    (z - (x + y) / 2) * scale,
  ];
  // centre the drawing on its bounding box
  const xs = [at(0, w, 0)[0], at(l, 0, 0)[0]];
  const ys = [at(l, w, 0)[1], at(0, 0, h)[1]];
  const dx = -(Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = -(Math.min(...ys) + Math.max(...ys)) / 2;
  const P = (x: number, y: number, z: number): [number, number] => {
    const q = at(x, y, z);
    return [q[0] + dx, q[1] + dy];
  };
  const face = (
    pts: [number, number][],
    fill: "accent-fill" | "paper",
  ): Element => ({
    type: "polygon",
    points: pts,
    stroke: "ink",
    width: 2,
    fill,
  });
  const label = (
    text: string,
    anchor: [number, number],
    align: [-1 | 0 | 1, -1 | 0 | 1],
    offset: [number, number],
  ): Element => ({
    type: "text",
    at: anchor,
    text,
    font: "sans",
    size: "md",
    align,
    offset,
  });
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  return [
    face([P(0, 0, h), P(l, 0, h), P(l, w, h), P(0, w, h)], "accent-fill"),
    face([P(l, 0, 0), P(l, w, 0), P(l, w, h), P(l, 0, h)], "paper"),
    face([P(0, w, 0), P(l, w, 0), P(l, w, h), P(0, w, h)], "paper"),
    label(`${l} cm`, mid(P(0, w, 0), P(l, w, 0)), [1, -1], [-2, 3]),
    label(`${w} cm`, mid(P(l, 0, 0), P(l, w, 0)), [-1, -1], [2, 3]),
    label(`${h} cm`, mid(P(0, w, 0), P(0, w, h)), [1, 0], [-4, 0]),
  ];
}

export const poly = (
  points: readonly Pt[],
  extra: Partial<{ fill: "accent-fill" | "none"; width: number }> = {},
): Element => ({
  type: "polygon",
  points: points.map((p) => [p[0], p[1]] as [number, number]),
  stroke: "ink",
  width: extra.width ?? 2,
  fill: extra.fill ?? "accent-fill",
});

/** Direction of side i of a closed polygon. */
export const sides = (pts: readonly Pt[]): Pt[] =>
  pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return [q[0] - p[0], q[1] - p[1]] as const;
  });
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
/** Angle in degrees between two undirected lines, in [0, 90]. */
export const lineAngle = (a: Pt, b: Pt) => {
  const t =
    (Math.atan2(Math.abs(cross(a, b)), Math.abs(dot(a, b))) * 180) / Math.PI;
  return t;
};
/** A pair of sides that are exactly parallel (and not on one line). */
export function hasParallelSides(pts: readonly Pt[]): boolean {
  const s = sides(pts);
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      if (cross(s[i]!, s[j]!) !== 0) continue;
      const d: Pt = [pts[j]![0] - pts[i]![0], pts[j]![1] - pts[i]![1]];
      if (cross(s[i]!, d) !== 0) return true;
    }
  return false;
}
/** A pair of sides that meet at a right angle or are perpendicular lines. */
export function hasPerpendicularSides(pts: readonly Pt[]): boolean {
  const s = sides(pts);
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++)
      if (dot(s[i]!, s[j]!) === 0) return true;
  return false;
}
/** No pair of sides is almost parallel or almost perpendicular without being
 * exactly so: the drawing is unambiguous to the eye. */
export function unambiguousSides(pts: readonly Pt[], margin = 10): boolean {
  const s = sides(pts);
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      const t = lineAngle(s[i]!, s[j]!);
      const exactPar = cross(s[i]!, s[j]!) === 0;
      const exactPerp = dot(s[i]!, s[j]!) === 0;
      if (!exactPar && t < margin) return false;
      if (!exactPerp && Math.abs(90 - t) < margin) return false;
    }
  return true;
}

/** Rotate by a multiple of 90 degrees and optionally mirror, exactly. */
export function transform(
  pts: readonly Pt[],
  quarter: number,
  mirror: boolean,
): Pt[] {
  return pts.map(([x0, y0]) => {
    let x = mirror ? -x0 : x0;
    let y = y0;
    for (let k = 0; k < quarter; k++) [x, y] = [-y, x];
    return [x, y] as const;
  });
}
