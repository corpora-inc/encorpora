import type { SemanticFigure } from "../math/contracts";
import { sweep } from "../math/geometry-models";

/** Exact layouts for the angle and solid figures, in SVG coordinates (y down).
 * Shared by the practice figure, the lesson animations and the printed lessons. */
export type Point = { x: number; y: number };
export type Label = Point & { text: string; width: number; size?: number };
type RayFigure = Extract<SemanticFigure, { kind: "angle-rays" }>;
type TriangleFigure = Extract<SemanticFigure, { kind: "triangle-angles" }>;
type ParallelFigure = Extract<SemanticFigure, { kind: "parallel-transversal" }>;
type SolidFigure = Extract<SemanticFigure, { kind: "solid-section" }>;

export const FONT = 17;
/** The asked-for angle is marked "?" or "x°"; every other label is a given. */
export const isUnknown = (text: string | null) => text === "?" || text === "x°";
const rad = (d: number) => (d * Math.PI) / 180;
/** A direction in degrees (counterclockwise from rightward) as an SVG vector. */
export const dir = (d: number): Point => ({
  x: Math.cos(rad(d)),
  y: -Math.sin(rad(d)),
});
const add = (p: Point, v: Point, k = 1): Point => ({
  x: p.x + v.x * k,
  y: p.y + v.y * k,
});
/** Conservative Arial advance widths, so labels never collide with lines. */
export function textWidth(text: string, size = FONT) {
  let em = 0;
  for (const ch of text)
    em += /[()]/.test(ch)
      ? 0.36
      : ch === " "
        ? 0.3
        : ch === "°"
          ? 0.42
          : /[−+=]/.test(ch)
            ? 0.6
            : /[A-Z]/.test(ch)
              ? 0.68
              : 0.58;
  return em * size;
}
/** Counterclockwise arc around `c` from direction d1 through `s` degrees. */
export function arcPath(c: Point, r: number, d1: number, s: number) {
  const a = add(c, dir(d1), r),
    b = add(c, dir(d1 + s), r);
  return `M${f(a.x)} ${f(a.y)} A${r} ${r} 0 ${s > 180 ? 1 : 0} 0 ${f(b.x)} ${f(b.y)}`;
}
/** The right-angle square between directions d1 and d1 + 90. */
export function squarePath(c: Point, size: number, d1: number) {
  const a = add(c, dir(d1), size),
    b = add(a, dir(d1 + 90), size),
    e = add(c, dir(d1 + 90), size);
  return `M${f(a.x)} ${f(a.y)} L${f(b.x)} ${f(b.y)} L${f(e.x)} ${f(e.y)}`;
}
export const f = (n: number) => String(Math.round(n * 10) / 10);

/** Place a label inside the angle from d1 through s, clear of both sides. */
export function angleLabel(
  c: Point,
  d1: number,
  s: number,
  text: string,
  minR: number,
  maxR = 120,
): Label {
  const size = text.length > 6 ? 15 : FONT;
  const width = textWidth(text, size),
    half = rad(s / 2);
  let r = minR;
  for (const d of [d1, d1 + s]) {
    const n = { x: Math.sin(rad(d)), y: Math.cos(rad(d)) };
    const extent = (width / 2) * Math.abs(n.x) + (size / 2) * Math.abs(n.y);
    if (s < 180) r = Math.max(r, (extent + 5) / Math.sin(half));
  }
  const p = add(c, dir(d1 + s / 2), Math.min(r, maxR));
  return { ...p, text, width, size };
}
type Box = { minX: number; minY: number; maxX: number; maxY: number };
function fit(points: Point[], labels: Label[], pad = 12, minWidth = 300) {
  const b: Box = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  const take = (x: number, y: number) => {
    b.minX = Math.min(b.minX, x);
    b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y);
    b.maxY = Math.max(b.maxY, y);
  };
  for (const p of points) take(p.x, p.y);
  for (const l of labels) {
    take(l.x - l.width / 2, l.y - FONT / 2);
    take(l.x + l.width / 2, l.y + FONT / 2);
  }
  let width = b.maxX - b.minX + 2 * pad;
  const extra = Math.max(0, minWidth - width) / 2;
  width += 2 * extra;
  return `${f(b.minX - pad - extra)} ${f(b.minY - pad)} ${f(width)} ${f(b.maxY - b.minY + 2 * pad)}`;
}

