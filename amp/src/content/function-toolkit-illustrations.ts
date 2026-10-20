import { f } from "../math/scene/author";
import type { Scene } from "../math/scene/spec";
import {
  compareScene,
  machineScene,
  piecewiseWalkthrough,
  reflectionScene,
  transformWalkthrough,
  type Piece,
} from "../math/function-toolkit-scenes";

/** Lesson models for the function toolkit, drawn revealed and played. */
const example: Piece[] = [
  { m: 2, b: 1, lo: null, hi: 2, loIn: false, hiIn: false },
  { m: -1, b: 6, lo: 2, hi: null, loIn: true, hiIn: false },
];
const absPieces: Piece[] = [
  { m: -1, b: 3, lo: null, hi: 1, loIn: false, hiIn: false },
  { m: 1, b: 1, lo: 1, hi: null, loIn: true, hiIn: false },
];
export const functionToolkitIllustrations = {
  // f(x) = 2x + 1 for x < 2 and −x + 6 for x ≥ 2: a jump at 2, f(2) = 4.
  "piecewise-pieces": piecewiseWalkthrough(
    example,
    ["2x + 1", "-x + 6"],
    ["x < 2", "x \\ge 2"],
    2,
  ),
  // |x − 1| + 2 is −x + 3 left of 1 and x + 1 from 1 on.
  "abs-pieces": piecewiseWalkthrough(
    absPieces,
    ["-x + 3", "x + 1"],
    ["x < 1", "x \\ge 1"],
  ),
  // y = x² slides 1 right, stretches by −2 (through flat), then rises 3.
  "transform-parent": transformWalkthrough(
    "square",
    -2,
    1,
    3,
    "x^2",
    "-2(x - 1)^2 + 3",
  ),
  // 3 → g → 10 → f → 17, with g(x) = x² + 1 and f(x) = 2x − 3.
  "composition-machine": machineScene(
    { name: "g", rule: "g(x) = x^2 + 1" },
    { name: "f", rule: "f(x) = 2x - 3" },
    ["3", "10", "17"],
    true,
  ),
  // f(x) = 2x − 3 and f⁻¹(x) = (x + 3)/2 mirror in y = x: (4, 5) ↔ (5, 4).
  "inverse-reflection": reflectionScene(
    f.poly(2, -3),
    [-1, 5],
    f.poly(0.5, 1.5),
    [-5, 7],
    [4, 5],
    [-5, 7],
    ["y = f(x)", "y = f^{-1}(x)"],
  ),
  // x² on x ≥ 0 and √x mirror in y = x: (2, 4) ↔ (4, 2).
  "inverse-restricted": reflectionScene(
    f.poly(1, 0, 0),
    [0, 2.6],
    f.sqrt(1, 0, 0),
    [0, 6.5],
    [2, 4],
    [-1, 7],
    ["y = x^2", "y = √x"],
  ),
  // f(x) = −(x − 1)² + 5 drawn; g's table −(x + 1)² + 3 at x = −3 … 1.
  "compare-formula-table": compareScene(
    f.vertex(-1, 1, 5),
    [
      [-3, -1],
      [-2, 2],
      [-1, 3],
      [0, 2],
      [1, -1],
    ],
    { x: [-5, 5], y: [-6, 6], grid: 1 },
  ),
} as const satisfies Record<string, Scene>;
