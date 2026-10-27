import type { ContentFamily } from "./registry/types";
import {
  lineGraphReadGenerate,
  lineGraphReadTemplates,
} from "../math/line-graph-read-practice";
import {
  lineGraphReadFacetMappings,
  lineGraphReadLessons,
  lineGraphReadMethods,
  lineGraphReadPrinciples,
} from "../content/line-graph-read-lessons";

export const family = {
  id: "line-graph-read",
  practice: {
    templates: lineGraphReadTemplates,
    generate: lineGraphReadGenerate,
    preserveAlgebra: true,
  },
  lessons: lineGraphReadLessons,
  methods: lineGraphReadMethods,
  principles: lineGraphReadPrinciples,
  facetMappings: lineGraphReadFacetMappings,
  archetypeLinks: {
    "line-graph-reader": ["data.graph-read"],
    "dot-plot-arithmetic": ["data.fraction-line-plot", "univariate.displays"],
  },
} satisfies ContentFamily;
