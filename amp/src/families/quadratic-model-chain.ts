import type { ContentFamily } from "./registry/types";
import {
  heightModelChainGenerate,
  heightModelChainTemplates,
} from "../math/height-model-chain-practice";
import {
  heightModelChainFacetMappings,
  heightModelChainLessons,
  heightModelChainMethods,
  heightModelChainPrinciples,
} from "../content/height-model-chain-lessons";

export const family = {
  id: "quadratic-model-chain",
  practice: {
    templates: heightModelChainTemplates,
    generate: heightModelChainGenerate,
    preserveAlgebra: true,
  },
  lessons: heightModelChainLessons,
  methods: heightModelChainMethods,
  principles: heightModelChainPrinciples,
  facetMappings: heightModelChainFacetMappings,
  archetypeLinks: {
    "quadratic-model-chain": [
      "quadratic.context",
      "nonlinear.quadratic-from-data",
    ],
  },
} satisfies ContentFamily;
