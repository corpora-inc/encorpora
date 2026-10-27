import type { ContentFamily } from "./registry/types";
import {
  perimeterAreaChainGenerate,
  perimeterAreaChainTemplates,
} from "../math/perimeter-area-chain-practice";
import {
  perimeterAreaChainFacetMappings,
  perimeterAreaChainLessons,
  perimeterAreaChainMethods,
  perimeterAreaChainPrinciples,
} from "../content/perimeter-area-chain-lessons";

export const family = {
  id: "perimeter-area-chain",
  practice: {
    templates: perimeterAreaChainTemplates,
    generate: perimeterAreaChainGenerate,
    preserveAlgebra: true,
  },
  lessons: perimeterAreaChainLessons,
  methods: perimeterAreaChainMethods,
  principles: perimeterAreaChainPrinciples,
  facetMappings: perimeterAreaChainFacetMappings,
  archetypeLinks: {
    "perimeter-area-chain": ["measure.area"],
  },
} satisfies ContentFamily;
