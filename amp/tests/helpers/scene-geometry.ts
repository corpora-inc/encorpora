import {
  layoutScene,
  type Box,
  type Drawn,
  type Layout,
  type Scene,
} from "../../src/math/scene/index.js";

/**
 * Figure geometry as a learner sees it: a scene laid out for one container
 * and checked for the faults that make a figure unreadable. Labels never
 * touch one another, a mark (a dot), an arrowhead or an arrow's stroke;
 * everything lies inside the view box and the container; and every label is
 * at least a readable size once the figure is drawn at the container's width.
 */

/** Where a scene is drawn. `width`/`maxHeight` cap the scene's own size, as
 * the app relays a figure out for its box; `display` is the CSS width the
 * figure gets (it is never drawn wider than its layout). */
export type Container = {
  name: string;
  width?: number;
  maxHeight?: number;
  display: number;
};
/** The figure's own size: the figure panel on a wide screen, and print. */
export const OWN: Container = { name: "panel/print", display: 720 };
/** A phone's figure panel: scenes lay out at most 288 wide (useCompact). */
export const PHONE_PANEL: Container = {
  name: "panel 320",
  width: 288,
  display: 288,
};
/** A choice card on a 320 px phone: laid out at most 288 wide, drawn in the
 * card's 262 px (288 less the card's border and padding). */
export const PHONE_CARD: Container = {
  name: "choice card 320",
  width: 288,
  display: 262,
};
/** A choice card at 1280: two across, relaid at the card's width and the
 * shortest height FigureChoiceInput gives a figure. */
export const DESKTOP_CARD: Container = {
  name: "choice card 1280",
  width: 300,
  maxHeight: 160,
  display: 300,
};
export const CONTAINERS = [OWN, PHONE_PANEL, PHONE_CARD, DESKTOP_CARD];

/** Smallest base-line label size on screen, in CSS px (SceneSvg's
 * LEGIBLE_PX, less rounding), and for raised or stacked parts. */
export const MIN_TEXT_PX = 12;
export const MIN_SCRIPT_PX = 9;

export function fit(scene: Scene, c: Container): Scene {
  return {
    ...scene,
    ...(c.width !== undefined && {
      width: Math.max(160, Math.min(scene.width ?? 360, c.width)),
    }),
    ...(c.maxHeight !== undefined && {
      maxHeight: Math.max(80, Math.min(scene.maxHeight ?? 320, c.maxHeight)),
    }),
  };
}

type Text = Extract<Drawn, { k: "text" }>;
/** The box of a label's glyphs: its em box less internal leading (the box
 * the layout keeps clear). */
export const inkBox = (t: Text): Box => ({
  x0: t.x,
  y0: t.y - t.t.ascent * 0.82,
  x1: t.x + t.t.width,
  y1: t.y + t.t.descent * 0.6,
});
const meets = (a: Box, b: Box) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const inside = (b: Box, x: number, y: number) =>
  x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;

/** Points along a drawn path: M/L/Q/C commands (arcs use their bbox). */
function pathPoints(d: string): [number, number][] {
  const out: [number, number][] = [];
  let x = 0,
    y = 0;
  for (const [, c, body] of d.matchAll(/([MLQCZ])([^MLQCZA]*)/g)) {
    const v = body!
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (c === "M" || c === "L") {
      [x, y] = [v[0]!, v[1]!];
      out.push([x, y]);
    } else if (c === "Q") {
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        out.push([
          (1 - t) ** 2 * x + 2 * t * (1 - t) * v[0]! + t * t * v[2]!,
          (1 - t) ** 2 * y + 2 * t * (1 - t) * v[1]! + t * t * v[3]!,
        ]);
      }
      [x, y] = [v[2]!, v[3]!];
    } else if (c === "C") {
      for (let i = 1; i <= 24; i++) {
        const t = i / 24,
          u = 1 - t;
        out.push([
          u ** 3 * x +
            3 * u * u * t * v[0]! +
            3 * u * t * t * v[2]! +
            t ** 3 * v[4]!,
          u ** 3 * y +
            3 * u * u * t * v[1]! +
            3 * u * t * t * v[3]! +
            t ** 3 * v[5]!,
        ]);
      }
      [x, y] = [v[4]!, v[5]!];
    }
  }
  // Densify straight runs so a short label between two vertices is caught.
  const dense: [number, number][] = [];
  for (let i = 0; i < out.length; i++) {
    const [ax, ay] = out[i]!;
    dense.push([ax, ay]);
    const next = out[i + 1];
    if (!next) break;
    const n = Math.ceil(Math.hypot(next[0] - ax, next[1] - ay) / 2);
    for (let k = 1; k < n; k++)
      dense.push([
        ax + ((next[0] - ax) * k) / n,
        ay + ((next[1] - ay) * k) / n,
      ]);
  }
  return dense;
}
const linePoints = (d: Extract<Drawn, { k: "line" }>) =>
  pathPoints(`M${d.x1} ${d.y1}L${d.x2} ${d.y2}`);

