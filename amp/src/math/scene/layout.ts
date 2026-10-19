import type {
  Component,
  Element,
  FillRole,
  InkRole,
  PathOp,
  Point,
  Primitive,
  Scene,
} from "./spec";
import { typeset, type Typeset } from "./type";

/** A primitive as components emit it: test hooks and collision hints added. */
export type Prim = Primitive & {
  data?: Record<string, string | number>;
  /** Labels avoid this shape when they are placed. */
  obstacle?: boolean;
  /** A fill with no outline (shaded regions). */
  noStroke?: boolean;
  cap?: "round";
};
export type CompileContext = {
  /** Figure pixels per math unit, for density decisions (label strides). */
  s: number;
  /** Draw derived values (the unknowns) instead of "?". */
  reveal: boolean;
};
export type ComponentDef<C> = {
  compile(c: C, ctx: CompileContext): Prim[];
  describe(c: C, reveal: boolean): string;
  /** Largest useful pixels per math unit (a ten-frame cell, a clock radius). */
  maxScale?(c: C): number;
};

export type Box = { x0: number; y0: number; x1: number; y1: number };
type Common = { id: string; data?: Record<string, string | number> };
/** Display list in figure pixels, y down. Every item belongs to an element. */
export type Drawn = Common &
  (
    | {
        k: "line";
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        stroke: InkRole;
        w: number;
        dash?: "dash" | "dot";
        cap?: "round";
      }
    | {
        k: "path";
        d: string;
        stroke?: InkRole;
        w?: number;
        fill: FillRole;
        opacity?: number;
        dash?: "dash" | "dot";
        /** Used for trace animation and arrowheads. */
        length?: number;
        /** Exact bounds for paths with arcs, which control points do not bound. */
        bbox?: Box;
      }
    | {
        k: "circle";
        cx: number;
        cy: number;
        r: number;
        stroke?: InkRole;
        w?: number;
        fill: FillRole;
        opacity?: number;
        dash?: "dash" | "dot";
      }
    | {
        k: "rect";
        x: number;
        y: number;
        w: number;
        h: number;
        rx?: number;
        stroke?: InkRole;
        sw?: number;
        fill: FillRole;
        opacity?: number;
        dash?: "dash" | "dot";
      }
    | {
        k: "text";
        /** Left end of the baseline. */
        x: number;
        y: number;
        t: Typeset;
        color: InkRole;
        halo?: boolean;
        bold?: boolean;
        /** The label as read aloud and tested; "?" when masked. */
        plain: string;
        masked: boolean;
        box: Box;
      }
  );
export type Layout = {
  width: number;
  height: number;
  /** Pixels per math unit, after fitting. */
  scale: number;
  items: Drawn[];
  /** Labels dropped because they collided (optional tick labels). */
  dropped: string[];
};

const defs = new Map<string, ComponentDef<never>>();
export function registerComponent<T extends Component["type"]>(
  type: T,
  def: ComponentDef<Extract<Component, { type: T }>>,
) {
  defs.set(type, def as ComponentDef<never>);
}
export function componentDef(type: string) {
  return defs.get(type) as ComponentDef<Component> | undefined;
}
const isComponent = (e: Element): e is Component => defs.has(e.type);

function elementId(e: Element, index: number) {
  return e.id ?? `e${index}`;
}

/** Compile every element to primitives with fully qualified ids. */
export function compileScene(scene: Scene, ctx: CompileContext): Prim[] {
  return scene.elements.flatMap((e, index) => {
    const id = elementId(e, index);
    if (!isComponent(e)) return [{ ...(e as Prim), id }];
    return componentDef(e.type)!
      .compile(e, ctx)
      .map((p) => ({ ...p, id: p.id ? `${id}.${p.id}` : id }));
  });
}

