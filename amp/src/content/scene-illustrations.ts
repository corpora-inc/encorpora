import {
  act,
  f,
  graph,
  lineTable,
  rowBars,
  scene,
  step,
  table,
} from "../math/scene/author";
import type { Graph, Point } from "../math/scene/spec";

const g = (spec: Omit<Graph, "type">) => ({ type: "graph" as const, ...spec });
import type { Scene } from "../math/scene/spec";
import { quadraticStructureIllustrations } from "./quadratic-structure-illustrations";
import { functionToolkitIllustrations } from "./function-toolkit-illustrations";
import { exponentialLessonScenes } from "../math/exponential-scenes";
import { lessonScenes } from "./lesson-scenes";
import { similarityTrigScenes } from "./similarity-trig-scenes";
import { coordinateCircleScenes } from "./coordinate-circle-scenes";
import { powerScenes } from "./power-scenes";
import { statisticsModelScenes } from "./statistics-model-scenes";

/** Lesson models built with the scene framework, drawn revealed. */
export const sceneIllustrations = {
  "rational-expression-hole": graph({
    id: "g",
    x: [-1, 7],
    y: [-3, 4],
    grid: 1,
  })
    .curve(f.rational([1, -3], [1, -4]), { color: "accent" })
    .point(2, 0.5, "(2, 1/2)", { open: true, color: "warm" })
    .line({ a: 1, b: 0, c: 4 }, { dash: "dash", color: "warm" })
    .scene({
      title:
        "The rule y = (x − 3)/(x − 4), with the point (2, 1/2) removed. Both x = 2 and x = 4 are excluded from the original expression.",
      steps: [
        step(
          "Trace the simplified rule $y = (x - 3)/(x - 4)$.",
          act.trace("g.curve.0"),
        ),
        step(
          "The open circle removes the point at $x = 2$: the original denominator was 0 there.",
          act.highlight("g.point.0"),
        ),
        step(
          "The denominator is also 0 at $x = 4$. There is no curve point at this input.",
          act.highlight("g.line.0"),
        ),
      ],
    }),
  "nonlinear-system-example": graph({
    id: "g",
    x: [-3, 4],
    y: [-2, 8],
    grid: 1,
  })
    .curve(f.poly(1, 0, 0), { color: "accent" })
    .curve(f.poly(1, 2), { color: "warm", dash: "dash" })
    .point(-1, 1, "(-1, 1)")
    .point(2, 4, "(2, 4)")
    .scene({
      title:
        "The parabola y = x² and straight line y = x + 2 share (-1, 1) and (2, 4).",
      steps: [
        step(
          "Trace the parabola: each point follows $y = x^2$.",
          act.trace("g.curve.0"),
        ),
        step(
          "Trace the line: each point follows $y = x + 2$.",
          act.trace("g.curve.1"),
        ),
        step(
          "Both rules give the same point at $(-1, 1)$ and $(2, 4)$.",
          act.highlight("g.point.0"),
          act.highlight("g.point.1"),
        ),
      ],
    }),
  ...lessonScenes,
  ...similarityTrigScenes,
  ...coordinateCircleScenes,
  ...powerScenes,
  ...statisticsModelScenes,
  "scene-scatter-study": graph({
    x: [0, 10],
    y: [30, 100],
    grid: [1, 10],
    tick: [1, 10],
    aspect: 0.1029,
    axisNames: ["hours studied", "test score"],
  })
    .scatter([
      [1, 50],
      [2, 55],
      [2, 62],
      [3, 58],
      [4, 66],
      [5, 70],
      [5, 74],
      [6, 72],
      [7, 82],
      [8, 84],
      [9, 88],
      [10, 96],
    ])
    .scene(),
  "scene-scatter-curve": graph({
    x: [6, 20],
    y: [40, 90],
    grid: [2, 10],
    tick: [2, 10],
    aspect: 0.2016,
    axisNames: ["hour of the day", "temperature (°F)"],
  })
    .scatter([
      [6, 44],
      [8, 58],
      [10, 70],
      [12, 80],
      [14, 84],
      [16, 80],
      [18, 70],
      [20, 56],
    ])
    .scene(),
  "scene-scatter-trend": carTrend(),
  "scene-two-way-blank": table({
    title: "Has a curfew",
    columns: ["Yes", "No", "Total"],
    rows: [
      { label: "Grade 7", cells: [18, 2, 20] },
      { label: "Grade 8", cells: [null, null, 60] },
      { label: "Total", cells: [42, 38, 80] },
    ],
    sums: true,
    derived: [[1, 0]],
  }).scene(),
  "scene-two-way-bars": rowBars({
    id: "bars",
    parts: ["Yes", "No"],
    rows: [
      { label: "Grade 7", counts: [18, 2] },
      { label: "Grade 8", counts: [24, 36] },
    ],
  }).scene({
    steps: [
      step(
        "On one count scale, more eighth graders say yes: 24 against 18. But there are 60 eighth graders and only 20 seventh graders.",
        act.appear("bars.legend"),
        act.appear("bars.count"),
      ),
      step(
        "Stretch each row to the same length, 100%: now the yes parts compare as fractions of their own row, 90% against 40%.",
        act.appear("bars.percent", true),
      ),
    ],
  }),
  // f on −3 ≤ x < 4: the domain marked on the x-axis, the range on the y-axis.
  "domain-range-axes": scene(
    g({
      id: "g",
      x: [-5, 6],
      y: [-4, 6],
      grid: 1,
      curves: [
        {
          fn: f.poly(0.5, -1, -1.5),
          domain: [-3, 4],
          ends: ["closed", "open"],
        },
      ],
      segments: [
        { from: [-3, 0], to: [4, 0], color: "gold" },
        { from: [0, -2], to: [0, 6], color: "warm" },
      ],
      points: [
        { x: -3, y: 0, color: "gold", label: "−3" },
        { x: 4, y: 0, open: true, color: "gold", label: "4" },
        { x: 0, y: -2, color: "warm", label: "−2" },
        { x: 0, y: 6, color: "warm", label: "6" },
      ],
    }),
  ).build({
    title: "Domain −3 ≤ x < 4 on the x-axis and range −2 ≤ y ≤ 6 on the y-axis",
  }),
  // A repeated input with two outputs breaks a function.
  "relation-repeated-input": lineTable(
    [
      ["x", "1", "2", "2", "5"],
      ["y", "4", "3", "7", "4"],
    ],
    { highlight: [2, 3] },
  ).scene({ title: "The input 2 has two outputs, 3 and 7" }),
  // f(x) = x² − 2x − 1 from A (1, −2) to B (4, 7): the secant's slope is 9/3.
  "average-rate-secant": graph({ id: "g", x: [-3, 5], y: [-3, 9], grid: 1 })
    .curve(f.poly(1, -2, -1))
    .secant(0, 1, 4)
    .slope([1, -2], [4, 7], "shown")
    .point(1, -2, "A")
    .point(4, 7, "B")
    .scene({
      title: "Secant AB on y = x² − 2x − 1: rise 9 over run 3",
    }),
  // F = 2d + 3: the starting amount on the F-axis, the rate as a slope step.
  "linear-model-graph": graph({
    id: "g",
    x: [0, 7],
    y: [0, 17],
    grid: 1,
    tick: 2,
    axisNames: ["d", "F"],
  })
    .curve(f.poly(2, 3), { domain: [0, 6], ends: ["none", "none"] })
    .slope([2, 7], [3, 9], "shown")
    .point(0, 3, "(0, 3)")
    .scene({ title: "F = 2d + 3: starts at 3 and rises 2 per mile" }),
  // Isolating h in A = bh/2: each step undoes one operation on both sides.
  "formula-isolate-steps": lineTable(
    [
      ["A = bh/2", "Given"],
      ["2A = bh", "Multiply both sides by 2"],
      ["2A/b = h", "Divide both sides by b"],
    ],
    { header: "none", rules: "rows", align: ["left", "left"] },
  ).scene({ title: "Solving A = bh/2 for h" }),
  // The graph of 2x + 3y = 12 is exactly its solutions.
  "solution-set-line": graph({ id: "g", x: [-2, 8], y: [-2, 6], grid: 1 })
    .line({ a: 2, b: 3, c: 12 }, { label: "2x + 3y = 12" })
    .point(0, 4, "(0, 4)")
    .point(3, 2, "(3, 2)")
    .point(6, 0, "(6, 0)")
    .point(4, 4, "(4, 4)", { open: true })
    .scene({
      title: "Solutions of 2x + 3y = 12 lie on its line; (4, 4) does not",
    }),
  ...quadraticStructureIllustrations,
  ...functionToolkitIllustrations,
  // Two constraints and the axes: the feasible region, one point in, one out.
  "feasible-bakery": graph({
    id: "g",
    x: [0, 14],
    y: [0, 13],
    grid: 1,
    tick: 2,
  })
    .shade("x + y <= 12", "4x + 7y >= 60", "x >= 0", "y >= 0")
    .point(3, 8, "(3, 8)")
    .point(8, 2, "(8, 2)", { open: true })
    .scene({
      title: "x + y ≤ 12 and 4x + 7y ≥ 60: (3, 8) is feasible, (8, 2) is not",
    }),
  // y < 2x − 1: a dashed boundary, and the test point (0, 0) on the unshaded side.
  "half-plane-test-point": graph({ id: "g", x: [-5, 5], y: [-5, 5], grid: 1 })
    .shade("y < 2x - 1")
    .point(0, 0, "(0, 0)", { open: true })
    .scene({ title: "y < 2x − 1: dashed boundary; (0, 0) fails the test" }),
  // Solving 3(x − 4) = 18 with the reason for each step.
  "equation-step-reasons": lineTable(
    [
      ["3(x − 4) = 18", "Given"],
      ["3x − 12 = 18", "Distributive property"],
      ["3x = 30", "Addition property of equality"],
      ["x = 10", "Division property of equality"],
    ],
    { header: "none", rules: "rows", align: ["left", "left"] },
  ).scene({ title: "Solving 3(x − 4) = 18, step by step" }),
  // x + 2y = 7 above 3x − 2y = 5; their sum eliminates y.
  "elimination-stacked": lineTable(
    [
      ["", "x", "+ 2y", "=", "7"],
      ["+", "3x", "− 2y", "=", "5"],
      ["", "4x", "", "=", "12"],
    ],
    {
      header: "none",
      rules: "rows",
      total: 2,
      align: ["center", "right", "left", "center", "right"],
    },
  ).scene({ title: "Adding x + 2y = 7 and 3x − 2y = 5 gives 4x = 12" }),
  // The sum's line passes through the same solution as the original two.
  "elimination-lines": graph({ id: "g", x: [-1, 7], y: [-2, 6], grid: 1 })
    .line({ a: 1, b: 2, c: 7 }, { label: "x + 2y = 7" })
    .line({ a: 3, b: -2, c: 5 }, { label: "3x − 2y = 5", color: "warm" })
    .line({ x: 3 }, { label: "4x = 12", color: "gold", dash: "dash" })
    .point(3, 2, "(3, 2)")
    .scene({ title: "Three lines through the one solution (3, 2)" }),
  ...exponentialLessonScenes,
} as const satisfies Record<string, Scene>;
export type SceneIllustration = keyof typeof sceneIllustrations;
export const isSceneIllustration = (kind: string): kind is SceneIllustration =>
  kind in sceneIllustrations;

