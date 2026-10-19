import type { SemanticFigure } from "../contracts";
import type { Scene } from "./spec";

/** Legacy figure kinds that now draw through the scene renderer. Each port
 * is proven by the gallery's side-by-side screenshots and the kind's tests. */
export const portedKinds = [
  "number-line",
  "clock",
  "coordinate-plane",
  "ten-frame",
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
    width: 320,
    maxHeight: 320,
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