function mathPoints(p: Prim): Point[] {
  switch (p.type) {
    case "text":
    case "point":
    case "tick":
      return [p.at];
    case "segment":
    case "arrow":
    case "brace":
      return [p.from, p.to];
    case "polyline":
    case "polygon":
      return p.points;
    case "path":
      return p.d.flatMap((op) => {
        const out: Point[] = [];
        for (let i = 1; i + 1 < op.length; i += 2)
          out.push([op[i] as number, op[i + 1] as number]);
        return out;
      });
    case "circle":
      return [
        [p.center[0] - p.r, p.center[1] - p.r],
        [p.center[0] + p.r, p.center[1] + p.r],
      ];
    case "arc":
      return arcPoints(p.center, p.r, p.from, p.to, 24).concat(
        p.fill ? [p.center] : [],
      );
    case "rect":
      return [p.at, [p.at[0] + p.size[0], p.at[1] + p.size[1]]];
  }
}
function arcPoints(c: Point, r: number, from: number, to: number, n: number) {
  return Array.from({ length: n + 1 }, (_, i): Point => {
    const t = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
  });
}

const empty = (): Box => ({
  x0: Infinity,
  y0: Infinity,
  x1: -Infinity,
  y1: -Infinity,
});
function grow(b: Box, x: number, y: number, pad = 0) {
  b.x0 = Math.min(b.x0, x - pad);
  b.y0 = Math.min(b.y0, y - pad);
  b.x1 = Math.max(b.x1, x + pad);
  b.y1 = Math.max(b.y1, y + pad);
}
const overlaps = (a: Box, b: Box, gap = 0) =>
  a.x0 < b.x1 + gap &&
  b.x0 < a.x1 + gap &&
  a.y0 < b.y1 + gap &&
  b.y0 < a.y1 + gap;

/** Does a segment cross a box? (Liang–Barsky against the box.) */
function segmentHitsBox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  b: Box,
) {
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

const fmt = (n: number) => +n.toFixed(2);
const dashOf = (d?: string) => (d === "dash" || d === "dot" ? d : undefined);

/** Arrowhead as a filled triangle whose tip is at (x, y), pointing along (ux, uy). */
function head(
  id: string,
  x: number,
  y: number,
  ux: number,
  uy: number,
  stroke: InkRole,
  w: number,
): Drawn {
  const len = 6 + 2 * w,
    half = 2.4 + w;
  const bx = x - ux * len,
    by = y - uy * len;
  return {
    k: "path",
    id,
    d: `M${fmt(x)} ${fmt(y)}L${fmt(bx - uy * half)} ${fmt(by + ux * half)}L${fmt(bx + uy * half)} ${fmt(by - ux * half)}Z`,
    fill: stroke as FillRole,
  };
}
const unit = (dx: number, dy: number) => {
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l] as const;
};

type PendingText = {
  id: string;
  data?: Record<string, string | number>;
  x: number;
  y: number;
  t: Typeset;
  p: Extract<Prim, { type: "text" }>;
  plain: string;
  masked: boolean;
};

