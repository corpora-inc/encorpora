import {
  act,
  f,
  graph,
  lessonStep,
  lineTable,
  scene,
  step,
} from "./scene/author";
import type { Element, Fn, Scene } from "./scene/spec";
import type { Step } from "./scene/timeline";

/**
 * Scenes for the function toolkit: piecewise graphs whose pieces light up by
 * domain, a parent graph translated and stretched, an input flowing through
 * two function machines, a graph mirrored in y = x, and function tables.
 * Every value the learner reads sits on a grid line.
 */

const minus = (v: number) => String(v).replace("-", "−");

// ------------------------------------------------------------------ pieces
/** One linear piece y = mx + b on an interval; `null` ends are unbounded. */
export type Piece = {
  m: number;
  b: number;
  lo: number | null;
  hi: number | null;
  /** Whether the finite ends belong to the piece. */
  loIn: boolean;
  hiIn: boolean;
};
export const pieceAt = (p: Piece, x: number) => p.m * x + p.b;
export const inPiece = (p: Piece, x: number) =>
  (p.lo === null || x > p.lo || (p.loIn && x === p.lo)) &&
  (p.hi === null || x < p.hi || (p.hiIn && x === p.hi));

/** A window holding every piece's values over x in [x0, x1], on a grid of 1. */
export function piecewiseWindow(pieces: Piece[], x0 = -6, x1 = 6) {
  let lo = -2,
    hi = 2;
  for (const p of pieces) {
    const a = Math.max(x0, p.lo ?? x0),
      b = Math.min(x1, p.hi ?? x1);
    for (const x of [a, b]) {
      lo = Math.min(lo, pieceAt(p, x));
      hi = Math.max(hi, pieceAt(p, x));
    }
  }
  return {
    x: [x0, x1] as [number, number],
    y: [Math.max(-10, Math.floor(lo) - 1), Math.min(10, Math.ceil(hi) + 1)] as [
      number,
      number,
    ],
  };
}

/** The graph of a piecewise-linear function: one curve per piece, with open
 * and closed dots where a piece stops and arrows where it leaves the window.
 * `domains` adds each piece's interval on the x-axis (for walkthroughs). */
function piecewiseBuilder(
  pieces: Piece[],
  options: { level?: number; domains?: boolean } = {},
) {
  const w = piecewiseWindow(pieces);
  let g = graph({ id: "g", x: w.x, y: w.y, grid: 1, tick: 2 });
  pieces.forEach((p, i) => {
    const a = p.lo ?? w.x[0],
      b = p.hi ?? w.x[1];
    g = g.curve(f.poly(p.m, p.b), {
      domain: [a, b],
      ends: [
        p.lo === null ? "arrow" : p.loIn ? "closed" : "open",
        p.hi === null ? "arrow" : p.hiIn ? "closed" : "open",
      ],
      color: i % 2 ? "warm" : "accent",
    });
  });
  if (options.level !== undefined)
    g = g.line({ m: 0, b: options.level }, { dash: "dash", color: "ink" });
  if (options.domains)
    pieces.forEach((p, i) => {
      g = g.segment([p.lo ?? w.x[0], 0], [p.hi ?? w.x[1], 0], {
        color: i % 2 ? "warm" : "accent",
      });
    });
  return { g, w };
}
export function piecewiseGraph(
  pieces: Piece[],
  options: { level?: number } = {},
): Scene {
  return piecewiseBuilder(pieces, options).g.scene({
    title: "The graph of a function defined in pieces",
  });
}

/** Each piece lights up over its own domain; then the point at x = a. */
export function piecewiseWalkthrough(
  pieces: Piece[],
  rules: string[],
  conditions: string[],
  a?: number,
): Scene {
  const { g } = piecewiseBuilder(pieces, { domains: true });
  const steps: Step[] = pieces.map((_, i) =>
    step(
      `For $${conditions[i]}$ the rule is $${rules[i]}$.`,
      act.appear(`g.segment.${i}`),
      act.trace(`g.curve.${i}`),
      act.highlight(`g.curve.${i}`),
    ),
  );
  if (a === undefined)
    return g.scene({ title: "A function defined in pieces", steps });
  const i = pieces.findIndex((p) => inPiece(p, a));
  const y = pieceAt(pieces[i]!, a);
  steps.push(
    step(
      `$x = ${a}$ lies in $${conditions[i]}$: only that piece applies.`,
      act.highlight(`g.segment.${i}`),
      act.highlight(`g.curve.${i}`),
    ),
    lessonStep(
      `So the point on the graph is {g.point.0.label}.`,
      act.appear("g.point.0"),
    ),
  );
  return g
    .point(a, y, `(${minus(a)}, ${minus(y)})`, { derived: true, color: "ink" })
    .scene({ title: "A function defined in pieces", steps });
}

