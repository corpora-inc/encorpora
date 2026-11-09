import type { ContentFamily } from "./registry/types";
import {
  generateStrategyReasons,
  strategyReasonsTemplates,
} from "../math/strategy-reasons-practice";
import {
  strategyReasonsFacetMappings,
  strategyReasonsLessons,
  strategyReasonsMethods,
  strategyReasonsPrinciples,
} from "../content/strategy-reasons-lessons";

/** Why addition and subtraction strategies work (2.NBT.B.9): the reason for
 * a step, the step that breaks the amount, and what a carry or borrow means. */
export const family = {
  id: "strategy-reasons",
  practice: {
    templates: strategyReasonsTemplates,
    generate: generateStrategyReasons,
    preserveAlgebra: true,
  },
  lessons: strategyReasonsLessons,
  methods: strategyReasonsMethods,
  principles: strategyReasonsPrinciples,
  facetMappings: strategyReasonsFacetMappings,
  connections: [
    {
      from: "explain-strategies",
      to: "add-subtract-thousands",
      kind: "extension",
      explanation:
        "A strategy works because breaking a number by place, and trading 10 ones for 1 ten, keep the amount the same. The same reasons make quick addition and subtraction within 1000 work.",
      templateIds: ["strategy-step-reason"],
    },
  ],
} satisfies ContentFamily;
