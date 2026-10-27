import type { ContentFamily } from "./registry/types";
import {
  numberOrderGenerate,
  numberOrderTemplates,
} from "../math/number-order-choice-practice";
import {
  numberOrderFacetMappings,
  numberOrderLessons,
  numberOrderMethods,
  numberOrderPrinciples,
} from "../content/number-order-lessons";

export const family = {
  id: "number-order",
  practice: {
    templates: numberOrderTemplates,
    generate: numberOrderGenerate,
    preserveAlgebra: true,
  },
  lessons: numberOrderLessons,
  methods: numberOrderMethods,
  principles: numberOrderPrinciples,
  facetMappings: numberOrderFacetMappings,
  archetypeLinks: {
    "number-between-bounds": ["place.compare-whole"],
    "true-comparison-statement": ["place.compare-whole"],
  },
} satisfies ContentFamily;