/** Map primitives to pixels. `X`/`Y` take math coordinates. */
function draw(
  prims: Prim[],
  X: (x: number) => number,
  Y: (y: number) => number,
  s: number,
  reveal: boolean,
) {
  const items: Drawn[] = [];
  const texts: PendingText[] = [];
  const obstacles: Box[] = [];
  const segments: [number, number, number, number][] = [];
  const P = (p: Point) => [X(p[0]), Y(p[1])] as const;
  for (const p of prims) {
    const id = p.id!,
      data = p.data;
    const stroke = "stroke" in p ? (p.stroke ?? "ink") : "ink";
    const w = "width" in p ? (p.width ?? 2) : 2;
    const dash = "dash" in p ? dashOf(p.dash) : undefined;
    switch (p.type) {
      case "segment": {
        const [x1, y1] = P(p.from),
          [x2, y2] = P(p.to);
        const [ux, uy] = unit(x2 - x1, y2 - y1);
        const inset = 4 + 1.5 * w;
        const sx = p.arrow === "start" || p.arrow === "both" ? inset : 0,
          ex = p.arrow === "end" || p.arrow === "both" ? inset : 0;
        items.push({
          k: "line",
          id,
          data,
          x1: x1 + ux * sx,
          y1: y1 + uy * sx,
          x2: x2 - ux * ex,
          y2: y2 - uy * ex,
          stroke,
          w,
          dash,
          cap: p.cap,
        });
        if (sx) items.push(head(`${id}.head`, x1, y1, -ux, -uy, stroke, w));
        if (ex) items.push(head(`${id}.head`, x2, y2, ux, uy, stroke, w));
        if (p.obstacle) segments.push([x1, y1, x2, y2]);
        break;
      }
      case "arrow": {
        const [x1, y1] = P(p.from),
          [x2, y2] = P(p.to);
        const [ux, uy] = unit(x2 - x1, y2 - y1);
        // Bow to the left of the direction of travel (up, for a rightward hop).
        const bend = p.bend ?? 0;
        const cx = (x1 + x2) / 2 + uy * bend * 2,
          cy = (y1 + y2) / 2 - ux * bend * 2;
        const [tx, ty] = bend ? unit(x2 - cx, y2 - cy) : [ux, uy];
        const inset = 4 + 1.5 * w;
        const ex = x2 - tx * inset,
          ey = y2 - ty * inset;
        const chord = Math.hypot(x2 - x1, y2 - y1);
        items.push({
          k: "path",
          id,
          data,
          d: bend
            ? `M${fmt(x1)} ${fmt(y1)}Q${fmt(cx)} ${fmt(cy)} ${fmt(ex)} ${fmt(ey)}`
            : `M${fmt(x1)} ${fmt(y1)}L${fmt(ex)} ${fmt(ey)}`,
          stroke,
          w,
          fill: "none",
          dash,
          length: chord + Math.abs(bend) * 1.6,
        });
        items.push(head(`${id}.head`, x2, y2, tx, ty, stroke, w));
        // The bow's apex keeps labels away from the curve.
        const apex = { x: (x1 + 2 * cx + x2) / 4, y: (y1 + 2 * cy + y2) / 4 };
        obstacles.push({
          x0: Math.min(x1, x2, apex.x),
          x1: Math.max(x1, x2, apex.x),
          y0: Math.min(y1, y2, apex.y) - w,
          y1: Math.min(y1, y2, apex.y) + w,
        });
        break;
      }
      case "polyline":
      case "polygon": {
        const closed = p.type === "polygon" || p.closed;
        if (p.obstacle)
          for (let i = 0; i + 1 < p.points.length; i++)
            segments.push([
              X(p.points[i]![0]),
              Y(p.points[i]![1]),
              X(p.points[i + 1]![0]),
              Y(p.points[i + 1]![1]),
            ]);
        const fill = p.fill ?? (p.type === "polygon" ? "accent-fill" : "none");
        items.push({
          k: "path",
          id,
          data,
          d:
            p.points
              .map((q, i) => `${i ? "L" : "M"}${fmt(X(q[0]))} ${fmt(Y(q[1]))}`)
              .join("") + (closed ? "Z" : ""),
          stroke: p.noStroke ? undefined : (p.stroke ?? "ink"),
          w,
          fill,
          opacity: p.opacity,
          dash,
          length: p.points.reduce(
            (sum, q, i, all) =>
              i
                ? sum +
                  Math.hypot(q[0] - all[i - 1]![0], q[1] - all[i - 1]![1]) * s
                : 0,
            0,
          ),
        });
        break;
      }
      case "path": {
        items.push({
          k: "path",
          id,
          data,
          d: p.d.map((op) => pathOp(op, X, Y)).join(""),
          stroke,
          w,
          fill: p.fill ?? "none",
          opacity: p.opacity,
          dash,
        });
        break;
      }
      case "arc": {
        const [cx, cy] = P(p.center),
          r = p.r * s;
        const at = (deg: number) => {
          const t = (deg * Math.PI) / 180;
          return [cx + r * Math.cos(t), cy - r * Math.sin(t)] as const;
        };
        const [ax, ay] = at(p.from),
          [bx, by] = at(p.to);
        const sweep = p.to > p.from ? 0 : 1,
          large = Math.abs(p.to - p.from) > 180 ? 1 : 0;
        const arc = `A${fmt(r)} ${fmt(r)} 0 ${large} ${sweep} ${fmt(bx)} ${fmt(by)}`;
        const bbox = empty();
        for (let i = 0; i <= 48; i++) {
          const [qx, qy] = at(p.from + ((p.to - p.from) * i) / 48);
          grow(bbox, qx, qy, w / 2);
        }
        if (p.fill && p.fill !== "none") grow(bbox, cx, cy);
        if (p.fill && p.fill !== "none")
          items.push({
            k: "path",
            id: `${id}.sector`,
            data,
            d: `M${fmt(cx)} ${fmt(cy)}L${fmt(ax)} ${fmt(ay)}${arc}Z`,
            fill: p.fill,
            bbox,
          });
        items.push({
          k: "path",
          id,
          data,
          d: `M${fmt(ax)} ${fmt(ay)}${arc}`,
          stroke,
          w,
          fill: "none",
          dash,
          length: (Math.abs(p.to - p.from) * Math.PI * r) / 180,
          bbox,
        });
        const tangent = (deg: number, dir: number) => {
          const t = (deg * Math.PI) / 180;
          // Counterclockwise in math is (−sin, cos); y flips on screen.
          return [-Math.sin(t) * dir, -Math.cos(t) * dir] as const;
        };
        const dir = p.to > p.from ? 1 : -1;
        if (p.arrow === "end" || p.arrow === "both")
          items.push(
            head(`${id}.head`, bx, by, ...tangent(p.to, dir), stroke, w),
          );
        if (p.arrow === "start" || p.arrow === "both")
          items.push(
            head(`${id}.head`, ax, ay, ...tangent(p.from, -dir), stroke, w),
          );
        break;
      }
      case "circle": {
        const [cx, cy] = P(p.center);
        items.push({
          k: "circle",
          id,
          data,
          cx,
          cy,
          r: p.r * s,
          stroke,
          w,
          fill: p.fill ?? "none",
          opacity: p.opacity,
          dash,
        });
        break;
      }
      case "rect": {
        const x = X(p.at[0]),
          y = Y(p.at[1] + p.size[1]);
        items.push({
          k: "rect",
          id,
          data,
          x,
          y,
          w: p.size[0] * s,
          h: p.size[1] * s,
          rx: p.radius,
          stroke: p.stroke,
          sw: p.stroke ? w : undefined,
          fill: p.fill ?? "none",
          opacity: p.opacity,
          dash,
        });
        break;
      }
      case "point": {
        const [cx, cy] = P(p.at),
          r = p.r ?? 5,
          c = p.color ?? "warm";
        if (p.shape === "square")
          items.push({
            k: "rect",
            id,
            data,
            x: cx - r,
            y: cy - r,
            w: 2 * r,
            h: 2 * r,
            rx: 1.5,
            fill: c as FillRole,
          });
        else
          items.push({
            k: "circle",
            id,
            data,
            cx,
            cy,
            r,
            stroke: p.shape === "open" ? c : "paper",
            w: p.shape === "open" ? 2 : 1.25,
            fill: p.shape === "open" ? "paper" : (c as FillRole),
          });
        obstacles.push({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r });
        break;
      }
      case "tick": {
        const [x, y] = P(p.at),
          [ux, uy] = unit(p.dir[0], p.dir[1]),
          h = p.length / 2;
        items.push({
          k: "line",
          id,
          data,
          x1: x - ux * h,
          y1: y - uy * h,
          x2: x + ux * h,
          y2: y + uy * h,
          stroke,
          w: p.width ?? 1.5,
        });
        break;
      }
      case "brace": {
        const [x1, y1] = P(p.from),
          [x2, y2] = P(p.to);
        const [ux, uy] = unit(x2 - x1, y2 - y1);
        // Left normal on screen (y down): (uy, −ux).
        const nx = uy,
          ny = -ux,
          g = p.gap ?? 6,
          depth = 8;
        const a = (t: number, o: number) =>
          `${fmt(x1 + (x2 - x1) * t + nx * (g + o))} ${fmt(y1 + (y2 - y1) * t + ny * (g + o))}`;
        items.push({
          k: "path",
          id,
          data,
          d: `M${a(0, 0)}Q${a(0, depth / 2)} ${a(0.08, depth / 2)}L${a(0.42, depth / 2)}Q${a(0.5, depth / 2)} ${a(0.5, depth)}Q${a(0.5, depth / 2)} ${a(0.58, depth / 2)}L${a(0.92, depth / 2)}Q${a(1, depth / 2)} ${a(1, 0)}`,
          stroke,
          w: p.width ?? 1.5,
          fill: "none",
        });
        if (p.label) {
          const tipX = (x1 + x2) / 2 + nx * (g + depth + 4),
            tipY = (y1 + y2) / 2 + ny * (g + depth + 4);
          const masked = !!p.derived && !reveal;
          const text = masked ? "?" : p.label;
          const t = typeset(text, "math", "md");
          const ax = Math.abs(nx) < 0.3 ? 0 : nx > 0 ? -1 : 1,
            ay = Math.abs(ny) < 0.3 ? 0 : ny > 0 ? -1 : 1;
          texts.push(
            pending(
              `${id}.label`,
              undefined,
              t,
              tipX,
              tipY,
              ax as -1 | 0 | 1,
              ay as -1 | 0 | 1,
              { type: "text", at: [0, 0], text },
              text,
              masked,
            ),
          );
        }
        break;
      }
      case "text": {
        const masked = !!p.derived && !reveal;
        const text = masked ? "?" : p.text;
        const t = typeset(text, p.font ?? "math", p.size ?? "md", p.bold);
        const [x, y] = P(p.at);
        const [ax, ay] = p.align ?? [0, 0];
        const [dx, dy] = p.offset ?? [0, 0];
        texts.push(
          pending(id, data, t, x + dx, y + dy, ax, ay, p, text, masked),
        );
        break;
      }
    }
  }
  return { items, texts, obstacles, segments };
}

