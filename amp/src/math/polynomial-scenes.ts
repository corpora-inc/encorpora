import { act, f, graph, lessonStep, lineTable, step } from "./scene/author";
import type { Fn, Scene } from "./scene/spec";
import { niceStep } from "./quadratic-scenes";

/**
 * Scenes for quadratic and polynomial structure: parabolas on an integer
 * grid, a parent parabola translated, polynomials with their zeros, and the
 * synthetic-division layout. Coefficients are exact; windows are chosen so
 * every feature the learner reads sits on a grid line.
 */

const minus = (v: number) => String(v).replace("-", "−");

/** Coefficients, highest power first, of lead·(x − r₁)(x − r₂)… */
export function fromRoots(lead: number, roots: number[]) {
  let c = [lead];
  for (const r of roots) {
    const next = Array<number>(c.length + 1).fill(0);
    c.forEach((v, i) => {
      next[i]! += v;
      next[i + 1]! -= v * r;
    });
    c = next;
  }
  return c;
}
const at = (desc: number[], x: number) =>
  desc.reduce((acc, c) => acc * x + c, 0);

/** An integer window holding the given x-values (and 0) with a margin, and
 * every value of the polynomial over it. */
export function polynomialWindow(desc: number[], xs: number[]) {
  const x0 = Math.min(-1, ...xs) - 1,
    x1 = Math.max(1, ...xs) + 1;
  // Size y to the turns between the zeros (and the y-intercept), not to the
  // far ends: the arms leave the window, and the bumps stay readable.
  const lo0 = Math.min(...xs),
    hi0 = Math.max(...xs);
  let m = Math.abs(at(desc, 0));
  for (let x = lo0; x <= hi0; x += 0.05) m = Math.max(m, Math.abs(at(desc, x)));
  m = Math.max(m * 1.4, 4);
  const g = niceStep(2 * m, 10);
  const top = Math.ceil(m / g) * g;
  return {
    x: [x0, x1] as [number, number],
    y: [-top, top] as [number, number],
    grid: g,
  };
}

/** y = a(x − h)² + k on a grid of 1, the vertex on a lattice point. Its
 * vertex is marked but not labelled: the learner reads it. */
export function parabolaOnGrid(a: number, h: number, k: number): Scene {
  const x0 = Math.min(-1, h - 4),
    x1 = Math.max(1, h + 4);
  const far = k + a * 16;
  const y0 = Math.min(-1, k - 1, far - 1),
    y1 = Math.max(1, k + 1, far + 1);
  return graph({
    id: "g",
    x: [x0, x1],
    y: [Math.max(y0, k - 12), Math.min(y1, k + 12)],
    grid: 1,
  })
    .curve(f.vertex(a, h, k), { features: ["vertex"] })
    .scene({ title: "A parabola on a coordinate grid" });
}

/** y = (x − h)² + k with the parent y = x² dashed beside it. */
export function shiftedParabola(h: number, k: number): Scene {
  const w = parentWindow(h, k);
  return graph({ id: "g", x: w.x, y: w.y, grid: 1 })
    .curve(f.poly(1, 0, 0), {
      domain: [-w.r, w.r],
      ends: ["none", "none"],
      color: "muted",
      dash: "dash",
    })
    .curve(f.vertex(1, h, k), {
      domain: [h - w.r, h + w.r],
      ends: ["arrow", "arrow"],
      features: ["vertex"],
    })
    .scene({ title: "The graph of y = x² and a translated parabola" });
}

/** Room for y = x² on [−r, r] at the origin and moved to (h, k). */
function parentWindow(h: number, k: number) {
  const r = 3;
  return {
    r,
    x: [Math.min(-r, h - r) - 1, Math.max(r, h + r) + 1] as [number, number],
    y: [Math.min(0, k) - 2, Math.max(r * r, k + r * r) + 1] as [number, number],
  };
}

