import type { ContentFamily } from "./registry/types";
import {
  similarSolidChainGenerate,
  similarSolidChainTemplates,
} from "../math/similar-solid-chain-practice";
import {
  similarSolidChainFacetMappings,
  similarSolidChainLessons,
  similarSolidChainMethods,
  similarSolidChainPrinciples,
} from "../content/similar-solid-chain-lessons";

export const family = {
  id: "similar-solid-chain",
  practice: {
    templates: similarSolidChainTemplates,
    generate: similarSolidChainGenerate,
    preserveAlgebra: true,
  },
  lessons: similarSolidChainLessons,
  methods: similarSolidChainMethods,
  principles: similarSolidChainPrinciples,
  facetMappings: similarSolidChainFacetMappings,
  archetypeLinks: {
    "similar-solid-scale-chain": ["measure.scale"],
  },
} satisfies ContentFamily;