// ——— Rays from one vertex ———

export function rayLayout(figure: RayFigure) {
  const c = { x: 0, y: 0 };
  // Nested marks get larger arcs so each stays readable.
  const span = (m: RayFigure["marks"][number]) =>
    sweep(figure.rays[m.from]!, figure.rays[m.to]!);
  const inside = (outer: RayFigure["marks"][number], d: number) =>
    sweep(figure.rays[outer.from]!, d) <= span(outer);
  const marks = figure.marks.map((m) => {
    const d1 = figure.rays[m.from]!,
      s = span(m);
    const depth = figure.marks.filter(
      (o) =>
        o !== m &&
        !o.right &&
        span(o) < s &&
        inside(m, figure.rays[o.from]!) &&
        inside(m, figure.rays[o.to]!),
    ).length;
    const r = 30 + depth * 34;
    return {
      ...m,
      d1,
      s,
      path: m.right ? squarePath(c, 16, d1) : arcPath(c, r, d1, s),
      label: m.right ? null : angleLabel(c, d1, s, m.label, r + 18),
      unknown: isUnknown(m.label),
    };
  });
  // Rays reach past every angle label, so point letters never crowd a label.
  const R = Math.max(
    96,
    ...marks.map((m) =>
      m.label ? Math.hypot(m.label.x, m.label.y) + m.label.width / 2 + 10 : 0,
    ),
  );
  const rays = figure.rays.map((d, i) => ({
    end: add(c, dir(d), R),
    label: {
      ...add(c, dir(d), R + 16),
      text: figure.points[i]!,
      width: textWidth(figure.points[i]!),
    },
  }));
  // The vertex letter sits in the widest gap between neighbouring rays.
  const sorted = [...figure.rays].sort((a, b) => a - b);
  const marked = (d: number, s: number) =>
    marks.some(
      (m) => sweep(m.d1, d) < m.s && sweep(m.d1, d + s) <= m.s && s > 0,
    );
  let gap = { d: 0, s: -1, free: false };
  sorted.forEach((d, i) => {
    const s = sweep(d, sorted[(i + 1) % sorted.length]!) || 360;
    const free = !marked(d, s);
    if ((free && !gap.free) || (free === gap.free && s > gap.s))
      gap = { d, s, free };
  });
  const vertex = gap.free
    ? { ...angleLabel(c, gap.d, gap.s, figure.vertex, 18, 60), size: FONT }
    : { ...angleLabel(c, gap.d, gap.s, figure.vertex, 13, 22), size: FONT };
  const labels = [
    vertex,
    ...rays.map((r) => r.label),
    ...marks.flatMap((m) => (m.label ? [m.label] : [])),
  ];
  return {
    center: c,
    rays,
    marks,
    vertex,
    viewBox: fit([c, ...rays.map((r) => r.end)], labels),
  };
}

// ——— Triangle with an optional exterior angle at B ———

