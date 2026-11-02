import {
  areaModel,
  circleDiagram,
  fractionBar,
  graph,
  numberLine,
  triangle,
} from "../math/scene/author";
import type { Scene } from "../math/scene/spec";
import type { GlossaryFigure } from "./types";

/** Small figures for term cards, from scenes-v1 builders only, so every
 * client that can open a lesson can draw them. */
const builders: Record<GlossaryFigure, () => Scene> = {
  "right-triangle-parts": () =>
    triangle([
      [0, 0],
      [4, 0],
      [0, 3],
    ])
      .angle(0, { mark: "right" })
      .side(0, { label: "leg" })
      .side(1, { label: "hypotenuse", color: "accent" })
      .side(2, { label: "leg" })
      .scene({
        note: "A right triangle: the two legs meet at the right angle; the hypotenuse is opposite it.",
      }),
  "fraction-parts": () =>
    fractionBar({ shaded: 3, parts: 4, label: "3/4" }).scene({
      note: "One whole cut into 4 equal parts with 3 shaded: numerator 3, denominator 4.",
    }),
  "number-line-integers": () =>
    numberLine({ min: -5, max: 5, step: 1, labels: "auto" })
      .mark(-3)
      .mark(2)
      .scene({
        note: "Integers on a number line: negative numbers left of 0, positive numbers right of it.",
      }),
  "area-model": () =>
    areaModel(34, 6).products("shown").scene({
      note: "34 × 6 as a rectangle split into 30 × 6 and 4 × 6.",
    }),
  "slope-rise-run": () =>
    graph({ x: [-1, 6], y: [-1, 6] })
      .line({
        through: [
          [1, 1],
          [3, 5],
        ],
      })
      .slope([1, 1], [3, 5], "shown")
      .scene({
        note: "From one point to another, the line rises 4 while it runs 2 to the right: slope 4/2 = 2.",
      }),
  "circle-radius-diameter": () =>
    circleDiagram({
      points: [
        { name: "A", at: 60 },
        { name: "B", at: 180 },
        { name: "C", at: 0 },
      ],
      center: true,
      segments: [
        { from: "O", to: "A", label: "radius", color: "accent" },
        { from: "B", to: "C", label: "diameter" },
      ],
    }).scene({
      note: "A radius runs from the center to the circle; a diameter crosses the circle through the center.",
    }),
};

export const glossaryFigures = Object.keys(builders) as GlossaryFigure[];

export function glossaryFigure(figure: GlossaryFigure): Scene {
  return builders[figure]();
}
