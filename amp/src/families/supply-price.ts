import type { ContentFamily } from "./registry/types";
import {
  supplyPriceGenerate,
  supplyPriceTemplates,
} from "../math/supply-price-practice";
import {
  supplyPriceFacetMappings,
  supplyPriceLessons,
  supplyPriceMethods,
  supplyPricePrinciples,
} from "../content/supply-price-lessons";

export const family = {
  id: "supply-price",
  practice: {
    templates: supplyPriceTemplates,
    generate: supplyPriceGenerate,
    preserveAlgebra: true,
  },
  lessons: supplyPriceLessons,
  methods: supplyPriceMethods,
  principles: supplyPricePrinciples,
  facetMappings: supplyPriceFacetMappings,
  archetypeLinks: { "supply-price-choice": ["finance.supply-price"] },
} satisfies ContentFamily;
