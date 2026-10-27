import type { ContentFamily } from "./registry/types";
import {
  percentChainGenerate,
  percentChainTemplates,
} from "../math/percent-chain-practice";
import {
  percentChainFacetMappings,
  percentChainLessons,
  percentChainMethods,
  percentChainPrinciples,
} from "../content/percent-chain-lessons";

export const family = {
  id: "percent-chain",
  practice: {
    templates: percentChainTemplates,
    generate: percentChainGenerate,
    preserveAlgebra: true,
  },
  lessons: percentChainLessons,
  methods: percentChainMethods,
  principles: percentChainPrinciples,
  facetMappings: percentChainFacetMappings,
  archetypeLinks: {
    "percent-chain": ["percent.change", "percent.successive"],
  },
} satisfies ContentFamily;
