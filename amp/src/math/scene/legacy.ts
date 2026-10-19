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
  "picture-graph",
  "sort-shapes",
  "base-ten",
  "unit-array",
] as const;
export type PortedKind = (typeof portedKinds)[number];
export function isPorted(
  f: SemanticFigure,
): f is Extract<SemanticFigure, { kind: PortedKind }> {
  return (portedKinds as readonly string[]).includes(f.kind);
}

export function legacyScene(
  f: Extract<SemanticFigure, { kind: PortedKind }>,
): Scene {
  switch (f.kind) {
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
