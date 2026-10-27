import {
  figureChoiceFormatsFacetMappings,
  figureChoiceFormatsLessons,
  figureChoiceFormatsMethods,
  figureChoiceFormatsPrinciples,
} from "../content/figure-choice-formats-lessons";
import {
  figureChoiceFormatsTemplates,
  generateFigureChoiceFormatsProblem,
} from "../math/figure-choice-formats-practice";
import type { ContentFamily } from "./registry/types";

/** Choose the graph of paired values, of a signed point or of a shifted
 * graph (figure-choice-v1). */
export const family = {
  id: "figure-choice-formats",
  practice: {
    templates: figureChoiceFormatsTemplates,
    generate: generateFigureChoiceFormatsProblem,
    preserveAlgebra: true,
  },
  lessons: figureChoiceFormatsLessons,
  methods: figureChoiceFormatsMethods,
  principles: figureChoiceFormatsPrinciples,
  facetMappings: figureChoiceFormatsFacetMappings,
  archetypeLinks: {
    "graph-of-paired-values": [
      "data.table-to-graph",
      "pattern.graph-relationship",
    ],
    "point-on-signed-grid": ["coordinate.plane-point"],
    "graph-after-shift": ["nonlinear.transform"],
  },
} satisfies ContentFamily;
