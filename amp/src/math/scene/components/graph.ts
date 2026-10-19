import { registerComponent, type Prim } from "../layout";
import {
  axisStep,
  type Fn,
  type Graph,
  type LineSpec,
  type Point,
} from "../spec";
import { typeset } from "../type";
import {
  clipHalfPlane,
  clipPolyline,
  evaluate,
  features,
  lineCoefficients,
  lineInWindow,
  sample,
} from "../functions";
import { clean, num, point, spoken, spokenPoint } from "./format";
import { ticks } from "./number-line";

const nice = (range: number, most: number) => {
  for (const m of [
    1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000,
  ])
    if (range / m <= most) return m;
  return 10 ** Math.ceil(Math.log10(range / most));
};
/** Screen y units per x unit: 1 unless the window is far from square. */
export function graphAspect(g: Graph) {
  if (g.aspect) return g.aspect;
  if (g.circles?.length) return 1;
  const ratio = (g.y[1] - g.y[0]) / (g.x[1] - g.x[0]);
  return Math.min(1.1, Math.max(0.6, ratio)) / ratio;
}
const superscript = (n: number) =>
  String(n)
    .split("")
    .map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d])
    .join("");
/** A formula as plain text: y = 2x² − 3x + 1. */
export function formula(fn: Fn): string {
  const poly = (c: readonly number[]) => {
    const terms = c
      .map((a, i) => [a, i] as const)
      .filter(([a]) => a !== 0)
      .reverse();
    if (!terms.length) return "0";
    return terms
      .map(([a, i], j) => {
        const mag = Math.abs(a),
          coef = mag === 1 && i > 0 ? "" : num(mag);
        const body =
          i === 0 ? num(mag) : `${coef}x${i > 1 ? superscript(i) : ""}`;
        return j === 0
          ? a < 0
            ? `−${body}`
            : body
          : `${a < 0 ? " − " : " + "}${body}`;
      })
      .join("");
  };
  const shift = (h = 0) =>
    h === 0 ? "x" : `x ${h > 0 ? "−" : "+"} ${num(Math.abs(h))}`;
  const tail = (k = 0) =>
    k === 0 ? "" : ` ${k > 0 ? "+" : "−"} ${num(Math.abs(k))}`;
  const lead = (a: number) => (a === 1 ? "" : a === -1 ? "−" : num(a));
  switch (fn.f) {
    case "poly":
      return poly(fn.c);
    case "rational": {
      const wrap = (c: readonly number[]) =>
        c.filter((a) => a !== 0).length > 1 ? `(${poly(c)})` : poly(c);
      return `${wrap(fn.num)} / ${wrap(fn.den)}`;
    }
    case "exp":
      return `${lead(fn.a)}${num(fn.b)}^(${shift(fn.h)})${tail(fn.k)}`;
    case "log":
      return `${lead(fn.a)}log base ${num(fn.base)} of (${shift(fn.h)})${tail(fn.k)}`;
    case "abs":
      return `${lead(fn.a)}|${shift(fn.h)}|${tail(fn.k)}`;
    case "sqrt":
      return `${lead(fn.a)}√(${shift(fn.h)})${tail(fn.k)}`;
    default:
      return `${lead(fn.a)}${fn.f}(${fn.b === 1 ? "" : num(fn.b)}${fn.h ? `(${shift(fn.h)})` : "x"})${tail(fn.k)}`;
  }
}
export function lineText(l: LineSpec) {
  if ("m" in l) return `y = ${formula({ f: "poly", c: [l.b, l.m] })}`;
  if ("x" in l) return `x = ${num(l.x)}`;
  const { a, b, c } = lineCoefficients(l);
  if (b !== 0)
    return `y = ${formula({ f: "poly", c: [clean(c / b), clean(-a / b)] })}`;
  return `x = ${num(c / a)}`;
}
const opText = { "<": "<", "<=": "≤", ">": ">", ">=": "≥" } as const;
const flipOp = { "<": ">", "<=": ">=", ">": "<", ">=": "<=" } as const;
/** "y is greater than 2x − 1": solved for y when y appears. */
function inequalityWords(h: {
  a: number;
  b: number;
  c: number;
  op: keyof typeof flipOp;
}) {
  if (h.b !== 0) {
    const op = h.b < 0 ? flipOp[h.op] : h.op;
    return `y is ${opWords[op]} ${formula({ f: "poly", c: [clean(h.c / h.b), clean(-h.a / h.b)] })}`;
  }
  const op = h.a < 0 ? flipOp[h.op] : h.op;
  return `x is ${opWords[op]} ${num(clean(h.c / h.a))}`;
}
const opWords = {
  "<": "less than",
  "<=": "less than or equal to",
  ">": "greater than",
  ">=": "greater than or equal to",
} as const;

