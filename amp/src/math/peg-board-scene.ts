import type { Scene } from "./scene/spec";
import { scene } from "./scene/author";
import { pegPoint, parsePegBoard, type PegBoardResponse } from "./peg-board";

/** A printable board and a worked example share the same peg spacing. */
export function pegBoardScene(r: PegBoardResponse, raw?: string): Scene {
  const sticks = raw ? (parsePegBoard(r, raw)?.sticks ?? []) : r.given;
  const point = (id: number): [number, number] => {
    const [x, y] = pegPoint(id);
    return [x, -y];
  };
  const elements: Scene["elements"] = [
    { type: "rect", at: [-0.4, -4.4], size: [4.8, 4.8], fill: "none" },
    ...sticks.map(([a, b], i) => ({
      type: "segment" as const,
      id: `stick-${i}`,
      from: point(a),
      to: point(b),
      stroke: "accent" as const,
      width: r.skin === "draw" ? 3 : 6,
    })),
    ...Array.from({ length: 25 }, (_, i) => ({
      type: "circle" as const,
      id: `peg-${i}`,
      center: point(i),
      r: 0.09,
      fill: "warm" as const,
      stroke: "ink" as const,
      width: 1,
    })),
  ];
  if (r.copy) {
    for (let i = 0; i < 25; i++) {
      const [x, y] = point(i);
      elements.push({
        type: "circle",
        id: `reference-peg-${i}`,
        center: [x + 6, y],
        r: 0.06,
        fill: "ink",
      });
    }
    elements.push({
      type: "polygon",
      points: r.copy.pegs.map((id) => {
        const [x, y] = point(id);
        return [x + 6, y];
      }),
      fill: "none",
      stroke: "ink",
      width: 3,
    });
    elements.push({
      type: "text",
      at: [8, 0.6],
      text: "Copy this shape",
      size: "sm",
      font: "sans",
    });
  }
  return scene(...elements).build({
    width: 440,
    maxHeight: 260,
    title: raw ? "One way to build the shape" : "Join pegs with straight sides",
    note: r.copy
      ? `Copy the ${r.copy.pegs.length}-sided shape on the right. Both grids have five rows of five equally spaced pegs.`
      : "Five rows of five pegs. Count rows from the top and pegs from the left. Each row and column has equal spacing.",
  });
}
