import type { SemanticFigure } from "../contracts";
import type { Scene } from "./spec";

/** Legacy figure kinds that now draw through the scene renderer. Each port
 * is proven by the gallery's side-by-side screenshots and the kind's tests. */
export const portedKinds = [
  "number-line",
  "clock",
  "coordinate-plane",
  "ten-frame",
  "line-plot",
  "double-dot-plot",
  "box-plot",
  "double-box-plot",
  "histogram",
  "scaled-bar-graph",
  "bar-chart",
  "picture-graph",
  "sort-shapes",
  "base-ten",
  "unit-array",
  "plane-shapes",
  "shape-puzzle",
  "solid-shape",
  "cube-prism",
  "box-prism",
  "composite-prism",
  "quadrant-grid",
] as const;
export type PortedKind = (typeof portedKinds)[number];
export function isPorted(
  f: SemanticFigure,
): f is Extract<SemanticFigure, { kind: PortedKind }> {
  return (portedKinds as readonly string[]).includes(f.kind);
}

/** Dot and box plots size their stacks and boxes in pixels, so their height
 * does not shrink with the scale. The fit grows the scale by the room left
 * under the ceiling each pass; a high ceiling lets it reach the full width
 * in a few passes instead of stopping squeezed (a tall double dot plot was
 * left 117 px wide under the default). */
const PLOT_CEILING = 720;

