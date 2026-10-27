import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraTwoExponentialGenerate,
  regentsAlgebraTwoExponentialTemplates,
} from "../math/regents-algebra-two-exponential-practice";
import {
  regentsAlgebraTwoExponentialFacetMappings,
  regentsAlgebraTwoExponentialLessons,
  regentsAlgebraTwoExponentialMethods,
  regentsAlgebraTwoExponentialPrinciples,
} from "../content/regents-algebra-two-exponential-lessons";

export const family = {
  id: "regents-algebra-two-exponential",
  practice: {
    templates: regentsAlgebraTwoExponentialTemplates,
    generate: regentsAlgebraTwoExponentialGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraTwoExponentialLessons,
  methods: regentsAlgebraTwoExponentialMethods,
  principles: regentsAlgebraTwoExponentialPrinciples,
  facetMappings: regentsAlgebraTwoExponentialFacetMappings,
  archetypeLinks: {
    "geometric-series-total": ["sequence.series-sum"],
    "common-base-exponential": ["expression.exponent-rules"],
    "exponential-parameter-log": ["logarithm.solve"],
    "exponential-target-time": ["exponential.context", "logarithm.solve"],
    "growth-model-rewrite": ["exponential.form", "exponential.context"],
    "depreciation-recursion": ["sequence.rule-forms", "sequence.recursive"],
    "nonlinear-recursion-term": ["sequence.recursive"],
  },
} satisfies ContentFamily;
