import {
  complexClauseItemsFacetMappings,
  complexClauseItemsLessons,
  complexClauseItemsMethods,
  complexClauseItemsPrinciples,
} from "../content/complex-clause-items-lessons";
import {
  complexClauseItemsTemplates,
  generateComplexClauseItems,
} from "../math/complex-clause-items-practice";
import type { ContentFamily } from "./registry/types";

/** Modulus from a conjugate, and plotting a real or imaginary number. */
export const family = {
  id: "complex-clause-items",
  practice: {
    templates: complexClauseItemsTemplates,
    generate: generateComplexClauseItems,
    preserveAlgebra: true,
  },
  lessons: complexClauseItemsLessons,
  methods: complexClauseItemsMethods,
  principles: complexClauseItemsPrinciples,
  facetMappings: complexClauseItemsFacetMappings,
  archetypeLinks: {
    "complex-modulus-via-conjugate": ["complex.arithmetic"],
    "complex-axis-number-plot": ["complex.plane"],
  },
} satisfies ContentFamily;
