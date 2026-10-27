import type { ContentFamily } from "./registry/types";
import {
  feeChainGenerate,
  feeChainTemplates,
} from "../math/fee-chain-practice";
import {
  feeChainFacetMappings,
  feeChainLessons,
  feeChainMethods,
  feeChainPrinciples,
} from "../content/fee-chain-lessons";

export const family = {
  id: "fee-chain",
  practice: {
    templates: feeChainTemplates,
    generate: feeChainGenerate,
    preserveAlgebra: true,
  },
  lessons: feeChainLessons,
  methods: feeChainMethods,
  principles: feeChainPrinciples,
  facetMappings: feeChainFacetMappings,
  archetypeLinks: {
    "fee-plan-chain": ["finance.fee-compare", "linear.context"],
    "fee-rule-choice": ["function.rule", "linear.context"],
    "fee-budget-inequality": ["inequality.context"],
  },
  connections: [
    {
      from: "linear-equation-modeling",
      to: "linear-inequalities",
      kind: "application",
      explanation:
        "A charge made of a fee plus a rate is a linear model. Asking which counts keep the charge within a budget turns the equation into an inequality that is solved the same way.",
      templateIds: ["fee-rule-choice", "fee-budget-inequality"],
    },
  ],
} satisfies ContentFamily;
