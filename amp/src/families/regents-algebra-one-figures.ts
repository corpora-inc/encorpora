import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraOneFigureGenerate,
  regentsAlgebraOneFigureTemplates,
} from "../math/regents-algebra-one-figures-practice";
import {
  regentsAlgebraOneFigureFacetMappings,
  regentsAlgebraOneFigureLessons,
  regentsAlgebraOneFigureMethods,
  regentsAlgebraOneFigurePrinciples,
} from "../content/regents-algebra-one-figures-lessons";

export const family = {
  id: "regents-algebra-one-figures",
  practice: {
    templates: regentsAlgebraOneFigureTemplates,
    generate: regentsAlgebraOneFigureGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraOneFigureLessons,
  methods: regentsAlgebraOneFigureMethods,
  principles: regentsAlgebraOneFigurePrinciples,
  facetMappings: regentsAlgebraOneFigureFacetMappings,
  archetypeLinks: {
    "parabola-axis-vertex-graph": ["nonlinear.features"],
    "graph-is-function": ["function.identify"],
    "inequality-both-sides-number-line": [
      "inequality.solve",
      "inequality.number-line",
    ],
  },
} satisfies ContentFamily;
