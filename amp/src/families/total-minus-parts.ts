import type { ContentFamily } from "./registry/types";
import {
  totalMinusPartsGenerate,
  totalMinusPartsTemplates,
} from "../math/total-minus-parts-practice";
import {
  totalMinusPartsFacetMappings,
  totalMinusPartsLessons,
  totalMinusPartsMethods,
  totalMinusPartsPrinciples,
} from "../content/total-minus-parts-lessons";

export const family = {
  id: "total-minus-parts",
  practice: {
    templates: totalMinusPartsTemplates,
    generate: totalMinusPartsGenerate,
    preserveAlgebra: true,
  },
  lessons: totalMinusPartsLessons,
  methods: totalMinusPartsMethods,
  principles: totalMinusPartsPrinciples,
  facetMappings: totalMinusPartsFacetMappings,
  archetypeLinks: {
    "bag-totals-chain": ["number.add-subtract-story"],
    "fraction-total-minus-parts": ["fractions.add-subtract-unlike"],
  },
} satisfies ContentFamily;