export function triangleLayout(figure: TriangleFigure, size = 290) {
  const [A, B, C] = figure.angles;
  // Law of sines: each side is proportional to the sine of the opposite angle.
  const ab = Math.sin(rad(C)),
    ac = Math.sin(rad(B));
  const raw = [
    { x: 0, y: 0 },
    { x: ab, y: 0 },
    { x: ac * Math.cos(rad(A)), y: -ac * Math.sin(rad(A)) },
  ];
  const minX = Math.min(...raw.map((p) => p.x)),
    maxX = Math.max(...raw.map((p) => p.x), figure.exterior ? ab * 1.45 : 0);
  const k =
    size / Math.max(maxX - minX, -Math.min(...raw.map((p) => p.y)) * 1.3);
  const P = raw.map((p) => ({ x: (p.x - minX) * k, y: p.y * k }));
  const D = figure.exterior
    ? { x: P[1]!.x + Math.max(ab * k * 0.45, 70), y: 0 }
    : null;
  // Interior angles: at A from AB to AC; at B from BC to BA; at C from CA to CB.
  const heading = (p: Point, q: Point) =>
    (Math.atan2(-(q.y - p.y), q.x - p.x) * 180) / Math.PI;
  const corners = [0, 1, 2].map((i) => {
    const p = P[i]!,
      next = P[(i + 1) % 3]!,
      prev = P[(i + 2) % 3]!;
    const d1 = heading(p, next),
      s = figure.angles[i]!;
    const text = figure.labels[i];
    const r = 26;
    return {
      at: p,
      d1,
      s,
      right: s === 90,
      path: s === 90 ? squarePath(p, 15, d1) : arcPath(p, r, d1, s),
      label: text ? angleLabel(p, d1, s, text, r + 16) : null,
      unknown: isUnknown(text),
      prev,
    };
  });
  const centroid = {
    x: (P[0]!.x + P[1]!.x + P[2]!.x) / 3,
    y: (P[0]!.y + P[1]!.y + P[2]!.y) / 3,
  };
  const names = P.map((p, i) => {
    const v = { x: p.x - centroid.x, y: p.y - centroid.y },
      n = Math.hypot(v.x, v.y) || 1;
    return {
      x: p.x + (v.x / n) * 18,
      y: p.y + (v.y / n) * 18,
      text: figure.vertices[i]!,
      width: textWidth(figure.vertices[i]!),
    };
  });
  let exterior = null;
  if (D && figure.exterior) {
    const s = 180 - B,
      d1 = 0;
    const r = 30;
    exterior = {
      d1,
      s,
      path: arcPath(P[1]!, r, d1, s),
      label: figure.exterior.label
        ? angleLabel(P[1]!, d1, s, figure.exterior.label, r + 16)
        : null,
      unknown: isUnknown(figure.exterior.label),
      end: D,
      name: {
        x: D.x + 2,
        y: D.y + 22,
        text: figure.exterior.point,
        width: textWidth(figure.exterior.point),
      },
    };
    // Exterior label sits above the extension; keep the B name below the line.
    names[1] = { ...names[1]!, x: P[1]!.x - 4, y: P[1]!.y + 22 };
  }
  const labels = [
    ...names,
    ...corners.flatMap((c) => (c.label ? [c.label] : [])),
    ...(exterior?.label ? [exterior.label] : []),
    ...(exterior ? [exterior.name] : []),
  ];
  return {
    points: P,
    corners,
    names,
    exterior,
    viewBox: fit([...P, ...(D ? [D] : [])], labels),
  };
}

// ——— Two parallel lines and a transversal ———

