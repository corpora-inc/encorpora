import {
  equationSlotsFacetMappings,
  equationSlotsLessons,
  equationSlotsMethods,
  equationSlotsPrinciples,
} from "../content/equation-slots-lessons";
import {
  equationSlotsGenerate,
  equationSlotsTemplates,
} from "../math/equation-slots-practice";
import type { ContentFamily } from "./registry/types";

/** Build equations, inequalities, rules and sentences piece by piece
 * (multi-part-choice-v1). */
export const family = {
  id: "equation-slots",
  practice: {
    templates: equationSlotsTemplates,
    generate: equationSlotsGenerate,
    preserveAlgebra: true,
  },
  lessons: equationSlotsLessons,
  methods: equationSlotsMethods,
  principles: equationSlotsPrinciples,
  facetMappings: equationSlotsFacetMappings,
  archetypeLinks: {
    "booth-equation-slots": ["expression.verbal", "linear.context"],
    "budget-inequality-slots": ["inequality.context"],
    "unit-fraction-division-slots": ["fractions.divide-context"],
    "array-division-slots": ["whole.division-facts"],
    "story-operations-slots": ["whole.multiplicative-stories"],
    "delivery-operations-slots": ["whole.multi-step-stories"],
    "table-equation-slots": ["function.relation-equation"],
    "rule-table-fill-slots": ["pattern.rule"],
    "unit-price-sentence-slots": ["ratio.proportion"],
    "cylinder-volume-slots": ["measure.volume"],
    "dilation-rule-slots": ["transformation.dilation"],
    "transformation-rule-slots": [
      "transformation.image",
      "transformation.identify",
    ],
    "exponent-quotient-slots": ["expression.exponent-rules"],
    "square-root-solutions-slots": ["nonlinear.quadratic"],
    "function-shift-sentence": ["nonlinear.transform"],
  },
} satisfies ContentFamily;
