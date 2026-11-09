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
} satisfies ContentFamily;