export function parallelLayout(figure: ParallelFigure) {
  const gap = 110,
    theta = figure.angle;
  const cot = 1 / Math.tan(rad(theta));
  const cross = [
    { x: 160 + (gap / 2) * cot, y: 0 },
    { x: 160 - (gap / 2) * cot, y: gap },
  ];
  const up = dir(theta);
  const extend = 70;
  const transversal = [add(cross[0]!, up, extend), add(cross[1]!, up, -extend)];
  const left = Math.min(cross[0]!.x, cross[1]!.x) - 95,
    right = Math.max(cross[0]!.x, cross[1]!.x) + 95;
  const lines = [0, gap].map((y) => ({
    a: { x: left, y },
    b: { x: right, y },
  }));
  const starts = [0, theta, 180, theta + 180];
  const spans = [theta, 180 - theta, theta, 180 - theta];
  const marks = figure.marks.map((m) => {
    const c = cross[m.crossing]!,
      d1 = starts[m.position]!,
      s = spans[m.position]!;
    return {
      ...m,
      d1,
      s,
      path: arcPath(c, 24, d1, s),
      label: angleLabel(c, d1, s, m.label, 42),
      unknown: isUnknown(m.label),
    };
  });
  const names = [
    { x: right + 12, y: 6, text: figure.lines[0], width: textWidth("m") },
    { x: right + 12, y: gap + 6, text: figure.lines[1], width: textWidth("m") },
    {
      ...add(transversal[0]!, up, 14),
      text: figure.lines[2],
      width: textWidth("m"),
    },
  ];
  return {
    cross,
    transversal,
    lines,
    marks,
    names,
    /** Two chevrons on each line mark them parallel. */
    arrows: [0, gap].map((y) => ({ x: left + 34, y })),
    viewBox: fit(
      [...transversal, ...lines.flatMap((l) => [l.a, l.b])],
      [...names, ...marks.map((m) => m.label)],
    ),
  };
}

// ——— Solids in oblique projection ———

