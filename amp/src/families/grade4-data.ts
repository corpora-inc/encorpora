import type { ContentFamily } from "./registry/types";
import {
  generateGrade4DataProblem,
  grade4DataTemplates,
} from "../math/grade4-data-practice";
import {
  grade4DataFacetMappings,
  grade4DataLessons,
  grade4DataMethods,
  grade4DataPrinciples,
} from "../content/grade4-data-lessons";

export const family = {
  id: "grade4-data",
  practice: {
    templates: grade4DataTemplates,
    generate: generateGrade4DataProblem,
    preserveAlgebra: true,
  },
  lessons: grade4DataLessons,
  methods: grade4DataMethods,
  principles: grade4DataPrinciples,
  facetMappings: grade4DataFacetMappings,
  archetypeLinks: {
    "line-plot-build-slots": ["data.fraction-line-plot"],
    "line-plot-data-match": ["data.fraction-line-plot"],
    "line-plot-center-range": [
      "data.fraction-line-plot",
      "univariate.center",
      "univariate.spread",
    ],
    "frequency-table-grade4": ["data.frequency-table-read"],
    "scaled-bar-grade4": ["data.graph-read"],
  },
  connections: [
    {
      from: "frequency-bar-graphs",
      to: "distribution-plots",
      kind: "extension",
      explanation:
        "A frequency table counts how many numbers fall in each equal interval. A histogram draws those counts as bars.",
      templateIds: ["frequency-table-grade4"],
    },
  ],
} satisfies ContentFamily;
