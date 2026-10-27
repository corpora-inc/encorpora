import type { ContentFamily } from "./registry/types";
import {
  conversionChainGenerate,
  conversionChainTemplates,
} from "../math/conversion-chain-practice";
import {
  conversionChainFacetMappings,
  conversionChainLessons,
  conversionChainMethods,
  conversionChainPrinciples,
} from "../content/conversion-chain-lessons";

export const family = {
  id: "conversion-chain",
  practice: {
    templates: conversionChainTemplates,
    generate: conversionChainGenerate,
    preserveAlgebra: true,
  },
  lessons: conversionChainLessons,
  methods: conversionChainMethods,
  principles: conversionChainPrinciples,
  facetMappings: conversionChainFacetMappings,
  archetypeLinks: {
    "conversion-chain-story": ["measure.customary-units", "ratio.units"],
  },
} satisfies ContentFamily;