function pending(
  id: string,
  data: PendingText["data"],
  t: Typeset,
  x: number,
  y: number,
  ax: -1 | 0 | 1,
  ay: -1 | 0 | 1,
  p: Extract<Prim, { type: "text" }>,
  plain: string,
  masked: boolean,
): PendingText {
  const h = t.ascent + t.descent;
  const left = x - ((ax + 1) / 2) * t.width;
  const top = y - ((ay + 1) / 2) * h;
  return { id, data, t, x: left, y: top + t.ascent, p, plain, masked };
}
/** The box used for collisions: the em box, trimmed of internal leading. */
const inkBox = (x: number, y: number, t: Typeset): Box => ({
  x0: x - 1,
  y0: y - t.ascent * 0.82,
  x1: x + t.width + 1,
  y1: y + t.descent * 0.6,
});
const emBox = (x: number, y: number, t: Typeset): Box => ({
  x0: x,
  y0: y - t.ascent,
  x1: x + t.width,
  y1: y + t.descent,
});

/** Place labels: fixed ones first, optional ones only where clear, then
 * labels with candidate positions at their first clear candidate. */
function placeTexts(
  texts: PendingText[],
  obstacles: Box[],
  segments: [number, number, number, number][],
) {
  const placed: Box[] = [];
  const out: Drawn[] = [];
  const dropped: string[] = [];
  const clear = (b: Box) =>
    !placed.some((o) => overlaps(o, b, 2)) &&
    !obstacles.some((o) => overlaps(o, b, 1)) &&
    !segments.some((s) => segmentHitsBox(...s, b));
  const emit = (t: PendingText, x: number, y: number) => {
    placed.push(inkBox(x, y, t.t));
    out.push({
      k: "text",
      id: t.id,
      data: t.data,
      x,
      y,
      t: t.t,
      color: t.p.color ?? "ink",
      halo: t.p.halo,
      bold: t.p.bold,
      plain: t.plain,
      masked: t.masked,
      box: emBox(x, y, t.t),
    });
  };
  const order = (t: PendingText) => (t.p.place ? 2 : t.p.optional ? 1 : 0);
  for (const t of [...texts].sort((a, b) => order(a) - order(b))) {
    if (t.p.place) {
      // Candidates are relative to the anchor before alignment.
      const [ax, ay] = t.p.align ?? [0, 0];
      const h = t.t.ascent + t.t.descent;
      const anchorX = t.x + ((ax + 1) / 2) * t.t.width,
        anchorY = t.y - t.t.ascent + ((ay + 1) / 2) * h;
      let chosen: [number, number] | undefined;
      for (const [dx, dy, cx, cy] of t.p.place) {
        const x = anchorX + dx - ((cx + 1) / 2) * t.t.width,
          y = anchorY + dy - ((cy + 1) / 2) * h + t.t.ascent;
        if (clear(inkBox(x, y, t.t))) {
          chosen = [x, y];
          break;
        }
      }
      if (!chosen) {
        const [dx, dy, cx, cy] = t.p.place[0]!;
        chosen = [
          anchorX + dx - ((cx + 1) / 2) * t.t.width,
          anchorY + dy - ((cy + 1) / 2) * h + t.t.ascent,
        ];
      }
      emit(t, ...chosen);
    } else if (
      t.p.optional &&
      [...placed, ...obstacles].some((o) =>
        overlaps(o, inkBox(t.x, t.y, t.t), 1),
      )
    )
      // Optional labels (ticks) yield to labels and marks; a halo keeps
      // them legible where a line or curve crosses.
      dropped.push(t.id);
    else emit(t, t.x, t.y);
  }
  return { texts: out, dropped };
}

