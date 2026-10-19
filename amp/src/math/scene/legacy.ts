import type { SemanticFigure } from "../contracts";
import type { Scene } from "./spec";

/** Legacy figure kinds that now draw through the scene renderer. Each port
 * is proven by the gallery's side-by-side screenshots and the kind's tests. */
export const portedKinds = [
  "number-line",
  "clock",
  "coordinate-plane",
  "ten-frame",
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
  }
}
