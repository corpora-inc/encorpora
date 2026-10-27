import { figureChoiceFacetMappings } from "../content/figure-choice-coverage";
import {
  figureChoiceLessons,
  figureChoiceMethods,
  figureChoicePrinciples,
} from "../content/figure-choice-lessons";
import {
  figureChoiceTemplates,
  generateFigureChoiceProblem,
} from "../math/figure-choice-practice";
import type { ContentFamily } from "./registry/types";

/** Choose the drawn graph or number line (figure-choice-v1). */
export const family = {
  id: "figure-choice",
  practice: {
    templates: figureChoiceTemplates,
    generate: generateFigureChoiceProblem,
    preserveAlgebra: true,
  },
  lessons: figureChoiceLessons,
  methods: figureChoiceMethods,
  principles: figureChoicePrinciples,
  facetMappings: figureChoiceFacetMappings,
  archetypeLinks: {
    "graph-of-inequality-number-line": [
      "inequality.number-line",
      "inequality.solve",
    ],
    "graph-of-linear-rule": [
      "function.representations",
      "pattern.graph-relationship",
      "line.slope-equation",
    ],
    "graph-of-proportional-rate": [
      "pattern.graph-relationship",
      "function.proportional-identify",
      "function.representations",
    ],
    "graph-of-quadratic-or-exponential": [
      "nonlinear.representations",
      "nonlinear.transform",
      "nonlinear.features",
      "exponential.graph-features",
    ],
  },
} satisfies ContentFamily;