/** Used cars: a flat line at the typical value, then the trend line, with
 * the vertical gaps from the points to each. */
function carTrend() {
  const points: Point[] = [
    [1, 26],
    [2, 23],
    [3, 21],
    [4, 19],
    [5, 18],
    [6, 13],
    [7, 12],
    [8, 9],
    [9, 5],
    [10, 6],
  ];
  const fit = (x: number) => 26 - 2 * x;
  const level = Math.round(
    points.reduce((a, [, y]) => a + y, 0) / points.length,
  );
  const gaps = (line: (x: number) => number) =>
    points.reduce((a, [x, y]) => a + Math.abs(y - line(x)), 0);
  return graph({
    id: "g",
    x: [0, 10],
    y: [0, 30],
    grid: [1, 5],
    tick: [1, 5],
    aspect: 0.24,
    axisNames: ["age (years)", "value (thousand $)"],
  })
    .scatter(points, { m: -2, b: 26 }, true)
    .trial(0, level)
    .point(2, 22, undefined, { open: true })
    .point(8, 10, undefined, { open: true })
    .scene({
      steps: [
        step(
          `A flat line at ${level} ignores the trend: the gaps from the points to it add up to ${gaps(() => level)}.`,
          act.appear("g.trial"),
        ),
        step(
          `Tilt it to follow the points: the trend line’s gaps add up to only ${gaps(fit)}.`,
          act.disappear("g.trial"),
          act.highlight("g.fit"),
          act.appear("g.residual"),
        ),
      ],
    });
}
