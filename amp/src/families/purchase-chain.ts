import type { ContentFamily } from "./registry/types";
import {
  purchaseChainGenerate,
  purchaseChainTemplates,
} from "../math/purchase-chain-practice";
import {
  purchaseChainFacetMappings,
  purchaseChainLessons,
  purchaseChainMethods,
  purchaseChainPrinciples,
} from "../content/purchase-chain-lessons";

export const family = {
  id: "purchase-chain",
  practice: {
    templates: purchaseChainTemplates,
    generate: purchaseChainGenerate,
    preserveAlgebra: true,
  },
  lessons: purchaseChainLessons,
  methods: purchaseChainMethods,
  principles: purchaseChainPrinciples,
  facetMappings: purchaseChainFacetMappings,
  archetypeLinks: {
    "wallet-purchase-chain": [
      "decimal.add-subtract",
      "money.change",
      "money.count-coins",
    ],
    "mixed-quantity-discount": ["percent.change"],
  },
} satisfies ContentFamily;
