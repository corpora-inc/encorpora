import type { ContentFamily } from "./registry/types";
import {
  generatePackEqualsProduct,
  packEqualsProductTemplates,
} from "../math/pack-equals-product-practice";
import {
  packEqualsProductFacetMappings,
  packEqualsProductLessons,
  packEqualsProductMethods,
  packEqualsProductPrinciples,
} from "../content/pack-equals-product-lessons";

export const family = {
  id: "pack-equals-product",
  practice: {
    templates: packEqualsProductTemplates,
    generate: generatePackEqualsProduct,
    preserveAlgebra: true,
  },
  lessons: packEqualsProductLessons,
  methods: packEqualsProductMethods,
  principles: packEqualsProductPrinciples,
  facetMappings: packEqualsProductFacetMappings,
  archetypeLinks: {
    "pack-equals-product-work": ["measure.unit-cube-volume"],
    "pack-equals-product-select": ["measure.unit-cube-volume"],
    "pack-equals-product-picture": ["measure.unit-cube-volume"],
  },
} satisfies ContentFamily;
