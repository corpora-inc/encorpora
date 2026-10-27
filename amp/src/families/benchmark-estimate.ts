import type { ContentFamily } from "./registry/types";
import {
  benchmarkEstimateGenerate,
  benchmarkEstimateTemplates,
} from "../math/benchmark-estimate-practice";
import {
  benchmarkEstimateFacetMappings,
  benchmarkEstimateLessons,
  benchmarkEstimateMethods,
  benchmarkEstimatePrinciples,
} from "../content/benchmark-estimate-lessons";

export const family = {
  id: "benchmark-estimate",
  practice: {
    templates: benchmarkEstimateTemplates,
    generate: benchmarkEstimateGenerate,
    preserveAlgebra: true,
  },
  lessons: benchmarkEstimateLessons,
  methods: benchmarkEstimateMethods,
  principles: benchmarkEstimatePrinciples,
  facetMappings: benchmarkEstimateFacetMappings,
  archetypeLinks: {
    "benchmark-fraction-estimate": ["number.fraction-benchmark-estimate"],
  },
} satisfies ContentFamily;