// --------------------------------------------------------- transformations
export type Parent = "square" | "abs" | "sqrt" | "cube";
/** a·p(x − h) + k as an exact function family. */
export function parentFn(p: Parent, a: number, h: number, k: number): Fn {
  switch (p) {
    case "square":
      return f.vertex(a, h, k);
    case "abs":
      return f.abs(a, h, k);
    case "sqrt":
      return f.sqrt(a, h, k);
    case "cube":
      // a(x − h)³ + k expanded.
      return f.poly(a, -3 * a * h, 3 * a * h * h, -a * h * h * h + k);
  }
}
/** The x-span drawn around a parent's key point so its shape reads. */
const spread = (p: Parent) =>
  p === "sqrt" ? [0, 5] : p === "cube" ? [-2, 2] : [-3, 3];

/** A window holding y = p(x) at its home and a·p(x − h) + k. */
export function transformWindow(p: Parent, a: number, h: number, k: number) {
  const [l, r] = spread(p) as [number, number];
  const at = (x: number, aa: number, hh: number, kk: number) => {
    const u = x - hh;
    const base =
      p === "square"
        ? u * u
        : p === "abs"
          ? Math.abs(u)
          : p === "sqrt"
            ? Math.sqrt(Math.max(0, u))
            : u * u * u;
    return aa * base + kk;
  };
  const ys: number[] = [0, k];
  for (let t = l; t <= r; t += 0.5) ys.push(at(t, 1, 0, 0), at(h + t, a, h, k));
  const clampY = (v: number) => Math.max(-10, Math.min(10, v));
  return {
    x: [Math.min(l, h + l) - 1, Math.max(r, h + r) + 1] as [number, number],
    y: [
      clampY(Math.floor(Math.min(...ys)) - 1),
      clampY(Math.ceil(Math.max(...ys)) + 1),
    ] as [number, number],
    span: [l, r] as [number, number],
  };
}

/** The parent dashed at home and the transformed curve solid, its key point
 * marked (the vertex, or the start of a square-root curve). */
export function transformGraph(
  p: Parent,
  a: number,
  h: number,
  k: number,
): Scene {
  const w = transformWindow(p, a, h, k);
  const ends =
    p === "sqrt" ? (["none", "arrow"] as const) : (["arrow", "arrow"] as const);
  return graph({ id: "g", x: w.x, y: w.y, grid: 1, tick: 2 })
    .curve(parentFn(p, 1, 0, 0), {
      domain: [w.span[0], w.span[1]],
      ends: ["none", "none"],
      color: "muted",
      dash: "dash",
    })
    .curve(parentFn(p, a, h, k), {
      domain: [h + w.span[0], h + w.span[1]],
      ends: [...ends],
    })
    .point(h, k)
    .scene({ title: "A parent graph, dashed, and a transformed graph" });
}

/**
 * y = p(x) becomes y = a·p(x − h) + k: the curve slides h across, stretches
 * (through flat, when a is negative) by a about the x-axis, then slides k up.
 * A stretch is a sequence of curves, each replacing the last.
 */
export function transformWalkthrough(
  p: Parent,
  a: number,
  h: number,
  k: number,
  parentTex: string,
  formTex: string,
): Scene {
  const w = transformWindow(p, a, h, k);
  const [l, r] = w.span;
  // Stretch frames between 1 and a, at the shifted position.
  const stages =
    a === 1
      ? []
      : a > 0
        ? [(1 + a) / 2, a]
        : a === -1
          ? [0, -1]
          : [0, a / 2, a];
  let g = graph({ id: "g", x: w.x, y: w.y, grid: 1, tick: 2 }).curve(
    parentFn(p, 1, 0, 0),
    { domain: [l, r], ends: ["none", "none"] },
  );
  for (const s of stages)
    g = g.curve(s === 0 ? f.poly(0) : parentFn(p, s, h, 0), {
      domain: [h + l, h + r],
      ends: ["none", "none"],
    });
  // The point one unit right of the key point carries the stretch: its
  // height 1 above the key point becomes a.
  if (a !== 1)
    g = g.segment([h + 1, 1], [h + 1, a], { arrow: true, color: "warm" });
  const across =
    h === 0
      ? null
      : `${Math.abs(h)} ${Math.abs(h) === 1 ? "unit" : "units"} ${h > 0 ? "right" : "left"}`;
  const up =
    k === 0
      ? null
      : `${Math.abs(k)} ${Math.abs(k) === 1 ? "unit" : "units"} ${k > 0 ? "up" : "down"}`;
  const steps: Step[] = [
    step(`Start from $y = ${parentTex}$.`, act.trace("g.curve.0")),
  ];
  if (across)
    steps.push(
      step(
        `Replacing $x$ with $x ${h > 0 ? "-" : "+"} ${Math.abs(h)}$ moves every point ${across}.`,
        act.move("g.curve.0", [h, 0]),
      ),
    );
  stages.forEach((s, i) => {
    const prev = i === 0 ? "g.curve.0" : `g.curve.${i}`;
    const actions = [act.disappear(prev), act.appear(`g.curve.${i + 1}`)];
    if (i === stages.length - 1) actions.push(act.appear("g.segment.0"));
    steps.push(
      step(
        i === stages.length - 1
          ? `Multiplying every output by $${a}$ ${a < 0 ? "reflects the curve across the $x$-axis and " : ""}${Math.abs(a) === 1 ? "keeps its shape" : `stretches it by $${Math.abs(a)}$`}: height $1$ becomes $${a}$.`
          : s === 0
            ? "As the multiplier shrinks to $0$ the curve flattens onto the $x$-axis."
            : `Multiplying every output by $${s}$ stretches the curve away from the $x$-axis.`,
        ...actions,
      ),
    );
  });
  const last = stages.length ? `g.curve.${stages.length}` : "g.curve.0";
  if (up)
    steps.push(
      step(
        `Adding $${k}$ to every output moves the curve ${up}.`,
        act.move(last, [0, k]),
        ...(a !== 1 ? [act.move("g.segment.0", [0, k])] : []),
      ),
    );
  steps.push(
    lessonStep(
      `The result is $y = ${formTex}$, with key point {g.point.0.label}.`,
      act.appear("g.point.0"),
    ),
  );
  return g
    .point(h, k, `(${minus(h)}, ${minus(k)})`, { derived: true, color: "ink" })
    .scene({ title: "A parent graph translated and stretched", steps });
}

