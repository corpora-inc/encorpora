import type { PathOp, Scene } from "./scene/spec";
import {
  parseShapeAnswer,
  placedCells,
  shapePath,
  type ShapeCell,
  type ShapeComposerResponse,
} from "./shape-composer";

/** Scene paths use upward y. Quarter-circle arcs use the usual cubic display
 * approximation; the interactive board renders circular SVG arcs directly. */
function path(cells: ShapeCell[], dx = 0, dy = 0): PathOp[] {
  const tokens = shapePath(cells).match(/[MLAZ]|-?\d+(?:\.\d+)?/g)!,
    out: PathOp[] = [];
  let x = 0,
    y = 0;
  const point = (a: number, b: number): [number, number] => [a + dx, -b - dy];
  for (let i = 0; i < tokens.length;) {
    const op = tokens[i++]!;
    if (op === "Z") {
      out.push(["Z"]);
      continue;
    }
    if (op === "A") {
      i += 5;
      const a = Number(tokens[i++]),
        b = Number(tokens[i++]);
      const cx = (x + a - b + y) / 2,
        cy = (y + b + a - x) / 2,
        k = 0.5522847498307936;
      out.push([
        "C",
        ...point(x - k * (y - cy), y + k * (x - cx)),
        ...point(a + k * (b - cy), b - k * (a - cx)),
        ...point(a, b),
      ]);
      x = a;
      y = b;
    } else {
      x = Number(tokens[i++]);
      y = Number(tokens[i++]);
      out.push([op as "M" | "L", ...point(x, y)]);
    }
  }
  return out;
}
export function shapeComposerScene(
  r: ShapeComposerResponse,
  raw?: string,
): Scene {
  const answer = raw ? parseShapeAnswer(r, raw) : null;
  const elements: Scene["elements"] = [];
  r.stages.forEach((stage, i) => {
    const minX = Math.min(...stage.target.map((c) => c.x)),
      minY = Math.min(...stage.target.map((c) => c.y)),
      targetWidth = Math.max(...stage.target.map((c) => c.x + 1)) - minX,
      dy = answer ? -minY : i * 8.5,
      dx = answer ? i * 6 - minX : 0;
    if (!answer)
      elements.push({
        type: "rect",
        at: [dx, -dy - 4],
        size: [5, 4],
        stroke: "grid",
        fill: "none",
        width: 1,
      });
    if (r.stages.length > 1)
      elements.push({
        type: "text",
        at: answer ? [i * 6 + targetWidth / 2, 0.35] : [dx + 2.5, -dy + 0.35],
        text: `Shape ${i + 1}`,
        font: "sans",
        size: "sm",
      });
    if (answer)
      for (const [j, p] of answer[i]!.entries())
        elements.push({
          type: "path",
          id: `stage-${i}-piece-${j}`,
          d: path(
            placedCells(
              stage.tray.find((t) => t.id === p.pieceId)!,
              p,
            ),
            dx,
            dy,
          ),
          fill: j % 2 ? "gold-fill" : "accent-fill",
          stroke: "ink",
          width: 1.5,
        });
    elements.push({
      type: "path",
      d: path(stage.target, dx, dy),
      fill: "none",
      stroke: "ink",
      width: 2.5,
    });
    if (!answer) {
      let x = 0;
      const trayHeight = Math.max(
        ...stage.tray.flatMap((p) => p.cells.map((c) => c.y + 1)),
      );
      for (const p of stage.tray) {
        elements.push({
          type: "path",
          d: path(p.cells, x, dy + 4.6),
          fill: "accent-fill",
          stroke: "ink",
          width: 1.5,
        });
        elements.push({
          type: "text",
          at: [x, -dy - 4.6 - trayHeight - 0.45],
          text: `${p.copies} ${p.name}${p.copies === 1 ? "" : "s"}`,
          font: "sans",
          size: "sm",
          align: [-1, 0],
        });
        x += Math.max(2.4, Math.max(...p.cells.map((c) => c.x)) + 1.8);
      }
    }
  });
  return {
    v: 1,
    title: answer
      ? "Pieces joined to fill each outline"
      : "Outline and pieces to draw inside it",
    note: answer
      ? "Shared sides show how smaller pieces make each whole shape."
      : "Draw the pieces inside each outline without gaps or overlaps.",
    width: answer && r.stages.length > 1 ? 420 : 360,
    elements,
  };
}
