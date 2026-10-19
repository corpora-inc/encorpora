import { act, f, graph, lessonStep, polyArea, step } from "./scene/author";
import type { Scene } from "./scene/spec";

/**
 * Quadratic scenes: a parabola with its vertex, axis and zeros, and the
 * algebra-tile square that completing the square builds. Each takes only
 * exact integer coefficients.
 */

/** A spacing of 1, 2 or 5 times a power of ten giving at most `lines` lines. */
export function niceStep(span: number, lines = 12) {
  const raw = span / lines,
    p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw)!;
}

/** A window around a parabola's vertex that includes the origin and shows
 * both arms rising (or falling) at least four units from the axis. */
export function parabolaWindow(a: number, b: number, c: number) {
  const vx = -b / (2 * a),
    vy = c - (b * b) / (4 * a);
  const x0 = Math.min(-1, Math.floor(vx) - 4),
    x1 = Math.max(1, Math.ceil(vx) + 4);
  const at = (x: number) => a * x * x + b * x + c;
  const arm = Math.max(Math.abs(at(vx - 3) - vy), 4);
  const ys = [0, vy, vy + Math.sign(a) * arm];
  const span = Math.max(...ys) - Math.min(...ys);
  const g = niceStep(span + 2, 10);
  const y0 = Math.floor((Math.min(...ys) - g) / g) * g,
    y1 = Math.ceil((Math.max(...ys) + g) / g) * g;
  return {
    x: [x0, x1] as [number, number],
    y: [y0, y1] as [number, number],
    grid: g,
    vx,
    vy,
  };
}

/** Graphs fit when the vertex lies near the origin: |vx| ≤ 8, |vy| ≤ 60. */
export const parabolaFits = (a: number, b: number, c: number) => {
  const { vx, vy } = parabolaWindow(a, b, c);
  return Math.abs(vx) <= 8 && Math.abs(vy) <= 60;
};

/** An exact rational n/d as a scene label ("−3/2") and as TeX. */
export function ratio(n: number, d: number) {
  if (d < 0) [n, d] = [-n, -d];
  let g = Math.abs(n),
    e = d;
  while (e) [g, e] = [e, g % e];
  g ||= 1;
  [n, d] = [n / g, d / g];
  const m = Math.abs(n);
  return {
    label: `${n < 0 ? "−" : ""}${m}${d === 1 ? "" : `/${d}`}`,
    tex: `${n < 0 ? "-" : ""}${d === 1 ? m : `\\frac{${m}}{${d}}`}`,
  };
}

/** y = ax² + bx + c with its vertex and axis of symmetry. The walkthrough
 * traces the curve, marks the vertex the completed-square form names, then
 * draws the axis through it. `given` and `form` are TeX. */
export function vertexGraph(
  a: number,
  b: number,
  c: number,
  given: string,
  form: string,
): Scene {
  const w = parabolaWindow(a, b, c);
  const vx = ratio(-b, 2 * a),
    vy = ratio(4 * a * c - b * b, 4 * a);
  return graph({
    id: "g",
    x: w.x,
    y: w.y,
    grid: [1, w.grid],
    tick: [1, w.grid],
  })
    .curve(f.poly(a, b, c), { features: ["vertex"] })
    .line({ x: w.vx }, { dash: "dash" })
    .point(w.vx, w.vy, `(${vx.label}, ${vy.label})`, { derived: true })
    .scene({
      title: "A parabola with its vertex and axis of symmetry",
      steps: [
        step(`The graph of $y = ${given}$.`, act.trace("g.curve.0")),
        step(
          `In $${form}$ the squared term is never negative${a < 0 ? " and is multiplied by a negative number" : ""}, so $y$ is ${a > 0 ? "least" : "greatest"} where the square is $0$.`,
          act.highlight("g.curve.0.vertex"),
        ),
        lessonStep(
          `That point is the vertex, $(${vx.tex}, ${vy.tex})$. The axis of symmetry is the line $x = ${vx.tex}$.`,
          act.appear("g.line.0"),
          act.appear("g.point.0"),
        ),
      ],
    });
}

/** x² + bx as algebra tiles (b even, |b| ≤ 24): an x² square with half of
 * the x strips on each side and the corner left empty. The walkthrough
 * splits the strips, then fills the corner with (b/2)² unit tiles. */
export function completeSquareTiles(b: number, walkthrough = true): Scene {
  const h = b / 2;
  if (!Number.isInteger(h) || h === 0 || Math.abs(h) > 12)
    throw new Error("Tiles need an even nonzero b with |b| ≤ 24");
  const half = `${Math.abs(h) === 1 ? "" : Math.abs(h)}x`;
  const sign = h < 0 ? "−" : "";
  return polyArea(
    [
      [1, 1],
      [h, 0],
    ],
    [
      [1, 1],
      [h, 0],
    ],
    { products: "shown", missing: [[1, 1]] },
  )
    .id("t")
    .scene({
      title: `x² ${b < 0 ? "−" : "+"} ${Math.abs(b)}x as algebra tiles`,
      steps: !walkthrough
        ? undefined
        : [
            step(
              "Start with the x² tile.",
              act.appear("t.region.0.0"),
              act.appear("t.across.0"),
              act.appear("t.down.0"),
            ),
            step(
              `Split the ${Math.abs(b)} x strips into two equal halves: ${sign}${half} along the right and ${sign}${half} along the bottom.`,
              act.appear("t.region.1.0"),
              act.appear("t.region.0.1"),
              act.appear("t.across.1"),
              act.appear("t.down.1"),
            ),
            step(
              `The shape is a square missing its corner, a ${Math.abs(h)}-by-${Math.abs(h)} block of unit tiles.`,
              act.appear("t.region.1.1"),
              act.highlight("t.region.1.1"),
            ),
            lessonStep(
              `Add the ${h * h} unit tiles: x² ${b < 0 ? "−" : "+"} ${Math.abs(b)}x + ${h * h} = (x ${h < 0 ? "−" : "+"} ${Math.abs(h)})².`,
              act.fill("t.region.1.1", "empty"),
              act.highlight("t.region.1.1"),
            ),
          ],
    });
}