// ------------------------------------------------------------- composition
/**
 * Two function machines in a row: the input enters the inner function, its
 * output enters the outer one. `values` are the input, the middle value and
 * the output; a middle or output value of null is drawn as "?". In a
 * walkthrough the values are derived and a token carries the input along.
 */
export function machineScene(
  inner: { name: string; rule: string },
  outer: { name: string; rule: string },
  values: [string, string | null, string | null],
  walk = false,
): Scene {
  const y = 0;
  const parts: Element[] = [];
  const value = (id: string, x: number, v: string | null, derived: boolean) =>
    parts.push({
      type: "text",
      id,
      at: [x, y],
      text: v ?? "?",
      font: "math",
      size: "lg",
      ...(derived && v !== null ? { derived: true } : {}),
    });
  const box = (
    id: string,
    x: number,
    m: { name: string; rule: string },
    color: "accent-fill" | "warm-fill",
  ) => {
    parts.push(
      {
        type: "rect",
        id,
        at: [x, y - 0.8],
        size: [2.4, 1.6],
        radius: 8,
        fill: color,
        stroke: color === "accent-fill" ? "accent" : "warm",
      },
      {
        type: "text",
        id: `${id}-name`,
        at: [x + 1.2, y],
        text: m.name,
        font: "math",
        size: "lg",
      },
      {
        type: "text",
        id: `${id}-rule`,
        at: [x + 1.2, y + 1.5],
        text: m.rule,
        font: "math",
        size: "sm",
      },
    );
  };
  value("in", 0, values[0], false);
  parts.push({
    type: "arrow",
    id: "a1",
    from: [0.9, y],
    to: [2.1, y],
    stroke: "ink",
  });
  box("inner", 2.2, inner, "accent-fill");
  parts.push({
    type: "arrow",
    id: "a2",
    from: [4.7, y],
    to: [5.9, y],
    stroke: "ink",
  });
  value("mid", 6.8, values[1], walk);
  parts.push({
    type: "arrow",
    id: "a3",
    from: [7.7, y],
    to: [8.9, y],
    stroke: "ink",
  });
  box("outer", 9, outer, "warm-fill");
  parts.push({
    type: "arrow",
    id: "a4",
    from: [11.5, y],
    to: [12.7, y],
    stroke: "ink",
  });
  value("out", 13.6, values[2], walk);
  if (walk)
    parts.push({
      type: "circle",
      id: "token",
      center: [0, y - 1.4],
      r: 0.22,
      fill: "accent",
      stroke: "accent",
    });
  const built = scene(...parts);
  if (!walk)
    return built.build({
      title: `An input through ${inner.name}, then ${outer.name}`,
    });
  return built.build({
    title: `An input through ${inner.name}, then ${outer.name}`,
    steps: [
      step(`The input is $${values[0]}$.`, act.highlight("in")),
      step(
        `It enters $${inner.name}$ first: $${inner.rule}$.`,
        act.move("token", [3.4, 0]),
        act.highlight("inner"),
      ),
      lessonStep(
        `$${inner.name}$ outputs {mid}.`,
        act.move("token", [3.4, 0]),
        act.appear("mid"),
      ),
      lessonStep(
        `That output is $${outer.name}$'s input: $${outer.rule}$.`,
        act.move("token", [3.4, 0]),
        act.highlight("outer"),
      ),
      lessonStep(
        `$${outer.name}$ outputs {out}.`,
        act.move("token", [3.4, 0]),
        act.appear("out"),
      ),
    ],
  });
}

