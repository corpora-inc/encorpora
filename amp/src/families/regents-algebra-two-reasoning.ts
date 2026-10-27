import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraTwoReasoningGenerate,
  regentsAlgebraTwoReasoningTemplates,
} from "../math/regents-algebra-two-reasoning-practice";
import {
  regentsAlgebraTwoReasoningFacetMappings,
  regentsAlgebraTwoReasoningLessons,
  regentsAlgebraTwoReasoningMethods,
  regentsAlgebraTwoReasoningPrinciples,
} from "../content/regents-algebra-two-reasoning-lessons";

export const family = {
  id: "regents-algebra-two-reasoning",
  practice: {
    templates: regentsAlgebraTwoReasoningTemplates,
    generate: regentsAlgebraTwoReasoningGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraTwoReasoningLessons,
  methods: regentsAlgebraTwoReasoningMethods,
  principles: regentsAlgebraTwoReasoningPrinciples,
  facetMappings: regentsAlgebraTwoReasoningFacetMappings,
  archetypeLinks: {
    "study-design-classify": ["study.scope"],
    "quartic-factored-form": ["expression.factor"],
    "cubic-quotient-factored": [
      "expression.rational",
      "expression.polynomial-division",
    ],
    "complete-square-first-steps": [
      "nonlinear.quadratic",
      "linear.step-justification",
    ],
    "exponential-points-statement": ["exponential.context"],
    "rational-abs-solution-count": [
      "equation.graphical-solution",
      "nonlinear.rational-radical",
    ],
  },
} satisfies ContentFamily;
