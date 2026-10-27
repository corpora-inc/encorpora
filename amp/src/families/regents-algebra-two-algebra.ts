import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraTwoAlgebraGenerate,
  regentsAlgebraTwoAlgebraTemplates,
} from "../math/regents-algebra-two-algebra-practice";
import {
  regentsAlgebraTwoAlgebraFacetMappings,
  regentsAlgebraTwoAlgebraLessons,
  regentsAlgebraTwoAlgebraMethods,
  regentsAlgebraTwoAlgebraPrinciples,
} from "../content/regents-algebra-two-algebra-lessons";

export const family = {
  id: "regents-algebra-two-algebra",
  practice: {
    templates: regentsAlgebraTwoAlgebraTemplates,
    generate: regentsAlgebraTwoAlgebraGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraTwoAlgebraLessons,
  methods: regentsAlgebraTwoAlgebraMethods,
  principles: regentsAlgebraTwoAlgebraPrinciples,
  facetMappings: regentsAlgebraTwoAlgebraFacetMappings,
  archetypeLinks: {
    "nonmonic-complex-quadratic": ["complex.quadratic"],
    "inverse-exponential-root": ["function.inverse"],
    "circle-line-system": ["nonlinear.system"],
    "rational-two-denominators": ["nonlinear.rational-radical"],
    "trinomial-product": ["expression.polynomial"],
    "cubic-quotient-remainder": ["expression.polynomial-division"],
    "powers-of-i-sum": ["complex.arithmetic"],
    "two-radical-equation": ["nonlinear.rational-radical"],
    "absolute-value-linear": ["nonlinear.absolute"],
    "shifted-trinomial-factor": ["expression.factor"],
    "rational-exponent-product": [
      "expression.radical",
      "expression.exponent-rules",
    ],
  },
} satisfies ContentFamily;
