import type { SemanticFigure } from "../contracts";
import {
  areaModel,
  array,
  baseTen,
  clock,
  f,
  fractionBar,
  graph,
  numberLine,
  tenFrame,
} from "./author";
import type { Scene } from "./spec";
import {
  exponentialGraph,
  exponentialLessonScenes,
  logGraph,
  raceBars,
  raceGraph,
  stepTable,
} from "../exponential-scenes";

/** Reference scenes for every component: the gallery renders them at four
 * widths in both themes, and the unit tests lay every one of them out. */
export type GalleryCase = {
  name: string;
  scene: Scene;
  reveal?: boolean;
  /** A legacy figure this scene replaces, drawn beside it for parity. */
  legacy?: SemanticFigure;
};

export const galleryCases: GalleryCase[] = [
  {
    name: "Number line: make ten, then add the rest (hint)",
    scene: numberLine({ id: "nl", min: 0, max: 20 })
      .mark(8)
      .hop(8, 2, { landing: "shown" })
      .then(3)
      .scene({ title: "8 + 5 on a number line" }),
  },
  {
    name: "Number line: the same jumps, revealed (lesson)",
    reveal: true,
    scene: numberLine({ id: "nl", min: 0, max: 20 })
      .mark(8)
      .hop(8, 2, { landing: "shown" })
      .then(3)
      .scene({ title: "8 + 5 on a number line" }),
  },
  {
    name: "Number line: fourths",
    scene: numberLine({ min: 0, max: 2, denominator: 4, labels: "auto" })
      .mark(0.75, { label: "3/4" })
      .mark(1.5, { label: "6/4", color: "accent" })
      .scene(),
  },
  {
    name: "Number line: x ≥ −2 and x < 3",
    scene: numberLine({ min: -5, max: 5 })
      .interval(-2, 3, [false, true])
      .scene(),
  },
  {
    name: "Number line: subtract with a backward jump",
    scene: numberLine({ min: 30, max: 60, step: 1 })
      .mark(52)
      .hop(52, -17)
      .scene(),
  },
  {
    name: "Parabola: vertex and zeros",
    reveal: true,
    scene: graph({ id: "g", x: [-5, 5], y: [-5, 5] })
      .curve(f.vertex(1, 1, -4), {
        features: ["vertex", "zeros", "yint"],
        featureLabels: "derived",
        label: "y = (x − 1)^2 − 4",
      })
      .scene(),
  },
  {
    name: "Rational: asymptotes and a hole",
    scene: graph({ x: [-6, 6], y: [-6, 6], grid: 1 })
      .curve(f.rational([1, -1], [1, -3, 2]), {
        features: ["asymptotes"],
      })
      .scene(),
  },
  {
    name: "Exponential and logarithm",
    scene: graph({ x: [-4, 8], y: [-4, 8] })
      .curve(f.exp(1, 2, { k: -2 }), { features: ["asymptotes", "yint"] })
      .curve(f.log(2, 2, { h: -1 }), {
        color: "warm",
        features: ["asymptotes"],
      })
      .scene(),
  },
  {
    name: "Sine and tangent",
    scene: graph({ x: [-7, 7], y: [-3, 3], tick: 1 })
      .curve(f.sin(2, 1), { features: ["zeros"] })
      .curve(f.tan(1, 0.5), { color: "warm", features: ["asymptotes"] })
      .scene(),
  },
  {
    name: "Piecewise: open and closed endpoints",
    scene: graph({ x: [-5, 5], y: [-3, 6] })
      .curve(f.poly(-1, 1), { domain: [-5, 1], ends: ["arrow", "open"] })
      .curve(f.poly(2), {
        domain: [1, 3],
        ends: ["closed", "closed"],
        color: "warm",
      })
      .curve(f.poly(1, -1), { domain: [3, 5], ends: ["open", "arrow"] })
      .scene(),
  },
  {
    name: "System of inequalities: the feasible region",
    scene: graph({ x: [-1, 8], y: [-1, 8] })
      .shade("x + y <= 6", "y > x - 2", "x >= 0", "y >= 0")
      .point(2, 3, "P")
      .scene(),
  },
  {
    name: "Half-plane: y < 2x + 1",
    scene: graph({ x: [-5, 5], y: [-5, 5] })
      .shade("y < 2x + 1")
      .scene(),
  },
  {
    name: "Circle, slope triangle and secant",
    scene: graph({ x: [-6, 6], y: [-6, 6] })
      .circle([1, 1], 3, { radius: true })
      .curve(f.poly(0.25, 0, -3), { color: "gold" })
      .secant(0, -2, 4)
      .slope([-2, -2], [4, 1])
      .scene(),
  },
  {
    name: "Scatter plot with residuals",
    scene: graph({ x: [0, 10], y: [0, 10], axisNames: ["hours", "score"] })
      .scatter(
        [
          [1, 2.5],
          [2, 2.2],
          [3, 4.4],
          [4, 4.1],
          [5, 6.3],
          [6, 5.6],
          [7, 7.9],
          [8, 7.4],
          [9, 9.2],
        ],
        { m: 0.85, b: 1.4 },
        true,
      )
      .scene(),
  },
  {
    name: "Area model: 34 × 6 (problem)",
    scene: areaModel(34, 6).scene({ title: "34 × 6 as an area model" }),
  },
  {
    name: "Area model: 34 × 6 (lesson)",
    reveal: true,
    scene: areaModel(34, 6).scene({ title: "34 × 6 as an area model" }),
  },
  {
    name: "Area model: 23 × 15",
    reveal: true,
    scene: areaModel(23, 15).scene(),
  },
  {
    name: "Area model: 345 × 7, not to scale",
    reveal: true,
    scene: areaModel(345, 7).scene(),
  },
  {
    name: "Area model: (x + 3)(x + 2)",
    reveal: false,
    scene: areaModel([5, 3], [4, 2], {
      acrossLabels: ["x", "3"],
      downLabels: ["x", "2"],
      products: "none",
      scale: "schematic",
    }).scene(),
  },
  {
    name: "Array: 7 × 6 split after 4 rows",
    scene: array(7, 6, { splitAfterRow: 4 }).scene(),
  },
  { name: "Ten-frames: 8 + 5", scene: tenFrame(8, 5).scene() },
  { name: "Base ten: 247", scene: baseTen(247).scene() },
  {
    name: "Fraction bars: compare 3/4 and 2/3",
    scene: fractionBar(
      { shaded: 3, parts: 4 },
      { shaded: 2, parts: 3 },
    ).scene(),
  },
  {
    name: "Fraction bars: 5/4",
    scene: fractionBar({ shaded: 5, parts: 4, wholes: 2 }).scene(),
  },
  { name: "Clock: 3:45", scene: clock(3, 45).scene({ width: 280 }) },
  // Exponential growth and logarithms: tables, bars and curves.
  ...Object.entries(exponentialLessonScenes).map(([name, scene]) => ({
    name: `Exponential lesson: ${name}`,
    scene,
    reveal: true,
  })),
  {
    name: "Table: constant ratio, a later value asked",
    scene: stepTable([0, 1, 2, 3], ["5", "15", "45", "135"], "×3"),
  },
  {
    name: "Graph: exponential through marked points",
    scene: exponentialGraph(3, 2, [0, 1, 2]),
  },
  { name: "Graph: line against exponential", scene: raceGraph(12, 20, 2, 8) },
  { name: "Graph: log curve, height asked", scene: logGraph(2, 16, 17) },
  {
    name: "Bars: two offers by day",
    scene: raceBars(
      [0, 1, 2, 3],
      { label: "Offer A", values: [40, 65, 90, 115] },
      { label: "Offer B", values: [1, 2, 4, 8] },
      "Day",
    ),
  },
];

/** Legacy figures drawn through both renderers for screenshot parity. */
export const parityFigures: SemanticFigure[] = [
  { kind: "number-line", min: 0, max: 20, points: [6, 14] },
  { kind: "number-line", min: -10, max: 10, points: [-7, -6, 3] },
  { kind: "clock", hour: 10, minute: 10 },
  { kind: "clock", hour: 4, minute: 35 },
  {
    kind: "coordinate-plane",
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    points: [
      { x: -3, y: -1, label: "A" },
      { x: 2, y: 4, label: "B" },
    ],
    lines: [{ m: 1, b: 2 }],
  },
  {
    kind: "coordinate-plane",
    xMin: 0,
    xMax: 8,
    yMin: 0,
    yMax: 8,
    points: [{ x: 3, y: 5, label: "P" }],
  },
  { kind: "ten-frame", first: 7, second: 2, capacity: 10 },
  { kind: "ten-frame", first: 9, second: 6, capacity: 20 },
];