export type P3 = [number, number, number];
/** Cabinet-style oblique view: depth recedes up and to the right at 30°. */
export function project(p: P3, k: number): Point {
  const [x, y, z] = p;
  return {
    x: (x + y * 0.5 * Math.cos(rad(30))) * k,
    y: -(z + y * 0.5 * Math.sin(rad(30))) * k,
  };
}
/** The plane's patch (drawn) and the exact section polygon, in solid coordinates. */
export function sectionGeometry(figure: SolidFigure, depth = 0.5) {
  const { length: l, width: w, height: h, solid, plane } = figure;
  const m = 0.22;
  const rect = (
    a: [number, number],
    b: [number, number],
    put: (u: number, v: number) => P3,
  ): P3[] => [
    put(a[0], a[1]),
    put(b[0], a[1]),
    put(b[0], b[1]),
    put(a[0], b[1]),
  ];
  let patch: P3[], section: P3[];
  if (plane === "parallel-base") {
    const z = h * depth;
    patch = rect([-m * l, -m * w], [l * (1 + m), w * (1 + m)], (u, v) => [
      u,
      v,
      z,
    ]);
    if (solid === "prism") section = rect([0, 0], [l, w], (u, v) => [u, v, z]);
    else {
      const k = 1 - z / h;
      section = rect(
        [(l * (1 - k)) / 2, (w * (1 - k)) / 2],
        [(l * (1 + k)) / 2, (w * (1 + k)) / 2],
        (u, v) => [u, v, z],
      );
    }
  } else if (
    plane === "perpendicular-front" ||
    plane === "through-apex" ||
    plane === "off-apex"
  ) {
    const y = plane === "off-apex" ? w * 0.25 : w * depth;
    patch = rect([-m * l, -m * h], [l * (1 + m), h * (1 + m)], (u, v) => [
      u,
      y,
      v,
    ]);
    if (solid === "prism") section = rect([0, 0], [l, h], (u, v) => [u, y, v]);
    else if (plane === "through-apex" || y === w / 2)
      section = [
        [0, y, 0],
        [l, y, 0],
        [l / 2, y, h],
      ];
    else {
      const top = h * (1 - Math.abs(y - w / 2) / (w / 2)),
        k = 1 - top / h;
      section = [
        [0, y, 0],
        [l, y, 0],
        [(l * (1 + k)) / 2, y, top],
        [(l * (1 - k)) / 2, y, top],
      ];
    }
  } else if (plane === "perpendicular-side") {
    const x = l * depth;
    patch = rect([-m * w, -m * h], [w * (1 + m), h * (1 + m)], (u, v) => [
      x,
      u,
      v,
    ]);
    section = rect([0, 0], [w, h], (u, v) => [x, u, v]);
  } else if (plane === "perpendicular-diagonal") {
    patch = rect([-m, -m * h], [1 + m, h * (1 + m)], (u, v) => [
      u * l,
      u * w,
      v,
    ]);
    section = rect([0, 0], [1, h], (u, v) => [u * l, u * w, v]);
  } else {
    // Corner: the three vertices joined to the front top right vertex.
    section = [
      [0, 0, h],
      [l, w, h],
      [l, 0, 0],
    ];
    const g: P3 = [(2 * l) / 3, w / 3, (2 * h) / 3];
    patch = section.map(
      (p) => p.map((c, i) => g[i]! + (c - g[i]!) * 1.2) as P3,
    );
  }
  return { patch, section };
}
export function solidLayout(figure: SolidFigure, size = 230) {
  const { length: l, width: w, height: h, solid } = figure;
  const k =
    size /
    Math.max(l + w * 0.5 * Math.cos(rad(30)), h + w * 0.5 * Math.sin(rad(30)));
  const P = (p: P3) => project(p, k);
  const base: P3[] = [
    [0, 0, 0],
    [l, 0, 0],
    [l, w, 0],
    [0, w, 0],
  ];
  // Edges as [from, to, hidden]; the back left corner is out of sight.
  let edges: [P3, P3, boolean][];
  if (solid === "prism") {
    const top = base.map(([x, y]) => [x, y, h] as P3);
    edges = [
      [base[0]!, base[1]!, false],
      [base[1]!, base[2]!, false],
      [base[2]!, base[3]!, true],
      [base[3]!, base[0]!, true],
      [top[0]!, top[1]!, false],
      [top[1]!, top[2]!, false],
      [top[2]!, top[3]!, false],
      [top[3]!, top[0]!, false],
      [base[0]!, top[0]!, false],
      [base[1]!, top[1]!, false],
      [base[2]!, top[2]!, false],
      [base[3]!, top[3]!, true],
    ];
  } else {
    const apex: P3 = [l / 2, w / 2, h];
    edges = [
      [base[0]!, base[1]!, false],
      [base[1]!, base[2]!, false],
      [base[2]!, base[3]!, true],
      [base[3]!, base[0]!, true],
      [base[0]!, apex, false],
      [base[1]!, apex, false],
      [base[2]!, apex, false],
      [base[3]!, apex, true],
    ];
  }
  const geometry = sectionGeometry(figure);
  const u = figure.unit;
  const labels: Label[] = u
    ? [
        {
          ...add(P([l / 2, 0, 0]), { x: 0, y: 1 }, 22),
          text: `${l} ${u}`,
          width: textWidth(`${l} ${u}`),
        },
        {
          ...add(
            P([l, w / 2, 0]),
            { x: 1, y: 0.4 },
            22 + textWidth(`${w} ${u}`) / 2,
          ),
          text: `${w} ${u}`,
          width: textWidth(`${w} ${u}`),
        },
        solid === "prism"
          ? {
              ...add(
                P([0, 0, h / 2]),
                { x: -1, y: 0 },
                10 + textWidth(`${h} ${u}`) / 2,
              ),
              text: `${h} ${u}`,
              width: textWidth(`${h} ${u}`),
            }
          : {
              ...add(
                P([l / 2, w / 2, h / 2]),
                { x: 1, y: 0 },
                10 + textWidth(`${h} ${u}`) / 2,
              ),
              text: `${h} ${u}`,
              width: textWidth(`${h} ${u}`),
            },
      ]
    : [];
  const all = [
    ...base,
    ...edges.flatMap((e) => [e[0], e[1]]),
    ...geometry.patch,
  ];
  return {
    edges: edges.map(([a, b, hidden]) => ({ a: P(a), b: P(b), hidden })),
    patch: geometry.patch.map(P),
    section: geometry.section.map(P),
    height:
      solid === "pyramid"
        ? { a: P([l / 2, w / 2, 0]), b: P([l / 2, w / 2, h]) }
        : null,
    labels,
    project: P,
    viewBox: fit(all.map(P), labels),
  };
}
