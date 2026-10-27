import type { ContentFamily } from "./registry/types";
import {
  dataMeasureGenerate,
  dataMeasureTemplates,
} from "../math/data-measure-practice";
import {
  dataMeasureFacetMappings,
  dataMeasureLessons,
  dataMeasureMethods,
  dataMeasurePrinciples,
} from "../content/data-measure-lessons";

export const family = {
  id: "data-measure",
  practice: {
    templates: dataMeasureTemplates,
    generate: dataMeasureGenerate,
    preserveAlgebra: true,
  },
  lessons: dataMeasureLessons,
  methods: dataMeasureMethods,
  principles: dataMeasurePrinciples,
  facetMappings: dataMeasureFacetMappings,
  archetypeLinks: {
    // univariate.mode is merged into univariate.center.
    "mode-of-data": ["univariate.center"],
    "measure-meaning-choice": ["univariate.measure-meaning"],
  },
} satisfies ContentFamily;