export function legacyScene(
  f: Extract<SemanticFigure, { kind: PortedKind }>,
): Scene {
  switch (f.kind) {
    // Geometry figures from before the scene port: the same data, one
    // component each (stored and offline problems still carry them).
    case "plane-shapes":
      return {
        v: 1,
        width: f.items.length === 1 ? 320 : 340,
        elements: [{ type: "shapes", id: "shapes", items: f.items }],
      };
    case "shape-puzzle":
      return {
        v: 1,
        width: 340,
        elements: [
          {
            type: "shapePuzzle",
            id: "puzzle",
            outline: f.outline,
            placed: f.placed,
            candidates: f.candidates,
          },
        ],
      };
    case "solid-shape":
      return {
        v: 1,
        width: 320,
        elements: [{ type: "solid", id: "solid", solid: f.solid }],
      };
    case "cube-prism":
      return {
        v: 1,
        width: 320,
        elements: [
          {
            type: "isoSolid",
            id: "prism",
            solid: {
              form: "cubes",
              length: f.length,
              width: f.width,
              height: f.height,
            },
          },
        ],
      };
    case "box-prism":
      return {
        v: 1,
        width: 320,
        // Labels stay at least 12 px when the figure shrinks to 150 px.
        maxHeight: 230,
        elements: [
          {
            type: "isoSolid",
            id: "prism",
            solid: {
              form: "box",
              length: f.length,
              width: f.width,
              height: f.height,
            },
          },
        ],
      };
    case "composite-prism":
      return {
        v: 1,
        width: 320,
        maxHeight: 230,
        elements: [
          {
            type: "isoSolid",
            id: "prism",
            solid: {
              form: "composite",
              width: f.width,
              parts: f.parts,
              unit: f.unit,
            },
          },
        ],
      };
    case "quadrant-grid":
      return quadrantScene(f.size, f.points);
    case "number-line":
      return {
        v: 1,
        elements: [
          {
            type: "numberLine",
            id: "line",
            min: f.min,
            max: f.max,
            marks: f.points.map((at) => ({ at, label: true })),
          },
        ],
      };
    case "clock":
      return {
        v: 1,
        width: 280,
        elements: [
          { type: "clock", id: "clock", hour: f.hour, minute: f.minute },
        ],
      };
    case "coordinate-plane":
      return {
        v: 1,
        width: 340,
        maxHeight: 340,
        elements: [
          {
            type: "graph",
            id: "plane",
            x: [f.xMin, f.xMax],
            y: [f.yMin, f.yMax],
            aspect: 1,
            grid: 1,
            labels: "ends",
            points: f.points.map((p) => ({ x: p.x, y: p.y, label: p.label })),
            lines: f.lines?.map((l) => ({ line: { m: l.m, b: l.b } })),
          },
        ],
      };
    case "ten-frame":
      return {
        v: 1,
        width: 300,
        elements: [
          {
            type: "tenFrame",
            id: "frame",
            frames: f.capacity === 20 ? 2 : 1,
            groups: [
              { count: f.first, shape: "dot", color: "accent" },
              { count: f.second, shape: "square", color: "warm" },
            ],
          },
        ],
      };
    case "line-plot":
      return {
        v: 1,
        maxHeight: PLOT_CEILING,
        elements: [
          {
            type: "dotPlot",
            id: "plot",
            min: f.start / f.denominator,
            max: f.end / f.denominator,
            ...(f.denominator > 1 ? { denominator: f.denominator } : {}),
            mark: f.mark,
            groups: [{ values: f.values.map((v) => v / f.denominator) }],
            unit: f.unit,
          },
        ],
      };
    case "double-dot-plot":
      return {
        v: 1,
        maxHeight: PLOT_CEILING,
        elements: [
          {
            type: "dotPlot",
            id: "plot",
            min: f.start,
            max: f.end,
            mark: "dot",
            groups: f.groups.map((g) => ({ label: g.label, values: g.values })),
            unit: f.unit,
          },
        ],
      };
    case "box-plot":
    case "double-box-plot":
      return {
        v: 1,
        maxHeight: PLOT_CEILING,
        elements: [
          {
            type: "boxPlot",
            id: "box",
            min: f.start,
            max: f.end,
            step: f.step,
            groups:
              f.kind === "box-plot"
                ? [{ summary: f.summary }]
                : f.groups.map((g) => ({ label: g.label, summary: g.summary })),
            unit: f.unit,
          },
        ],
      };
    case "base-ten":
      return {
        v: 1,
        width: 340,
        elements: [
          {
            type: "baseTen",
            id: "blocks",
            hundreds: f.hundreds,
            tens: f.tens,
            ones: f.ones,
          },
        ],
      };
    case "unit-array":
      return {
        v: 1,
        width: 340,
        elements: [
          {
            type: "array",
            id: "array",
            rows: f.rows,
            columns: f.columns,
            ...(f.splitAfterRow
              ? { splitAfterRow: f.splitAfterRow, regionLabels: true }
              : {}),
          },
        ],
      };
    case "histogram": {
      const peak = Math.max(...f.counts),
        step = peak > 10 ? 2 : 1;
      return {
        v: 1,
        elements: [
          {
            type: "barChart",
            id: "chart",
            bins: { start: f.start, width: f.width, counts: f.counts },
            max: Math.ceil(peak / step) * step,
            step,
            unit: "count",
            xUnit: f.unit,
          },
        ],
      };
    }
    case "bar-chart": {
      // A read-the-graph item: the bars carry no value labels, so the
      // learner reads each top against the gridlines. The finest nice step
      // with at most 14 gridlines, and a top an even number of steps up, so
      // the labeled gridlines (every one or every other) end on the top.
      const peak = Math.max(...f.values),
        step = [1, 2, 5, 10, 20, 50, 100].find((k) => peak / k <= 14) ?? 200;
      return {
        v: 1,
        elements: [
          {
            type: "barChart",
            id: "chart",
            bars: f.categories.map((label, i) => ({
              label,
              value: f.values[i]!,
            })),
            max: Math.max(2, Math.ceil(peak / (2 * step)) * 2) * step,
            step,
            unit: f.valueLabel,
          },
        ],
      };
    }
    case "scaled-bar-graph":
      return {
        v: 1,
        elements: [
          {
            type: "barChart",
            id: "chart",
            bars: f.categories.map((c) => ({ label: c.label, value: c.value })),
            max: f.max,
            step: f.step,
            unit: f.unit,
          },
        ],
      };
    case "picture-graph":
      return {
        v: 1,
        elements: [
          {
            type: "pictureGraph",
            id: "graph",
            rows: f.categories.map((c) => ({ label: c.label, count: c.count })),
            key: f.key,
            unit: f.unit,
          },
        ],
      };
    case "sort-shapes":
      return {
        v: 1,
        width: 340,
        elements: [{ type: "shapeSort", id: "shapes", shapes: f.shapes }],
      };
  }
}

/** The first quadrant with every whole-number gridline labeled. */
export function quadrantScene(
  size: number,
  points: { x: number; y: number; label: string }[],
  extra: Scene["elements"] = [],
  steps?: Scene["steps"],
): Scene {
  return {
    v: 1,
    width: 300,
    // As tall as the grid it replaces (280 px), so the answer dock fits.
    maxHeight: 280,
    elements: [
      {
        type: "graph",
        id: "grid",
        x: [0, size],
        y: [0, size],
        aspect: 1,
        grid: 1,
        labels: "all",
        points: points.map((p) => ({ x: p.x, y: p.y, label: p.label })),
      },
      ...extra,
    ],
    ...(steps ? { steps } : {}),
  };
}