function boxOf(d: Drawn): Box {
  switch (d.k) {
    case "line":
      return {
        x0: Math.min(d.x1, d.x2) - d.w / 2,
        y0: Math.min(d.y1, d.y2) - d.w / 2,
        x1: Math.max(d.x1, d.x2) + d.w / 2,
        y1: Math.max(d.y1, d.y2) + d.w / 2,
      };
    case "circle":
    case "image": {
      const r = d.r + ("w" in d ? (d.w ?? 0) / 2 : 1);
      return { x0: d.cx - r, y0: d.cy - r, x1: d.cx + r, y1: d.cy + r };
    }
    case "rect":
    case "billImage":
      return { x0: d.x, y0: d.y, x1: d.x + d.w, y1: d.y + d.h };
    case "text":
      return d.box;
    case "path": {
      if (d.bbox) return d.bbox;
      const n = d.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (let i = 0; i + 1 < n.length; i += 2) {
        b.x0 = Math.min(b.x0, n[i]!);
        b.x1 = Math.max(b.x1, n[i]!);
        b.y0 = Math.min(b.y0, n[i + 1]!);
        b.y1 = Math.max(b.y1, n[i + 1]!);
      }
      return b;
    }
  }
}

export type Fault = { rule: string; detail: string };

/** Every readability fault of one laid-out scene in one container. */
export function faults(scene: Scene, c: Container, reveal = false) {
  const fitted = fit(scene, c);
  const l = layoutScene(fitted, { reveal });
  return { layout: l, faults: layoutFaults(l, fitted, c) };
}

export function layoutFaults(l: Layout, scene: Scene, c: Container): Fault[] {
  const out: Fault[] = [];
  const W = scene.width ?? 360,
    H = scene.maxHeight ?? 320;
  if (l.width > W + 1 || l.height > H + 1)
    out.push({
      rule: "container",
      detail: `figure ${l.width}×${l.height} exceeds ${W}×${H}`,
    });
  const texts = l.items.filter((d): d is Text => d.k === "text");
  for (const d of l.items) {
    const b = boxOf(d);
    if (
      b.x0 < -0.5 ||
      b.y0 < -0.5 ||
      b.x1 > l.width + 0.5 ||
      b.y1 > l.height + 0.5
    )
      out.push({
        rule: "view box",
        detail: `${d.id} lies outside the view box`,
      });
  }
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++)
      if (meets(inkBox(texts[i]!), inkBox(texts[j]!)))
        out.push({
          rule: "label/label",
          detail: `"${texts[i]!.plain}" (${texts[i]!.id}) meets "${texts[j]!.plain}" (${texts[j]!.id})`,
        });
  // Marks: dots and small points; arrowheads; and the strokes of arrows.
  const heads = new Set(
    l.items.filter((d) => d.id.endsWith(".head")).map((d) => d.id.slice(0, -5)),
  );
  const marks = l.items.filter(
    (d) =>
      (d.k === "circle" && d.r <= 8 && d.fill !== "none") ||
      d.id.endsWith(".head"),
  );
  const arrows = l.items.filter(
    (d) => (d.k === "path" || d.k === "line") && heads.has(d.id),
  );
  for (const t of texts) {
    const b = inkBox(t);
    for (const m of marks)
      if (meets(b, boxOf(m)))
        out.push({
          rule: "label/mark",
          detail: `"${t.plain}" (${t.id}) covers ${m.id}`,
        });
    if (t.halo) continue;
    for (const a of arrows) {
      const pts =
        a.k === "path" ? pathPoints(a.d) : a.k === "line" ? linePoints(a) : [];
      if (pts.some(([x, y]) => inside(b, x, y)))
        out.push({
          rule: "label/arrow",
          detail: `"${t.plain}" (${t.id}) lies on the arrow ${a.id}`,
        });
    }
  }
  const scale = Math.min(1, c.display / l.width);
  for (const t of texts)
    for (const r of t.t.runs) {
      const px = r.size * scale,
        min = r.dy === 0 ? MIN_TEXT_PX : MIN_SCRIPT_PX;
      if (px < min - 1e-6) {
        out.push({
          rule: "text size",
          detail: `"${t.plain}" (${t.id}) draws at ${px.toFixed(1)} px < ${min}`,
        });
        break;
      }
    }
  return out;
}