function pathOp(
  op: PathOp,
  X: (x: number) => number,
  Y: (y: number) => number,
) {
  const [c, ...v] = op;
  if (c === "Z") return "Z";
  const out: number[] = [];
  for (let i = 0; i < v.length; i += 2)
    out.push(fmt(X(v[i] as number)), fmt(Y(v[i + 1] as number)));
  return c + out.join(" ");
}

function itemBox(d: Drawn, b: Box) {
  switch (d.k) {
    case "line":
      grow(b, d.x1, d.y1, d.w / 2);
      grow(b, d.x2, d.y2, d.w / 2);
      break;
    case "circle":
      grow(b, d.cx, d.cy, d.r + (d.w ?? 0) / 2);
      break;
    case "rect":
      grow(b, d.x, d.y, (d.sw ?? 0) / 2);
      grow(b, d.x + d.w, d.y + d.h, (d.sw ?? 0) / 2);
      break;
    case "text":
      grow(b, d.box.x0, d.box.y0, d.halo ? 2 : 0);
      grow(b, d.box.x1, d.box.y1, d.halo ? 2 : 0);
      break;
    case "path": {
      if (d.bbox) {
        grow(b, d.bbox.x0, d.bbox.y0);
        grow(b, d.bbox.x1, d.bbox.y1);
        break;
      }
      // Control points bound a quadratic or cubic curve.
      const n = d.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      for (let i = 0; i + 1 < n.length; i += 2)
        grow(b, n[i]!, n[i + 1]!, (d.w ?? 0) / 2);
      break;
    }
  }
}