/** The parent parabola sliding to y = (x − h)² + k: h across, then k up. */
export function shiftWalkthrough(h: number, k: number, form: string): Scene {
  const w = parentWindow(h, k);
  const across = h === 0 ? null : `${Math.abs(h)} ${h > 0 ? "right" : "left"}`,
    up = k === 0 ? null : `${Math.abs(k)} ${k > 0 ? "up" : "down"}`;
  const steps = [
    step(
      "Start from $y = x^2$, whose vertex is $(0, 0)$.",
      act.trace("g.curve.0"),
    ),
  ];
  if (across)
    steps.push(
      step(
        `Replacing $x$ with $x ${h > 0 ? "-" : "+"} ${Math.abs(h)}$ moves every point ${across}.`,
        act.move("g.curve.0", [h, 0]),
      ),
    );
  if (up)
    steps.push(
      step(
        `Adding ${minus(k)} to the output moves every point ${up}.`,
        act.move("g.curve.0", [0, k]),
      ),
    );
  steps.push(
    lessonStep(
      `The graph of $${form}$: vertex {g.point.0.label}.`,
      act.appear("g.point.0"),
    ),
  );
  return graph({ id: "g", x: w.x, y: w.y, grid: 1 })
    .curve(f.poly(1, 0, 0), { domain: [-w.r, w.r], ends: ["arrow", "arrow"] })
    .point(h, k, `(${minus(h)}, ${minus(k)})`, { derived: true })
    .scene({ title: "Translating y = x²", steps });
}

/** lead·(x − r₁)(x − r₂)… on an integer grid with its x-intercepts marked. */
export function zerosGraph(lead: number, roots: number[]): Scene {
  const desc = fromRoots(lead, roots);
  const w = polynomialWindow(desc, roots);
  let g = graph({
    id: "g",
    x: w.x,
    y: w.y,
    grid: [1, w.grid],
    tick: [1, w.grid],
  }).curve(poly(desc));
  // Each x-intercept is marked with its x-value, which a tick label at a
  // crossing cannot show (the curve passes through it).
  for (const z of [...new Set(roots)].sort((u, v) => u - v))
    g = g.point(z, 0, minus(z));
  return g.scene({ title: "A polynomial graph and its x-intercepts" });
}
const poly = (desc: number[]): Fn => f.poly(...desc);

/** One factor's zero sliding along the x-axis while the others stay: the
 * curve for each value of the moving zero, one after another. */
export function zeroSlide(
  lead: number,
  fixed: number[],
  path: number[],
  form: (z: number) => string,
): Scene {
  const all = path.map((z) => fromRoots(lead, [...fixed, z]));
  const xs = [...fixed, ...path];
  // Each curve sized by its own turns; x spans every position of the zero.
  const windows = all.map((d, i) => polynomialWindow(d, [...fixed, path[i]!]));
  const span = polynomialWindow(all[0]!, xs).x;
  const y: [number, number] = [
    Math.min(...windows.map((w) => w.y[0])),
    Math.max(...windows.map((w) => w.y[1])),
  ];
  const g = niceStep(y[1] - y[0], 10);
  let builder = graph({
    id: "g",
    x: span,
    y,
    grid: [1, g],
    tick: [1, g],
  });
  for (const d of all) builder = builder.curve(poly(d));
  // Fixed zeros are labelled once; each position of the moving zero has its
  // own point, shown with its curve.
  for (const z of fixed) builder = builder.point(z, 0, minus(z));
  for (const z of path) builder = builder.point(z, 0, minus(z));
  return builder.scene({
    title: "A zero moving with its factor",
    steps: path.map((z, i) =>
      step(
        `$y = ${form(z)}$: the factor $${z === 0 ? "x" : `x ${z < 0 ? "+" : "-"} ${Math.abs(z)}`}$ puts a zero at $x = ${z}$.`,
        ...(i
          ? [
              act.disappear(`g.curve.${i - 1}`),
              act.disappear(`g.point.${fixed.length + i - 1}`),
            ]
          : []),
        act.appear(`g.curve.${i}`),
        act.appear(`g.point.${fixed.length + i}`),
        act.highlight(`g.point.${fixed.length + i}`),
      ),
    ),
  });
}

/** The synthetic-division layout for p(x) ÷ (x − a): the divisor's zero, the
 * coefficients, and (in a walkthrough) the products and running sums. */
export function syntheticTableau(
  a: number,
  desc: number[],
  fill: "blank" | "filled",
): { scene: Scene; sums: number[] } {
  const sums: number[] = [];
  const products: number[] = [];
  for (const c of desc) {
    const product = sums.length ? a * sums[sums.length - 1]! : null;
    if (product !== null) products.push(product);
    sums.push(c + (product ?? 0));
  }
  const blank = fill === "blank";
  const rows = [
    [minus(a), ...desc.map(minus)],
    ["", "", ...products.map((v) => (blank ? "" : minus(v)))],
    ["", ...sums.map((v) => (blank ? "" : minus(v)))],
  ];
  return {
    sums,
    scene: lineTable(rows, { header: "column", total: 2 })
      .id("t")
      .scene({
        title: `Synthetic division by x ${a < 0 ? "+" : "−"} ${Math.abs(a)}`,
      }),
  };
}
