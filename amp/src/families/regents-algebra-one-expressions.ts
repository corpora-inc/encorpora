import type { ContentFamily } from "./registry/types";
import {
  regentsAlgebraOneExpressionGenerate,
  regentsAlgebraOneExpressionTemplates,
} from "../math/regents-algebra-one-expressions-practice";
import {
  regentsAlgebraOneExpressionFacetMappings,
  regentsAlgebraOneExpressionLessons,
  regentsAlgebraOneExpressionMethods,
  regentsAlgebraOneExpressionPrinciples,
} from "../content/regents-algebra-one-expressions-lessons";

export const family = {
  id: "regents-algebra-one-expressions",
  practice: {
    templates: regentsAlgebraOneExpressionTemplates,
    generate: regentsAlgebraOneExpressionGenerate,
    preserveAlgebra: true,
  },
  lessons: regentsAlgebraOneExpressionLessons,
  methods: regentsAlgebraOneExpressionMethods,
  principles: regentsAlgebraOneExpressionPrinciples,
  facetMappings: regentsAlgebraOneExpressionFacetMappings,
  archetypeLinks: {
    "rate-unit-chain": ["ratio.units"],
    "negative-monomial-power": ["expression.exponent-rules"],
    "combine-unlike-radicals": ["expression.radical-simplify"],
    "complete-square-equation": ["nonlinear.quadratic"],
    "complete-square-step-property": ["linear.step-justification"],
    "polynomial-structure": ["expression.polynomial-structure"],
  },
} satisfies ContentFamily;