const PAD = 4;
/** Fit a scene to its target width: compile, map to pixels, place labels,
 * then refit until labels and marks outside the math bounds are included. */
export function layoutScene(
  scene: Scene,
  options: { reveal?: boolean } = {},
): Layout {
  const reveal = !!options.reveal;
  const W = (scene.width ?? 360) - 2 * PAD,
    H = (scene.maxHeight ?? 320) - 2 * PAD;
  const caps = scene.elements.flatMap((e) =>
    isComponent(e) ? [componentDef(e.type)!.maxScale?.(e) ?? Infinity] : [],
  );
  const cap = Math.min(Infinity, ...caps);
  let s = 1;
  let result: ReturnType<typeof pass> | undefined;
  function pass(scale: number) {
    const prims = compileScene(scene, { s: scale, reveal });
    const mb = empty();
    for (const p of prims) for (const [x, y] of mathPoints(p)) grow(mb, x, y);
    const X = (x: number) => (x - mb.x0) * scale,
      Y = (y: number) => (mb.y1 - y) * scale;
    const { items, texts, obstacles, segments } = draw(
      prims,
      X,
      Y,
      scale,
      reveal,
    );
    const placed = placeTexts(texts, obstacles, segments);
    const all = [...items, ...placed.texts];
    const box = empty();
    for (const d of all) itemBox(d, box);
    return {
      all,
      box,
      dropped: placed.dropped,
      mw: mb.x1 - mb.x0,
      mh: mb.y1 - mb.y0,
      over: {
        x: -box.x0 + (box.x1 - (mb.x1 - mb.x0) * scale),
        y: -box.y0 + (box.y1 - (mb.y1 - mb.y0) * scale),
      },
    };
  }
  // The first pass measures the math extent; later passes fit the overhang.
  result = pass(1);
  for (let i = 0; i < 4; i++) {
    const fitW = result.mw > 1e-9 ? (W - result.over.x) / result.mw : Infinity;
    const fitH = result.mh > 1e-9 ? (H - result.over.y) / result.mh : Infinity;
    let next = Math.min(fitW, fitH, cap);
    if (!Number.isFinite(next)) next = Math.min(cap, 40);
    next = Math.max(next, 0.01);
    const converged = i > 0 && Math.abs(next - s) / s < 0.005;
    s = next;
    result = pass(s);
    if (converged) break;
  }
  const { all, box } = result;
  const dx = PAD - box.x0,
    dy = PAD - box.y0;
  return {
    width: Math.ceil(box.x1 - box.x0 + 2 * PAD),
    height: Math.ceil(box.y1 - box.y0 + 2 * PAD),
    scale: s,
    items: all.map((d) => translate(d, dx, dy)),
    dropped: result.dropped,
  };
}