// ----------------------------------------------------------------- inverses
/**
 * y = f(x) and its inverse mirror in y = x: the point (a, b) swaps to (b, a).
 * `inverse` is the inverse's exact curve when it has one.
 */
export function reflectionScene(
  fn: Fn,
  fnDomain: [number, number],
  inverse: Fn,
  inverseDomain: [number, number],
  point: [number, number],
  window: [number, number],
  labels: [string, string],
): Scene {
  const [a, b] = point;
  return graph({ id: "g", x: window, y: window, grid: 1, tick: 2, aspect: 1 })
    .line({ m: 1, b: 0 }, { dash: "dash", color: "ink", label: "y = x" })
    .curve(fn, { domain: fnDomain, ends: ["none", "none"], label: labels[0] })
    .curve(inverse, {
      domain: inverseDomain,
      ends: ["none", "none"],
      color: "warm",
      label: labels[1],
    })
    .point(a, b, `(${minus(a)}, ${minus(b)})`)
    .point(b, a, `(${minus(b)}, ${minus(a)})`, { derived: true, color: "warm" })
    .segment([a, b], [b, a], { dash: "dot", color: "ink" })
    .scene({
      title: "A function and its inverse mirror in the line y = x",
      steps: [
        step(
          `Start from the graph of $f$ through $(${a}, ${b})$.`,
          act.trace("g.curve.0"),
          act.appear("g.point.0"),
        ),
        step("The line $y = x$ is the mirror.", act.appear("g.line.0")),
        step(
          `Swapping the coordinates of $(${a}, ${b})$ reflects it across $y = x$.`,
          act.trace("g.segment.0"),
        ),
        lessonStep(
          `It lands on {g.point.1.label}, a point of $f^{-1}$.`,
          act.appear("g.point.1"),
        ),
        lessonStep(
          "Swapping every point's coordinates draws the inverse: the mirror image of $f$.",
          act.trace("g.curve.1"),
        ),
      ],
    });
}

/** A function given by points, mirrored point by point in y = x. */
export function reflectPointsScene(
  points: [number, number][],
  window: [number, number],
): Scene {
  let g = graph({
    id: "g",
    x: window,
    y: window,
    grid: 1,
    tick: 2,
    aspect: 1,
  }).line({ m: 1, b: 0 }, { dash: "dash", color: "ink", label: "y = x" });
  for (const [x, y] of points)
    g = g.point(x, y, undefined, { color: "accent" });
  for (const [x, y] of points) g = g.point(y, x, undefined, { color: "warm" });
  const n = points.length;
  const of = (from: number) =>
    Array.from({ length: n }, (_, i) => act.appear(`g.point.${from + i}`));
  return g.scene({
    title: "Points of a function and of its inverse, mirrored in y = x",
    steps: [
      step("The points of $f$.", ...of(0)),
      step("The line $y = x$ is the mirror.", act.appear("g.line.0")),
      lessonStep(
        "Swapping each pair of coordinates gives the points of $f^{-1}$, mirrored in $y = x$.",
        ...of(n),
      ),
    ],
  });
}

// ------------------------------------------------------------------ tables
/** A function table read across: a heading column, then one column per x. */
export function valueTable(rows: [string, ...(string | number)[]][]): Scene {
  return lineTable(
    rows.map(([head, ...cells]) => [head, ...cells.map(String)]),
    { header: "column" },
  )
    .id("t")
    .scene({ title: "A table of function values" });
}

/** f's formula drawn as a curve and g's table as points, on one grid. */
export function compareScene(
  fn: Fn,
  points: [number, number][],
  window: { x: [number, number]; y: [number, number]; grid: number },
): Scene {
  let g = graph({
    id: "g",
    x: window.x,
    y: window.y,
    grid: [1, window.grid],
    tick: [1, window.grid],
  }).curve(fn, {
    label: "y = f(x)",
    features: ["vertex"],
  });
  for (const [x, y] of points) g = g.point(x, y, undefined, { color: "warm" });
  return g.scene({
    title: "A function from its formula beside one from its table",
    steps: [
      step("Draw $f$ from its formula.", act.trace("g.curve.0")),
      step("Plot $g$ from its table.", act.appear("g.point", true)),
      lessonStep(
        "Now both read on one scale: compare the highest points.",
        act.highlight("g.curve.0.vertex"),
      ),
    ],
  });
}
