import { f, graph } from "../math/scene/author";
import type { Scene } from "../math/scene/spec";
import {
  shiftWalkthrough,
  syntheticTableau,
  zeroSlide,
  zerosGraph,
} from "../math/polynomial-scenes";
import { factorTiles } from "../math/tile-walkthroughs";

/** Lesson models for quadratic and polynomial structure, drawn revealed. */
export const quadraticStructureIllustrations = {
  // y = x² − 2x − 3: vertex (1, −4), zeros −1 and 3, axis x = 1.
  "parabola-features": graph({ id: "g", x: [-3, 5], y: [-5, 6], grid: 1 })
    .curve(f.poly(1, -2, -3), {
      features: ["vertex", "zeros"],
      featureLabels: "shown",
    })
    .line({ x: 1 }, { dash: "dash", label: "x = 1" })
    .scene({
      title:
        "y = x² − 2x − 3: vertex (1, −4), zeros −1 and 3, axis of symmetry x = 1",
    }),
  // y = x² moved 2 right and 3 down: (x − 2)² − 3.
  "parabola-translate": shiftWalkthrough(2, -3, "y = (x - 2)^2 - 3"),
  // (x + 3)(x + 2) built region by region.
  "area-tiles-product": factorTiles([3, 1], [2, 1]),
  // (x + 2)(x − 1)(x − r) as r moves from 2 to 4.
  "zero-slide": zeroSlide(
    1,
    [-2, 1],
    [2, 3, 4],
    (r) => `(x + 2)(x - 1)(x - ${r})`,
  ),
  // (x + 1)²(x − 2): touches at −1, crosses at 2.
  "multiplicity-touch": zerosGraph(1, [-1, -1, 2]),
  // x³ − 2x² − 5x + 6 ÷ (x − 3): quotient x² + x − 2, remainder 0.
  "synthetic-layout": syntheticTableau(3, [1, -2, -5, 6], "filled").scene,
} as const satisfies Record<string, Scene>;