function translate(d: Drawn, dx: number, dy: number): Drawn {
  switch (d.k) {
    case "line":
      return {
        ...d,
        x1: d.x1 + dx,
        y1: d.y1 + dy,
        x2: d.x2 + dx,
        y2: d.y2 + dy,
      };
    case "circle":
      return { ...d, cx: d.cx + dx, cy: d.cy + dy };
    case "rect":
      return { ...d, x: d.x + dx, y: d.y + dy };
    case "text":
      return {
        ...d,
        x: d.x + dx,
        y: d.y + dy,
        box: {
          x0: d.box.x0 + dx,
          y0: d.box.y0 + dy,
          x1: d.box.x1 + dx,
          y1: d.box.y1 + dy,
        },
      };
    case "path":
      return {
        ...d,
        d: shiftPath(d.d, dx, dy),
        bbox: d.bbox && {
          x0: d.bbox.x0 + dx,
          y0: d.bbox.y0 + dy,
          x1: d.bbox.x1 + dx,
          y1: d.bbox.y1 + dy,
        },
      };
  }
}
/** Shift absolute path coordinates; arc radii and flags stay put. */
function shiftPath(d: string, dx: number, dy: number) {
  return d.replace(/([MLQCA])([^MLQCAZ]*)/g, (_, c: string, body: string) => {
    const v = body
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (c === "A") {
      v[5] = fmt(v[5]! + dx);
      v[6] = fmt(v[6]! + dy);
    } else
      for (let i = 0; i < v.length; i++) v[i] = fmt(v[i]! + (i % 2 ? dy : dx));
    return c + v.join(" ");
  });
}

/** A component's own description, or nothing for a bare primitive. */
export function describeScene(scene: Scene, reveal = false) {
  const parts = scene.elements.flatMap((e) =>
    isComponent(e) ? [componentDef(e.type)!.describe(e, reveal)] : [],
  );
  return [
    scene.title ? `${scene.title.replace(/\.$/, "")}.` : "",
    ...parts,
    scene.note ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}