/** Eight label positions around a point, nearest first. */
const around = (d: number): [number, number, -1 | 0 | 1, -1 | 0 | 1][] => [
  [d, -d, -1, 1],
  [-d, -d, 1, 1],
  [d, d, -1, -1],
  [-d, d, 1, -1],
  [0, -d - 2, 0, 1],
  [0, d + 2, 0, -1],
  [d + 2, 0, -1, 0],
  [-d - 2, 0, 1, 0],
];

function gridWords(g: Graph) {
  const shared = nice(Math.max(g.x[1] - g.x[0], g.y[1] - g.y[0]), 20);
  const gx = axisStep(g.grid, 0, shared),
    gy = axisStep(g.grid, 1, shared);
  return gx === gy
    ? `, gridlines every ${spoken(gx)}`
    : `, gridlines every ${spoken(gx)} across and every ${spoken(gy)} up`;
}
registerComponent("graph", {
  maxScale: (g) => 48 / Math.min(1, graphAspect(g)),
  compile(g, { s }) {
    const k = graphAspect(g);
    const [x0, x1] = g.x,
      [y0, y1] = g.y;
    const P = (x: number, y: number): Point => [x, y * k];
    const prims: Prim[] = [];
    const xr = x1 - x0,
      yr = y1 - y0;
    const shared = nice(Math.max(xr, yr), 20);
    const grid: [number, number] | null =
      g.grid === false
        ? null
        : [axisStep(g.grid, 0, shared), axisStep(g.grid, 1, shared)];
    // Axes cross at the origin when it is in view, else along the window edge.
    const ax = y0 <= 0 && y1 >= 0 ? 0 : y0,
      ay = x0 <= 0 && x1 >= 0 ? 0 : x0;
    if (grid) {
      for (const v of ticks(x0, x1, grid[0]))
        if (v !== ay)
          prims.push({
            type: "segment",
            id: `grid.x.${v}`,
            from: P(v, y0),
            to: P(v, y1),
            stroke: "grid",
            width: 1,
          });
      for (const v of ticks(y0, y1, grid[1]))
        if (v !== ax)
          prims.push({
            type: "segment",
            id: `grid.y.${v}`,
            from: P(x0, v),
            to: P(x1, v),
            stroke: "grid",
            width: 1,
          });
    }
    // Shaded regions sit under every line.
    const fills = {
      accent: "accent-fill",
      warm: "warm-fill",
      gold: "gold-fill",
    } as const;
    for (const [i, region] of (g.regions ?? []).entries()) {
      let poly: Point[] = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];
      for (const h of region.halfPlanes) {
        const flip = h.op === ">" || h.op === ">=" ? -1 : 1;
        poly = clipHalfPlane(poly, flip * h.a, flip * h.b, flip * h.c);
      }
      const color = region.color ?? "accent";
      if (poly.length >= 3)
        prims.push({
          type: "polygon",
          id: `region.${i}`,
          points: poly.map(([x, y]) => P(x, y)),
          fill: fills[color],
          opacity: 0.75,
          stroke: color,
          width: 0.5,
        });
      for (const [j, h] of region.halfPlanes.entries()) {
        if (h.boundary === false) continue;
        const seg = lineInWindow({ a: h.a, b: h.b, c: h.c }, g.x, g.y);
        if (seg)
          prims.push({
            type: "segment",
            id: `region.${i}.boundary.${j}`,
            from: P(...seg[0]),
            to: P(...seg[1]),
            stroke: color,
            width: 2.5,
            dash: h.op === "<" || h.op === ">" ? "dash" : "solid",
            obstacle: true,
          });
      }
    }
    const curveData = (g.curves ?? []).map((c) => {
      const lo = Math.max(x0, c.domain?.[0] ?? -Infinity),
        hi = Math.min(x1, c.domain?.[1] ?? Infinity);
      const feat = features(c.fn, lo, hi);
      let a = Math.max(lo, feat.domain?.[0] ?? lo);
      if (c.fn.f === "log" && a <= (c.fn.h ?? 0)) a = (c.fn.h ?? 0) + 1e-9 * xr;
      const b = Math.min(hi, feat.domain?.[1] ?? hi);
      const f = (x: number) => evaluate(c.fn, x);
      const pieces =
        feat.domain && b > a
          ? sample(f, a, b, (x, y) => [x * s, -y * k * s], [
              ...feat.breaks,
              ...feat.vertical,
            ])
          : [];
      return { c, feat, pieces, a, b, f };
    });
    for (const r of g.curveRegions ?? []) {
      const d = curveData[r.curve];
      if (!d) continue;
      for (const [j, piece] of d.pieces.entries()) {
        const clamp = piece.map(([x, y]): Point => [
          x,
          Math.min(y1, Math.max(y0, y)),
        ]);
        const edge = r.side === "above" ? y1 : y0;
        prims.push({
          type: "polygon",
          id: `curve.${r.curve}.region.${j}`,
          points: [
            ...clamp,
            [clamp.at(-1)![0], edge],
            [clamp[0]![0], edge],
          ].map(([x, y]) => P(x, y)),
          fill: fills[r.color ?? "accent"],
          opacity: 0.75,
          noStroke: true,
        });
      }
    }
    // Axes, with arrows where they continue past the window.
    const ext = 14 / s;
    const both = (lo: number, hi: number, at: number) =>
      at > lo && at < hi ? "both" : "end";
    prims.push({
      type: "segment",
      id: "axis.x",
      from: P(ay === x0 ? x0 : x0 - ext, ax),
      to: P(x1 + ext, ax),
      arrow: both(x0, x1, ay) === "both" ? "both" : "end",
      stroke: "ink",
      width: 1.75,
      obstacle: true,
    });
    prims.push({
      type: "segment",
      id: "axis.y",
      from: P(ay, ax === y0 ? y0 : y0 - ext / k),
      to: P(ay, y1 + ext / k),
      arrow: both(y0, y1, ax) === "both" ? "both" : "end",
      stroke: "ink",
      width: 1.75,
      obstacle: true,
    });
    const [nx, ny] = g.axisNames ?? ["x", "y"];
    // A one-letter name is a variable; a word is a label.
    const nameFont = (n: string) => (/^[a-zA-Z]$/.test(n) ? "math" : "sans");
    // A variable sits past the arrow; a word sits under the axis's end,
    // below the tick labels, so long names never narrow the plot.
    prims.push(
      nameFont(nx) === "math"
        ? {
            type: "text",
            id: "axis.x.name",
            at: P(x1 + ext, ax),
            text: nx,
            font: "math",
            offset: [6, 0],
            align: [-1, 0],
          }
        : {
            type: "text",
            id: "axis.x.name",
            at: P(x1, ax),
            text: nx,
            font: "sans",
            offset: [0, 30],
            align: [1, -1],
          },
    );
    prims.push({
      type: "text",
      id: "axis.y.name",
      at: P(ay, y1 + ext / k),
      text: ny,
      font: nameFont(ny),
      offset: [0, -6],
      align: [0, 1],
    });
    // Tick labels: a stride that fits, from the grid or a nice step.
    const mode = g.labels ?? "auto";
    if (mode !== "none") {
      const fallback = nice(Math.max(xr, yr), 10);
      const bases = ([0, 1] as const).map((a) =>
        g.tick !== undefined
          ? axisStep(g.tick, a, fallback)
          : grid
            ? grid[a]
            : fallback,
      ) as [number, number];
      const widest = (vals: number[]) =>
        Math.max(0, ...vals.map((v) => typeset(num(v), "math", "sm").width));
      const pick = (
        base: number,
        vals: (step: number) => number[],
        gap: (step: number) => number,
        need: (step: number) => number,
      ) =>
        [1, 2, 5, 10, 20, 50]
          .map((m) => m * base)
          .find((st) => gap(st) >= need(st)) ?? base * 50;
      const xStep =
        mode === "all" || g.tick
          ? bases[0]
          : pick(
              bases[0],
              (st) => ticks(x0, x1, st),
              (st) => st * s,
              (st) => widest(ticks(x0, x1, st)) + 10,
            );
      const yStep =
        mode === "all" || g.tick
          ? bases[1]
          : pick(
              bases[1],
              (st) => ticks(y0, y1, st),
              (st) => st * k * s,
              () => 20,
            );
      // "ends": only the window's ends (and the origin), so the learner
      // counts gridlines; otherwise every stride tick.
      const xs = mode === "ends" ? [x0, x1] : ticks(x0, x1, xStep),
        ys = mode === "ends" ? [y0, y1] : ticks(y0, y1, yStep);
      const keep = (vals: number[]) => vals;
      for (const v of keep(xs)) {
        if (v === ay && ax === 0 && ay === 0) continue;
        prims.push({
          type: "tick",
          id: `tick.x.${v}`,
          at: P(v, ax),
          dir: [0, 1],
          length: 7,
          stroke: "ink",
        });
        prims.push({
          type: "text",
          id: `label.x.${v}`,
          at: P(v, ax),
          text: num(v),
          size: "sm",
          offset: [0, 6],
          align: [0, -1],
          halo: true,
          optional: true,
        });
      }
      for (const v of keep(ys)) {
        if (v === ax && ax === 0 && ay === 0) continue;
        prims.push({
          type: "tick",
          id: `tick.y.${v}`,
          at: P(ay, v),
          dir: [1, 0],
          length: 7,
          stroke: "ink",
        });
        prims.push({
          type: "text",
          id: `label.y.${v}`,
          at: P(ay, v),
          text: num(v),
          size: "sm",
          offset: [-6, 0],
          align: [1, 0],
          halo: true,
          optional: true,
        });
      }
      if (ax === 0 && ay === 0)
        prims.push({
          type: "text",
          id: "label.origin",
          at: P(0, 0),
          text: "0",
          size: "sm",
          offset: [-5, 5],
          align: [1, -1],
          halo: true,
        });
    }
    for (const [i, l] of (g.lines ?? []).entries()) {
      const seg = lineInWindow(l.line, g.x, g.y);
      if (!seg) continue;
      const color = l.color ?? "accent";
      prims.push({
        type: "segment",
        id: `line.${i}`,
        from: P(...seg[0]),
        to: P(...seg[1]),
        stroke: color,
        width: 2.5,
        dash: l.dash,
        arrow: "both",
        obstacle: true,
      });
      if (l.label)
        prims.push({
          type: "text",
          id: `line.${i}.label`,
          at: P(...seg[1]),
          text: l.label,
          color,
          halo: true,
          place: around(10).slice(1).concat(around(22)),
        });
    }
    for (const [i, c] of (g.circles ?? []).entries()) {
      const color = c.color ?? "accent";
      if (k === 1)
        prims.push({
          type: "circle",
          id: `circle.${i}`,
          center: c.center,
          r: c.r,
          stroke: color,
          width: 2.5,
          dash: c.dash,
        });
      else
        prims.push({
          type: "polygon",
          id: `circle.${i}`,
          points: Array.from({ length: 96 }, (_, j): Point => {
            const t = (j / 96) * 2 * Math.PI;
            return P(
              c.center[0] + c.r * Math.cos(t),
              c.center[1] + c.r * Math.sin(t),
            );
          }),
          fill: "none",
          stroke: color,
          width: 2.5,
          dash: c.dash,
        });
      if (c.radius)
        prims.push({
          type: "segment",
          id: `circle.${i}.radius`,
          from: P(...c.center),
          to: P(c.center[0] + c.r, c.center[1]),
          stroke: color,
          width: 1.75,
        });
      if (c.showCenter || c.radius)
        prims.push({
          type: "point",
          id: `circle.${i}.center`,
          at: P(...c.center),
          r: 4,
          color,
        });
    }
    for (const [i, d] of curveData.entries()) {
      const color = d.c.color ?? "accent";
      const visible = d.pieces.flatMap((piece) =>
        clipPolyline(piece, g.x, g.y),
      );
      for (const [j, piece] of visible.entries())
        prims.push({
          type: "polyline",
          id: `curve.${i}.piece.${j}`,
          points: piece.map(([x, y]) => P(x, y)),
          stroke: color,
          width: 2.75,
          dash: d.c.dash,
          obstacle: true,
        });
      // Endpoints of a restricted domain: closed, open, or an arrow.
      const ends =
        d.c.ends ?? (d.c.domain ? ["closed", "closed"] : ["none", "none"]);
      for (const [j, x] of [d.a, d.b].entries()) {
        const y = d.f(x);
        const style = ends[j]!;
        const restricted = d.c.domain && Math.abs(x - d.c.domain[j]!) < 1e-9;
        if (!Number.isFinite(y) || y < y0 || y > y1) continue;
        if ((style === "closed" || style === "open") && restricted)
          prims.push({
            type: "point",
            id: `curve.${i}.end.${j}`,
            at: P(x, y),
            r: 5,
            color,
            shape: style === "open" ? "open" : "dot",
          });
      }
      for (const [j, piece] of visible.entries())
        for (const side of [0, 1] as const) {
          if (ends[side] !== "arrow") continue;
          if (
            (side === 0 && j !== 0) ||
            (side === 1 && j !== visible.length - 1)
          )
            continue;
          const tip = side ? piece.at(-1)! : piece[0]!,
            prev = side ? piece.at(-2)! : piece[1]!;
          prims.push({
            type: "segment",
            id: `curve.${i}.arrow.${side}`,
            from: P(...prev),
            to: P(...tip),
            stroke: color,
            width: 2.75,
            arrow: "end",
          });
        }
      const feat = d.feat;
      const want = new Set(d.c.features ?? []);
      const inView = ([x, y]: Point) =>
        x >= x0 && x <= x1 && y >= y0 && y <= y1;
      const labelled = (id: string, p: Point) => {
        if (!d.c.featureLabels) return;
        prims.push({
          type: "text",
          id: `${id}.label`,
          at: P(...p),
          text: point(...p),
          size: "sm",
          derived: d.c.featureLabels === "derived",
          halo: true,
          place: around(9).concat(around(20)),
        });
      };
      if (want.has("asymptotes")) {
        for (const [j, x] of feat.vertical.entries())
          prims.push({
            type: "segment",
            id: `curve.${i}.asymptote.x.${j}`,
            from: P(x, y0),
            to: P(x, y1),
            stroke: "muted",
            width: 1.75,
            dash: "dash",
            data: { asymptote: `x=${x}` },
          });
        if (
          feat.horizontal !== null &&
          feat.horizontal >= y0 &&
          feat.horizontal <= y1
        )
          prims.push({
            type: "segment",
            id: `curve.${i}.asymptote.y`,
            from: P(x0, feat.horizontal),
            to: P(x1, feat.horizontal),
            stroke: "muted",
            width: 1.75,
            dash: "dash",
            data: { asymptote: `y=${feat.horizontal}` },
          });
        if (feat.slant) {
          const seg = lineInWindow(feat.slant, g.x, g.y);
          if (seg)
            prims.push({
              type: "segment",
              id: `curve.${i}.asymptote.slant`,
              from: P(...seg[0]),
              to: P(...seg[1]),
              stroke: "muted",
              width: 1.75,
              dash: "dash",
            });
        }
      }
      for (const [j, h] of feat.holes.entries())
        if (inView(h))
          prims.push({
            type: "point",
            id: `curve.${i}.hole.${j}`,
            at: P(...h),
            r: 5,
            shape: "open",
            color,
          });
      if (want.has("zeros"))
        for (const [j, z] of feat.zeros.entries())
          if (inView(z)) {
            prims.push({
              type: "point",
              id: `curve.${i}.zero.${j}`,
              at: P(...z),
              r: 5,
              color: "warm",
              data: { zero: z[0] },
            });
            labelled(`curve.${i}.zero.${j}`, z);
          }
      if (want.has("vertex") && feat.vertex && inView(feat.vertex)) {
        prims.push({
          type: "point",
          id: `curve.${i}.vertex`,
          at: P(...feat.vertex),
          r: 5.5,
          color: "gold",
          data: { vertex: feat.vertex.join(",") },
        });
        labelled(`curve.${i}.vertex`, feat.vertex);
      }
      if (want.has("yint") && feat.yint && inView(feat.yint)) {
        prims.push({
          type: "point",
          id: `curve.${i}.yint`,
          at: P(...feat.yint),
          r: 5,
          color: "warm",
          data: { yint: feat.yint[1] },
        });
        labelled(`curve.${i}.yint`, feat.yint);
      }
      if (d.c.label && visible.length) {
        const last = visible.at(-1)!;
        prims.push({
          type: "text",
          id: `curve.${i}.label`,
          at: P(...last.at(-1)!),
          text: d.c.label,
          color,
          halo: true,
          place: around(10).slice(1).concat(around(24)),
        });
      }
    }
    for (const [i, sg] of (g.segments ?? []).entries())
      prims.push({
        type: "segment",
        id: `segment.${i}`,
        from: P(...sg.from),
        to: P(...sg.to),
        stroke: sg.color ?? "ink",
        width: 2.5,
        dash: sg.dash,
        arrow: sg.arrow ? "end" : undefined,
      });
    for (const [i, t] of (g.slopeTriangles ?? []).entries()) {
      const [px, py] = t.from,
        [qx, qy] = t.to;
      const color = t.color ?? "warm";
      prims.push({
        type: "segment",
        id: `slope.${i}.run`,
        from: P(px, py),
        to: P(qx, py),
        stroke: color,
        width: 2.25,
        dash: "dash",
      });
      prims.push({
        type: "segment",
        id: `slope.${i}.rise`,
        from: P(qx, py),
        to: P(qx, qy),
        stroke: color,
        width: 2.25,
        dash: "dash",
      });
      if ((t.labels ?? "shown") !== "none") {
        const derived = t.labels === "derived";
        const up = qy > py,
          right = qx > px;
        prims.push({
          type: "text",
          id: `slope.${i}.run.label`,
          at: P((px + qx) / 2, py),
          text: num(qx - px),
          size: "sm",
          color,
          derived,
          halo: true,
          offset: [0, up ? 6 : -6],
          align: [0, up ? -1 : 1],
        });
        prims.push({
          type: "text",
          id: `slope.${i}.rise.label`,
          at: P(qx, (py + qy) / 2),
          text: num(qy - py),
          size: "sm",
          color,
          derived,
          halo: true,
          offset: [right ? 6 : -6, 0],
          align: [right ? -1 : 1, 0],
        });
      }
    }
    for (const [i, sc] of (g.secants ?? []).entries()) {
      const d = curveData[sc.curve];
      if (!d) continue;
      const a: Point = [sc.x[0], d.f(sc.x[0])],
        b: Point = [sc.x[1], d.f(sc.x[1])];
      const seg = lineInWindow({ through: [a, b] }, g.x, g.y);
      const color = sc.color ?? "gold";
      if (seg)
        prims.push({
          type: "segment",
          id: `secant.${i}`,
          from: P(...seg[0]),
          to: P(...seg[1]),
          stroke: color,
          width: 2,
          dash: "dash",
        });
      for (const [j, q] of [a, b].entries())
        prims.push({
          type: "point",
          id: `secant.${i}.point.${j}`,
          at: P(...q),
          r: 4.5,
          color,
        });
    }
    if (g.scatter) {
      const fit = g.scatter.fit;
      if (fit) {
        const seg = lineInWindow(fit, g.x, g.y);
        if (seg)
          prims.push({
            type: "segment",
            id: "fit",
            from: P(...seg[0]),
            to: P(...seg[1]),
            stroke: "gold",
            width: 2.5,
          });
        if (g.scatter.residuals)
          for (const [j, [x, y]] of g.scatter.points.entries())
            prims.push({
              type: "segment",
              id: `residual.${j}`,
              from: P(x, y),
              to: P(x, fit.m * x + fit.b),
              stroke: "warm",
              width: 1.75,
              data: { residual: clean(y - (fit.m * x + fit.b)) },
            });
      }
      const trial = g.scatter.trial;
      if (trial) {
        const seg = lineInWindow(trial, g.x, g.y);
        if (seg)
          prims.push({
            type: "segment",
            id: "trial",
            from: P(...seg[0]),
            to: P(...seg[1]),
            stroke: "axis",
            width: 2.5,
            dash: "dash",
          });
        if (g.scatter.residuals)
          for (const [j, [x, y]] of g.scatter.points.entries())
            prims.push({
              type: "segment",
              id: `trial.residual.${j}`,
              from: P(x, y),
              to: P(x, trial.m * x + trial.b),
              stroke: "gold",
              width: 1.75,
              data: { residual: clean(y - (trial.m * x + trial.b)) },
            });
      }
      if (fit && g.scatter.predict !== undefined) {
        const x = g.scatter.predict,
          y = fit.m * x + fit.b;
        prims.push(
          {
            type: "segment",
            id: "predict.guide.up",
            from: P(x, ax),
            to: P(x, y),
            stroke: "warm",
            width: 1.75,
            dash: "dash",
          },
          {
            type: "segment",
            id: "predict.guide.across",
            from: P(x, y),
            to: P(ay, y),
            stroke: "warm",
            width: 1.75,
            dash: "dash",
          },
          {
            type: "point",
            id: "predict",
            at: P(x, y),
            r: 5.5,
            color: "warm",
            data: { point: "predict" },
          },
          {
            type: "text",
            id: "predict.label",
            at: P(ay, y),
            text: num(y),
            bold: true,
            color: "warm",
            derived: true,
            halo: true,
            offset: [-8, 0],
            align: [1, 0],
          },
        );
      }
      for (const [j, q] of g.scatter.points.entries())
        prims.push({
          type: "point",
          id: `scatter.${j}`,
          at: P(...q),
          r: 4,
          color: "accent",
        });
    }
    for (const [i, p] of (g.points ?? []).entries()) {
      const color = p.color ?? "warm";
      prims.push({
        type: "point",
        id: `point.${i}`,
        at: P(p.x, p.y),
        r: 5.5,
        color,
        shape: p.open ? "open" : "dot",
        data: { point: p.label || i },
      });
      if (p.label)
        prims.push({
          type: "text",
          id: `point.${i}.label`,
          at: P(p.x, p.y),
          text: p.label,
          bold: true,
          color,
          derived: p.derived,
          halo: true,
          place: around(8).concat(around(20)),
        });
    }
    return prims;
  },
  describe(g, reveal) {
    const out = [
      `Coordinate plane with x from ${spoken(g.x[0])} to ${spoken(g.x[1])} and y from ${spoken(g.y[0])} to ${spoken(g.y[1])}${g.grid === false ? "" : gridWords(g)}.`,
    ];
    for (const r of g.regions ?? [])
      out.push(
        `Shaded: the points where ${r.halfPlanes
          .map((h) => inequalityWords(h))
          .join(
            ", and ",
          )}. ${r.halfPlanes.some((h) => h.op === "<" || h.op === ">") ? "A dashed boundary is not included." : "Solid boundaries are included."}`,
      );
    for (const l of g.lines ?? []) out.push(`The line ${lineText(l.line)}.`);
    for (const [i, c] of (g.curves ?? []).entries()) {
      const f = features(
        c.fn,
        c.domain?.[0] ?? g.x[0],
        c.domain?.[1] ?? g.x[1],
      );
      const parts = [`The graph of y = ${formula(c.fn)}`];
      if (c.domain)
        parts.push(
          `for x from ${spoken(c.domain[0])} to ${spoken(c.domain[1])}`,
        );
      out.push(`${parts.join(" ")}.`);
      const want = new Set(c.features ?? []);
      const hide = c.featureLabels === "derived" && !reveal;
      const say = (name: string, p: Point) =>
        hide
          ? `Its ${name} is marked.`
          : `Its ${name} is at ${spokenPoint(...p)}.`;
      if (want.has("vertex") && f.vertex) out.push(say("vertex", f.vertex));
      if (want.has("zeros") && f.zeros.length)
        out.push(
          hide
            ? `Its ${f.zeros.length === 1 ? "x-intercept is" : "x-intercepts are"} marked.`
            : `It crosses the x-axis at ${f.zeros.map((z) => `x = ${spoken(z[0])}`).join(" and ")}.`,
        );
      if (want.has("yint") && f.yint) out.push(say("y-intercept", f.yint));
      if (want.has("asymptotes")) {
        const a = [
          ...f.vertical.map((x) => `x = ${spoken(x)}`),
          ...(f.horizontal !== null ? [`y = ${spoken(f.horizontal)}`] : []),
          ...(f.slant ? [lineText(f.slant)] : []),
        ];
        if (a.length)
          out.push(
            `Dashed asymptote${a.length > 1 ? "s" : ""}: ${a.join(", ")}.`,
          );
      }
      if (f.holes.length)
        out.push(
          `An open circle marks a hole at ${f.holes.map((h) => spokenPoint(...h)).join(" and ")}.`,
        );
      void i;
    }
    for (const c of g.circles ?? [])
      out.push(
        `A circle with center ${spokenPoint(...c.center)} and radius ${spoken(c.r)}.`,
      );
    for (const t of g.slopeTriangles ?? [])
      out.push(
        t.labels === "derived" && !reveal
          ? `A slope triangle from ${spokenPoint(...t.from)} to ${spokenPoint(...t.to)} marks the run and rise.`
          : `A slope triangle from ${spokenPoint(...t.from)} to ${spokenPoint(...t.to)}: run ${spoken(t.to[0] - t.from[0])}, rise ${spoken(t.to[1] - t.from[1])}.`,
      );
    for (const sc of g.secants ?? [])
      out.push(
        `A secant line meets the graph at x = ${spoken(sc.x[0])} and x = ${spoken(sc.x[1])}.`,
      );
    if (g.scatter)
      out.push(
        `A scatter plot of ${g.scatter.points.length} points${g.scatter.fit ? `, with the line ${lineText(g.scatter.fit)}${g.scatter.residuals ? " and a residual segment from each point to the line" : ""}` : ""}.`,
      );
    if (g.scatter?.trial)
      out.push(`A trial line ${lineText(g.scatter.trial)} for comparison.`);
    if (g.scatter?.fit && g.scatter.predict !== undefined)
      out.push(
        `At x = ${spoken(g.scatter.predict)} the line predicts ${reveal ? spoken(g.scatter.fit.m * g.scatter.predict + g.scatter.fit.b) : "the number to find"}.`,
      );
    for (const p of g.points ?? [])
      out.push(
        p.label && !(p.derived && !reveal)
          ? `Point ${p.label} at ${spokenPoint(p.x, p.y)}.`
          : `A point at ${spokenPoint(p.x, p.y)}${p.label ? ", labeled with a question mark" : ""}.`,
      );
    return out.join(" ");
  },
});

export { opText };
