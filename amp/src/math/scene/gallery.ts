import type { SemanticFigure } from "../contracts";
import {
  angle,
  protractor,
  areaModel,
  array,
  baseTen,
  clock,
  f,
  fractionBar,
  graph,
  numberLine,
  rowBars,
  polyArea,
  table,
  lineTable,
  tenFrame,
} from "./author";
import type { Scene } from "./spec";

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
    name: "Tiles: (x + 3)(x + 2), terms to find",
    scene: polyArea(
      [
        [1, 1],
        [3, 0],
      ],
      [
        [1, 1],
        [2, 0],
      ],
    ).scene(),
  },
  {
    name: "Tiles: (x − 2)(x + 4), revealed",
    reveal: true,
    scene: polyArea(
      [
        [1, 1],
        [-2, 0],
      ],
      [
        [1, 1],
        [4, 0],
      ],
    ).scene(),
  },
  {
    name: "Tiles: (2x + 1)(x + 3), revealed",
    reveal: true,
    scene: polyArea(
      [
        [2, 1],
        [1, 0],
      ],
      [
        [1, 1],
        [3, 0],
      ],
    ).scene(),
  },
  {
    name: "Tiles: x² + 6x missing its corner",
    scene: polyArea(
      [
        [1, 1],
        [3, 0],
      ],
      [
        [1, 1],
        [3, 0],
      ],
      {
        products: "shown",
        missing: [[1, 1]],
      },
    ).scene(),
  },
  {
    name: "Tiles: 6x(x³ − 2x + 5), not to scale, revealed",
    reveal: true,
    scene: polyArea(
      [
        [1, 3],
        [-2, 1],
        [5, 0],
      ],
      [[6, 1]],
    ).scene(),
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
  {
    name: "Protractor: 0 on the left, ray at 130",
    scene: protractor([180, 130], ["A", "B", "C"]).scene({ width: 340 }),
  },
  {
    name: "Protractor: 0 on the right, ray at 75",
    scene: protractor([0, 75], ["P", "Q", "R"]).scene({ width: 340 }),
  },
  {
    name: "Angle: parts with the unknown masked",
    scene: angle({
      rays: [20, 65, 140],
      labels: { vertex: "B", ends: ["A", "C", "D"] },
      marks: [
        { from: 0, to: 1, measure: true },
        { from: 1, to: 2, measure: true, derived: true },
      ],
    }).scene({ width: 340 }),
  },
  {
    name: "Angle: a right angle with arrows",
    scene: angle({
      rays: [30, 120],
      arrows: true,
      marks: [{ from: 0, to: 1 }],
    }).scene({ width: 300 }),
  },
  {
    name: "Scatter plot: unlike axis units, trend line through two marked points",
    scene: graph({
      x: [0, 10],
      y: [30, 100],
      grid: [1, 10],
      aspect: (0.72 * 10) / 70,
      axisNames: ["hours studied", "test score"],
    })
      .scatter(
        [
          [1, 50],
          [2, 55],
          [3, 58],
          [4, 66],
          [5, 70],
          [6, 72],
          [7, 82],
          [8, 84],
          [9, 88],
          [10, 96],
        ],
        { m: 5, b: 45 },
      )
      .point(2, 55, undefined, { open: true })
      .point(8, 85, undefined, { open: true })
      .scene(),
  },
  {
    name: "Scatter plot: a flat trial line, the trend line and a prediction (lesson)",
    reveal: true,
    scene: graph({
      id: "g",
      x: [0, 10],
      y: [0, 30],
      grid: [1, 5],
      aspect: 0.24,
      axisNames: ["age (years)", "value (thousand $)"],
    })
      .scatter(
        [
          [1, 26],
          [3, 21],
          [5, 18],
          [7, 12],
          [9, 5],
        ],
        { m: -2, b: 26 },
        true,
      )
      .trial(0, 16)
      .predict(6)
      .scene(),
  },
  {
    name: "Row bars: counts on one scale, then each row as 100%",
    scene: rowBars({
      parts: ["Yes", "No"],
      rows: [
        { label: "Grade 7", counts: [18, 2] },
        { label: "Grade 8", counts: [24, 36] },
      ],
    }).scene(),
  },
  {
    name: "Two-way table: the cell to find (problem)",
    scene: table({
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
  },
  {
    name: "Two-way table: revealed (lesson)",
    reveal: true,
    scene: table({
      title: "Has a curfew",
      columns: ["Yes", "No", "Total"],
      rows: [
        { label: "Grade 7", cells: [18, 2, 20] },
        { label: "Grade 8", cells: [null, 36, 60] },
        { label: "Total", cells: [42, 38, 80] },
      ],
      sums: true,
      derived: [[1, 0]],
    }).scene(),
  },
  {
    name: "Line table: a function's values, one to find",
    scene: lineTable(
      [
        ["x", "0", "1", "2", "3", "4"],
        ["f(x)", "5", "8", "11", { text: "14", derived: true }, "17"],
      ],
      { highlight: [1, 4] },
    ).scene({ title: "Values of f" }),
  },
  {
    name: "Line table: equation steps with their reasons",
    scene: lineTable(
      [
        ["3(x − 4) = 18", "Given"],
        ["3x − 12 = 18", "Distributive property"],
        ["3x = 30", { text: "Addition property of equality", derived: true }],
        ["x = 10", "Division property of equality"],
      ],
      { header: "none", rules: "rows", align: ["left", "left"] },
    ).scene({ title: "Solving 3(x − 4) = 18" }),
  },
  {
    name: "Line table: two equations stacked and added (lesson)",
    reveal: true,
    scene: lineTable(
      [
        ["", "2x", "+ 3y", "=", "12"],
        ["+", "x", "− 3y", "=", "3"],
        [
          "",
          { text: "3x", derived: true },
          "",
          "=",
          { text: "15", derived: true },
        ],
      ],
      {
        header: "none",
        rules: "rows",
        total: 2,
        align: ["center", "right", "left", "center", "right"],
      },
    ).scene({ title: "Adding the equations" }),
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
  {
    kind: "line-plot",
    denominator: 4,
    start: 4,
    end: 12,
    values: [5, 5, 6, 8, 8, 8, 9, 11, 12],
    mark: "x",
    unit: "inches",
  },
  {
    kind: "line-plot",
    denominator: 1,
    start: 0,
    end: 8,
    values: [1, 2, 2, 3, 7],
    mark: "dot",
    unit: "goals",
  },
  {
    kind: "double-dot-plot",
    start: 0,
    end: 12,
    groups: [
      { label: "Morning", values: [3, 4, 5, 5, 6, 7] },
      { label: "Afternoon", values: [6, 7, 8, 8, 9, 10] },
    ],
    unit: "push-ups",
  },
  {
    kind: "box-plot",
    start: 40,
    end: 100,
    step: 5,
    summary: [50, 65, 75, 85, 95],
    unit: "points",
  },
  {
    kind: "double-box-plot",
    start: 40,
    end: 100,
    step: 5,
    groups: [
      { label: "Class A", summary: [55, 65, 75, 85, 95] },
      { label: "Class B", summary: [45, 60, 65, 70, 90] },
    ],
    unit: "points",
  },
  { kind: "base-ten", hundreds: 2, tens: 4, ones: 7 },
  { kind: "base-ten", hundreds: 0, tens: 13, ones: 6 },
  { kind: "unit-array", rows: 7, columns: 6, splitAfterRow: 4 },
  { kind: "unit-array", rows: 3, columns: 9 },
];
