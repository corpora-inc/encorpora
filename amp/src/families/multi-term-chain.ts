import type { ContentFamily } from "./registry/types";
import {
  multiTermChainGenerate,
  multiTermChainTemplates,
} from "../math/multi-term-chain-practice";
import {
  multiTermChainFacetMappings,
  multiTermChainLessons,
  multiTermChainMethods,
  multiTermChainPrinciples,
} from "../content/multi-term-chain-lessons";

export const family = {
  id: "multi-term-chain",
  practice: {
    templates: multiTermChainTemplates,
    generate: multiTermChainGenerate,
    preserveAlgebra: true,
  },
  lessons: multiTermChainLessons,
  methods: multiTermChainMethods,
  principles: multiTermChainPrinciples,
  facetMappings: multiTermChainFacetMappings,
  archetypeLinks: {
    "fraction-term-chain": [
      "fractions.add-subtract-unlike",
      "number.rational-operations",
    ],
    "decimal-rename-chain": [
      "decimal.add-subtract",
      "number.rational-operations",
    ],
    "price-count-chain": [
      "decimal.multiply",
      "decimal.add-subtract",
      "money.change",
    ],
    "dollar-rate-scale": ["ratio.proportion"],
    "signed-changes-sum": ["rational.signed-context"],
  },
  connections: [
    {
      from: "fraction-addition",
      to: "decimal-algorithms",
      kind: "related",
      explanation:
        "A fraction with a denominator such as 2, 4, 5 or 10 has an exact decimal form, so a sum that mixes both can be done in either form.",
      templateIds: ["decimal-rename-chain"],
    },
    {
      from: "decimal-arithmetic",
      to: "ratio-tables",
      kind: "application",
      explanation:
        "A price times a count is a unit rate scaled to a quantity. A rate table scales one hourly price to any number of hours the same way.",
      templateIds: ["dollar-rate-scale"],
    },
  ],
} satisfies ContentFamily;
